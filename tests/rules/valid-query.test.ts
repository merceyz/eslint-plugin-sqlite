import { RuleTester } from "@typescript-eslint/rule-tester";
import * as vitest from "vitest";
import { createValidQueryRule } from "../../src/rules/valid-query.js";
import SQLite from "better-sqlite3";

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;

const ruleTester = new RuleTester();

const db = new SQLite(":memory:");
db.exec(`
  CREATE TABLE foo (bar int, baz text);
`);

const db_users = new SQLite(":memory:");
db_users.exec(`
  CREATE TABLE users (id int);
`);

const rule = createValidQueryRule({
	getDatabase({ name }) {
		return name === "db_users" || name === "nested.db.users" ? db_users : db;
	},
});

ruleTester.run("valid-query", rule, {
	valid: [
		"db.prepare('SELECT 42')",
		"db.prepare('SELECT * FROM foo')",
		"db.prepare('SELECT bar FROM foo')",
		"db_users.prepare('SELECT * FROM users')",
		"nested.db.users.prepare('SELECT * FROM users')",
		"db.prepare('DELETE FROM foo')",
	],
	invalid: [
		{
			code: "db.prepare(foo)",
			errors: [
				{
					messageId: "nonStaticQuery",
				},
			],
		},
		{
			code: "db.prepare(42)",
			errors: [
				{
					messageId: "invalidQuery",
					data: {
						message: "typeof number is not a valid query",
					},
				},
			],
		},
		{
			code: "db.prepare('SELECT test FROM foo')",
			errors: [
				{
					messageId: "invalidQuery",
					data: {
						message: "no such column: test",
					},
				},
			],
		},
		{
			code: "db.prepare('SELECT test FROM')",
			errors: [
				{
					messageId: "invalidQuery",
					data: {
						message: "incomplete input",
					},
				},
			],
		},
		{
			code: "db.prepare('SELECT test FROM foo WHERE bar === 1')",
			errors: [
				{
					messageId: "invalidQuery",
					data: {
						message: `near "=": syntax error`,
					},
				},
			],
		},
	],
});
