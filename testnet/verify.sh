#!/usr/bin/env bash
# Judge verification: no wallet, no install beyond curl + python3.
# Prints, for each demo tx, the signer, what the agent tried, and what the vault decided
# (from on-chain receipt logs / return value), read from NEAR testnet archival RPC.
# The regular RPC prunes tx older than ~2.5 days, so archival is used on purpose.
set -u
ARPC=${ARPC:-https://archival-rpc.testnet.fastnear.com}
ROOT=semilla1guard-1792872425535.testnet
V1="Ht1aft7ryQMD8SZx5gykTER11ebF9sy3a5xuuTcJHSGs ATysBMEH9iCCeBxP2JksqcGt9AghuJFHAmgNQn8Duqj7 BjYmWVuzhDpcUYPdzUY527TU9RFAQH9Vs8Ncv9XVyp1W 8hcMXQANFDnCsMbEyEfzwLHyvXDrwRHxdnP2FzUsbwwe GCdA74UvrLNienA6bTbRDemnRY5S1zvgwo2MbtAbmTnZ 7pdqi5drkidHVjY9gMzQSJcKFRQUXtHZgCNBvHYzwSeD"
# v1.1 anti-griefing fix on vault2 (expect: true, false, false, false; all with EVENT_JSON logs)
V2="H3At5VeosMwifJAz7TM293YoTHhXxP4SLeLuUFhD76CK 2dNu54FyeTwCkuhqPm4QGQfsuKYT6oCYaNVSqEPdQM1m CzHsVkExfWzaBSxuSHz5dEsgqtfVP7XbWAT8TPNkTAXv 2yx2TVwsyRZ35hH4ifhFPRvh9AVYgEbXKWzWs1CEfscb"
for h in $V1 $V2; do
  out=""
  for snd in agent.$ROOT attacker.$ROOT $ROOT; do
    out=$(curl -s -m 20 "$ARPC" -H 'content-type: application/json' \
      -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tx\",\"params\":{\"tx_hash\":\"$h\",\"sender_account_id\":\"$snd\",\"wait_until\":\"NONE\"}}" \
      | python3 -c '
import sys,json,base64
r=json.load(sys.stdin)
if "result" not in r: sys.exit(1)
t=r["result"]["transaction"]; logs=[]
for o in r["result"]["receipts_outcome"]: logs+=o["outcome"]["logs"]
st=r["result"]["status"]; ret=""
if "SuccessValue" in st: ret=base64.b64decode(st["SuccessValue"]).decode() or "(empty)"
else: ret="FAILURE "+json.dumps(st.get("Failure",st))[:160]
acts=[a for a in t["actions"] if isinstance(a,dict) and "FunctionCall" in a]
args=base64.b64decode(acts[0]["FunctionCall"]["args"]).decode() if acts else ""
m=acts[0]["FunctionCall"]["method_name"] if acts else "-"
print("  signer   "+t["signer_id"]); print("  call     "+m+" "+args); print("  returns  "+ret)
for l in logs: print("  log      "+l[:200])
') && break
  done
  echo "tx $h"; [ -n "$out" ] && echo "$out" || echo "  NOT FOUND (try https://testnet.nearblocks.io/txns/$h)"
done
