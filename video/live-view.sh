#!/usr/bin/env bash
# Read-only live check of Semilla1 Guard on NEAR testnet (no tx, no keys, no spend).
V=vault.semilla1guard-1792872425535.testnet
q(){ curl -s https://rpc.testnet.near.org -H 'content-type: application/json' -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"call_function\",\"finality\":\"final\",\"account_id\":\"$V\",\"method_name\":\"$1\",\"args_base64\":\"$(printf '%s' "$2" | base64 -w0)\"}}" | python3 -c "import sys,json;r=json.load(sys.stdin)['result'];print(json.dumps(json.loads(bytes(r['result']).decode()),indent=1))"; }
echo "== Semilla1 Guard vault: $V =="
echo "-- policy (yocto: 0.2 NEAR per tx, 0.5 NEAR per day)"; q get_policy '{}'
echo "-- allowlist"; q get_allowlist '{}'
echo "-- remaining today"; q get_remaining_today '{}'
echo "-- on-chain audit log"; q get_log '{"from":0,"limit":20}'
