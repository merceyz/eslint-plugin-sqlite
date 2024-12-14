import SQLite from "better-sqlite3";

import { createValidQueryRule } from "../../src/rules/valid-query.js";
import { ruleTester } from "./rule-tester.js";

const db = new SQLite(":memory:");
db.exec(`
  CREATE TABLE foo (bar int, baz text);
`);

const db_users = new SQLite(":memory:");
db_users.exec(`
  CREATE TABLE users (id int, name text);
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
		"db_users.prepare(`SELECT * FROM users WHERE id IN (${ids.map(() => '?').join(',')})`);",
		"const query = `SELECT * FROM users WHERE id IN (${ids.map(() => '?').join(',')})`;db_users.prepare(query);",
		"db_users.prepare(`SELECT * FROM users WHERE ${ids.map(() => 'NAME LIKE ? || \\'%\\'').join(' OR ')}`);",
		"const query = `SELECT * FROM users WHERE ${ids.map(() => 'NAME LIKE ? || \\'%\\'').join(' OR ')}`;db_users.prepare(query);",
		"db_users.prepare(`SELECT * FROM users WHERE id IN (${ids.map(() => '?').join()})`);",
		'this.prepare("SELECT * FROM foo")',
		'super.prepare("SELECT * FROM foo")',
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
			code: "db_users.prepare(`SELECT * FROM users WHERE ${ids.map(() => unknownValue).join(' OR ')}`);",
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
		{
			code: "db_users.prepare(`SELECT * FROM user WHERE id IN (${ids.map(() => '?').join(',')})`);",
			errors: [
				{
					messageId: "invalidQuery",
					data: {
						message: `no such table: user`,
					},
				},
			],
		},
		{
			code: "const query = `SELECT * FROM user WHERE id IN (${ids.map(() => '?').join(',')})`;db_users.prepare(query);",
			errors: [
				{
					messageId: "invalidQuery",
					data: {
						message: `no such table: user`,
					},
				},
			],
		},
		{
			code: "this.prepare('SELECT * FROM user')",
			errors: [
				{
					messageId: "invalidQuery",
					data: {
						message: `no such table: user`,
					},
				},
			],
		},
		{
			code: "super.prepare('SELECT * FROM user')",
			errors: [
				{
					messageId: "invalidQuery",
					data: {
						message: `no such table: user`,
					},
				},
			],
		},
	],
});
