#!/usr/bin/env bash
# Build a NEAR-runtime-compatible wasm (MVP features only).
# rustc >=1.82 emits bulk-memory/sign-ext by default; nearcore rejects them ("PrepareError: Deserialization").
set -euo pipefail
cd "$(dirname "$0")"
RUSTFLAGS="-C target-cpu=mvp -C link-arg=-s" cargo build --release --target wasm32-unknown-unknown --target-dir target/mvp
npx --prefix ../agent wasm-opt --enable-bulk-memory --enable-bulk-memory-opt --enable-sign-ext \
  --enable-nontrapping-float-to-int --enable-mutable-globals --enable-multivalue --enable-reference-types \
  --llvm-memory-copy-fill-lowering --signext-lowering --llvm-nontrapping-fptoint-lowering -Oz \
  target/mvp/wasm32-unknown-unknown/release/semilla1_guard.wasm -o semilla1_guard.near.wasm
npx --prefix ../agent wasm-opt --mvp-features --enable-mutable-globals semilla1_guard.near.wasm -o /dev/null
ls -la semilla1_guard.near.wasm
