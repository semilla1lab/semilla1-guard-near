# Semilla1 Guard — status (v1.1)

## Live on NEAR testnet (free faucet accounts, no mainnet funds)
- v1.0 vault: `vault.semilla1guard-1792872425535.testnet` — 6 judge transactions (1 ALLOW + 5 DENY / function-call-key rejections), listed in `README.md` and `testnet/testnet-run.json`.
- v1.1 vault (anti-griefing fix): `vault2.semilla1guard-1792872425535.testnet` — 4 transactions with NEP-297 events; `get_log` keeps only the agent's calls. See `testnet/testnet-run-fix.json`.
- Verify without an explorer: `bash testnet/verify.sh` (archival RPC, curl + python3).

## Tests (local, no network)
- `contract/`: `cargo test` → 10/10.
- `agent/guard.sandbox.test.mjs`: near-workspaces integration against the shipped wasm (`contract/semilla1_guard.near.wasm`, v1.1) → 9/9.
- `agent/demo.mjs`: sandbox demo; expected output in `agent/demo.expected.txt`.

## Commands
```
cd agent
npm install && bash fetch-sandbox.sh     # one-time: neard 2.13.2 sandbox
npm run build:wasm                        # only if contract changed
npm run demo                              # compare with demo.expected.txt
npm test                                  # expected: pass 9 / fail 0
```

## Gotchas found
1. rustc default wasm features (bulk-memory, sign-ext) → `PrepareError: Deserialization`. Fixed via target-cpu=mvp + wasm-opt lowering.
2. near-sandbox npm ships neard 2.6.2; near-sdk 5.29 imports newer host fns → Link Error. Fixed with neard 2.13.2 sandbox binary.
3. near-workspaces 5.x has no `NEAR` export and wants gas as bigint; local helper in `agent/lib.mjs`.

## Not in this version
Mainnet deployment, TEE attestation, NEAR Intents, Chain Signatures (see README limitations).
