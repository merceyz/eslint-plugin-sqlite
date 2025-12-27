use fallible_iterator::FallibleIterator;
use sqlite3_parser::{
	ast::{ParameterInfo, fmt::ToTokens},
	lexer::sql::Parser,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn does_all_named_parameters_start_with_prefix(query: &str, prefix: char) -> Option<bool> {
	let mut parser = Parser::new(query.as_bytes());
	let cmd = parser.next().ok()??;

	let mut parameters = ParameterInfo::default();

	cmd.to_tokens(&mut parameters).ok()?;

	Some(parameters.names.iter().all(|n| n.starts_with(prefix)))
}
