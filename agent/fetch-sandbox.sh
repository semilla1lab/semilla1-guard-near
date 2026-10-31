#!/usr/bin/env bash
# near-sandbox npm 0.1.5 ships neard 2.6.2, too old for near-sdk 5.29 imports
# (promise_batch_action_use_global_contract_by_account_id, promise_batch_action_transfer_to_gas_key).
# Replace it with neard 2.13.2 sandbox build (local only, no network accounts).
set -euo pipefail
cd "$(dirname "$0")"
V=2.13.2
mkdir -p .sandbox-bin
curl -sL https://s3-us-west-1.amazonaws.com/build.nearprotocol.com/nearcore/Linux-x86_64/$V/near-sandbox.tar.gz | tar xz --strip-components=1 -C .sandbox-bin
cp .sandbox-bin/near-sandbox node_modules/near-sandbox/bin/near-sandbox
node_modules/near-sandbox/bin/near-sandbox --version
