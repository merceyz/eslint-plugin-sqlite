import { Database } from "better-sqlite3";

export enum ColumnType {
	Unknown = 1 << 0,
	Number = 1 << 1,
	String = 1 << 2,
	Buffer = 1 << 3,
	Null = 1 << 4,
	Any = 1 << 5,
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
    WHEN (TYPE == 'ANY' AND (SELECT strict FROM pragma_table_list(:tableName)) == 1) THEN ${ColumnType.Any.toString()}
    ELSE ${ColumnType.Number.toString()}
  END type
FROM
  pragma_table_info(:tableName)
  WHERE name = :columnName
`;

export function inferQueryResult(query: string, db: Database): ColumnInfo[] {
	const columnDataStatement = db.prepare<
		{ tableName: string; columnName: string },
		{ type: ColumnType; notnull: number }
	>(COLUMN_DATA_QUERY);

	const columnTypes = new Map<string, ColumnType>();

	for (const column of db.prepare(query).columns()) {
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

		columnTypes.set(
			column.name,
			columnData.type | (columnData.notnull ? 0 : ColumnType.Null),
		);
	}

	return Array.from(columnTypes, ([name, type]) => ({ name, type }));
}
