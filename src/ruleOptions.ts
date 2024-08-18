import { Database } from "better-sqlite3";

export interface GetDatabaseOptions {
	/**
	 * The filename of the file being linted
	 */
	filename: string;
	/**
	 * The name of the database
	 */
	name: string;
}

export interface RuleOptions {
	getDatabase(options: GetDatabaseOptions): Database;
}
