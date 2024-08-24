# eslint-plugin-sqlite

## Description

An ESLint plugin that can validate SQLite queries and automatically generate types for query parameters and results.

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