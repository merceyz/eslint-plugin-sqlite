import { Database } from "better-sqlite3";
import { is_column_nullable, NullableResult } from "./parser/parser.js";

export enum ColumnType {
	Unknown = 1 << 0,
	Number = 1 << 1,
	String = 1 << 2,
	Buffer = 1 << 3,
	Null = 1 << 4,
}

export interface ColumnInfo {
	name: string;
	type: ColumnType;
}

// https://www.sqlite.org/datatype3.html#determination_of_column_affinity
const COLUMN_DATA_QUERY = `
SELECT
  \`notnull\`,
  CASE
    WHEN TYPE LIKE '%INT%' THEN ${ColumnType.Number.toString()}
    WHEN (TYPE LIKE '%CHAR%')
    OR (TYPE LIKE '%CLOB%')
    OR (TYPE LIKE '%TEXT%') THEN ${ColumnType.String.toString()}
    WHEN (TYPE LIKE '%BLOB%')
    OR (TYPE = '') THEN ${ColumnType.Buffer.toString()}
    WHEN (TYPE LIKE '%REAL%')
    OR (TYPE LIKE '%FLOA%')
    OR (TYPE LIKE '%DOUB%') THEN ${ColumnType.Number.toString()}
    WHEN (TYPE == 'ANY' AND (SELECT strict FROM pragma_table_list(:tableName)) == 1) THEN ${(ColumnType.String | ColumnType.Number | ColumnType.Buffer).toString()}
    ELSE ${ColumnType.Number.toString()}
  END type
FROM
  pragma_table_info(:tableName)
  WHERE name = :columnName
`;

export function inferQueryResult(
	query: string,
	db: Database,
): ColumnInfo[] | null {
	let preparedQuery;
	try {
		preparedQuery = db.prepare(query);
	} catch {
		return null;
	}

	const columnDataStatement = db.prepare<
		{ tableName: string; columnName: string },
		{ type: ColumnType; notnull: number }
	>(COLUMN_DATA_QUERY);

	const columnTypes = new Map<string, ColumnType>();

	let columns;
	try {
		columns = preparedQuery.columns();
	} catch {
		return [];
	}

	for (const column of columns) {
		if (!column.table || !column.column) {
			columnTypes.set(column.name, ColumnType.Unknown);
			continue;
		}

		const columnData = columnDataStatement.get({
			tableName: column.table,
			columnName: column.column,
		});

		if (!columnData) {
			throw new Error("Unable to get column data");
		}

		let type = columnData.type | (columnData.notnull ? 0 : ColumnType.Null);

		if (type & ColumnType.Null) {
			const result = is_column_nullable(column.column, column.table, query);
			if (result === NullableResult.NotNull) {
				type &= ~ColumnType.Null;
			} else if (result === NullableResult.Null) {
				type = ColumnType.Null;
			}
		}

		columnTypes.set(column.name, type);
	}

	return Array.from(columnTypes, ([name, type]) => ({ name, type }));
}
