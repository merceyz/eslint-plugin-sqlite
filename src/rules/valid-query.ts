import { ESLintUtils } from "@typescript-eslint/utils";

import type { RuleOptions } from "../ruleOptions.js";
import { getQueryValue, makeRuleListener, stringifyNode } from "../utils.js";

export function createValidQueryRule(options: RuleOptions) {
	return ESLintUtils.RuleCreator.withoutDocs({
		create(context) {
			return makeRuleListener({
				handleQuery({ queryNode, callee }) {
					const val = getQueryValue(
						queryNode,
						context.sourceCode.getScope(queryNode),
					);

					if (!val) {
						context.report({
							messageId: "nonStaticQuery",
							node: queryNode,
						});
						return;
					}

					if (typeof val.value !== "string") {
						context.report({
							messageId: "invalidQuery",
							node: queryNode,
							data: {
								message: `typeof ${typeof val.value} is not a valid query`,
							},
						});
						return;
					}

					const databaseName = stringifyNode(callee.object);
					if (!databaseName) {
						return;
					}

					const db = options.getDatabase({
						filename: context.filename,
						name: databaseName,
					});

					try {
						db.prepare(val.value);
					} catch (error) {
						context.report({
							messageId: "invalidQuery",
							node: queryNode,
							data: {
								message:
									error && typeof error === "object" && "message" in error
										? error.message
										: String(error),
							},
						});
					}
				},
			});
		},
		meta: {
			messages: {
				invalidQuery: "Invalid query: {{message}}",
				nonStaticQuery: "Unable to determine a static query value",
			},
			schema: [],
			type: "problem",
		},
		defaultOptions: [],
	});
}
