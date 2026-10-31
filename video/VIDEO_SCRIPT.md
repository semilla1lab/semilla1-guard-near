# Semilla1 Guard — 75 s demo video script (NEAR Hackathon · AI Security)
Brand: Semilla1 Lab only. No personal names. Recording: 1920x1080, terminal font ≥18 pt, browser zoom 125%.
Runbook with exact commands/URLs: `video/DEMO_RUNBOOK.md`. Title card: `video/title.html`.

| Time | Screen | Voiceover (EN) | On-screen text |
|---|---|---|---|
| 0–6 s | title.html slide 1 | "AI agents are getting wallets. One prompt injection and the wallet is drained." | **Semilla1 Guard** — on-chain spend firewall for AI agents |
| 6–14 s | title.html slide 2 (diagram) | "Semilla1 Guard puts the rules in a NEAR smart contract, not in the agent's prompt." | Agent → Guard vault → allowlist · per-tx cap · daily cap · audit log |
| 14–24 s | Terminal: `bash video/live-view.sh` (policy + allowlist) | "This vault is live on NEAR testnet. Policy: 0.2 NEAR per transaction, 0.5 per day, one allow-listed merchant." | Live: vault.semilla1guard-1792872425535.testnet |
| 24–32 s | Explorer: ALLOW tx | "The agent pays the merchant. Allowed." | ✅ ALLOW 0.1 NEAR → merchant |
| 32–40 s | Explorer: DENY receiver tx | "A hijacked agent tries to pay an attacker. The contract says no." | ❌ DENY receiver not allowed |
| 40–46 s | Explorer: DENY per_tx tx | "Tries 1 NEAR in one shot. Over the cap: denied." | ❌ DENY per_tx_cap |
| 46–52 s | Explorer: DENY daily tx | "Tries to drip it out slowly. Daily cap: denied." | ❌ DENY daily_cap |
| 52–62 s | Terminal: `grep "FC key" testnet/testnet-run.out.txt` | "Even the agent's own key is scoped: it can't send NEAR directly or change the policy. The protocol rejects it." | 🔒 RequiresFullAccess · MethodNameMismatch |
| 62–70 s | Terminal: audit log section of live-view.sh | "Every decision—allow or deny—is written on-chain, so humans can audit the agent." | On-chain audit log |
| 70–75 s | title.html slide 3 | "Semilla1 Guard: let agents spend, never drain. Built on NEAR." | Semilla1 Lab · testnet live · open source 14-Nov |
