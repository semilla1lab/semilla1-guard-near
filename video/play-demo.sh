#!/usr/bin/env bash
# Timed terminal demo for screen capture. Read-only. ~78s.
# NOTE: no pipefail — `head` closing the pipe must not abort the demo.
set -eu
cd "$(dirname "$0")/.."
export TERM=xterm-256color
clear
printf '\n  Semilla1 Guard — live NEAR testnet vault\n'
printf '  vault.semilla1guard-1792872425535.testnet\n\n'
sleep 5
printf '== policy + allowlist (live RPC) ==\n'
bash video/live-view.sh 2>/dev/null | head -14 || true
sleep 9
printf '\n== ALLOW 0.1 NEAR → merchant ==\n'
sed -n '15p' testnet/testnet-run.out.txt
sleep 7
printf '\n== DENY receiver not allowed ==\n'
sed -n '17p' testnet/testnet-run.out.txt
sleep 7
printf '\n== DENY per_tx_cap ==\n'
sed -n '19p' testnet/testnet-run.out.txt
sleep 6
printf '\n== DENY daily_cap ==\n'
sed -n '26p' testnet/testnet-run.out.txt
sleep 6
printf '\n== FC key scoped (protocol rejects transfer / set_policy) ==\n'
grep "FC key" testnet/testnet-run.out.txt || true
sleep 8
printf '\n== on-chain audit (allow/deny reasons) ==\n'
bash video/live-view.sh 2>/dev/null | sed -n '/audit/,$p' | grep -E 'decision|reason' | head -40 || true
sleep 8
printf '\n  Semilla1 Guard: let agents spend, never drain.\n'
printf '  Semilla1 Lab · testnet live · open source 14-Nov\n\n'
sleep 6
