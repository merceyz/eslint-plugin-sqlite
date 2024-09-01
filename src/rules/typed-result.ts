import { ESLintUtils, TSESTree, ASTUtils } from "@typescript-eslint/utils";
import {
	ColumnInfo,
	ColumnType,
	inferQueryResult,
} from "../inferQueryResult.js";
import { RuleOptions } from "../ruleOptions.js";
import { getQueryValue, stringifyNode } from "../utils.js";

type ColumnInfoWithUserType = ColumnInfo & { userTSTypeAnnotation?: string };

export function createTypedResultRule(options: RuleOptions) {
	return ESLintUtils.RuleCreator.withoutDocs({
		create(context) {
			return {
				'CallExpression[callee.type=MemberExpression][callee.property.name="prepare"][arguments.length=1]'(
					node: Omit<TSESTree.CallExpression, "arguments" | "callee"> & {
						arguments: [TSESTree.CallExpression["arguments"][0]];
						callee: TSESTree.MemberExpression;
					},
				) {
					const val = getQueryValue(
						node.arguments[0],
						context.sourceCode.getScope(node.arguments[0]),
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

					const columns: ColumnInfoWithUserType[] | null = inferQueryResult(
						val.value,
						db,
					);
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
					if (!resultParam) {
						return;
					}

					if (resultParam.type !== TSESTree.AST_NODE_TYPES.TSTypeLiteral) {
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

					let isValid = resultParam.members.length === columns.length;

					for (const column of columns) {
						const declaredType = getDeclaredType(
							column.name,
							resultParam.members,
						);

						if (!declaredType) {
							isValid = false;
							continue;
						}

						// If the column type is unknown then preserve what the user set it to
						if (column.type & ColumnType.Unknown) {
							column.userTSTypeAnnotation =
								context.sourceCode.getText(declaredType);
							continue;
						}

						if (
							!doesDeclaredTypeMatchColumn(
								declaredType.typeAnnotation,
								column.type,
							)
						) {
							isValid = false;
						}
					}

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
	if (type & ColumnType.Number) {
		typeParts.push("number");
	}
	if (type & ColumnType.String) {
		typeParts.push("string");
	}
	if (type & ColumnType.Buffer) {
		typeParts.push("Buffer");
	}
	if (type & ColumnType.Null) {
		typeParts.push("null");
	}

	return typeParts.join(" | ");
}

function columnsToObjectLiteralText(columns: ColumnInfoWithUserType[]): string {
	return `{${columns
		.map((column) => {
			let value = `"${column.name}"`;
			if (column.userTSTypeAnnotation) {
				value += column.userTSTypeAnnotation;
			} else {
				value += ": " + columnTypeToJSType(column.type);
			}
			return value;
		})
		.join(", ")}}`;
}

function countBitsSet(v: number): number {
	// From https://graphics.stanford.edu/~seander/bithacks.html
	v = v - ((v >> 1) & 0x55555555);
	v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
	return (((v + (v >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
}

function getDeclaredType(columnName: string, members: TSESTree.TypeElement[]) {
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
		if (name !== columnName) {
			continue;
		}

		return member.typeAnnotation;
	}

	return null;
}

function doesDeclaredTypeMatchColumn(
	declaredType: TSESTree.TypeNode,
	columnType: ColumnType,
): boolean {
	if (declaredType.type === TSESTree.AST_NODE_TYPES.TSUnionType) {
		if (countBitsSet(columnType) === 1) {
			return false;
		}

		return declaredType.types.every((type) =>
			isTypeNodeCompatibleWithColumnType(type, columnType),
		);
	}

	if (countBitsSet(columnType) !== 1) {
		return false;
	}

	return isTypeNodeCompatibleWithColumnType(declaredType, columnType);
}
