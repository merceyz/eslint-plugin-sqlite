import SQLite from "better-sqlite3";

import { createTypedResultRule } from "../../src/rules/typed-result.js";
import { ruleTester } from "./rule-tester.js";

const db = new SQLite(":memory:");
db.exec(`
	CREATE TABLE users (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL);
	CREATE TABLE foo (id int);
	CREATE table test (id ANY NOT NULL, name ANY) STRICT;
	CREATE table blobData (data BLOB NOT NULL);
`);

const db_users = new SQLite(":memory:");
db_users.exec(`
  CREATE TABLE users (id int);
`);

const rule = createTypedResultRule({
	getDatabase({ name }) {
		return name === "db_users" || name === "nested.db.users" ? db_users : db;
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
		// Valid query
		`db.prepare<[], {"id": number, "name": string}>("SELECT * FROM users")`,
		// Order of columns doesn't matter
		`db.prepare<[], {"name": string, "id": number}>("SELECT * FROM users")`,
		// Identifier as column names
		`db.prepare<[], {name: string, id: number}>("SELECT * FROM users")`,
		// Column with unknown type
		`db.prepare<[], {"random()": unknown}>("SELECT random();")`,
		// Column with Buffer type
		`db.prepare<[], {"data": Buffer}>("SELECT data FROM blobData")`,
		// Should ignore invalid queries
		`db.prepare("SELECT * FROM 42")`,
		// Should pass the correct name to getDatabase
		"db_users.prepare<[], {id: number | null}>('SELECT * FROM users')",
		"nested.db.users.prepare<[], {id: number | null}>('SELECT * FROM users')",
		// Queries that don't return data
		"db.prepare('DELETE FROM foo')",
		"db.prepare<[]>('DELETE FROM foo')",
		// Should allow the user to set another type for unknown
		`db.prepare<[], {"random()": (number | null)}>("SELECT random();")`,
		// Test that no errors are reported for the outputs from the invalid cases
		`db.prepare<[], {"id": number}>("SELECT id FROM users")`,
		'db.prepare<[], {"id": number}>(`SELECT id FROM users`)',
		`const query = 'SELECT id FROM users';db.prepare<[], {"id": number}>(query);`,
		`db.prepare<[], {"id": number | null}>("SELECT * FROM foo")`,
		`db.prepare<[], {"id": number | string | Buffer}>("SELECT id FROM test")`,
		`db.prepare<[], {"name": number | string | Buffer | null}>("SELECT name FROM test")`,
		`db.prepare<[]>("DELETE FROM foo")`,
		`db.prepare<[], {"random()": (foo | number), "id": number}>("SELECT random(), id FROM users")`,
		'db.prepare<[], {"name": string}>(`SELECT name FROM users WHERE id IN (${foo.map(() => "?").join(",")})`)',
		'this.prepare<[], {"name": string}>(`SELECT name FROM users`)',
		'super.prepare<[], {"name": string}>(`SELECT name FROM users`)',
	],
	invalid: [
		// Query as string Literal
		{
			code: `db.prepare("SELECT id FROM users")`,
			errors: [{ messageId: "missingResultType" }],
			output: `db.prepare<[], {"id": number}>("SELECT id FROM users")`,
		},
		// Query as TemplateLiteral
		{
			code: "db.prepare(`SELECT id FROM users`)",
			errors: [{ messageId: "missingResultType" }],
			output: 'db.prepare<[], {"id": number}>(`SELECT id FROM users`)',
		},
		// Query as Identifier
		{
			code: `const query = 'SELECT id FROM users';db.prepare(query);`,
			errors: [{ messageId: "missingResultType" }],
			output: `const query = 'SELECT id FROM users';db.prepare<[], {"id": number}>(query);`,
		},
		// Empty typeArguments
		{
			code: `db.prepare<>("SELECT * FROM users")`,
			errors: [{ messageId: "missingResultType" }],
			output: `db.prepare<[], {"id": number, "name": string}>("SELECT * FROM users")`,
		},
		// Missing result type
		{
			code: `db.prepare<[]>("SELECT id FROM users")`,
			errors: [{ messageId: "missingResultType" }],
			output: `db.prepare<[], {"id": number}>("SELECT id FROM users")`,
		},
		// Result type isn't an object
		{
			code: `db.prepare<[], any>("SELECT * FROM users")`,
			errors: [{ messageId: "incorrectResultType" }],
			output: `db.prepare<[], {"id": number, "name": string}>("SELECT * FROM users")`,
		},
		// Empty result type
		{
			code: `db.prepare<[], {}>("SELECT * FROM users")`,
			errors: [{ messageId: "incorrectResultType" }],
			output: `db.prepare<[], {"id": number, "name": string}>("SELECT * FROM users")`,
		},
		// Missing a column
		{
			code: `db.prepare<[], {"id": number}>("SELECT * FROM users")`,
			errors: [{ messageId: "incorrectResultType" }],
			output: `db.prepare<[], {"id": number, "name": string}>("SELECT * FROM users")`,
		},
		// Column type is incorrect
		{
			code: `db.prepare<[], {"id": string}>("SELECT id FROM users")`,
			errors: [{ messageId: "incorrectResultType" }],
			output: `db.prepare<[], {"id": number}>("SELECT id FROM users")`,
		},
		// Column type is missing a type
		{
			code: `db.prepare<[], {"id": number}>("SELECT * FROM foo")`,
			errors: [{ messageId: "incorrectResultType" }],
			output: `db.prepare<[], {"id": number | null}>("SELECT * FROM foo")`,
		},
		// Column type union is incorrect
		{
			code: `db.prepare<[], {"id": string | null}>("SELECT * FROM foo")`,
			errors: [{ messageId: "incorrectResultType" }],
			output: `db.prepare<[], {"id": number | null}>("SELECT * FROM foo")`,
		},
		// Column name is incorrect
		{
			code: `db.prepare<[], {"name": string}>("SELECT id FROM users")`,
			errors: [{ messageId: "incorrectResultType" }],
			output: `db.prepare<[], {"id": number}>("SELECT id FROM users")`,
		},
		// An extra column
		{
			code: `db.prepare<[], {id: number, name: string}>("SELECT id FROM users")`,
			errors: [{ messageId: "incorrectResultType" }],
			output: `db.prepare<[], {"id": number}>("SELECT id FROM users")`,
		},
		// Column with Blob type
		{
			code: `db.prepare("SELECT data FROM blobData")`,
			errors: [{ messageId: "missingResultType" }],
			output: `db.prepare<[], {"data": Buffer}>("SELECT data FROM blobData")`,
		},
		// Column with any type
		{
			code: `db.prepare("SELECT id FROM test")`,
			errors: [{ messageId: "missingResultType" }],
			output: `db.prepare<[], {"id": number | string | Buffer}>("SELECT id FROM test")`,
		},
		// Column with any nullable type
		{
			code: `db.prepare("SELECT name FROM test")`,
			errors: [{ messageId: "missingResultType" }],
			output: `db.prepare<[], {"name": number | string | Buffer | null}>("SELECT name FROM test")`,
		},
		// Column type is unknown
		{
			code: `db.prepare("SELECT random();")`,
			errors: [{ messageId: "missingResultType" }],
			output: `db.prepare<[], {"random()": unknown}>("SELECT random();")`,
		},
		// Column name must be a string Literal or an Identifier
		{
			code: `db.prepare<[], {random(): unknown}>("SELECT random();")`,
			errors: [{ messageId: "incorrectResultType" }],
			output: `db.prepare<[], {"random()": unknown}>("SELECT random();")`,
		},
		// Should remove result type if query doesn't return data
		{
			code: `db.prepare<[], {"random()": any}>("DELETE FROM foo")`,
			errors: [{ messageId: "extraneousResultType" }],
			output: `db.prepare<[]>("DELETE FROM foo")`,
		},
		// Should preserve user specified unknown type when fixing types
		{
			code: `db.prepare<[], {"random()": (foo | number)}>("SELECT random(), id FROM users")`,
			errors: [{ messageId: "incorrectResultType" }],
			output: `db.prepare<[], {"random()": (foo | number), "id": number}>("SELECT random(), id FROM users")`,
		},
		// Variable input parameters
		{
			code: 'db.prepare(`SELECT name FROM users WHERE id IN (${foo.map(() => "?").join(",")})`)',
			output:
				'db.prepare<[], {"name": string}>(`SELECT name FROM users WHERE id IN (${foo.map(() => "?").join(",")})`)',
			errors: [{ messageId: "missingResultType" }],
		},
		{
			code: "this.prepare(`SELECT name FROM users`)",
			output: 'this.prepare<[], {"name": string}>(`SELECT name FROM users`)',
			errors: [{ messageId: "missingResultType" }],
		},
		{
			code: "super.prepare(`SELECT name FROM users`)",
			output: 'super.prepare<[], {"name": string}>(`SELECT name FROM users`)',
			errors: [{ messageId: "missingResultType" }],
		},
	],
});
