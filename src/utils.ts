import { ASTUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";

export function stringifyNode(
	node: TSESTree.Expression | TSESTree.PrivateIdentifier,
): string | null {
	switch (node.type) {
		case TSESTree.AST_NODE_TYPES.Identifier: {
			return node.name;
		}
		case TSESTree.AST_NODE_TYPES.MemberExpression: {
			const objectName = stringifyNode(node.object);
			const propertyName = stringifyNode(node.property);
			if (objectName === null || propertyName === null) {
				return null;
			}

			return `${objectName}.${propertyName}`;
		}
		default: {
			return null;
		}
	}
}

/**
 * Attempts to get a query value from a given CallExpression argument.
 */
export function getQueryValue(
	arg: TSESTree.CallExpression["arguments"][0],
	scope: TSESLint.Scope.Scope,
): { value: unknown } | null {
	const value = ASTUtils.getStaticValue(arg, scope);
	if (value) {
		return value;
	}

	if (arg.type === TSESTree.AST_NODE_TYPES.TemplateLiteral) {
		if (arg.expressions.every((expr) => isVariableParameterExpression(expr))) {
			return {
				value: arg.quasis.map((quasi) => quasi.value.cooked).join("?"),
			};
		}

		return null;
	}

	if (arg.type === TSESTree.AST_NODE_TYPES.Identifier) {
		const variable = ASTUtils.findVariable(scope, arg);
		const def = variable?.defs[0];
		if (
			variable?.defs.length === 1 &&
			def?.type === TSESLint.Scope.DefinitionType.Variable &&
			def.node.id.type === TSESTree.AST_NODE_TYPES.Identifier &&
			def.parent.kind === "const" &&
			def.node.init
		) {
			return getQueryValue(def.node.init, scope);
		}
		return null;
	}

	return null;
}

/**
 * Checks if the expression looks like `foo.map(() => '?').join(',')`
 */
function isVariableParameterExpression(expr: TSESTree.Expression) {
	if (expr.type !== TSESTree.AST_NODE_TYPES.CallExpression || expr.optional) {
		return false;
	}

	if (expr.callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression) {
		return false;
	}

	if (!expr.arguments[0]) {
		return false;
	}

	if (ASTUtils.getPropertyName(expr.callee) !== "join") {
		return false;
	}

	const joinValue = ASTUtils.getStaticValue(expr.arguments[0]);
	if (typeof joinValue?.value !== "string" || joinValue.value.trim() !== ",") {
		return false;
	}

	if (
		expr.callee.object.type !== TSESTree.AST_NODE_TYPES.CallExpression ||
		expr.callee.object.optional
	) {
		return false;
	}

	const maybeMapExpr = expr.callee.object;

	if (maybeMapExpr.callee.type !== TSESTree.AST_NODE_TYPES.MemberExpression) {
		return false;
	}

	if (ASTUtils.getPropertyName(maybeMapExpr.callee) !== "map") {
		return false;
	}

	if (!maybeMapExpr.arguments[0]) {
		return false;
	}

	const maybeCallback = maybeMapExpr.arguments[0];

	if (maybeCallback.type !== TSESTree.AST_NODE_TYPES.ArrowFunctionExpression) {
		return false;
	}

	const mapValue = ASTUtils.getStaticValue(maybeCallback.body);
	if (typeof mapValue?.value !== "string" || mapValue.value.trim() !== "?") {
		return false;
	}

	return true;
}
