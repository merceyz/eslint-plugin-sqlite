FROM rust:1.81.0 AS build

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

FROM rust:1.81.0 AS license

RUN --mount=type=cache,target=/usr/local/cargo/git \
  --mount=type=cache,target=/usr/local/cargo/registry \
  cargo install --version 0.6.4 cargo-about

WORKDIR /parser
COPY Cargo* about* ./
COPY src src
RUN --mount=type=cache,target=/usr/local/cargo/git \
  --mount=type=cache,target=/usr/local/cargo/registry \
  cargo about generate -o THIRD-PARTY-LICENSES.html about.hbs

FROM scratch AS license_export
COPY --from=license /parser/THIRD-PARTY-LICENSES.html /