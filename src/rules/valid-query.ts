import { ESLintUtils, TSESTree, ASTUtils } from "@typescript-eslint/utils";
import { RuleOptions } from "../ruleOptions.js";
import { stringifyNode } from "../utils.js";

export function createValidQueryRule(options: RuleOptions) {
	return ESLintUtils.RuleCreator.withoutDocs({
		create(context) {
			return {
				'CallExpression[callee.property.name="prepare"][arguments.length=1]'(
					node: TSESTree.CallExpression,
				) {
					if (node.callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression) {
						return;
					}

					const arg = node.arguments[0];
					if (!arg) {
						return;
					}

					const val = ASTUtils.getStaticValue(
						arg,
						context.sourceCode.getScope(arg),
					);
					if (typeof val?.value !== "string") {
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
			},
			schema: [],
			type: "problem",
		},
		defaultOptions: [],
	});
}
