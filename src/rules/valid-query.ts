import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";

import type { RuleOptions } from "../ruleOptions.js";
import { getQueryValue, stringifyNode } from "../utils.js";

export function createValidQueryRule(options: RuleOptions) {
	return ESLintUtils.RuleCreator.withoutDocs({
		create(context) {
			return {
				'CallExpression[callee.type=MemberExpression][callee.property.name="prepare"][arguments.length=1]'(
					node: Omit<TSESTree.CallExpression, "arguments" | "callee"> & {
						arguments: [TSESTree.CallExpression["arguments"][0]];
						callee: TSESTree.MemberExpression;
					},
				) {
					const arg = node.arguments[0];

					const val = getQueryValue(arg, context.sourceCode.getScope(arg));

					if (!val) {
						context.report({
							messageId: "nonStaticQuery",
							node: arg,
						});
						return;
					}

					if (typeof val.value !== "string") {
						context.report({
							messageId: "invalidQuery",
							node: arg,
							data: {
								message: `typeof ${typeof val.value} is not a valid query`,
							},
						});
						return;
					}

					const databaseName = stringifyNode(node.callee.object);
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
							node: arg,
							data: {
								message:
									error && typeof error === "object" && "message" in error
										? error.message
										: String(error),
							},
						});
					}
				},
			};
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
