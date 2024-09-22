use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub enum JSColumnType {
	Number,
	String,
	Buffer,
	Null,
}

#[wasm_bindgen]
pub enum NullableStatus {
	NotNull,
	Null,
	Unknown,
}

#[wasm_bindgen]
pub struct Query {
	table_block_columns: Vec<(i64, i64, i64, String, bool)>,
	program: Vec<(i64, String, i64, i64, i64, Vec<u8>)>,
}

#[wasm_bindgen]
impl Query {
	#[wasm_bindgen(constructor)]
	pub fn new() -> Query {
		Query {
			table_block_columns: Vec::new(),
			program: Vec::new(),
		}
	}

	pub fn add_table_block_column(
		&mut self,
		dbnum: i64,
		rootpage: i64,
		colnum: i64,
		type_name: String,
		notnull: bool,
	) {
		self.table_block_columns
			.push((dbnum, rootpage, colnum, type_name, notnull));
	}

	pub fn add_program_step(
		&mut self,
		addr: i64,
		opcode: String,
		p1: i64,
		p2: i64,
		p3: i64,
		p4: String,
	) {
		self.program
			.push((addr, opcode, p1, p2, p3, p4.into_bytes()));
	}

	pub fn explain(&self, query: String) -> Option<Vec<i32>> {
		let result = sqlx_sqlite::connection::explain::explain(
			&self.table_block_columns,
			&self.program,
			&query,
		);

		match result {
			Ok((type_info, nullable)) => {
				let results = type_info
					.iter()
					.zip(nullable.iter())
					.enumerate()
					.flat_map(|(index, (type_info, nullable))| {
						let nullable_status = match nullable {
							Some(true) => NullableStatus::Null,
							Some(false) => NullableStatus::NotNull,
							None => NullableStatus::Unknown,
						};

						let jstype = match type_info.0 {
							sqlx_sqlite::type_info::DataType::Null => JSColumnType::Null,
							sqlx_sqlite::type_info::DataType::Integer => JSColumnType::Number,
							sqlx_sqlite::type_info::DataType::Float => JSColumnType::Number,
							sqlx_sqlite::type_info::DataType::Text => JSColumnType::String,
							sqlx_sqlite::type_info::DataType::Blob => JSColumnType::Buffer,
							sqlx_sqlite::type_info::DataType::Numeric => JSColumnType::Number,
							sqlx_sqlite::type_info::DataType::Bool => JSColumnType::Number,
							sqlx_sqlite::type_info::DataType::Int4 => JSColumnType::Number,
							sqlx_sqlite::type_info::DataType::Date => JSColumnType::Number,
							sqlx_sqlite::type_info::DataType::Time => JSColumnType::Number,
							sqlx_sqlite::type_info::DataType::Datetime => JSColumnType::Number,
						};

						[index as i32, nullable_status as i32, jstype as i32]
					})
					.collect::<Vec<i32>>();

				Some(results)
			}
			Err(_) => None,
		}
	}
}

impl Default for Query {
	fn default() -> Self {
		Self::new()
	}
}
