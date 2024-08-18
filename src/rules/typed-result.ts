import { ESLintUtils, TSESTree, ASTUtils } from "@typescript-eslint/utils";
import {
	ColumnInfo,
	ColumnType,
	inferQueryResult,
} from "../inferQueryResult.js";
import { RuleOptions } from "../ruleOptions.js";
import { stringifyNode } from "../utils.js";

export function createTypedResultRule(options: RuleOptions) {
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

					const columns = inferQueryResult(val.value, db);
					if (!columns) {
						return;
					}

					const typeArguments = node.typeArguments;
					if (columns.length === 0) {
						const inputNode = typeArguments?.params[0];
						const resultNode = typeArguments?.params[1];
						if (inputNode && resultNode) {
							context.report({
								messageId: "extraneousResultType",
								node: resultNode,
								*fix(fixer) {
									yield fixer.removeRange([
										inputNode.range[1],
										resultNode.range[1],
									]);
								},
							});
						}

						return;
					}

					if (!typeArguments) {
						context.report({
							messageId: "missingResultType",
							node,
							*fix(fixer) {
								yield fixer.insertTextAfter(
									node.callee,
									`<[], ${columnsToObjectLiteralText(columns)}>`,
								);
							},
						});
						return;
					}

					if (typeArguments.params.length === 0) {
						context.report({
							messageId: "missingResultType",
							node: typeArguments,
							*fix(fixer) {
								yield fixer.replaceTextRange(
									typeArguments.range,
									`<[], ${columnsToObjectLiteralText(columns)}>`,
								);
							},
						});
						return;
					}

					const firstParam = typeArguments.params[0];
					if (typeArguments.params.length === 1 && firstParam) {
						context.report({
							messageId: "missingResultType",
							node: typeArguments,
							*fix(fixer) {
								yield fixer.insertTextAfter(
									firstParam,
									`, ${columnsToObjectLiteralText(columns)}`,
								);
							},
						});
						return;
					}

					const resultParam = typeArguments.params[1];
					if (resultParam) {
						const isValid =
							resultParam.type === TSESTree.AST_NODE_TYPES.TSTypeLiteral &&
							resultParam.members.length === columns.length &&
							columns.every((column) => {
								return resultParam.members.some((member) => {
									if (
										member.type !== TSESTree.AST_NODE_TYPES.TSPropertySignature
									) {
										return false;
									}

									if (!member.typeAnnotation) {
										return false;
									}

									const name =
										member.key.type === TSESTree.AST_NODE_TYPES.Identifier
											? member.key.name
											: ASTUtils.getStringIfConstant(member.key);
									if (column.name !== name) {
										return false;
									}

									const declaredType = member.typeAnnotation.typeAnnotation;

									if (
										declaredType.type === TSESTree.AST_NODE_TYPES.TSUnionType
									) {
										if (countBitsSet(column.type) === 1) {
											return false;
										}

										return declaredType.types.every((type) =>
											isTypeNodeCompatibleWithColumnType(type, column.type),
										);
									}

									if (countBitsSet(column.type) !== 1) {
										return false;
									}

									return isTypeNodeCompatibleWithColumnType(
										declaredType,
										column.type,
									);
								});
							});

						if (!isValid) {
							context.report({
								messageId: "incorrectResultType",
								node: resultParam,
								*fix(fixer) {
									yield fixer.replaceText(
										resultParam,
										columnsToObjectLiteralText(columns),
									);
								},
							});
							return;
						}
					}
				},
			};
		},
		meta: {
			messages: {
				missingResultType: "Missing result type for query",
				incorrectResultType: "Incorrect result type for query",
				extraneousResultType: "Query doesn't return any data",
			},
			schema: [],
			type: "suggestion",
			fixable: "code",
		},
		defaultOptions: [],
	});
}

function isTypeNodeCompatibleWithColumnType(
	typeNode: TSESTree.TypeNode,
	columnType: ColumnType,
): boolean {
	switch (typeNode.type) {
		case TSESTree.AST_NODE_TYPES.TSUnknownKeyword:
			return !!(columnType & ColumnType.Unknown);
		case TSESTree.AST_NODE_TYPES.TSNullKeyword:
			return !!(columnType & ColumnType.Null);
		case TSESTree.AST_NODE_TYPES.TSNumberKeyword:
			return !!(columnType & ColumnType.Number);
		case TSESTree.AST_NODE_TYPES.TSStringKeyword:
			return !!(columnType & ColumnType.String);
		case TSESTree.AST_NODE_TYPES.TSTypeReference: {
			const typeName =
				typeNode.typeName.type === TSESTree.AST_NODE_TYPES.Identifier
					? typeNode.typeName.name
					: null;
			return !!(typeName === "Buffer" && columnType & ColumnType.Buffer);
		}
		default: {
			return false;
		}
	}
}

function columnTypeToJSType(type: ColumnType): string {
	const typeParts: ("unknown" | "number" | "Buffer" | "string" | "null")[] = [];

	if (type & ColumnType.Unknown) {
		typeParts.push("unknown");
	}
	if (type & ColumnType.Any || type & ColumnType.Number) {
		typeParts.push("number");
	}
	if (type & ColumnType.Any || type & ColumnType.String) {
		typeParts.push("string");
	}
	if (type & ColumnType.Any || type & ColumnType.Buffer) {
		typeParts.push("Buffer");
	}
	if (type & ColumnType.Null) {
		typeParts.push("null");
	}

	return typeParts.join(" | ");
}

function columnsToObjectLiteralText(columns: ColumnInfo[]): string {
	return `{${columns
		.map((column) => `"${column.name}": ${columnTypeToJSType(column.type)}`)
		.join(", ")}}`;
}

function countBitsSet(v: number): number {
	// From https://graphics.stanford.edu/~seander/bithacks.html
	v = v - ((v >> 1) & 0x55555555);
	v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
	return (((v + (v >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
}
