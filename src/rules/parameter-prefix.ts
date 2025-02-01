import { ESLintUtils } from "@typescript-eslint/utils";

import { does_all_named_parameters_start_with_prefix } from "../parser/parser.js";
import { getQueryValue, makeRuleListener } from "../utils.js";

export const parameterPrefixRule = ESLintUtils.RuleCreator.withoutDocs({
	create(context, options) {
		const expectedPrefix = options[0];

		return makeRuleListener({
			handleQuery({ queryNode }) {
				const val = getQueryValue(
					queryNode,
					context.sourceCode.getScope(queryNode),
				);

				if (typeof val?.value !== "string") {
					return;
				}

				const result = does_all_named_parameters_start_with_prefix(
					val.value,
					expectedPrefix,
				);

				if (result === false) {
					context.report({
						node: queryNode,
						messageId: "incorrectPrefixUsed",
						data: {
							prefix: expectedPrefix,
						},
					});
				}
			},
		});
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
