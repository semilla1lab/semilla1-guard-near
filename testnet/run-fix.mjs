// Semilla1 Guard fix-storage-griefing branch — fresh TESTNET vault (free faucet funds only). Does not touch the original vault.
import nearApi from 'near-api-js';
import fs from 'fs';
const { connect, keyStores, KeyPair, utils } = nearApi;
const P = utils.format.parseNearAmount, EX = 'https://testnet.nearblocks.io/txns/';
const root = JSON.parse(fs.readFileSync('.root-key.json'));
const ks = new keyStores.InMemoryKeyStore();
const kp = KeyPair.fromString(root.sk);
const near = await connect({ networkId: 'testnet', nodeUrl: 'https://rpc.testnet.near.org', keyStore: ks });
for (const n of ['', 'agent.', 'merchant.', 'attacker.', 'vault2.']) await ks.setKey('testnet', n + root.id, kp);
const R = await near.account(root.id);
const out = { root: root.id, branch: 'fix-storage-griefing', txs: [] };
const rec = (label, r, extra = {}) => { const h = r.transaction?.hash || r.transaction_outcome?.id; out.txs.push({ label, hash: h, url: EX + h, ...extra }); console.log(label, EX + h); return r; };
const vid = 'vault2.' + root.id;
rec(`create ${vid}`, await R.createAccount(vid, kp.getPublicKey(), P('3')));
const vault = await near.account(vid);
const [agent, merchant, attacker] = await Promise.all(['agent.', 'merchant.', 'attacker.'].map(n => near.account(n + root.id)));
rec('deploy fix wasm', await vault.deployContract(fs.readFileSync('semilla1_guard.fix.wasm')));
const call = (a, m, args) => a.functionCall({ contractId: vid, methodName: m, args, gas: 100_000_000_000_000n, attachedDeposit: 0n });
rec('new', await call(R, 'new', { owner_id: R.accountId, per_tx_cap: P('0.2'), daily_cap: P('0.5'), cooldown_ns: 0 }));
rec('set_agent', await call(R, 'set_agent', { agent: agent.accountId }));
rec('add_allowed merchant', await call(R, 'add_allowed', { receiver: merchant.accountId }));
const dec = r => Buffer.from(r.status.SuccessValue || '', 'base64').toString();
const logs = r => [r.transaction_outcome, ...r.receipts_outcome].flatMap(o => o.outcome.logs).filter(l => l.startsWith('EVENT_JSON'));
for (const [label, s, to, amt] of [
  ['ALLOW? agent->merchant 0.1', agent, merchant, '0.1'],
  ['DENY? agent->attacker 0.1', agent, attacker, '0.1'],
  ['DENY? non-agent signer (griefing attempt)', attacker, merchant, '0.1'],
  ['DENY? non-agent signer (griefing attempt 2)', attacker, merchant, '0.1']]) {
  const r = await call(s, 'agent_spend', { receiver: to.accountId, amount: P(amt) });
  rec(`${label} -> returned ${dec(r)}`, r, { events: logs(r) });
}
out.log = await vault.viewFunction({ contractId: vid, methodName: 'get_log', args: { from: 0, limit: 50 } });
out.remaining = await vault.viewFunction({ contractId: vid, methodName: 'get_remaining_today', args: {} });
fs.writeFileSync('testnet-run-fix.json', JSON.stringify(out, null, 2));
console.log('log entries', out.log.length, JSON.stringify(out.log)); console.log('remaining', out.remaining);
