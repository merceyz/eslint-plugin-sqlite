import SQLite from "better-sqlite3";
import { expect, it } from "vitest";

import { ColumnType, inferQueryResult } from "../src/inferQueryResult.js";

function testInferQueryResult(source: string, query: string) {
	const db = new SQLite(":memory:");

	if (source) {
		db.exec(source);
	}

	const result = inferQueryResult(query, db);
	db.close();
	return result;
}

it("should support select star", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (bar int, baz text)",
		"SELECT * FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "bar", type: ColumnType.Number | ColumnType.Null },
		{ name: "baz", type: ColumnType.String | ColumnType.Null },
	]);
});

it("should support select alias", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id int)",
		"SELECT id as id_alias FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id_alias", type: ColumnType.Number | ColumnType.Null },
	]);
});

it("should support not null columns", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id int not null)",
		"SELECT id FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number },
	]);
});

it("should treat ANY column type without strict as number", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id any)",
		"SELECT id FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number | ColumnType.Null },
	]);
});

it("should support column with strict ANY type", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id any) strict",
		"SELECT id FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{
			name: "id",
			type:
				ColumnType.String |
				ColumnType.Number |
				ColumnType.Buffer |
				ColumnType.Null,
		},
	]);
});

it("should support column without a table", () => {
	const result = testInferQueryResult("", "SELECT 1");

	expect(result).toStrictEqual<typeof result>([
		{ name: "1", type: ColumnType.Number },
	]);
});

it("should support columns with the same name", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id text);\nCREATE table bar (id int not null)",
		"SELECT * FROM foo JOIN bar",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number },
	]);
});

it("should support column selected with a table alias", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id text)",
		"SELECT f.id FROM foo f",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.String | ColumnType.Null },
	]);
});

it("should ignore invalid queries", () => {
	const result = testInferQueryResult("", "SELECT * FROM");

	expect(result).toStrictEqual<typeof result>(null);
});

it("should handle queries that don't return data", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id text)",
		"DELETE FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([]);
});

it("should prove that a column is not null", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id int)",
		"SELECT id FROM foo WHERE id IS NOT NULL",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number },
	]);
});

it("should prove that a column is only null", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id int)",
		"SELECT id FROM foo WHERE id IS NULL",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Null },
	]);
});

it("should detect when a column is an alias for rowid", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id integer primary key)",
		"SELECT id FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number },
	]);
});

it("should detect when a column is not an alias for rowid", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id integer, name text, PRIMARY KEY(id, name))",
		"SELECT id FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number | ColumnType.Null },
	]);
});

it("should detect when a not null column might not be present", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id int not null); CREATE TABLE bar (id int not null)",
		"SELECT foo.id FROM bar LEFT JOIN foo ON foo.id = bar.id",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number | ColumnType.Null },
	]);
});

it("should detect when a not null column is always present", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id int not null); CREATE TABLE bar (id int not null)",
		"SELECT foo.id FROM bar JOIN foo ON foo.id = bar.id",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number },
	]);
});

it("should support query as column", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id text not null)",
		"SELECT (SELECT id FROM foo) AS id",
	);

	// If table foo is empty then id will be null
	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.String | ColumnType.Null },
	]);
});

it("should support selecting rowid, oid, and _rowid_", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (name text)",
		"SELECT rowid as rowid, oid as oid, _rowid_ as _rowid_ FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "rowid", type: ColumnType.Number },
		{ name: "oid", type: ColumnType.Number },
		{ name: "_rowid_", type: ColumnType.Number },
	]);
});

it("should support ifnull()", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id int)",
		"SELECT ifnull(id, 1) as id FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number },
	]);
});

it("should support coalesce()", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id int)",
		"SELECT coalesce(id, 1) as id FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number },
	]);
});

it("should support string concatenation", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id text not null, name text)",
		"SELECT id || 'bar' as id, name || 'baz' as name FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.String },
		{ name: "name", type: ColumnType.String | ColumnType.Null },
	]);
});

it("should support count", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id int)",
		"SELECT count(*) as c FROM foo",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "c", type: ColumnType.Number },
	]);
});

it("should support literals", () => {
	const result = testInferQueryResult(
		"",
		"SELECT 1, true, false, 'foo', x'01', NULL, current_time, current_date, current_timestamp",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "1", type: ColumnType.Number },
		{ name: "true", type: ColumnType.Number },
		{ name: "false", type: ColumnType.Number },
		{ name: "'foo'", type: ColumnType.String },
		{ name: "x'01'", type: ColumnType.Buffer },
		{ name: "NULL", type: ColumnType.Null },
		{ name: "current_time", type: ColumnType.String },
		{ name: "current_date", type: ColumnType.String },
		{ name: "current_timestamp", type: ColumnType.String },
	]);
});

it("should detect when column can't be null", () => {
	const result = testInferQueryResult(
		"CREATE TABLE users (id integer primary key, email text, name text)",
		"SELECT * FROM users WHERE email = ?",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number },
		{ name: "email", type: ColumnType.String },
		{ name: "name", type: ColumnType.String | ColumnType.Null },
	]);
});

it("should support insert into ... returning", () => {
	const result = testInferQueryResult(
		"CREATE TABLE users (id integer primary key, email text, name text)",
		"INSERT INTO users (email, name) VALUES (?, ?) RETURNING id",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number },
	]);
});

it("should support update ... returning", () => {
	const result = testInferQueryResult(
		"CREATE TABLE users (id integer primary key, email text, name text)",
		"UPDATE users SET email = ? WHERE id = ? RETURNING id",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.Number },
	]);
});
