import { it, expect } from "vitest";
import SQLite from "better-sqlite3";
import { inferQueryResult, ColumnType } from "../src/inferQueryResult.js";

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
		{ name: "id", type: ColumnType.Any | ColumnType.Null },
	]);
});

it("should support column without a table", () => {
	const result = testInferQueryResult("", "SELECT 1");

	expect(result).toStrictEqual<typeof result>([
		{ name: "1", type: ColumnType.Unknown },
	]);
});

it("should support query as column", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id text not null)",
		"SELECT (SELECT id FROM foo) AS id",
	);

	expect(result).toStrictEqual<typeof result>([
		{ name: "id", type: ColumnType.String },
	]);
});

it("should support columns with the same name", () => {
	const result = testInferQueryResult(
		"CREATE TABLE foo (id text);\nCREATE table bar (id int not null)",
		"SELECT * FROM foo LEFT JOIN bar",
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