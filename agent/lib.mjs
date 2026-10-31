// Shared helpers: boot a local near-sandbox, deploy Semilla1 Guard, create owner/agent/merchant/attacker.
import nw from 'near-workspaces';
const { Worker } = nw;
// Minimal NEAR<->yocto helper (near-workspaces 5.x no longer exports NEAR).
export const NEAR = {
  parse(s) { const [i, f = ''] = String(s).replace(/\s*N$/, '').split('.'); return (BigInt(i) * 10n ** 24n + BigInt((f + '0'.repeat(24)).slice(0, 24))).toString(); },
  human(y) { const b = BigInt(y); const i = b / 10n ** 24n; const f = (b % 10n ** 24n).toString().padStart(24, '0').replace(/0+$/, ''); return `${i}${f ? '.' + f.slice(0, 4) : ''} NEAR`; },
};
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
export const WASM = process.env.GUARD_WASM ||
  path.join(here, '../contract/semilla1_guard.near.wasm');

export async function setup({ perTx = '1', daily = '2.5', cooldownNs = 0 } = {}) {
  const worker = await Worker.init(); // local sandbox, ephemeral keys only
  try {
  const root = worker.rootAccount;
  const owner = await root.createSubAccount('owner', { initialBalance: NEAR.parse('20') });
  const agent = await root.createSubAccount('agent', { initialBalance: NEAR.parse('5') });
  const merchant = await root.createSubAccount('merchant', { initialBalance: NEAR.parse('1') });
  const attacker = await root.createSubAccount('attacker', { initialBalance: NEAR.parse('5') });
  const vault = await root.devDeploy(WASM, { initialBalance: NEAR.parse('10') });
  await owner.call(vault, 'new', { owner_id: owner.accountId, per_tx_cap: NEAR.parse(perTx),
    daily_cap: NEAR.parse(daily), cooldown_ns: cooldownNs });
  await owner.call(vault, 'set_agent', { agent: agent.accountId });
  await owner.call(vault, 'add_allowed', { receiver: merchant.accountId });
  return { worker, root, owner, agent, merchant, attacker, vault };
  } catch (e) { await worker.tearDown(); throw e; }
}
export const spend = (signer, vault, receiver, near) =>
  signer.call(vault, 'agent_spend', { receiver: receiver.accountId ?? receiver, amount: NEAR.parse(near) }, { gas: 100_000_000_000_000n });
