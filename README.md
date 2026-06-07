# 🌞 Helios Protocol

**Autonomous agentic treasury for tokenized real-world assets (RWA) on Casper.**

Helios runs a swarm of AI agents that continuously scan tokenized RWA yield
sources, verify them against paid data feeds, and rebalance an on-chain
portfolio — all bounded by a user-defined policy committed to the blockchain.

Built for the **Casper Agentic Buildathon 2026**.

🔗 Live demo: https://helios-protocol.vercel.app
⛓️ Network: Casper **Testnet** (`casper-test`)

---

## ✅ On-chain proofs (Casper Testnet)

| What | Hash / ID | Explorer |
|------|-----------|----------|
| HeliosVault contract package | `f21eb828…6af872` | [view](https://testnet.cspr.live/contract-package/f21eb828df55867867bdc91adf1658b315fd1caecde9b601481e3ab32c6af872) |
| `record_rebalance` — agent execution (CLI) | `44ecaca6…71e727` | [view](https://testnet.cspr.live/transaction/44ecaca6ae81e007e25db865cc5e182b95119bb13670aff6f4e8f6433e71e727) |
| `record_rebalance` — in-app deposit (CSPR.click) | `7b9acb90…d8244` | [view](https://testnet.cspr.live/transaction/7b9acb9065d1e737f90b487276ef5424d6b6ff433821ff904f845541b72d8244) |
| `record_rebalance` — **autonomous swarm cycle** | `e66b9283…6aee4` | [view](https://testnet.cspr.live/transaction/e66b9283210096eb7d0037eeb5261b03fc28c6a1dc04461e28b232cd6416aee4) |

> Pressing **Run swarm cycle** triggers a live scout → verify → rebalance loop
> that writes the agents' decision on-chain via
> `record_rebalance(apy_bps: u32, risk_score: u8)`.
> Latest swarm-cycle proof: `apy_bps = 1193` (11.93%), `risk_score = 82`, status **Success** (block 8107078).

---

## 🧠 Agent swarm

| Agent | Role |
|-------|------|
| 🧠 Orchestrator | Parses policy, coordinates the swarm |
| 🔭 Yield Scout | Scans tokenized RWA pools for live APY and liquidity |
| 🛡️ Risk Oracle | Buys risk/rating data via **x402**, posts verifiable proofs |
| ⚙️ Execution | Signs & submits rebalances to HeliosVault on Casper |

The loop: **scout → verify (x402) → rebalance**, repeated under policy constraints.

---

## 📜 On-chain policy

The vault enforces a policy the user commits on-chain:

- Minimum asset rating (e.g. A+)
- Maximum portfolio risk score (0–100)
- Rebalance frequency
- Objective (e.g. maximize APY within risk budget)

`HeliosVault` entrypoints: `init`, `deposit`, `withdraw`, `set_policy`,
`set_agent`, `record_rebalance`, plus views.

---

## 🛠️ Stack

- **Smart contracts:** Odra (Rust) → HeliosVault, deployed on Casper Testnet
- **Wallet & auth:** CSPR.click
- **RPC / REST:** CSPR.cloud
- **Paid data:** x402
- **SDK:** casper-js-sdk v5
- **Agent core:** TypeScript agent swarm (+ MCP)

---

## 🚀 Run locally

    git clone https://github.com/Artem1981777/Helios-Protocol
    cd Helios-Protocol
    npx serve .

Connect a **Casper Testnet** account via CSPR.click, then press **Run swarm
cycle** to trigger a live on-chain rebalance.

---

## 📂 Key addresses (Testnet)

- Contract package: `f21eb828df55867867bdc91adf1658b315fd1caecde9b601481e3ab32c6af872`
- Contract hash: `28262c0e06a081ad6516a7479fd895f3f5f2f87d74fc50f7fcbfda968955cf31`
- Caller / agent account: `01e6bd20af8ddf77d4bb30ad2658b5ceecf8ce3bd94cf39eda523db786133f6434`

---

Built with ☀️ for the Casper Agentic Buildathon 2026.
