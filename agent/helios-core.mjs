// helios-core.mjs — shared Helios agent logic (used by swarm.mjs and mcp-server.mjs)
import { readFileSync } from 'node:fs';
import sdkNs from 'casper-js-sdk';
const sdk = sdkNs.PrivateKey ? sdkNs : (sdkNs.default || sdkNs);
const { PrivateKey, KeyAlgorithm, ContractCallBuilder, Args, CLValue, RpcClient, HttpHandler } = sdk;

export const CFG = {
  PKG: process.env.PKG || 'f21eb828df55867867bdc91adf1658b315fd1caecde9b601481e3ab32c6af872',
  REP_PKG: process.env.REP_PKG || 'c49efa353ff058fbbbd960cb742b6711e09ce25cdc3d0e0857aac13d8ad0b716',
  CHAIN: process.env.CHAIN || 'casper-test',
  KEY_PATH: process.env.KEY_PATH || '/data/data/com.termux/files/home/keys/secret_key.pem',
  RPC_URL: process.env.RPC_URL || 'https://node.testnet.cspr.cloud/rpc',
  TOKEN: process.env.CSPR_CLOUD_AUTH_TOKEN || process.env.TOKEN || '',
  X402_URL: process.env.X402_URL || '',
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export async function scout() {
  const url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=120';
  try {
    const r = await fetch(url);
    const j = await r.json();
    const rows = j.data || [];
    let tbill, tnote, rec;
    for (const row of rows) {
      const d = (row.security_desc || '').toLowerCase();
      const v = parseFloat(row.avg_interest_rate_amt);
      if (Number.isFinite(v) === false) continue;
      if (tbill == null && d.includes('bills')) { tbill = v; rec = row.record_date; }
      if (tnote == null && d.includes('notes')) { tnote = v; rec = rec || row.record_date; }
      if (tbill != null && tnote != null) break;
    }
    if (tbill == null) tbill = 4.9;
    if (tnote == null) tnote = 4.6;
    return { tbill, tnote, record_date: rec || null, source: 'treasury.gov' };
  } catch (e) {
    return { tbill: 4.9, tnote: 4.6, record_date: null, source: 'fallback' };
  }
}

export async function riskOracle(y) {
  const spread = Number((y.tnote - y.tbill).toFixed(3));
  let x402 = null;
  if (CFG.X402_URL) {
    try {
      const r = await fetch(CFG.X402_URL);
      if (r.status === 402) {
        x402 = { paid: false, requirements: await r.text(), note: 'settle via CSPR x402 facilitator' };
      } else {
        x402 = { paid: true, body: await r.text() };
      }
    } catch (e) { x402 = { error: String(e) }; }
  }
  const risk = clamp(Math.round(82 + spread * 2), 78, 86);
  return { spread, risk, policyFloor: 70, x402 };
}

export function decide(y) {
  const premium = clamp(7.2 - (y.tnote - y.tbill) * 3, 5, 8);
  const apyBps = clamp(Math.round((y.tbill + premium) * 100), 800, 2000);
  return { premium: Number(premium.toFixed(2)), apyBps };
}

export async function execute(apyBps, risk, opts) {
  const dryRun = opts && opts.dryRun === true;
  const pem = readFileSync(CFG.KEY_PATH, 'utf8');
  const sk = await PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
  const signer = sk.publicKey.toHex();
  if (dryRun) {
    return { dryRun: true, signer, apyBps, risk, note: 'signed locally, not submitted (no gas)' };
  }
  const tx = new ContractCallBuilder()
    .from(sk.publicKey)
    .byPackageHash(CFG.PKG)
    .entryPoint('record_rebalance')
    .runtimeArgs(Args.fromMap({
      apy_bps: CLValue.newCLUInt32(apyBps),
      risk_score: CLValue.newCLUint8(risk),
    }))
    .chainName(CFG.CHAIN)
    .payment(3000000000, 5)
    .build();
  tx.sign(sk);
  const handler = new HttpHandler(CFG.RPC_URL);
  handler.setCustomHeaders({ Authorization: CFG.TOKEN });
  const rpc = new RpcClient(handler);
  const res = await rpc.putTransaction(tx);
  let hash = res.transactionHash || res.transaction_hash || res.hash;
  if (hash && typeof hash === 'object' && hash.toHex) hash = hash.toHex();
  return { dryRun: false, signer, apyBps, risk, txHash: String(hash), explorer: 'https://testnet.cspr.live/transaction/' + hash };
}

export async function recordReputation(apyBps, risk, opts) {
  const dryRun = opts && opts.dryRun === true;
  const pem = readFileSync(CFG.KEY_PATH, 'utf8');
  const sk = await PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
  const signer = sk.publicKey.toHex();
  if (dryRun) {
    return { dryRun: true, signer, apyBps, risk, contract: 'ReputationRegistry', note: 'signed locally, not submitted (no gas)' };
  }
  const tx = new ContractCallBuilder()
    .from(sk.publicKey)
    .byPackageHash(CFG.REP_PKG)
    .entryPoint('record_decision')
    .runtimeArgs(Args.fromMap({
      apy_bps: CLValue.newCLUInt32(apyBps),
      risk_score: CLValue.newCLUint8(risk),
    }))
    .chainName(CFG.CHAIN)
    .payment(5000000000, 5)
    .build();
  tx.sign(sk);
  const handler = new HttpHandler(CFG.RPC_URL);
  handler.setCustomHeaders({ Authorization: CFG.TOKEN });
  const rpc = new RpcClient(handler);
  const res = await rpc.putTransaction(tx);
  let hash = res.transactionHash || res.transaction_hash || res.hash;
  if (hash && typeof hash === 'object' && hash.toHex) hash = hash.toHex();
  return { dryRun: false, signer, apyBps, risk, contract: 'ReputationRegistry', txHash: String(hash), explorer: 'https://testnet.cspr.live/transaction/' + hash };
}

export async function cycle(opts) {
  const dryRun = opts && opts.dryRun === true;
  const y = await scout();
  const o = await riskOracle(y);
  const d = decide(y);
  const ex = await execute(d.apyBps, o.risk, { dryRun });
  const rep = await recordReputation(d.apyBps, o.risk, { dryRun });
  return { yields: y, oracle: o, decision: d, execution: ex, reputation: rep };
}

// ---- on-chain reputation read (ReputationRegistry via CES events) ----
const REP_EVENTS_UREF = process.env.REP_EVENTS_UREF || 'uref-0b8f15d09ade09a157f3e1873970436fc04d06d54adf327e12952c39815fa9f9-007';
const REP_EVENTS_LEN_UREF = process.env.REP_EVENTS_LEN_UREF || 'uref-2b4a5bcc7e37e0c51579d668376b8204a2a135f774353e66b0eb60465bdb5fa7-007';

function clBytes(clv) {
  const raw = JSON.parse(JSON.stringify(clv));
  if (Array.isArray(raw)) return raw.map(Number);
  if (raw && Array.isArray(raw.bytes)) return raw.bytes.map(Number);
  if (typeof raw === 'string') { const m = raw.match(/.{1,2}/g) || []; return m.map((x) => parseInt(x, 16)); }
  return [];
}

function decodeEvent(bytes) {
  let o = 0;
  const u32 = () => { const v = (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0; o += 4; return v; };
  const u8v = () => { const v = bytes[o]; o += 1; return v; };
  const u64 = () => { let v = 0n; for (let i = 0; i < 8; i++) v |= BigInt(bytes[o + i]) << BigInt(8 * i); o += 8; return v; };
  const keyHex = () => { u8v(); let hx = ''; for (let i = 0; i < 32; i++) hx += bytes[o++].toString(16).padStart(2, '0'); return hx; };
  const nameLen = u32();
  let name = '';
  for (let i = 0; i < nameLen; i++) name += String.fromCharCode(bytes[o++]);
  const ev = { name };
  if (name === 'event_DecisionRecorded') {
    ev.agent = keyHex(); ev.apy_bps = u32(); ev.risk_score = u8v();
    ev.decisions = Number(u64()); ev.reputation = Number(u64());
  } else if (name === 'event_PassportMinted') {
    ev.agent = keyHex(); ev.token_id = Number(u64());
  }
  return ev;
}

export async function reputationOf(agentHashHex) {
  const agent = String(agentHashHex).replace(/^0x/, '').toLowerCase();
  const handler = new HttpHandler(CFG.RPC_URL);
  handler.setCustomHeaders({ Authorization: CFG.TOKEN });
  const rpc = new RpcClient(handler);
  const len = Number((await rpc.queryLatestGlobalState(REP_EVENTS_LEN_UREF)).storedValue.clValue);
  let reputation = 0, decisions = 0, lastApy = null, lastRisk = null, registered = false, passport = null;
  for (let i = 0; i < len; i++) {
    const r = await rpc.getDictionaryItem(null, REP_EVENTS_UREF, String(i));
    const ev = decodeEvent(clBytes(r.storedValue.clValue));
    if (ev.agent !== agent) continue;
    if (ev.name === 'event_PassportMinted') { registered = true; passport = ev.token_id; }
    if (ev.name === 'event_DecisionRecorded') {
      registered = true;
      reputation = ev.reputation; decisions = ev.decisions;
      lastApy = ev.apy_bps; lastRisk = ev.risk_score;
    }
  }
  return { agent, registered, reputation, decisions, last_apy_bps: lastApy, last_risk_score: lastRisk, passport, contract: 'ReputationRegistry', source: 'on-chain CES events (casper-test)', events: len };
}

export async function meetsThreshold(agentHashHex, minReputation) {
  const rep = await reputationOf(agentHashHex);
  const min = Number(minReputation);
  return { ...rep, minReputation: min, meets: rep.registered && rep.reputation >= min };
}
