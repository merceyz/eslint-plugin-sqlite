import { parse_query_parameters } from "./parser/parser.js";

export interface QueryInput {
	count: number;
	names: string[];
}

export function inferQueryInput(query: string): QueryInput | null {
	const parameters = parse_query_parameters(query);
	if (parameters == null) {
		return null;
	}

	try {
		return {
			count: parameters.count,
			names: parameters.names,
		};
	} finally {
		parameters.free();
	}
}
