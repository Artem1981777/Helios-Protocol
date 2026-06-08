# 🌞 Helios Protocol

**Autonomous agentic treasury for tokenized real-world assets (RWA) on Casper.**

Helios runs a swarm of AI agents that continuously pull real RWA yield data,
score it against an on-chain risk policy, and rebalance an on-chain portfolio —
with no human in the loop. Decisions are committed to the Casper blockchain.

Built for the **Casper Agentic Buildathon 2026**.

🔗 Live demo: https://helios-protocol.vercel.app
⛓️ Network: Casper **Testnet** (`casper-test`)

---

## ✅ On-chain proofs (Casper Testnet)

| What | Hash / ID | Explorer |
|------|-----------|----------|
| HeliosVault contract package | `f21eb828…6af872` | [view](https://testnet.cspr.live/contract-package/f21eb828df55867867bdc91adf1658b315fd1caecde9b601481e3ab32c6af872) |
| `record_rebalance` — CLI execution | `44ecaca6…71e727` | [view](https://testnet.cspr.live/transaction/44ecaca6ae81e007e25db865cc5e182b95119bb13670aff6f4e8f6433e71e727) |
| `record_rebalance` — in-app deposit (CSPR.click) | `7b9acb90…d8244` | [view](https://testnet.cspr.live/transaction/7b9acb9065d1e737f90b487276ef5424d6b6ff433821ff904f845541b72d8244) |
| `record_rebalance` — in-app swarm cycle (browser) | `e66b9283…6aee4` | [view](https://testnet.cspr.live/transaction/e66b9283210096eb7d0037eeb5261b03fc28c6a1dc04461e28b232cd6416aee4) |
| `record_rebalance` — **fully autonomous agent (swarm)** | `4369d0d5…5352` | [view](https://testnet.cspr.live/transaction/4369d0d5b63a3040bacaafe172476acf3b57d88d8c0b3ee8dbc9d9caf92f5352) |

> **Genuinely data-driven.** In the autonomous run, the Yield Scout pulled live
> US Treasury rates (T-Bills **3.69%**), the Risk Oracle scored the term
> structure to **81** (policy floor 70), and the Orchestrator targeted
> **11.69% APY → `apy_bps = 1169`** — then the agent signed with its own key and
> submitted on-chain with no human in the loop. The non-round `1169` follows
> directly from the real 3.69% rate.

---

## 🧠 Agent swarm

| Agent | Role |
|-------|------|
| 🧠 Orchestrator | Parses policy, coordinates the swarm |
| 🔭 Yield Scout | Pulls live RWA / Treasury yields |
| 🛡️ Risk Oracle | Scores risk vs on-chain policy (x402-ready data layer) |
| ⚙️ Execution | Signs & submits rebalances to HeliosVault |

The loop: **scout → score → rebalance**, repeated under policy constraints.
Shared logic lives in `agent/helios-core.mjs` and is reused by both the
autonomous runner and the MCP server.

---

## 🤖 Autonomous agent runner (`agent/swarm.mjs`)

A headless Node process — **no browser, no wallet popup, no button**:

1. **Scout** fetches live US Treasury average interest rates from
   `api.fiscaldata.treasury.gov`.
2. **Risk Oracle** derives a risk/quality score from the real term structure
   against the on-chain policy floor (optional `X402_URL` plugs in a paid feed
   via the CSPR x402 facilitator).
3. **Orchestrator** combines the real risk-free rate with a modeled RWA credit
   premium into a target APY.
4. **Execution** loads the agent key from PEM, builds a
   `record_rebalance(apy_bps, risk_score)` transaction with `casper-js-sdk`,
   signs it, and submits via **CSPR.cloud** JSON-RPC.

Run it:

    cd agent
    npm i casper-js-sdk@5
    node swarm.mjs

---

## 🔌 MCP server (`agent/mcp-server.mjs`)

Helios exposes its agent capabilities over the **Model Context Protocol**, so any
MCP-compatible client (Claude Desktop, Cursor, MCP Inspector, …) can drive the
protocol directly. It is a **zero-dependency** stdio JSON-RPC 2.0 server.

| Tool | Gas | Description |
|------|-----|-------------|
| `helios_scout` | none | Live US Treasury yields (RWA risk-free benchmark) |
| `helios_analyze` | none | Scout → risk score vs policy → target APY (bps) |
| `helios_rebalance` | on-chain* | `record_rebalance` on HeliosVault |

\* `helios_rebalance` accepts `dry_run: true` to sign locally without sending (no gas).

Add to your MCP client config:

    {
      "mcpServers": {
        "helios": {
          "command": "node",
          "args": ["/absolute/path/to/Helios-Protocol/agent/mcp-server.mjs"]
        }
      }
    }

---

## 📜 On-chain policy

The vault enforces a policy the user commits on-chain:

- Minimum asset rating / quality score
- Maximum portfolio risk
- Rebalance frequency
- Objective (maximize APY within risk budget)

`HeliosVault` entrypoints: `init`, `deposit`, `withdraw`, `set_policy`,
`set_agent`, `record_rebalance`, plus views.

---

## 🛠️ Stack

- **Smart contracts:** Odra (Rust) → HeliosVault, deployed on Casper Testnet
- **Autonomous runner:** Node + casper-js-sdk v5, live US Treasury data feed
- **MCP:** zero-dependency Model Context Protocol server (stdio)
- **Wallet & auth:** CSPR.click (web app)
- **RPC:** CSPR.cloud JSON-RPC
- **Paid data:** x402 (CSPR facilitator)

---

## 🚀 Run locally

Web app:

    git clone https://github.com/Artem1981777/Helios-Protocol
    cd Helios-Protocol
    npx serve .

Autonomous agent / MCP server: see the sections above.

---

## 📂 Key addresses (Testnet)

- Contract package: `f21eb828df55867867bdc91adf1658b315fd1caecde9b601481e3ab32c6af872`
- Contract hash: `28262c0e06a081ad6516a7479fd895f3f5f2f87d74fc50f7fcbfda968955cf31`
- Agent account: `01e6bd20af8ddf77d4bb30ad2658b5ceecf8ce3bd94cf39eda523db786133f6434`

---

Built with ☀️ for the Casper Agentic Buildathon 2026.

## 💸 x402 — autonomous machine payments (CSPR.cloud facilitator)

Helios agents pay for premium data using the **x402** protocol on Casper, settling through the official **CSPR.cloud x402 facilitator** (`https://x402-facilitator.cspr.cloud`).

- **Scheme:** `exact` over a CEP-18 token, authorized with an **EIP-712 `TransferWithAuthorization`** signature (EIP-3009 style).
- **Network:** `casper:casper-test` (CAIP-2).
- **Signing:** the agent signs the EIP-712 digest with its Ed25519 Casper key — no gas, no on-chain tx needed to authorize a payment.
- **Real verification:** the signed payload is validated by the live facilitator, which returns `isValid: true`.

### Proof — live facilitator returns isValid

    $ node agent/x402.mjs verify
    [selftest] transfer_with_authorization: PASS
    [selftest] casper_address_permit: PASS
    [/verify] 200 { "isValid": true, "payer": "00f3fc45961e794fa0acd30ef0841e0f193521cbc68b83319dd9dec7cb13ea3987" }

The EIP-712 engine in `agent/x402.mjs` is verified **bit-exact** against the official `casper-ecosystem/casper-eip-712` cross-language test vectors (`node agent/x402.mjs selftest`), so the digest the agent signs is identical to the one the facilitator reconstructs.

### Full 402 flow — resource server + paying client

`agent/x402.mjs` also ships a real x402 resource server that gates a premium treasury-rebalance signal:

    $ node agent/x402.mjs demo
    [demo] step1 GET (no payment)        -> 402  + PaymentRequirements
    [demo] step3 GET (PAYMENT-SIGNATURE) -> 200  + live signal (verified by facilitator)

- `node agent/x402.mjs serve` — run the resource server (`GET /premium/treasury-signal`).
- Unpaid request → `402` + `PaymentRequirements`.
- Client signs a `TransferWithAuthorization` and replays with the `PAYMENT-SIGNATURE` header.
- Server forwards the payload to the facilitator `/verify`; on `isValid` it returns the gated signal.

> `/settle` (on-chain CEP-18 `transfer_with_authorization`) is wired through the same facilitator and requires the agent to hold the x402 CEP-18 token balance. `/verify` needs no balance and is the cryptographic proof of a valid payment authorization.
