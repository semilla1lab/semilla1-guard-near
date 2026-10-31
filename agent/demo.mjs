// Semilla1 Guard agent demo (local sandbox). Run: node demo.mjs
import { setup, spend, NEAR } from './lib.mjs';
const fmt = (y) => NEAR.human(y);
const { worker, agent, merchant, attacker, vault } = await setup({ perTx: '1', daily: '2.5' });
try {
  console.log(`Vault ${vault.accountId} | policy`, await vault.view('get_policy'));
  const steps = [
    ['allowed merchant, 0.5 NEAR', agent, merchant, '0.5'],
    ['unlisted receiver (attacker), 0.5 NEAR', agent, attacker, '0.5'],
    ['over per-tx cap, 5 NEAR', agent, merchant, '5'],
    ['non-agent caller tries to spend', attacker, merchant, '0.5'],
    ['drain loop #1 1 NEAR', agent, merchant, '1'],
    ['drain loop #2 1 NEAR (2.5 used)', agent, merchant, '1'],
    ['drain loop #3 0.5 NEAR (exceeds 2.5 daily cap)', agent, merchant, '0.5'],
  ];
  for (const [label, signer, to, amt] of steps) {
    const ok = await spend(signer, vault, to, amt);
    console.log(`${ok ? 'ALLOW' : 'DENY '} | ${label}`);
  }
  console.log('remaining today:', fmt(await vault.view('get_remaining_today')));
  for (const e of await vault.view('get_log', { from: 0, limit: 50 }))
    console.log(`  log: ${e.decision.padEnd(5)} ${e.actor.split('.')[0]} -> ${e.receiver.split('.')[0]} ${fmt(e.amount)} (${e.reason})`);
} finally { await worker.tearDown(); }
