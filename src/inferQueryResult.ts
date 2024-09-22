import { Database } from "better-sqlite3";
import {
	is_column_nullable,
	NullableResult,
	Query,
	JSColumnType,
	NullableStatus,
} from "./parser/parser.js";
import { inferQueryInput } from "./inferQueryInput.js";

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
// https://www.sqlite.org/lang_createtable.html#rowids_and_the_integer_primary_key
// Note that this query doesn't handle the exception to rowid aliasing
const COLUMN_DATA_QUERY = `
SELECT
  iif(\`notnull\` = 1, 1, TYPE = 'INTEGER' AND pk = 1 AND (SELECT COUNT(*) FROM pragma_table_info(:tableName) WHERE pk != 0) = 1) AS 'notnull',
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

/**
 * Query from https://github.com/launchbadge/sqlx/blob/16e3f1025ad1e106d1acff05f591b8db62d688e2/sqlx-sqlite/src/connection/explain.rs#L367-L383
 * License in /THIRD-PARTY-LICENSES.html
 * https://github.com/launchbadge/sqlx/blob/16e3f1025ad1e106d1acff05f591b8db62d688e2/LICENSE-MIT
 * https://github.com/launchbadge/sqlx/blob/16e3f1025ad1e106d1acff05f591b8db62d688e2/LICENSE-APACHE
 */
const TABLE_BLOCK_COLUMNS_QUERY = `
	SELECT s.dbnum, s.rootpage, col.cid as colnum, col.type, col."notnull"
  FROM (
      select 1 dbnum, tss.* from temp.sqlite_schema tss
      UNION ALL select 0 dbnum, mss.* from main.sqlite_schema mss
      ) s
  JOIN pragma_table_info(s.name) AS col
  WHERE s.type = 'table'
  UNION ALL
  SELECT s.dbnum, s.rootpage, idx.seqno as colnum, col.type, col."notnull"
  FROM (
      select 1 dbnum, tss.* from temp.sqlite_schema tss
      UNION ALL select 0 dbnum, mss.* from main.sqlite_schema mss
      ) s
  JOIN pragma_index_info(s.name) AS idx
  LEFT JOIN pragma_table_info(s.tbl_name) as col
    ON col.cid = idx.cid
    WHERE s.type = 'index'
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

	let columns;
	try {
		columns = preparedQuery.columns();
	} catch {
		return [];
	}

	const columnsWithTypes = columns.map((column) => {
		if (!column.table || !column.column) {
			return { name: column.name, type: ColumnType.Unknown };
		}

		const columnData = columnDataStatement.get({
			tableName: column.table,
			columnName: column.column,
		});

		if (!columnData) {
			return { name: column.name, type: ColumnType.Unknown };
		}

		let type = columnData.type;

		const result = is_column_nullable(
			column.column,
			column.table,
			Boolean(columnData.notnull),
			query,
		);

		if (result === NullableResult.NotNull) {
			type &= ~ColumnType.Null;
		} else if (result === NullableResult.Null) {
			type = ColumnType.Null;
		} else {
			type |= ColumnType.Null;
		}

		return { name: column.name, type };
	});

	if (
		columnsWithTypes.some(
			(column) =>
				column.type === ColumnType.Unknown || column.type & ColumnType.Null,
		)
	) {
		// Workaround for https://github.com/WiseLibs/better-sqlite3/issues/1243
		const inputs = inferQueryInput(query, db);
		const args = [];
		if (inputs) {
			args.push(new Array(inputs.count - inputs.names.length).fill(0));
			args.push(Object.fromEntries(inputs.names.map((name) => [name, 0])));
		}

		const queryObject = new Query();
		try {
			const tableBlockColumns = db
				.prepare<
					[],
					{
						dbnum: bigint;
						rootpage: bigint;
						colnum: bigint;
						type: string;
						notnull: bigint;
					}
				>(TABLE_BLOCK_COLUMNS_QUERY)
				.safeIntegers()
				.all();

			for (const row of tableBlockColumns) {
				queryObject.add_table_block_column(
					row.dbnum,
					row.rootpage,
					row.colnum,
					String(row.type),
					Boolean(row.notnull),
				);
			}

			const opcodes = db
				.prepare<
					unknown[],
					{
						addr: bigint;
						opcode: string;
						p1: bigint;
						p2: bigint;
						p3: bigint;
						p4: unknown;
					}
				>(`EXPLAIN ${query}`)
				.safeIntegers()
				.all(...args);

			for (const op of opcodes) {
				queryObject.add_program_step(
					op.addr,
					String(op.opcode),
					op.p1,
					op.p2,
					op.p3,
					String(op.p4 ?? ""),
				);
			}

			const result = queryObject.explain(query);
			if (result) {
				for (let i = 0; i < result.length; i += 3) {
					const index = result[i];
					const nullable_status = result[i + 1] as undefined | NullableStatus;
					const jstype = result[i + 2] as undefined | JSColumnType;

					if (index == null || nullable_status == null || jstype == null) {
						continue;
					}

					if (nullable_status === NullableStatus.Unknown) {
						continue;
					}

					const column = columnsWithTypes[index];
					if (!column) {
						continue;
					}

					if (column.type === ColumnType.Null) {
						continue;
					}

					if (column.type === ColumnType.Unknown) {
						switch (jstype) {
							case JSColumnType.Number:
								column.type = ColumnType.Number;
								break;
							case JSColumnType.String:
								column.type = ColumnType.String;
								break;
							case JSColumnType.Buffer:
								column.type = ColumnType.Buffer;
								break;
							case JSColumnType.Null:
								column.type = ColumnType.Null;
								break;
						}

						if (nullable_status === NullableStatus.Null) {
							column.type |= ColumnType.Null;
						}
					} else if (nullable_status === NullableStatus.NotNull) {
						column.type &= ~ColumnType.Null;
					}
				}
			}
		} finally {
			queryObject.free();
		}
	}

	const columnTypes = new Map<string, ColumnType>();

	for (const column of columnsWithTypes) {
		columnTypes.set(column.name, column.type);
	}

	return Array.from(columnTypes, ([name, type]) => ({ name, type }));
}
