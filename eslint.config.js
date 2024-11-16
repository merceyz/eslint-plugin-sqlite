// @ts-check

import fs from "node:fs";

import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default tseslint.config({
	ignores: (
		await fs.promises.readFile(
			new URL("./.prettierignore", import.meta.url),
			"utf8",
		)
	)
		.split("\n")
		.filter((line) => line.trim() && !line.startsWith("#")),
	extends: [
		eslint.configs.recommended,
		...tseslint.configs.strictTypeChecked,
		...tseslint.configs.stylisticTypeChecked,
		{
			plugins: {
				"simple-import-sort": simpleImportSort,
			},
			rules: {
				"simple-import-sort/imports": "error",
				"simple-import-sort/exports": "error",
			},
		},
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
			files: ["**/*.js"],
			...tseslint.configs.disableTypeChecked,
		},
	],
});
