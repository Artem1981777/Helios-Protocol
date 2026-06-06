//! Deploys `HeliosVault` to a live Casper network (Testnet) and runs a smoke test
//! that produces the project's FIRST real on-chain transactions:
//!   1. install the contract,
//!   2. commit a risk policy,
//!   3. deposit 1 CSPR,
//!   4. record a swarm rebalance.
//!
//! Run with:
//!   ODRA_CASPER_LIVENET_ENV=casper-test cargo run --bin helios_vault_on_livenet --features livenet

use helios_vault::HeliosVault;
use odra::casper_types::U512;
use odra::host::{Deployer, NoArgs};

fn main() {
    let env = odra_casper_livenet_env::env();

    // ---- 1. Deploy the contract -------------------------------------------
    // Installing a contract is the most expensive call; give it plenty of gas.
    env.set_gas(300_000_000_000u64);
    let mut vault = HeliosVault::deploy(&env, NoArgs);
    println!("\nHeliosVault deployed at: {}", vault.address().to_string());

    // ---- 2. Commit a risk policy on-chain (PolicyManager) -----------------
    env.set_gas(2_000_000_000u64);
    vault.set_policy(60, 70, 2);
    println!("Policy committed: >=60% A-rated, min risk score 70, max 2 rebalances/day");

    // ---- 3. First on-chain deposit (1 CSPR == 1_000_000_000 motes) --------
    env.set_gas(3_000_000_000u64);
    vault.with_tokens(U512::from(1_000_000_000u64)).deposit();
    println!("Deposited 1 CSPR. Total managed (motes): {}", vault.total_managed());

    // ---- 4. Record a swarm rebalance (Execution / AuditOracle) ------------
    env.set_gas(2_000_000_000u64);
    vault.record_rebalance(1180, 82);
    println!("Rebalance recorded. Count: {}", vault.rebalance_count());

    println!("\nDone. Open the contract hash on https://testnet.cspr.live to see the txs.\n");
}
