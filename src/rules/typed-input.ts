import { ESLintUtils, TSESTree, ASTUtils } from "@typescript-eslint/utils";
import { RuleOptions } from "../ruleOptions.js";
import { stringifyNode } from "../utils.js";
import { inferQueryInput, QueryInput } from "../inferQueryInput.js";

export function createTypedInputRule(options: RuleOptions) {
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

					const queryInput = inferQueryInput(val.value, db);
					if (queryInput == null) {
						return;
					}

					const typeArguments = node.typeArguments;
					const inputParam = typeArguments?.params[0];
					if (!typeArguments || !inputParam) {
						context.report({
							node: node,
							messageId: "missingInputType",
							*fix(fixer) {
								if (typeArguments && !inputParam) {
									yield fixer.replaceText(
										typeArguments,
										`<${queryInputToText(queryInput)}>`,
									);
								} else {
									yield fixer.insertTextAfter(
										node.callee,
										`<${queryInputToText(queryInput)}>`,
									);
								}
							},
						});
						return;
					}

					if (isDeclaredTypeCorrect(queryInput, inputParam)) {
						return;
					}

					const members =
						inputParam.type === TSESTree.AST_NODE_TYPES.TSTypeLiteral
							? inputParam.members
							: inputParam.type === TSESTree.AST_NODE_TYPES.TSTupleType
								? inputParam.elementTypes.find(
										(element) =>
											element.type === TSESTree.AST_NODE_TYPES.TSTypeLiteral,
									)?.members
								: null;

					const userDeclaredTypes = new Map<string, string>();

					if (members) {
						for (const member of members) {
							if (member.type !== TSESTree.AST_NODE_TYPES.TSPropertySignature) {
								continue;
							}

							if (!member.typeAnnotation) {
								continue;
							}

							const name =
								member.key.type === TSESTree.AST_NODE_TYPES.Identifier
									? member.key.name
									: ASTUtils.getStringIfConstant(member.key);

							if (!name) {
								continue;
							}

							const type = context.sourceCode.getText(member.typeAnnotation);
							userDeclaredTypes.set(name, type);
						}
					}

					context.report({
						node: inputParam,
						messageId: "incorrectInputType",
						*fix(fixer) {
							yield fixer.replaceText(
								inputParam,
								queryInputToText(queryInput, userDeclaredTypes),
							);
						},
					});
				},
			};
		},
		meta: {
			messages: {
				missingInputType: "Missing input type for query",
				incorrectInputType: "Incorrect input type for query",
			},
			schema: [],
			type: "suggestion",
			fixable: "code",
		},
		defaultOptions: [],
	});
}

function queryInputToText(
	queryInput: QueryInput,
	userDeclaredTypes?: Map<string, string>,
): string {
	if (queryInput.count === 0) {
		return `[]`;
	} else if (queryInput.names.length === 0) {
		return `[${new Array(queryInput.count).fill("unknown").join(", ")}]`;
	} else if (queryInput.count === queryInput.names.length) {
		return `{${queryInput.names.map((name) => `"${name}"${userDeclaredTypes?.get(name) ?? ": unknown"}`).join(", ")}}`;
	} else {
		return `[${new Array(queryInput.count - queryInput.names.length).fill("unknown").join(", ")}, {${queryInput.names.map((name) => `"${name}"${userDeclaredTypes?.get(name) ?? ": unknown"}`).join(", ")}}]`;
	}
}

function isDeclaredTypeCorrect(
	queryInput: QueryInput,
	inputParam: TSESTree.TypeNode,
) {
	if (queryInput.count === 0) {
		if (
			inputParam.type !== TSESTree.AST_NODE_TYPES.TSTupleType ||
			inputParam.elementTypes.length !== 0
		) {
			return false;
		}
		return true;
	}

	if (queryInput.count === queryInput.names.length) {
		if (
			inputParam.type !== TSESTree.AST_NODE_TYPES.TSTypeLiteral ||
			inputParam.members.length !== queryInput.count
		) {
			return false;
		}

		for (const name of queryInput.names) {
			if (
				!inputParam.members.some(
					(member) =>
						member.type === TSESTree.AST_NODE_TYPES.TSPropertySignature &&
						((member.key.type === TSESTree.AST_NODE_TYPES.Identifier &&
							member.key.name === name) ||
							ASTUtils.getStringIfConstant(member.key) === name),
				)
			) {
				return false;
			}
		}

		return true;
	}

	if (queryInput.names.length === 0) {
		if (
			inputParam.type !== TSESTree.AST_NODE_TYPES.TSTupleType ||
			inputParam.elementTypes.length !== queryInput.count ||
			inputParam.elementTypes.some(
				(type) => type.type !== TSESTree.AST_NODE_TYPES.TSUnknownKeyword,
			)
		) {
			return false;
		}
		return true;
	}

	if (
		queryInput.count !== queryInput.names.length &&
		queryInput.count > 0 &&
		queryInput.names.length > 0
	) {
		if (inputParam.type !== TSESTree.AST_NODE_TYPES.TSTupleType) {
			return false;
		}

		const anonymousCount = queryInput.count - queryInput.names.length;
		for (let i = 0; i < anonymousCount; i++) {
			if (
				inputParam.elementTypes[i]?.type !==
				TSESTree.AST_NODE_TYPES.TSUnknownKeyword
			) {
				return false;
			}
		}

		const objectType = inputParam.elementTypes[anonymousCount];
		if (
			objectType?.type !== TSESTree.AST_NODE_TYPES.TSTypeLiteral ||
			objectType.members.length !== queryInput.names.length
		) {
			return false;
		}

		for (const name of queryInput.names) {
			if (
				!objectType.members.some(
					(member) =>
						member.type === TSESTree.AST_NODE_TYPES.TSPropertySignature &&
						((member.key.type === TSESTree.AST_NODE_TYPES.Identifier &&
							member.key.name === name) ||
							ASTUtils.getStringIfConstant(member.key) === name),
				)
			) {
				return false;
			}
		}

		return true;
	}

	return true;
}
