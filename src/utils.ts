import { ASTUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";

export function stringifyNode(
	node: TSESTree.Expression | TSESTree.PrivateIdentifier,
): string | null {
	switch (node.type) {
		case TSESTree.AST_NODE_TYPES.Super: {
			return "super";
		}
		case TSESTree.AST_NODE_TYPES.ThisExpression: {
			return "this";
		}
		case TSESTree.AST_NODE_TYPES.Identifier: {
			return node.name;
		}
		case TSESTree.AST_NODE_TYPES.MemberExpression: {
			const objectName = stringifyNode(node.object);
			const propertyName = stringifyNode(node.property);
			if (objectName === null || propertyName === null) {
				return null;
			}

			return `${objectName}.${propertyName}`;
		}
		default: {
			return null;
		}
	}
}

/**
 * Attempts to get a query value from a given CallExpression argument.
 */
export function getQueryValue(
	arg: TSESTree.CallExpression["arguments"][0],
	scope: TSESLint.Scope.Scope,
): { value: unknown } | null {
	const value = ASTUtils.getStaticValue(arg, scope);
	if (value) {
		return value;
	}

	if (arg.type === TSESTree.AST_NODE_TYPES.TemplateLiteral) {
		let query = "";

		for (let i = 0; i < arg.quasis.length; i++) {
			const quasi = arg.quasis[i];
			if (quasi) {
				query += quasi.value.cooked;

				const expr = arg.expressions[i];
				if (expr) {
					const value = getParameterExpressionValue(expr);
					if (value == null) {
						return null;
					}
					query += value;
				}
			}
		}

		return {
			value: query,
		};
	}

	if (arg.type === TSESTree.AST_NODE_TYPES.Identifier) {
		const variable = ASTUtils.findVariable(scope, arg);
		const def = variable?.defs[0];
		if (
			variable?.defs.length === 1 &&
			def?.type === TSESLint.Scope.DefinitionType.Variable &&
			def.node.id.type === TSESTree.AST_NODE_TYPES.Identifier &&
			def.parent.kind === "const" &&
			def.node.init
		) {
			return getQueryValue(def.node.init, scope);
		}
		return null;
	}

	return null;
}

/**
 * If the expression looks like `foo.map(() => '<value>').join('<separator>')`
 * then the value of the map callback is returned.
 */
function getParameterExpressionValue(expr: TSESTree.Expression) {
	if (expr.type !== TSESTree.AST_NODE_TYPES.CallExpression || expr.optional) {
		return null;
	}

	if (expr.callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression) {
		return null;
	}

	if (ASTUtils.getPropertyName(expr.callee) !== "join") {
		return null;
	}

	if (
		expr.arguments[0] != null &&
		typeof ASTUtils.getStaticValue(expr.arguments[0])?.value !== "string"
	) {
		return null;
	}

	if (
		expr.callee.object.type !== TSESTree.AST_NODE_TYPES.CallExpression ||
		expr.callee.object.optional
	) {
		return null;
	}

	const maybeMapExpr = expr.callee.object;

	if (maybeMapExpr.callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression) {
		return null;
	}

	if (ASTUtils.getPropertyName(maybeMapExpr.callee) !== "map") {
		return null;
	}

	if (!maybeMapExpr.arguments[0]) {
		return null;
	}

	const maybeCallback = maybeMapExpr.arguments[0];

	if (maybeCallback.type !== TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) {
		return null;
	}

	const mapValue = ASTUtils.getStaticValue(maybeCallback.body);
	if (typeof mapValue?.value !== "string") {
		return null;
	}

	return mapValue.value;
}
