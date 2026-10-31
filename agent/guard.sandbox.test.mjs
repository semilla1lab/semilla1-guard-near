// Integration test: deploy real wasm to near-sandbox and prove the 8 guarantees end-to-end.
// Run: node --test guard.sandbox.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, spend, NEAR } from './lib.mjs';

test('Semilla1 Guard: 8 guarantees on sandbox', { timeout: 300_000 }, async (t) => {
  const ctx = await setup({ perTx: '1', daily: '2.5', cooldownNs: 0 });
  const { worker, owner, agent, merchant, attacker, vault } = ctx;
  try {
    await t.test('1 ALLOW within policy moves funds', async () => {
      const before = BigInt(await merchant.availableBalance());
      assert.equal(await spend(agent, vault, merchant, '0.5'), true);
      const after = BigInt(await merchant.availableBalance());
      assert.equal(after - before, BigInt(NEAR.parse('0.5')));
    });
    await t.test('2 DENY over per-tx cap', async () => assert.equal(await spend(agent, vault, merchant, '1.5'), false));
    await t.test('3 DENY unlisted receiver', async () => assert.equal(await spend(agent, vault, attacker, '0.1'), false));
    await t.test('4 DENY non-agent caller', async () => assert.equal(await spend(attacker, vault, merchant, '0.1'), false));
    await t.test('5 DENY over rolling daily cap', async () => {
      assert.equal(await spend(agent, vault, merchant, '1'), true);   // 1.5 spent
      assert.equal(await spend(agent, vault, merchant, '1'), true);   // 2.5 spent
      assert.equal(await spend(agent, vault, merchant, '0.1'), false); // over 2.5
      assert.equal((await vault.view('get_remaining_today')), '0');
    });
    await t.test('6 DENY during cooldown', async () => {
      await owner.call(vault, 'set_policy', { daily_cap: NEAR.parse('10'), cooldown_ns: 3_600_000_000_000 });
      assert.equal(await spend(agent, vault, merchant, '0.1'), false);
      const last = (await vault.view('get_log', { from: 0, limit: 100 })).at(-1);
      assert.equal(last.reason, 'cooldown');
      await owner.call(vault, 'set_policy', { cooldown_ns: 0 });
    });
    await t.test('7 only owner can change policy / withdraw', async () => {
      await assert.rejects(attacker.call(vault, 'set_policy', { per_tx_cap: NEAR.parse('100') }));
      await assert.rejects(agent.call(vault, 'add_allowed', { receiver: attacker.accountId }));
      await assert.rejects(agent.call(vault, 'owner_withdraw', { amount: '1', to: attacker.accountId }));
    });
    await t.test('8 every agent decision is in the audit log (DENY not reverted); stranger calls are not stored (v1.1 anti-griefing)', async () => {
      const log = await vault.view('get_log', { from: 0, limit: 100 });
      assert.equal(log.length, 7);
      assert.deepEqual(log.map((e) => e.decision),
        ['Allow', 'Deny', 'Deny', 'Allow', 'Allow', 'Deny', 'Deny']);
      assert.deepEqual(log.filter((e) => e.decision === 'Deny').map((e) => e.reason),
        ['per_tx_cap', 'receiver not allowed', 'daily_cap', 'cooldown']);
      assert.ok(log.every((e) => e.actor === agent.accountId));
    });
  } finally { await worker.tearDown(); }
});
