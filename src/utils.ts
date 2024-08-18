import { TSESTree } from "@typescript-eslint/utils";

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
