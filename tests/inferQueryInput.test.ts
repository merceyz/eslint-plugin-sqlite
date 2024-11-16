import { expect, it } from "vitest";

import { inferQueryInput } from "../src/inferQueryInput.js";

it("should ignore invalid queries", () => {
	const result = inferQueryInput("SELECT * FROM");

	expect(result).toStrictEqual<typeof result>(null);
});

it("should support anonymous parameters", () => {
	const result = inferQueryInput("SELECT * FROM foo WHERE bar = ?");

	expect(result).toStrictEqual<typeof result>({
		count: 1,
		names: [],
	});
});

it("should support named parameters", () => {
	const result = inferQueryInput(
		"SELECT * FROM foo WHERE bar = :bar or bar = :bar2",
	);

	expect(result).toStrictEqual<typeof result>({
		count: 2,
		names: ["bar", "bar2"],
	});
});

it("should support both anonymous and named parameters", () => {
	const result = inferQueryInput(
		"SELECT * FROM foo WHERE bar = ? or bar = :bar",
	);

	expect(result).toStrictEqual<typeof result>({
		count: 2,
		names: ["bar"],
	});
});

it("should deduplicate named parameters", () => {
	const result = inferQueryInput(
		"SELECT * FROM foo WHERE bar = $bar or bar = :bar or bar = @bar",
	);

	expect(result).toStrictEqual<typeof result>({
		count: 1,
		names: ["bar"],
	});
});

it("should handle ?NNN parameters", () => {
	const result = inferQueryInput(
		"SELECT * FROM foo WHERE bar = ? or bar = ?1 or bar = ?2",
	);

	expect(result).toStrictEqual<typeof result>({
		count: 2,
		names: [],
	});
});
