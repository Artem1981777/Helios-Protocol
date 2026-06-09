//! Deploys `ReputationRegistry` (Helios Yield Passport) to a live Casper network
//! (Testnet) and records the agent's first soulbound reputation decisions.
//!
//! Run with:
//!   ODRA_CASPER_LIVENET_ENV=casper-test cargo run --bin reputation_on_livenet --features livenet

use helios_vault::ReputationRegistry;
use odra::prelude::Addressable;
use odra::host::{Deployer, NoArgs};

fn main() {
    let env = odra_casper_livenet_env::env();

    // ---- 1. Deploy the registry (most expensive call) ---------------------
    env.set_gas(600_000_000_000u64);
    let mut reg = ReputationRegistry::deploy(&env, NoArgs);
    println!("\nReputationRegistry deployed at: {}", reg.address().to_string());

    // ---- 2. Record the agent's first on-chain decisions -------------------
    env.set_gas(3_000_000_000u64);
    reg.record_decision(1169, 81);
    println!("Decision #1 recorded (apy 1169 bps, risk 81).");

    env.set_gas(3_000_000_000u64);
    reg.record_decision(1180, 82);
    println!("Decision #2 recorded (apy 1180 bps, risk 82).");

    println!("Total passports: {}", reg.total_passports());
    println!("Agent reputation (avg policy-weighted APY bps): {}", reg.last_reputation());
    println!("\nDone. Open the contract hash on https://testnet.cspr.live to see the txs.\n");
}
