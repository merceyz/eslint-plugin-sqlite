import { Database } from "better-sqlite3";
import { parse_query_parameters } from "./parser/parser.js";

export function inferQueryInput(
	query: string,
	db: Database,
): { count: number; names: string[] } | null {
	// Check that the query is valid
	try {
		db.prepare(query);
	} catch {
		return null;
	}

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
