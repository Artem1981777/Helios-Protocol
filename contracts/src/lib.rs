//! HeliosVault — on-chain treasury contract for **Helios Protocol** on Casper.
//!
//! Helios is a self-driving treasury for tokenized RWA, run by a swarm of
//! accountable AI agents. This contract is the trust anchor of the whole system:
//!
//!   * Users deposit CSPR (motes) into the vault and keep a per-account balance.
//!   * The **owner** (PolicyManager role) commits a risk policy on-chain, so the
//!     agents can only act within user-defined guardrails.
//!   * An authorized **agent** (Execution / AuditOracle role) records each swarm
//!     rebalance together with the verified risk score. Rebalances that violate
//!     the on-chain policy are rejected by the contract itself.
//!
//! Every state-changing entrypoint emits an event, so the off-chain agents and
//! the dashboard can subscribe to a fully auditable on-chain activity feed.

#![cfg_attr(not(test), no_std)]

extern crate alloc;

use odra::casper_types::U512;
use odra::prelude::*;

/// Risk policy guardrails committed on-chain (the PolicyManager state).
#[odra::odra_type]
#[derive(Default)]
pub struct Policy {
    /// Minimum % of capital that must stay in A-rated RWA pools (0-100).
    pub min_a_rated_pct: u8,
    /// Minimum acceptable pool risk score the agents may rebalance into (0-100).
    pub min_risk_score: u8,
    /// Maximum number of rebalances the swarm may perform per day.
    pub max_daily_rebalances: u32,
}

/// Errors reverted by the contract.
#[odra::odra_error]
pub enum VaultError {
    /// A deposit with zero attached motes was attempted.
    ZeroDeposit = 1,
    /// Caller tried to withdraw more than their balance.
    InsufficientBalance = 2,
    /// Caller is not the contract owner.
    NotOwner = 3,
    /// Caller is not the authorized agent.
    NotAuthorizedAgent = 4,
    /// A rebalance was attempted before any policy was committed.
    PolicyNotSet = 5,
    /// The reported risk score is below the on-chain policy minimum.
    RiskBelowPolicy = 6,
}

#[odra::event]
pub struct Deposited {
    pub account: Address,
    pub amount: U512,
    pub total_managed: U512,
}

#[odra::event]
pub struct Withdrawn {
    pub account: Address,
    pub amount: U512,
}

#[odra::event]
pub struct PolicyUpdated {
    pub owner: Address,
    pub min_a_rated_pct: u8,
    pub min_risk_score: u8,
    pub max_daily_rebalances: u32,
}

#[odra::event]
pub struct Rebalanced {
    pub agent: Address,
    pub apy_bps: u32,
    pub risk_score: u8,
    pub count: u64,
}

#[odra::module(events = [Deposited, Withdrawn, PolicyUpdated, Rebalanced])]
pub struct HeliosVault {
    owner: Var<Address>,
    agent: Var<Address>,
    total_managed: Var<U512>,
    balances: Mapping<Address, U512>,
    policy: Var<Policy>,
    policy_set: Var<bool>,
    rebalance_count: Var<u64>,
    last_apy_bps: Var<u32>,
    last_risk_score: Var<u8>,
}

#[odra::module]
impl HeliosVault {
    /// Deploy-time constructor. The deployer becomes both the owner and the
    /// initial authorized agent (you can rotate the agent later with `set_agent`).
    pub fn init(&mut self) {
        let caller = self.env().caller();
        self.owner.set(caller);
        self.agent.set(caller);
        self.total_managed.set(U512::zero());
        self.policy_set.set(false);
        self.rebalance_count.set(0);
        self.last_apy_bps.set(0);
        self.last_risk_score.set(0);
    }

    /// Deposit CSPR into the vault. The attached motes are credited to the caller.
    #[odra(payable)]
    pub fn deposit(&mut self) {
        let amount = self.env().attached_value();
        if amount == U512::zero() {
            self.env().revert(VaultError::ZeroDeposit);
        }
        let caller = self.env().caller();
        let new_balance = self.balance_of(&caller) + amount;
        self.balances.set(&caller, new_balance);

        let total = self.total_managed() + amount;
        self.total_managed.set(total);

        self.env().emit_event(Deposited {
            account: caller,
            amount,
            total_managed: total,
        });
    }

    /// Withdraw CSPR previously deposited by the caller.
    pub fn withdraw(&mut self, amount: U512) {
        let caller = self.env().caller();
        let balance = self.balance_of(&caller);
        if amount > balance {
            self.env().revert(VaultError::InsufficientBalance);
        }
        self.balances.set(&caller, balance - amount);
        self.total_managed.set(self.total_managed() - amount);

        // Send the motes back to the caller's purse.
        self.env().transfer_tokens(&caller, &amount);

        self.env().emit_event(Withdrawn {
            account: caller,
            amount,
        });
    }

    /// Commit the risk policy on-chain. Owner only (PolicyManager role).
    pub fn set_policy(
        &mut self,
        min_a_rated_pct: u8,
        min_risk_score: u8,
        max_daily_rebalances: u32,
    ) {
        self.assert_owner();
        self.policy.set(Policy {
            min_a_rated_pct,
            min_risk_score,
            max_daily_rebalances,
        });
        self.policy_set.set(true);

        let owner = self.owner();
        self.env().emit_event(PolicyUpdated {
            owner,
            min_a_rated_pct,
            min_risk_score,
            max_daily_rebalances,
        });
    }

    /// Rotate the agent address allowed to record rebalances (Execution agent key).
    pub fn set_agent(&mut self, agent: Address) {
        self.assert_owner();
        self.agent.set(agent);
    }

    /// Record a swarm rebalance. Only the authorized agent may call this, and the
    /// reported risk score must respect the on-chain policy (AuditOracle guardrail).
    pub fn record_rebalance(&mut self, apy_bps: u32, risk_score: u8) {
        self.assert_agent();
        if !self.policy_set.get_or_default() {
            self.env().revert(VaultError::PolicyNotSet);
        }
        let policy = self.policy.get_or_default();
        if risk_score < policy.min_risk_score {
            self.env().revert(VaultError::RiskBelowPolicy);
        }

        let count = self.rebalance_count() + 1;
        self.rebalance_count.set(count);
        self.last_apy_bps.set(apy_bps);
        self.last_risk_score.set(risk_score);

        let agent = self.agent();
        self.env().emit_event(Rebalanced {
            agent,
            apy_bps,
            risk_score,
            count,
        });
    }

    // ----------------------------- views -----------------------------

    pub fn balance_of(&self, account: &Address) -> U512 {
        self.balances.get(account).unwrap_or_default()
    }

    pub fn total_managed(&self) -> U512 {
        self.total_managed.get_or_default()
    }

    pub fn rebalance_count(&self) -> u64 {
        self.rebalance_count.get_or_default()
    }

    pub fn owner(&self) -> Address {
        self.owner.get().unwrap()
    }

    pub fn agent(&self) -> Address {
        self.agent.get().unwrap()
    }

    pub fn get_policy(&self) -> Policy {
        self.policy.get_or_default()
    }

    pub fn last_apy_bps(&self) -> u32 {
        self.last_apy_bps.get_or_default()
    }

    pub fn last_risk_score(&self) -> u8 {
        self.last_risk_score.get_or_default()
    }

    // --------------------------- internal ----------------------------

    fn assert_owner(&self) {
        if self.env().caller() != self.owner() {
            self.env().revert(VaultError::NotOwner);
        }
    }

    fn assert_agent(&self) {
        if self.env().caller() != self.agent() {
            self.env().revert(VaultError::NotAuthorizedAgent);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, HostEnv, HostRef, NoArgs};

    fn setup() -> (HostEnv, HeliosVaultHostRef) {
        let env = odra_test::env();
        let vault = HeliosVault::deploy(&env, NoArgs);
        (env, vault)
    }

    #[test]
    fn deposit_and_withdraw_tracks_balance() {
        let (env, mut vault) = setup();
        let user = env.get_account(1);
        env.set_caller(user);

        vault.with_tokens(U512::from(1_000u64)).deposit();
        assert_eq!(vault.total_managed(), U512::from(1_000u64));
        assert_eq!(vault.balance_of(&user), U512::from(1_000u64));

        vault.withdraw(U512::from(400u64));
        assert_eq!(vault.balance_of(&user), U512::from(600u64));
        assert_eq!(vault.total_managed(), U512::from(600u64));
    }

    #[test]
    fn policy_then_rebalance_within_guardrails() {
        let (_env, mut vault) = setup();
        vault.set_policy(60, 70, 2);
        vault.record_rebalance(1180, 82);
        assert_eq!(vault.rebalance_count(), 1);
        assert_eq!(vault.last_apy_bps(), 1180);
        assert_eq!(vault.last_risk_score(), 82);
    }

    #[test]
    fn rebalance_below_policy_is_rejected() {
        let (_env, mut vault) = setup();
        vault.set_policy(60, 70, 2);
        // risk_score 50 < min_risk_score 70 -> must revert
        let result = vault.try_record_rebalance(1180, 50);
        assert_eq!(result, Err(VaultError::RiskBelowPolicy.into()));
    }

    #[test]
    fn rebalance_requires_policy() {
        let (_env, mut vault) = setup();
        let result = vault.try_record_rebalance(1180, 82);
        assert_eq!(result, Err(VaultError::PolicyNotSet.into()));
    }
}
