# Helios Protocol — Build Status

> Self-driving treasury for tokenized RWA on Casper, run by a swarm of accountable AI agents that pay for verified data on-chain via x402.

## ✅ Smart contract milestone complete

- `HeliosVault` (Odra 2.7.x) — unit tests pass on the MockVM backend
- CI **Build HeliosVault (WASM)** is green — produces a reproducible `HeliosVault.wasm` artifact (`helios-vault-wasm`) on every push to `contracts/**`
- Landing + `/app` live: https://helios-protocol.vercel.app

## Reproducible build (GitHub Actions)

The workflow installs a nightly Rust toolchain + `wasm32-unknown-unknown`, `wabt`, and a recent `binaryen`, then runs `cargo odra test` and `cargo odra build`, and uploads the compiled wasm as an artifact.

## Next

- [ ] Deploy `HeliosVault` to Casper **Testnet** (first on-chain transaction)
- [ ] Wire the deployed contract hash + CSPR.click signing into `/app`
- [ ] TypeScript agent swarm (x402-paid verified data feeds)
- [ ] `PolicyManager` + `ReputationRegistry` / `AuditOracle` contracts
- [ ] Demo video

Built for the Casper Agentic Buildathon 2026 (Qualification Round). Stack: Odra, x402, CSPR.click, CSPR.cloud, MCP.
