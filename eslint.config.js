// @ts-check

import fs from "node:fs";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	prettier,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
			},
		},
		linterOptions: {
			reportUnusedDisableDirectives: "error",
		},
		rules: {
			"no-undef": "off",
			"@typescript-eslint/prefer-literal-enum-member": [
				"error",
				{ allowBitwiseExpressions: true },
			],
		},
	},
	{
		ignores: (
			await fs.promises.readFile(
				new URL("./.prettierignore", import.meta.url),
				"utf8",
			)
		)
			.split("\n")
			.filter((line) => line.trim() && !line.startsWith("#")),
	},
);
