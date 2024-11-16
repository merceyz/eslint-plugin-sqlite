import { fileURLToPath } from "node:url";

import type { TSESLint } from "@typescript-eslint/utils";
import SQLite from "better-sqlite3";

import { GetDatabaseOptions, RuleOptions } from "./ruleOptions.js";
import { typedInputRule } from "./rules/typed-input.js";
import { createTypedResultRule } from "./rules/typed-result.js";
import { createValidQueryRule } from "./rules/valid-query.js";

export interface CreatePluginOptions {
	/**
	 * Return the database to use for a given source filename and database name.
	 * If the result is a string or an URL it is treated as a path to a SQLite database file.
	 * The result is cached by the filename and database name.
	 */
	getDatabase(options: GetDatabaseOptions): SQLite.Database | URL | string;
}

export function createSqlitePlugin(options: CreatePluginOptions) {
	const databaseCache = new Map<string, SQLite.Database>();

	const ruleOptions: RuleOptions = {
		getDatabase(opts) {
			const cacheKey = JSON.stringify(opts);

			// Check cache by full key
			{
				const cached = databaseCache.get(cacheKey);
				if (cached) {
					return cached;
				}
			}

			const userResult = options.getDatabase(opts);
			if (userResult instanceof SQLite) {
				databaseCache.set(cacheKey, userResult);
				return userResult;
			}

			const dbPath =
				userResult instanceof URL || userResult.startsWith("file://")
					? fileURLToPath(userResult)
					: userResult;

			// Check cache by db path
			{
				const cached = databaseCache.get(dbPath);
				if (cached) {
					databaseCache.set(cacheKey, cached);
					return cached;
				}
			}

			const db = new SQLite(dbPath, { readonly: true });
			databaseCache.set(cacheKey, db);
			databaseCache.set(dbPath, db);
			return db;
		},
	};

	const plugin = {
		meta: {
			name: "eslint-plugin-sqlite",
		},
		rules: {
			"valid-query": createValidQueryRule(ruleOptions),
			"typed-result": createTypedResultRule(ruleOptions),
			"typed-input": typedInputRule,
		},
	} satisfies TSESLint.FlatConfig.Plugin;

	return {
		...plugin,
		configs: {
			recommended: {
				plugins: {
					sqlite: plugin,
				},
				rules: {
					"sqlite/valid-query": "error",
					"sqlite/typed-result": "error",
					"sqlite/typed-input": "error",
				},
			},
		},
	} satisfies TSESLint.FlatConfig.Plugin;
}
