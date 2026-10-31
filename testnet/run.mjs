// Semilla1 Guard — NEAR TESTNET deploy + ALLOW/DENY demo (free faucet funds only).
import nearApi from 'near-api-js';
import fs from 'fs';
const { connect, keyStores, KeyPair, utils, transactions } = nearApi;
const P = utils.format.parseNearAmount, EX = 'https://testnet.nearblocks.io/txns/';
const root = JSON.parse(fs.readFileSync('.root-key.json'));
const ks = new keyStores.InMemoryKeyStore();
await ks.setKey('testnet', root.id, KeyPair.fromString(root.sk));
const near = await connect({ networkId: 'testnet', nodeUrl: 'https://rpc.testnet.near.org', keyStore: ks });
const R = await near.account(root.id);
const out = { root: root.id, txs: [] };
const rec = (label, r) => { const h = r.transaction?.hash || r.transaction_outcome?.id; out.txs.push({ label, hash: h, url: EX + h }); console.log(label, EX + h); return r; };
const sub = async (name, amt) => { const id = `${name}.${root.id}`; await ks.setKey('testnet', id, KeyPair.fromString(root.sk));
  rec(`create ${id}`, await R.createAccount(id, KeyPair.fromString(root.sk).getPublicKey(), P(amt))); return near.account(id); };
const vault = await sub('vault', '3'), agent = await sub('agent', '0.5'), merchant = await sub('merchant', '0.1'), attacker = await sub('attacker', '0.3');
const owner = R;
rec('deploy wasm', await vault.deployContract(fs.readFileSync('../contract/semilla1_guard.near.wasm')));
const call = (a, m, args, deposit = '0') => a.functionCall({ contractId: vault.accountId, methodName: m, args, gas: 100_000_000_000_000n, attachedDeposit: BigInt(deposit) });
rec('new', await call(owner, 'new', { owner_id: owner.accountId, per_tx_cap: P('0.2'), daily_cap: P('0.5'), cooldown_ns: 0 }));
rec('set_agent', await call(owner, 'set_agent', { agent: agent.accountId }));
rec('add_allowed merchant', await call(owner, 'add_allowed', { receiver: merchant.accountId }));
const dec = (r) => Buffer.from(r.status.SuccessValue || '', 'base64').toString();
for (const [label, s, to, amt] of [
  ['ALLOW? merchant 0.1', agent, merchant, '0.1'], ['DENY? attacker receiver 0.1', agent, attacker, '0.1'],
  ['DENY? per_tx_cap 1', agent, merchant, '1'], ['DENY? non-agent signer', attacker, merchant, '0.1'],
  ['ALLOW? merchant 0.2', agent, merchant, '0.2'], ['ALLOW? merchant 0.2 (0.5 used)', agent, merchant, '0.2'], ['DENY? daily_cap 0.1', agent, merchant, '0.1']]) {
  try { const r = await call(s, 'agent_spend', { receiver: to.accountId, amount: P(amt) }); rec(`${label} -> returned ${dec(r)}`, r); }
  catch (e) { const h = e.transaction_outcome?.id || e.context?.transactionHash; out.txs.push({ label: label + ' -> PANIC', err: String(e.message).slice(0, 200), hash: h, url: h && EX + h }); console.log(label, 'PANIC', String(e.message).slice(0, 150)); }
}
// Function-call access key test: key scoped to vault.agent_spend only, 0.25 NEAR allowance.
const fc = KeyPair.fromRandom('ed25519');
rec('add FC key on agent (agent_spend only)', await agent.addKey(fc.getPublicKey(), vault.accountId, ['agent_spend'], P('0.25')));
const ks2 = new keyStores.InMemoryKeyStore(); await ks2.setKey('testnet', agent.accountId, fc);
const n2 = await connect({ networkId: 'testnet', nodeUrl: 'https://rpc.testnet.near.org', keyStore: ks2 });
const agentFC = await n2.account(agent.accountId);
for (const [label, fn] of [['FC key: sendMoney 0.1 to attacker', () => agentFC.sendMoney(attacker.accountId, BigInt(P('0.1')))],
  ['FC key: call set_policy', () => agentFC.functionCall({ contractId: vault.accountId, methodName: 'set_policy', args: { per_tx_cap: P('100') }, gas: 30_000_000_000_000n })],
  ['FC key: agent_spend (daily cap exhausted -> false)', () => agentFC.functionCall({ contractId: vault.accountId, methodName: 'agent_spend', args: { receiver: merchant.accountId, amount: P('0.1') }, gas: 100_000_000_000_000n })]]) {
  try { const r = await fn(); rec(`${label} -> OK returned ${dec(r)}`, r); }
  catch (e) { out.txs.push({ label: label + ' -> REJECTED', err: String(e.type || e.message).slice(0, 200) }); console.log(label, 'REJECTED', String(e.type || e.message).slice(0, 150)); }
}
out.policy = await vault.viewFunction({ contractId: vault.accountId, methodName: 'get_policy' });
out.remaining = await vault.viewFunction({ contractId: vault.accountId, methodName: 'get_remaining_today' });
out.log = await vault.viewFunction({ contractId: vault.accountId, methodName: 'get_log', args: { from: 0, limit: 50 } });
console.log(JSON.stringify({ policy: out.policy, remaining: out.remaining, log: out.log }, null, 1));
fs.writeFileSync('testnet-run.json', JSON.stringify(out, null, 1));
