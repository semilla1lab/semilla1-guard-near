//! Semilla1 Guard: on-chain spending-limit vault for AI agents.
//! Denials do NOT panic (a panic would revert the audit-log write); they log + return false.
use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, Vector};
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise};

const DAY_NS: u64 = 86_400_000_000_000;

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Decision { Allow, Deny }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct AuditEntry {
    pub ts_ns: u64,
    pub actor: AccountId,
    pub receiver: AccountId,
    pub amount: U128,
    pub decision: Decision,
    pub reason: String,
}

#[near(serializers = [json])]
pub struct Policy { pub per_tx_cap: U128, pub daily_cap: U128, pub cooldown_ns: u64, pub agent: Option<AccountId> }

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Guard {
    owner_id: AccountId,
    agent: Option<AccountId>,
    per_tx_cap: u128,
    daily_cap: u128,
    cooldown_ns: u64,
    last_spend_ns: u64,
    window: Vec<(u64, u128)>,
    allowlist: IterableMap<AccountId, bool>,
    log: Vector<AuditEntry>,
}

#[near]
impl Guard {
    #[init]
    pub fn new(owner_id: AccountId, per_tx_cap: U128, daily_cap: U128, cooldown_ns: u64) -> Self {
        require!(per_tx_cap.0 <= daily_cap.0, "per_tx_cap > daily_cap");
        Self { owner_id, agent: None, per_tx_cap: per_tx_cap.0, daily_cap: daily_cap.0,
               cooldown_ns, last_spend_ns: 0, window: vec![],
               allowlist: IterableMap::new(b"a"), log: Vector::new(b"l") }
    }

    fn assert_owner(&self) { require!(env::predecessor_account_id() == self.owner_id, "owner only"); }

    pub fn set_policy(&mut self, per_tx_cap: Option<U128>, daily_cap: Option<U128>, cooldown_ns: Option<u64>) {
        self.assert_owner();
        if let Some(v) = per_tx_cap { self.per_tx_cap = v.0; }
        if let Some(v) = daily_cap { self.daily_cap = v.0; }
        if let Some(v) = cooldown_ns { self.cooldown_ns = v; }
        require!(self.per_tx_cap <= self.daily_cap, "per_tx_cap > daily_cap");
    }
    pub fn set_agent(&mut self, agent: Option<AccountId>) { self.assert_owner(); self.agent = agent; }
    pub fn add_allowed(&mut self, receiver: AccountId) { self.assert_owner(); self.allowlist.insert(receiver, true); }
    pub fn remove_allowed(&mut self, receiver: AccountId) { self.assert_owner(); self.allowlist.remove(&receiver); }

    #[payable]
    pub fn fund(&mut self) {}

    pub fn owner_withdraw(&mut self, amount: U128, to: Option<AccountId>) -> Promise {
        self.assert_owner();
        Promise::new(to.unwrap_or(self.owner_id.clone())).transfer(NearToken::from_yoctonear(amount.0))
    }

    /// The guarded path. Returns true on ALLOW (transfer scheduled), false on DENY (logged).
    pub fn agent_spend(&mut self, receiver: AccountId, amount: U128) -> bool {
        let actor = env::predecessor_account_id();
        let now = env::block_timestamp();
        self.prune(now);
        let spent: u128 = self.window.iter().map(|(_, a)| a).sum();
        let reason = if self.agent.as_ref() != Some(&actor) { Some("not agent") }
            else if amount.0 == 0 { Some("zero amount") }
            else if amount.0 > self.per_tx_cap { Some("per_tx_cap") }
            else if spent.saturating_add(amount.0) > self.daily_cap { Some("daily_cap") }
            else if self.last_spend_ns != 0 && now.saturating_sub(self.last_spend_ns) < self.cooldown_ns { Some("cooldown") }
            else if !self.allowlist.contains_key(&receiver) { Some("receiver not allowed") }
            else { None };
        let decision = if reason.is_none() { Decision::Allow } else { Decision::Deny };
        let why = reason.unwrap_or("ok");
        // NEP-297 event for every attempt (logs cost the caller gas only, no storage).
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"semilla1_guard\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":[{{\"actor\":\"{}\",\"receiver\":\"{}\",\"amount\":\"{}\",\"reason\":\"{}\"}}]}}",
            if decision == Decision::Allow { "allow" } else { "deny" }, actor, receiver, amount.0, why));
        // Anti-griefing: calls from anyone other than the configured agent are NOT persisted,
        // so strangers cannot burn the vault's storage stake by spamming denied calls.
        if self.agent.as_ref() != Some(&actor) { return false; }
        self.log.push(AuditEntry { ts_ns: now, actor, receiver: receiver.clone(), amount,
            decision: decision.clone(), reason: why.to_string() });
        if decision == Decision::Deny { return false; }
        self.window.push((now, amount.0));
        self.last_spend_ns = now;
        let _ = Promise::new(receiver).transfer(NearToken::from_yoctonear(amount.0));
        true
    }

    fn prune(&mut self, now: u64) { self.window.retain(|(t, _)| now.saturating_sub(*t) < DAY_NS); }

    pub fn get_policy(&self) -> Policy {
        Policy { per_tx_cap: U128(self.per_tx_cap), daily_cap: U128(self.daily_cap), cooldown_ns: self.cooldown_ns, agent: self.agent.clone() }
    }
    pub fn get_remaining_today(&self) -> U128 {
        let now = env::block_timestamp();
        let spent: u128 = self.window.iter().filter(|(t, _)| now.saturating_sub(*t) < DAY_NS).map(|(_, a)| a).sum();
        U128(self.daily_cap.saturating_sub(spent))
    }
    pub fn get_allowlist(&self) -> Vec<AccountId> { self.allowlist.keys().cloned().collect() }
    pub fn get_log(&self, from: u32, limit: u32) -> Vec<AuditEntry> {
        self.log.iter().skip(from as usize).take(limit as usize).cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn acc(s: &str) -> AccountId { s.parse().unwrap() }
    fn ctx(pred: &str, ts: u64) { testing_env!(VMContextBuilder::new().predecessor_account_id(acc(pred)).block_timestamp(ts).build()); }
    fn setup() -> Guard {
        ctx("owner.near", 1);
        let mut g = Guard::new(acc("owner.near"), U128(10), U128(25), 1_000);
        g.set_agent(Some(acc("agent.near")));
        g.add_allowed(acc("merchant.near"));
        g
    }

    #[test] fn test_allows_within_policy() { let mut g = setup(); ctx("agent.near", 10); assert!(g.agent_spend(acc("merchant.near"), U128(5))); }
    #[test] fn test_rejects_over_per_tx_cap() { let mut g = setup(); ctx("agent.near", 10); assert!(!g.agent_spend(acc("merchant.near"), U128(11))); }
    #[test] fn test_rejects_unlisted_receiver() { let mut g = setup(); ctx("agent.near", 10); assert!(!g.agent_spend(acc("attacker.near"), U128(1))); }
    #[test] fn test_rejects_non_agent_caller() { let mut g = setup(); ctx("attacker.near", 10); assert!(!g.agent_spend(acc("merchant.near"), U128(1))); }
    #[test] fn test_rejects_within_cooldown() {
        let mut g = setup(); ctx("agent.near", 10); assert!(g.agent_spend(acc("merchant.near"), U128(1)));
        ctx("agent.near", 500); assert!(!g.agent_spend(acc("merchant.near"), U128(1)));
    }
    #[test] fn test_rejects_over_daily_cap() {
        let mut g = setup(); let mut t = 10;
        for _ in 0..2 { ctx("agent.near", t); assert!(g.agent_spend(acc("merchant.near"), U128(10))); t += 2_000; }
        ctx("agent.near", t); assert!(!g.agent_spend(acc("merchant.near"), U128(10))); // 30 > 25
        ctx("agent.near", t + DAY_NS); assert!(g.agent_spend(acc("merchant.near"), U128(10))); // window rolled
    }
    #[test] fn test_logs_allow_and_deny() {
        let mut g = setup(); ctx("agent.near", 10);
        g.agent_spend(acc("merchant.near"), U128(1)); g.agent_spend(acc("attacker.near"), U128(1));
        let l = g.get_log(0, 10); assert_eq!(l.len(), 2);
        assert_eq!(l[0].decision, Decision::Allow); assert_eq!(l[1].decision, Decision::Deny);
    }
    #[test] fn test_stranger_calls_not_persisted() {
        let mut g = setup();
        for i in 0..50 { ctx("attacker.near", 10 + i); assert!(!g.agent_spend(acc("merchant.near"), U128(1))); }
        assert_eq!(g.get_log(0, 100).len(), 0);
        let logs = near_sdk::test_utils::get_logs();
        assert!(logs.last().unwrap().contains("\"event\":\"deny\"") && logs.last().unwrap().contains("not agent"));
    }
    #[test] fn test_agent_denials_still_persisted() {
        let mut g = setup(); ctx("agent.near", 10);
        assert!(!g.agent_spend(acc("attacker.near"), U128(1)));
        let l = g.get_log(0, 10); assert_eq!(l.len(), 1); assert_eq!(l[0].reason, "receiver not allowed");
    }
    #[test] #[should_panic(expected = "owner only")] fn test_policy_owner_only() { let mut g = setup(); ctx("agent.near", 10); g.set_policy(Some(U128(1000)), None, None); }
}
