# Semilla1 Guard — NEAR AI Security track (NEAR Hackathon, Nov 2026)

**Team:** Semilla1 Lab · **Track:** AI Security + agents
**Status:** SCOPING ONLY. No account, no deploy, no submission, no X post, no fund outflow.

## 0. One-liner
A NEAR smart-contract **policy guard / spending-limit vault** that lets an AI agent move money
**only within on-chain enforced rules** (per-tx cap, rolling daily cap, allow-listed receivers
and methods, cooldown), with a tamper-proof **on-chain audit log**. "Give AI money without
giving it the keys to everything" — enforced by consensus, not by trust in the agent.

## 1. Why this fits the track (verbatim category text)
Official: *"Build spending limits, policy engines, sandboxed wallets, reputation and scam
detection. Give AI money without giving it the keys to everything."* Listed tech: NEAR
function-call access keys, TEE attestation, agent security.

Semilla1 Guard hits the first three head-on:
- **Spending limits** → per-tx + rolling 24h caps enforced in the contract.
- **Policy engine** → allow-list of (receiver, method) pairs + cooldown, evaluated on-chain.
- **Sandboxed wallet** → the vault holds funds; the agent NEVER holds a full-access key. The
  agent only gets a **function-call access key** scoped to `agent_spend` on the vault contract,
  with a NEAR gas allowance. It is structurally incapable of transferring funds directly or
  calling any other contract.

This builds directly on our existing **txcheck** (x402 paid on-chain lookups for AI buyer
agents on Base): same thesis — *safe money rails for autonomous agents* — now on NEAR.

## 2. The security property we guarantee (the headline claim)
> Even if the AI agent (or its key) is fully compromised, an attacker holding the agent's
> function-call key **cannot**: (a) exceed the per-tx cap, (b) exceed the rolling 24h cap,
> (c) pay any receiver/method not on the owner-set allow-list, (d) bypass the cooldown, or
> (e) transfer NEAR to an arbitrary address. The worst case is bounded to `daily_cap`.

This is provable and demo-able: we show a malicious/over-limit call being **rejected on-chain**,
and every decision (allow/deny) appended to an immutable log.

## 3. Why it can win
- **Exactly on-theme**, not a tangent. Judges (Helius, Electric Capital, + Claude Code & Codex)
  can read the claim and verify it from the tests in minutes.
- **Narrow + finishable**: one contract, ~6 methods, a thin agent demo. No chain-sig/TEE
  moving parts required for the core property (they are optional "stretch" credit).
- **Verifiable on testnet**: anyone can call it and watch a bad transfer bounce.
- **AI-judge friendly**: deterministic tests encode each guarantee as an assertion.

## 4. Architecture
```
Owner (Semilla1 Lab)                     AI Agent (buyer / autonomous)
      | full-access key                        | function-call key ONLY
      | (set policy, fund, revoke)             | (receiver=vault, method=["agent_spend"],
      v                                        |  allowance=~0.25 NEAR for gas)
+------------------------------------------------------------------+
|  vault.semilla1.near  (near-sdk-rs contract)                     |
|  state: owner, agent_key_registered, policy{}, spent_window[],   |
|         allowlist{receiver->methods}, log[]                      |
|  agent_spend(receiver, amount, memo):                            |
|     require signer == registered agent                           |
|     check amount <= per_tx_cap                                   |
|     check rolling_24h_spent + amount <= daily_cap                |
|     check receiver in allowlist                                  |
|     check now - last_spend >= cooldown                           |
|     -> Promise::transfer(receiver, amount)  (vault's own funds)  |
|     -> append AuditEntry{ts,receiver,amount,ALLOW}               |
|  else -> append AuditEntry{...,DENY,reason} and panic            |
+------------------------------------------------------------------+
```
Key insight exploited: a **function-call access key cannot attach/transfer NEAR tokens**
(confirmed in NEAR docs). So the agent can only *ask the vault* to spend; the vault's own
logic is the sole gatekeeper of outflows. Defense in depth: even the key's NEAR `allowance`
caps gas spend independently.

## 5. On-chain data model & methods (near-sdk-rs 5.29.x)
State:
- `owner_id: AccountId`
- `agent_account: Option<AccountId>` (the implicit/sub account the agent signs from)
- `per_tx_cap: U128` (yoctoNEAR)
- `daily_cap: U128`
- `cooldown_ns: u64`
- `last_spend_ns: u64`
- `window: Vector<(u64 ts_ns, u128 amount)>`  (entries older than 24h pruned on write)
- `allowlist: UnorderedMap<AccountId, Vec<String>>` (receiver -> allowed memos/tags; empty=any)
- `log: Vector<AuditEntry>`

Methods:
- `new(owner_id, per_tx_cap, daily_cap, cooldown_ns)` — `#[init]`
- `set_policy(per_tx_cap?, daily_cap?, cooldown_ns?)` — owner only
- `set_agent(agent_account)` — owner only (register which account the agent signs from)
- `add_allowed(receiver, tags?)` / `remove_allowed(receiver)` — owner only
- `fund()` — `#[payable]`, anyone can top up the vault
- `agent_spend(receiver, amount: U128, memo?)` — **agent only**, the guarded path
- `owner_withdraw(amount, to?)` — owner only, escape hatch (full-access)
- views: `get_policy()`, `get_remaining_today()`, `get_allowlist()`, `get_log(from,limit)`

AuditEntry: `{ ts_ns, actor, receiver, amount, decision: ALLOW|DENY, reason }`.

## 6. Agent-side flow (demo)
1. Owner deploys vault, calls `new(...)`, `fund()` (e.g. 5 NEAR), `set_agent(agent.testnet)`,
   `add_allowed(merchant.testnet)`, and adds a **function-call key** for `agent.testnet`
   scoped to `receiver_id=vault, method_names=["agent_spend"], allowance=0.25 NEAR`.
2. Agent (Node script using near-api-js, or near-cli) signs `agent_spend(merchant, 0.5)` →
   **ALLOW**, transfer happens, log entry written.
3. Agent tries `agent_spend(attacker, 0.5)` → **DENY (receiver not allowed)**, panics, no funds move.
4. Agent tries `agent_spend(merchant, 100)` → **DENY (per_tx_cap)**.
5. Agent loops to drain → **DENY (daily_cap)** once rolling window exhausted.
6. Show `get_log()` — immutable trail of every decision.

## 7. Scope honesty — what we build vs skip in ~2 weeks
BUILD (core, high-confidence):
- The Rust contract + full unit tests for every guarantee (near-sdk test env / `#[test]`).
- An integration test with `near-workspaces` (sandbox) proving ALLOW/DENY end-to-end.
- A Node demo script that drives the 6-step story against testnet.
- README written for AI judges; a 60–90s screen capture for the mandatory X post.

STRETCH (only if time): 
- **Chain signatures** so the vault can police spend on *other* chains (big wow, more risk).
- **Shade Agent / TEE attestation** to also prove the agent code hash. NOTE: Shade Agent
  framework is DEPRECATED as standalone tooling (after 2026-04-19) and flagged "not for
  mainnet / known critical vulns" — so we only reference it conceptually, we do NOT depend on it.

SKIP: frontend dApp, token (FT), multi-owner governance.

## 8. Day-by-day plan to Nov 14 (submissions open Oct 31 18:00 CDMX)
- **Oct 24–30 (now, pre-open):** finalize SPEC, scaffold contract compiles, write method stubs
  + test skeletons. Decide .near accounts (see open questions). Keep repo private.
- **Oct 31:** submissions open. Implement `agent_spend` happy path + per_tx_cap + transfer.
- **Nov 1–2:** daily_cap rolling window + pruning; cooldown; allowlist. Unit tests green.
- **Nov 3–4:** near-workspaces sandbox integration test; deploy to **testnet**; manual E2E.
- **Nov 5–6:** Node agent demo script (6-step story); function-call key issuance script.
- **Nov 7–8:** README polish for AI judges; record demo video.
- **Nov 9–10:** STRETCH (chain-sig cross-chain policing) IF core is rock-solid, else harden.
- **Nov 11–12:** buffer / audit own code / edge cases (integer overflow, reentrancy via Promise).
- **Nov 13:** dry-run full submission packet (repo public toggle, form fields, X post draft).
- **Nov 14 before 17:59 CDMX:** make repo public, submit form, publish X demo post.

## 10. Scaffold state (2026-10-24)
- `contract/` near-sdk 5.29.1, Guard fully implemented (not just stubs). `cargo test`: **10/10 pass** (v1.1).
- Design fix found while building: a NEAR panic reverts state, so DENY must **log and return
  false** (no panic) or the audit trail of rejected attempts would vanish. Implemented.
- Known TODOs: `window` is a plain Vec (fine for demo; bound its size / use per-bucket sums
  for prod); transfer Promise result not checked via callback (add `on_transfer` callback
  to refund window on failure); storage deposit for the log (charge or cap log length);
  NEP-297 events for indexers; `cargo near build` (cargo-near not installed yet) for ABI +
  reproducible wasm; near-workspaces sandbox integration test; `agent/` Node demo script.
