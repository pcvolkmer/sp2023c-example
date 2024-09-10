FROM node:alpine AS web

WORKDIR /build
COPY package.json ./
COPY web ./web
COPY src/resources/assets ./src/resources/assets

RUN npm install
RUN npm run build

FROM rust:alpine AS build

RUN apk update
RUN apk add cmake make musl-dev g++

WORKDIR /build
COPY Cargo.toml ./
COPY askama.toml ./
COPY src ./src
COPY --from=web /build/src/resources/assets/main.js ./src/resources/assets/main.js

RUN cargo build --release

# Build image from scratch
FROM scratch
LABEL org.opencontainers.image.source="https://github.com/pcvolkmer/sp2023c-example"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.description="Concept-Demonstration - Beispiel Studienprotokoll 2023 - Teil C"

COPY --from=build /build/target/release/sp2023c-example .
USER 65532
EXPOSE 3000
CMD ["./sp2023c-example"]