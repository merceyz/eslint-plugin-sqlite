import { parameterPrefixRule } from "../../src/rules/parameter-prefix.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("parameter-prefix", parameterPrefixRule, {
	valid: [
		{
			code: "db.prepare('SELECT * FROM foo WHERE id = :id')",
		},
		{
			code: "db.prepare('SELECT * FROM foo WHERE id = :id')",
			options: [":"],
		},
		{
			code: "db.prepare('SELECT * FROM foo WHERE id = @id')",
			options: ["@"],
		},
		{
			code: "db.prepare('SELECT * FROM foo WHERE id = $id')",
			options: ["$"],
		},
	],
	invalid: [
		{
			code: 'db.prepare("SELECT * FROM foo WHERE id = :id")',
			options: ["@"],
			errors: [
				{
					messageId: "incorrectPrefixUsed",
					data: {
						prefix: "@",
					},
				},
			],
		},
		{
			code: 'db.prepare("SELECT * FROM foo WHERE id = @id")',
			options: ["$"],
			errors: [
				{
					messageId: "incorrectPrefixUsed",
					data: {
						prefix: "$",
					},
				},
			],
		},
		{
			code: 'db.prepare("SELECT * FROM foo WHERE id = $id")',
			options: [":"],
			errors: [
				{
					messageId: "incorrectPrefixUsed",
					data: {
						prefix: ":",
					},
				},
			],
		},
	],
});
