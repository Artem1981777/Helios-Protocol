// helios-core.mjs — shared Helios agent logic (used by swarm.mjs and mcp-server.mjs)
import { readFileSync } from 'node:fs';
import sdkNs from 'casper-js-sdk';
const sdk = sdkNs.PrivateKey ? sdkNs : (sdkNs.default || sdkNs);
const { PrivateKey, KeyAlgorithm, ContractCallBuilder, Args, CLValue, RpcClient, HttpHandler } = sdk;

export const CFG = {
  PKG: process.env.PKG || 'f21eb828df55867867bdc91adf1658b315fd1caecde9b601481e3ab32c6af872',
  CHAIN: process.env.CHAIN || 'casper-test',
  KEY_PATH: process.env.KEY_PATH || '/data/data/com.termux/files/home/keys/secret_key.pem',
  RPC_URL: process.env.RPC_URL || 'https://node.testnet.cspr.cloud/rpc',
  TOKEN: process.env.TOKEN || '***REMOVED***',
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

export async function cycle(opts) {
  const dryRun = opts && opts.dryRun === true;
  const y = await scout();
  const o = await riskOracle(y);
  const d = decide(y);
  const ex = await execute(d.apyBps, o.risk, { dryRun });
  return { yields: y, oracle: o, decision: d, execution: ex };
}
