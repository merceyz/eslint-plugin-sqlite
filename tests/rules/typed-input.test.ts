import { RuleTester } from "@typescript-eslint/rule-tester";
import * as vitest from "vitest";
import { createTypedInputRule } from "../../src/rules/typed-input.js";
import SQLite from "better-sqlite3";

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;

const ruleTester = new RuleTester();

const db = new SQLite(":memory:");
db.exec(`
	CREATE TABLE users (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL);
`);

const rule = createTypedInputRule({
	getDatabase() {
		return db;
	},
});

ruleTester.run("typed-result", rule, {
	valid: [
		// Shouldn't match if query can't be determined
		"db.prepare(true)",
		"db.prepare(123)",
		"db.prepare(null)",
		"db.prepare(undefined)",
		"db.prepare(1n)",
		"db.prepare(foo)",
		// Should ignore invalid queries
		'db.prepare("SELECT * FROM 42")',
		// Identifier is allowed as a name
		'db.prepare<{id: unknown}>("SELECT * FROM users WHERE id = $id")',
		// Test that no errors are reported for the outputs from the invalid cases
		'db.prepare<[]>("SELECT * FROM users")',
		'db.prepare<[unknown]>("SELECT * FROM users WHERE id = ?")',
		'db.prepare<[unknown, unknown]>("SELECT * FROM users WHERE id = ? and name = ?")',
		'db.prepare<{"id": unknown}>("SELECT * FROM users WHERE id = $id")',
		'db.prepare<{"id": unknown, "name": unknown}>("SELECT * FROM users WHERE id = $id and name = @name")',
		'db.prepare<[unknown, {"id": unknown}]>("SELECT * FROM users WHERE id = $id and name = ?")',
		'db.prepare<{"id": unknown, "name": unknown}>("SELECT * FROM users WHERE id = :id and name = :name")',
		'db.prepare<[unknown, {"id": unknown, "name": unknown}]>("SELECT * FROM users WHERE id = :id or id = ? and name = :name")',
		'db.prepare<[unknown, {"id": unknown}]>("SELECT * FROM users WHERE id = :id or id = ?")',
		'db.prepare<{"userID": unknown}>("SELECT * FROM users WHERE id = :userID")',
		'db.prepare<[unknown, {"userID": unknown}]>("SELECT * FROM users WHERE id = :userID or name = ?")',
		'db.prepare<[unknown, {"userID": string}]>("SELECT * FROM users WHERE id = :userID or name = ?")',
		'db.prepare<{"userID": string}>("SELECT * FROM users WHERE id = :userID")',
		'db.prepare<[unknown]>(`SELECT * FROM users WHERE id IN (${foo.map(() => "?").join(",")})`)',
	],
	invalid: [
		// No parameters
		{
			code: 'db.prepare("SELECT * FROM users")',
			output: 'db.prepare<[]>("SELECT * FROM users")',
			errors: [{ messageId: "missingInputType" }],
		},
		{
			code: 'db.prepare<>("SELECT * FROM users")',
			output: 'db.prepare<[]>("SELECT * FROM users")',
			errors: [{ messageId: "missingInputType" }],
		},
		// Anonymous parameter
		{
			code: 'db.prepare("SELECT * FROM users WHERE id = ?")',
			output: 'db.prepare<[unknown]>("SELECT * FROM users WHERE id = ?")',
			errors: [{ messageId: "missingInputType" }],
		},
		// Multiple anonymous parameters
		{
			code: 'db.prepare("SELECT * FROM users WHERE id = ? and name = ?")',
			output:
				'db.prepare<[unknown, unknown]>("SELECT * FROM users WHERE id = ? and name = ?")',
			errors: [{ messageId: "missingInputType" }],
		},
		// Named parameter
		{
			code: 'db.prepare<[]>("SELECT * FROM users WHERE id = $id")',
			output:
				'db.prepare<{"id": unknown}>("SELECT * FROM users WHERE id = $id")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		// Multiple named parameters
		{
			code: 'db.prepare<[]>("SELECT * FROM users WHERE id = $id and name = @name")',
			output:
				'db.prepare<{"id": unknown, "name": unknown}>("SELECT * FROM users WHERE id = $id and name = @name")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		// Named and anonymous parameters
		{
			code: 'db.prepare<[]>("SELECT * FROM users WHERE id = $id and name = ?")',
			output:
				'db.prepare<[unknown, {"id": unknown}]>("SELECT * FROM users WHERE id = $id and name = ?")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		// Removing input type
		{
			code: 'db.prepare<[unknown]>("SELECT * FROM users")',
			output: 'db.prepare<[]>("SELECT * FROM users")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		{
			code: 'db.prepare<[unknown, unknown]>("SELECT * FROM users WHERE id = ?")',
			output: 'db.prepare<[unknown]>("SELECT * FROM users WHERE id = ?")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		// Add missing named parameter
		{
			code: 'db.prepare<{"id": unknown}>("SELECT * FROM users WHERE id = :id and name = :name")',
			output:
				'db.prepare<{"id": unknown, "name": unknown}>("SELECT * FROM users WHERE id = :id and name = :name")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		{
			code: 'db.prepare<[unknown, {"id": unknown}]>("SELECT * FROM users WHERE id = :id or id = ? and name = :name")',
			output:
				'db.prepare<[unknown, {"id": unknown, "name": unknown}]>("SELECT * FROM users WHERE id = :id or id = ? and name = :name")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		{
			code: 'db.prepare<[unknown]>("SELECT * FROM users WHERE id = :id or id = ?")',
			output:
				'db.prepare<[unknown, {"id": unknown}]>("SELECT * FROM users WHERE id = :id or id = ?")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		// Parameter name changes
		{
			code: 'db.prepare<{"id": unknown}>("SELECT * FROM users WHERE id = :userID")',
			output:
				'db.prepare<{"userID": unknown}>("SELECT * FROM users WHERE id = :userID")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		{
			code: 'db.prepare<[unknown, {"id": unknown}]>("SELECT * FROM users WHERE id = :userID or name = ?")',
			output:
				'db.prepare<[unknown, {"userID": unknown}]>("SELECT * FROM users WHERE id = :userID or name = ?")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		// Preserve user changed type annotations on named parameters
		{
			code: 'db.prepare<[unknown, {"id": string, "userID": string}]>("SELECT * FROM users WHERE id = :userID or name = ?")',
			output:
				'db.prepare<[unknown, {"userID": string}]>("SELECT * FROM users WHERE id = :userID or name = ?")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		{
			code: 'db.prepare<{"id": string, "userID": string}>("SELECT * FROM users WHERE id = :userID")',
			output:
				'db.prepare<{"userID": string}>("SELECT * FROM users WHERE id = :userID")',
			errors: [{ messageId: "incorrectInputType" }],
		},
		// Variable input parameters
		{
			code: 'db.prepare(`SELECT * FROM users WHERE id IN (${foo.map(() => "?").join(",")})`)',
			output:
				'db.prepare<[unknown]>(`SELECT * FROM users WHERE id IN (${foo.map(() => "?").join(",")})`)',
			errors: [{ messageId: "missingInputType" }],
		},
	],
});
