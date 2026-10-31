# DEMO RUNBOOK — one-take recording (read-only, zero spend)
Nothing here sends transactions. All tx already exist on testnet (EXP-036). Do NOT re-run `testnet/run.mjs` (it would create new accounts / spend faucet).

## Pre-flight (before hitting record)
1. `bash video/live-view.sh > /tmp/lv.txt && head -20 /tmp/lv.txt` → must print policy + allowlist (verified 2026-10-28 07:5x CDMX: OK).
2. Open browser tabs in this order:
   1. video/title.html (open in a browser) (arrow keys = next slide)
   2. ALLOW: https://testnet.nearblocks.io/txns/Ht1aft7ryQMD8SZx5gykTER11ebF9sy3a5xuuTcJHSGs
   3. DENY receiver: https://testnet.nearblocks.io/txns/ATysBMEH9iCCeBxP2JksqcGt9AghuJFHAmgNQn8Duqj7
   4. DENY per_tx: https://testnet.nearblocks.io/txns/BjYmWVuzhDpcUYPdzUY527TU9RFAQH9Vs8Ncv9XVyp1W
   5. DENY daily: https://testnet.nearblocks.io/txns/GCdA74UvrLNienA6bTbRDemnRY5S1zvgwo2MbtAbmTnZ
   6. (backup) contract: https://testnet.nearblocks.io/address/vault.semilla1guard-1792872425535.testnet
   On each tx page, pre-scroll / expand "Logs" or "Execution outcome" so return value true/false is visible.
3. Terminal: `clear`, font ≥18pt, cwd = near-hackathon.

## During recording (matches VIDEO_SCRIPT.md)
| t | action |
|---|---|
| 0–14 | title.html slides 1→2 |
| 14 | `bash video/live-view.sh \| head -14` |
| 24/32/40/46 | switch to tabs 2,3,4,5 |
| 52 | `grep "FC key" testnet/testnet-run.out.txt` |
| 62 | `bash video/live-view.sh \| sed -n '/audit/,$p' \| grep -E 'decision\|reason'` |
| 70 | title.html slide 3 |

## Fallback (if RPC/nearblocks down)
Show `testnet/testnet-run.out.txt` (all links + results) or `video/terminal-transcript.txt`. Offline sandbox: `cd agent && npm run demo` (expected: agent/demo.expected.txt).

## Notes
- "remaining today" now shows 0.5 NEAR (daily window reset since Oct 24) — that's correct; the daily DENY is shown via its historical tx.
