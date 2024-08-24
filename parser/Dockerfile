FROM rust:1.80.1 AS build

RUN --mount=type=cache,target=/usr/local/cargo/git \
  --mount=type=cache,target=/usr/local/cargo/registry \
  cargo install --version 0.13.0 wasm-pack

RUN rustup target add wasm32-unknown-unknown

WORKDIR /parser
COPY Cargo* .
COPY src src

RUN --mount=type=cache,target=/usr/local/cargo/git \
  --mount=type=cache,target=/usr/local/cargo/registry \
  --mount=type=cache,target=/root/.cache \
  --mount=type=cache,sharing=private,target=/parser/target \
  wasm-pack build --target nodejs --release && rm pkg/.gitignore

FROM scratch AS build_export
COPY --from=build /parser/pkg /