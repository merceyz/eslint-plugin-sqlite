import { RuleTester, RunTests } from "@typescript-eslint/rule-tester";
import { RuleModule } from "@typescript-eslint/utils/ts-eslint";
import * as vitest from "vitest";

RuleTester.afterAll = vitest.afterAll;
RuleTester.it = vitest.it;
RuleTester.itOnly = vitest.it.only;
RuleTester.describe = vitest.describe;

/**
 * RuleTester extended to check if the output of invalid cases are valid inputs
 */
class InternalRuleTester extends RuleTester {
	override run<MessageIds extends string, Options extends readonly unknown[]>(
		ruleName: string,
		rule: RuleModule<MessageIds, Options>,
		test: RunTests<MessageIds, Options>,
	): void {
		super.run(ruleName, rule, {
			...test,
			valid: [
				...test.valid,
				...new Set(
					test.invalid
						.flatMap((test) => test.output)
						.filter((output) => output != undefined),
				),
			],
		});
	}
}

export const ruleTester = new InternalRuleTester();
