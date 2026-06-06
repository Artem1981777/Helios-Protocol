# HeliosVault — Casper smart contract (Odra)

The on-chain trust anchor of **Helios Protocol**: a self-driving RWA treasury run
by a swarm of accountable AI agents.

## What the contract does

| Entrypoint | Role | Description |
|---|---|---|
| `deposit` (payable) | user | Deposit CSPR; credited to your per-account balance. |
| `withdraw(amount)` | user | Withdraw your CSPR back to your purse. |
| `set_policy(min_a_rated_pct, min_risk_score, max_daily_rebalances)` | owner | Commit the risk policy on-chain (PolicyManager). |
| `set_agent(agent)` | owner | Rotate the agent key allowed to record rebalances. |
| `record_rebalance(apy_bps, risk_score)` | agent | Log a swarm rebalance. **Reverts if `risk_score` is below the policy** (AuditOracle guardrail). |

Views: `balance_of`, `total_managed`, `rebalance_count`, `owner`, `agent`, `get_policy`, `last_apy_bps`, `last_risk_score`.

Every state change emits an event (`Deposited`, `Withdrawn`, `PolicyUpdated`, `Rebalanced`) so the off-chain agents and the dashboard can subscribe to a fully auditable feed.

---

## Option A — Build the WASM in CI (recommended, no Rust on your machine)

A GitHub Actions workflow (`.github/workflows/build-contract.yml`) compiles the
contract on every push and runs the tests. To get the compiled `.wasm`:

1. Push this repo to GitHub.
2. Open the repo → **Actions** → **Build HeliosVault (WASM)** → latest run.
3. Download the **`helios-vault-wasm`** artifact (contains `HeliosVault.wasm`).

This is the easiest path on a phone — GitHub's runners do the heavy compilation.

---

## Option B — Build & test locally

Requires Rust + the Odra CLI. On a desktop / GitHub Codespaces:

```bash
rustup target add wasm32-unknown-unknown
cargo install cargo-odra --locked

cd contracts
cargo odra test     # run unit tests on the MockVM
cargo odra build    # outputs wasm/HeliosVault.wasm
```

> Building Rust → WASM is heavy (large toolchain, long first compile). It works in
> Termux but is slow; Codespaces or a desktop is recommended for the build/deploy.

---

## Deploy to Casper Testnet (real on-chain transactions)

1. **Create a key pair** (Casper Wallet, or `casper-client keygen ./keys`).
2. **Fund it** at the faucet: https://testnet.cspr.live/tools/faucet (5,000 test CSPR, once).
3. **Configure env:** copy `casper-test.env.sample` → `casper-test.env`, set
   `ODRA_CASPER_LIVENET_SECRET_KEY_PATH` to your `secret_key.pem`, and a Testnet
   node (e.g. CSPR.cloud + free `CSPR_CLOUD_AUTH_TOKEN` from https://console.cspr.cloud).
4. **Run the deploy script** (deploys + commits a policy + 1 CSPR deposit + a rebalance):

```bash
cd contracts
ODRA_CASPER_LIVENET_ENV=casper-test \
  cargo run --bin helios_vault_on_livenet --features livenet
```

The script prints the deployed contract hash — open it on
https://testnet.cspr.live to see your transactions.

5. **Wire the address into the dApp:** put the contract hash into the frontend
   (`/app`) so the dashboard reads/writes real on-chain state via CSPR.click.

---

## Layout

```
contracts/
  src/lib.rs                         # HeliosVault contract + unit tests
  src/bin/helios_vault_on_livenet.rs # Testnet deploy + smoke test
  bins/build_contract.rs             # cargo odra build entrypoint
  bins/build_schema.rs               # cargo odra schema entrypoint
  Cargo.toml  Odra.toml  rust-toolchain.toml
  casper-test.env.sample
```

> Pinned to Odra `2.6.0`. If your installed CLI scaffolds a different version,
> the macros are stable across 2.x; the CI build will surface any mismatch.
