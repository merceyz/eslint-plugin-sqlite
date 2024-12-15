import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";

import { does_all_named_parameters_start_with_prefix } from "../parser/parser.js";
import { getQueryValue } from "../utils.js";

export const parameterPrefixRule = ESLintUtils.RuleCreator.withoutDocs({
	create(context, options) {
		const expectedPrefix = options[0];

		return {
			'CallExpression[callee.type=MemberExpression][callee.property.name="prepare"][arguments.length=1]'(
				node: Omit<TSESTree.CallExpression, "arguments" | "callee"> & {
					arguments: [TSESTree.CallExpression["arguments"][0]];
					callee: TSESTree.MemberExpression;
				},
			) {
				const arg = node.arguments[0];

				const val = getQueryValue(arg, context.sourceCode.getScope(arg));

				if (typeof val?.value !== "string") {
					return;
				}

				const result = does_all_named_parameters_start_with_prefix(
					val.value,
					expectedPrefix,
				);

				if (result === false) {
					context.report({
						node: arg,
						messageId: "incorrectPrefixUsed",
						data: {
							prefix: expectedPrefix,
						},
					});
				}
			},
		};
	},
	meta: {
		messages: {
			incorrectPrefixUsed:
				"Query uses a named parameter prefix that isn't permitted, use '{{prefix}}' instead.",
		},
		schema: [
			{
				type: "string",
				enum: [":", "@", "$"],
			},
		],
		type: "problem",
	},
	defaultOptions: [":"],
});
