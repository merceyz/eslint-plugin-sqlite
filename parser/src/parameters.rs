use fallible_iterator::FallibleIterator;
use indexmap::IndexSet;
use sqlite3_parser::{
    ast::{fmt::ToTokens, ParameterInfo},
    lexer::sql::Parser,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Parameters {
    #[wasm_bindgen(readonly)]
    pub count: u32,

    #[wasm_bindgen(getter_with_clone, readonly)]
    pub names: Vec<String>,
}

#[wasm_bindgen]
pub fn parse_query_parameters(query: String) -> Option<Parameters> {
    let mut parser = Parser::new(query.as_bytes());
    let cmd = parser.next().ok()??;

    let mut parameters = ParameterInfo::default();

    cmd.to_tokens(&mut parameters).ok()?;

    let unique_names = parameters
        .names
        .iter()
        .map(|n| n[1..].to_string())
        .collect::<IndexSet<String>>()
        .into_iter()
        .collect::<Vec<String>>();

    Some(Parameters {
        count: parameters.count - (parameters.names.len() - unique_names.len()) as u32,
        names: unique_names,
    })
}
