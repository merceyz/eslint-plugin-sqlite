# eslint-plugin-sqlite

## Description

An ESLint plugin that can validate SQLite queries and automatically
generate types for query parameters and results when using the
`better-sqlite3` library.

## Usage

Note that the following examples exclude the setup of TypeScript linting.

```js
// eslint.config.js
import { createSqlitePlugin } from "eslint-plugin-sqlite";

const sqlitePlugin = createSqlitePlugin({
	getDatabase() {
		return new URL("./database.db", import.meta.url);
	},
});

export default [sqlitePlugin.configs.recommended];
```

If you have multiple databases you can return a different URL based on
the name of the database and/or name of the file that is being linted.

```js
// eslint.config.js
import { createSqlitePlugin } from "eslint-plugin-sqlite";

const sqlitePlugin = createSqlitePlugin({
	getDatabase({ name, filename }) {
		if (filename.includes("authentication") && name === "users") {
			return new URL("./users_database.db", import.meta.url);
		} else {
			return new URL("./database.db", import.meta.url);
		}
	},
});

export default [sqlitePlugin.configs.recommended];
```

If you require additional setup for the database you can return a
Database instance instead of a URL.

```js
// eslint.config.js
import { createSqlitePlugin } from "eslint-plugin-sqlite";
import Database from "better-sqlite3";

const sqlitePlugin = createSqlitePlugin({
	getDatabase() {
		const db = new Database("my_database.db");
		db.loadExtension("mod_spatialite");
		return db;
	},
});

export default [sqlitePlugin.configs.recommended];
```

## Editor support

### VSCode

By default the ESLint extension for VSCode uses the Node.js version
included with VSCode, if that version isn't the same major version
as the one used by your project then you need to configure the extension
to use the version of Node.js that your project uses.

You can do that by adding the following to your `.vscode/settings.json` file:

```json
{
	"eslint.runtime": "node"
}
```

## Rules

### valid-query

Validates that the query can be prepared by SQLite.

```ts
// Bad - Error: in prepare, no such table: user (1)
const users = db.prepare("SELECT * FROM user").all();

// Good
const users = db.prepare("SELECT * FROM users").all();
```

### typed-input

Generates types for the input parameters of a query.

```ts
// Bad
const user = db.prepare("SELECT * FROM users WHERE id = :id").get({ id: 1 });

// Good
const user = db
	.prepare<{ id: unknown }>("SELECT * FROM users WHERE id = :id")
	.get({ id: 1 });
```

### typed-result

Generates types for the result of a query.

```ts
// Bad
const user = db.prepare("SELECT * FROM users").all();

// Good
const user = db
	.prepare<[], { id: number; name: string }>("SELECT * FROM users")
	.all();
```

## License

eslint-plugin-sqlite is licensed under the [MIT License](LICENSE) and
uses various Rust crates compiled to WebAssembly and bundled with the
plugin, their licenses can be found in [Third Party Licenses](THIRD-PARTY-LICENSES.html).
