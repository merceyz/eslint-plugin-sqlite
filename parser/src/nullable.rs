use fallible_iterator::FallibleIterator;
use sqlite3_parser::ast;
use sqlite3_parser::lexer::sql::Parser;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NullableResult {
	NotNull,
	Null,
}

#[wasm_bindgen]
pub fn is_column_nullable(column: &str, table_name: &str, query: &str) -> Option<NullableResult> {
	let mut parser = Parser::new(query.as_bytes());
	let cmd = parser.next().ok()??;

	if let ast::Cmd::Stmt(ast::Stmt::Select(select)) = cmd {
		if let ast::OneSelect::Select {
			from: Some(from),
			where_clause,
			..
		} = select.body.select
		{
			let used_table_name = get_used_table_name(table_name, &from)?;

			if let Some(where_clause) = where_clause {
				let result = test_expr(column, used_table_name, &where_clause);
				if result.is_some() {
					return result;
				}
			}

			if let Some(joins) = &from.joins {
				// https://www.sqlite.org/lang_select.html#special_handling_of_cross_join_
				return joins.iter().find_map(|join| match join {
					ast::JoinedSelectTable {
						operator:
							ast::JoinOperator::Comma
							| ast::JoinOperator::TypedJoin(None)
							| ast::JoinOperator::TypedJoin(Some(ast::JoinType::INNER))
							| ast::JoinOperator::TypedJoin(Some(ast::JoinType::CROSS)),
						constraint: Some(ast::JoinConstraint::On(expr)),
						..
					} => test_expr(column, used_table_name, expr),
					_ => None,
				});
			}
		}
	}

	None
}

fn get_used_table_name<'a>(table_name: &str, from: &'a ast::FromClause) -> Option<&'a str> {
	if let Some(table) = &from.select {
		match table.as_ref() {
			ast::SelectTable::Table(name, as_name, _) if name.name.0 == table_name => {
				let used_table_name = match as_name {
					Some(ast::As::As(name)) => &name.0,
					Some(ast::As::Elided(name)) => &name.0,
					None => &name.name.0,
				};

				return Some(used_table_name);
			}
			_ => {}
		};
	}

	if let Some(joins) = &from.joins {
		// https://www.sqlite.org/lang_select.html#special_handling_of_cross_join_
		for join in joins {
			match join {
				ast::JoinedSelectTable {
					operator:
						ast::JoinOperator::Comma
						| ast::JoinOperator::TypedJoin(None)
						| ast::JoinOperator::TypedJoin(Some(ast::JoinType::INNER))
						| ast::JoinOperator::TypedJoin(Some(ast::JoinType::CROSS)),
					table: ast::SelectTable::Table(name, as_name, _),
					..
				} if name.name.0 == table_name => {
					let used_table_name = match as_name {
						Some(ast::As::As(name)) => &name.0,
						Some(ast::As::Elided(name)) => &name.0,
						None => &name.name.0,
					};

					return Some(used_table_name);
				}
				_ => {}
			}
		}
	}

	None
}

fn test_expr(column_name: &str, table_name: &str, expr: &ast::Expr) -> Option<NullableResult> {
	match expr {
		ast::Expr::Binary(
			left,
			ast::Operator::Equals
			| ast::Operator::NotEquals
			| ast::Operator::Greater
			| ast::Operator::GreaterEquals
			| ast::Operator::Less
			| ast::Operator::LessEquals,
			right,
		) if expr_matches_name(column_name, table_name, left)
			|| expr_matches_name(column_name, table_name, right) =>
		{
			return Some(NullableResult::NotNull);
		}
		ast::Expr::InList { lhs, .. } if expr_matches_name(column_name, table_name, lhs) => {
			return Some(NullableResult::NotNull);
		}
		ast::Expr::Like { lhs, rhs, .. }
			if expr_matches_name(column_name, table_name, lhs)
				|| expr_matches_name(column_name, table_name, rhs) =>
		{
			return Some(NullableResult::NotNull)
		}
		// column is null
		ast::Expr::Binary(left, ast::Operator::Is, right)
			if **right == ast::Expr::Literal(ast::Literal::Null)
				&& expr_matches_name(column_name, table_name, left) =>
		{
			return Some(NullableResult::Null);
		}
		// null is column
		ast::Expr::Binary(left, ast::Operator::Is, right)
			if **left == ast::Expr::Literal(ast::Literal::Null)
				&& expr_matches_name(column_name, table_name, right) =>
		{
			return Some(NullableResult::Null);
		}
		// column is not null
		ast::Expr::Binary(left, ast::Operator::IsNot, right)
			if **right == ast::Expr::Literal(ast::Literal::Null)
				&& expr_matches_name(column_name, table_name, left) =>
		{
			return Some(NullableResult::NotNull);
		}
		// null is not column
		ast::Expr::Binary(left, ast::Operator::IsNot, right)
			if **left == ast::Expr::Literal(ast::Literal::Null)
				&& expr_matches_name(column_name, table_name, right) =>
		{
			return Some(NullableResult::NotNull);
		}
		// column notnull
		// column not null
		ast::Expr::NotNull(expr) if expr_matches_name(column_name, table_name, expr) => {
			return Some(NullableResult::NotNull);
		}
		// expr and expr
		ast::Expr::Binary(left, ast::Operator::And, right) => {
			return test_expr(column_name, table_name, left)
				.or_else(|| test_expr(column_name, table_name, right));
		}
		// expr or expr
		ast::Expr::Binary(left, ast::Operator::Or, right) => {
			let left = test_expr(column_name, table_name, left);
			let right = test_expr(column_name, table_name, right);
			return match (left, right) {
				(Some(NullableResult::NotNull), Some(NullableResult::NotNull)) => {
					Some(NullableResult::NotNull)
				}
				(Some(NullableResult::Null), Some(NullableResult::Null)) => {
					Some(NullableResult::Null)
				}
				_ => None,
			};
		}
		// (expr)
		ast::Expr::Parenthesized(exprs) => {
			let mut iter = exprs
				.iter()
				.map(|expr| test_expr(column_name, table_name, expr));
			let first = iter.next()?;

			return iter.all(|x| x == first).then_some(first)?;
		}
		_ => {
			// println!("Unmatched expr: {:?}", expr);
		}
	}
	None
}

fn expr_matches_name(column_name: &str, table_name: &str, expr: &ast::Expr) -> bool {
	match expr {
		ast::Expr::Id(id) => id.0 == column_name,
		ast::Expr::Qualified(name, id) => name.0 == table_name && id.0 == column_name,
		_ => false,
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn returns_none_when_nothing_is_provable() {
		assert_eq!(is_column_nullable("id", "foo", "select * from foo"), None);
	}

	#[test]
	fn support_not_null() {
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo where id is not null"),
			Some(NullableResult::NotNull)
		);
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo where id notnull"),
			Some(NullableResult::NotNull)
		);
	}

	#[test]
	fn support_aliased_table() {
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where id notnull"),
			Some(NullableResult::NotNull)
		);
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where f.id notnull"),
			Some(NullableResult::NotNull)
		);
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where foo.id notnull"),
			None
		);
	}

	#[test]
	fn support_aliased_table_using_as() {
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo as f where id notnull"),
			Some(NullableResult::NotNull)
		);
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo as f where f.id notnull"),
			Some(NullableResult::NotNull)
		);
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo as f where foo.id notnull"),
			None
		);
	}

	#[test]
	fn support_and() {
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo where 1=1 and id not null",),
			Some(NullableResult::NotNull)
		);
	}

	#[test]
	fn support_or() {
		assert_eq!(
			is_column_nullable(
				"id",
				"foo",
				"select * from foo where id is not null or id is not null and 1=1",
			),
			Some(NullableResult::NotNull)
		);
	}

	#[test]
	fn support_parens() {
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where (id not null)",),
			Some(NullableResult::NotNull)
		);
		assert_eq!(
			is_column_nullable(
				"id",
				"foo",
				"select * from foo f where (id is null) or (id is null)",
			),
			Some(NullableResult::Null)
		);
		assert_eq!(
			is_column_nullable(
				"id",
				"foo",
				"select * from foo f where (id is null) and (id is null)",
			),
			Some(NullableResult::Null)
		);
	}

	#[test]
	fn support_is_null() {
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where id is null",),
			Some(NullableResult::Null)
		);
	}

	#[test]
	fn support_join() {
		assert_eq!(
			is_column_nullable(
				"id",
				"bar",
				"select * from foo join bar where bar.id is null"
			),
			Some(NullableResult::Null)
		);
		assert_eq!(
			is_column_nullable(
				"id",
				"bar",
				"select * from foo join bar b where b.id is null"
			),
			Some(NullableResult::Null)
		);
		assert_eq!(
			is_column_nullable("id", "bar", "select * from foo, bar b where b.id is null"),
			Some(NullableResult::Null)
		);
	}

	#[test]
	fn support_yoda_null_check() {
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where null is id",),
			Some(NullableResult::Null)
		);

		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where null is not id",),
			Some(NullableResult::NotNull)
		);
	}

	#[test]
	fn support_in_list() {
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where id in (:bar)"),
			Some(NullableResult::NotNull)
		);
	}

	#[test]
	fn support_constraints_on_join() {
		assert_eq!(
			is_column_nullable(
				"id",
				"foo",
				"SELECT foo.id FROM foo INNER JOIN bar ON bar.id = foo.id"
			),
			Some(NullableResult::NotNull)
		);

		assert_eq!(
			is_column_nullable(
				"id",
				"bar",
				"SELECT foo.id FROM foo INNER JOIN bar ON bar.id = foo.id"
			),
			Some(NullableResult::NotNull)
		);
	}

	#[test]
	fn support_like_operator() {
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where id like ?"),
			Some(NullableResult::NotNull)
		);
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where id not like ?"),
			Some(NullableResult::NotNull)
		);
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where ? like id"),
			Some(NullableResult::NotNull)
		);
		assert_eq!(
			is_column_nullable("id", "foo", "select * from foo f where ? not like id"),
			Some(NullableResult::NotNull)
		);
	}
}
