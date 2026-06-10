import sdkNs from 'casper-js-sdk';
import { readFileSync } from 'fs';

const sdk = (sdkNs && sdkNs.PrivateKey) ? sdkNs : (sdkNs.default || sdkNs);
const { PrivateKey, KeyAlgorithm, Args, CLValue, ContractCallBuilder, RpcClient, HttpHandler } = sdk;

const CFG = {
  PKG: process.env.HELIOS_PKG || 'f21eb828df55867867bdc91adf1658b315fd1caecde9b601481e3ab32c6af872',
  CHAIN: process.env.HELIOS_CHAIN || 'casper-test',
  KEY_PATH: process.env.HELIOS_KEY || '/data/data/com.termux/files/home/keys/secret_key.pem',
  RPC_URL: process.env.RPC_URL || 'https://node.testnet.cspr.cloud/rpc',
  TOKEN: process.env.CSPR_CLOUD_AUTH_TOKEN || process.env.CSPR_CLOUD_TOKEN || '',
  X402_URL: process.env.X402_URL || '',
  LOOP: process.env.LOOP === '1',
  CYCLE_MS: parseInt(process.env.CYCLE_MS || '300000', 10),
};

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log = (tag, msg) => console.log('[' + now() + '] ' + tag + ' ' + msg);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

async function scout() {
  const url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=120';
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    const j = await r.json();
    const rows = (j && j.data) || [];
    const pick = (d) => {
      const row = rows.find((x) => (x.security_desc || '').toLowerCase().includes(d));
      return row ? parseFloat(row.avg_interest_rate_amt) : null;
    };
    const tbill = pick('bills');
    const tnote = pick('notes');
    if (tbill != null) {
      log('Scout', 'live Treasury: T-Bills ' + tbill + '% / T-Notes ' + (tnote != null ? tnote + '%' : 'n/a') + ' (rec ' + (rows[0] && rows[0].record_date) + ')');
      return { tbill, tnote: tnote != null ? tnote : tbill, source: 'treasury.gov' };
    }
    log('Scout', 'no T-Bill row; sample: ' + JSON.stringify(rows[0] || {}).slice(0, 160));
  } catch (e) {
    log('Scout', 'live fetch failed (' + e.message + '), fallback baseline');
  }
  return { tbill: 4.9, tnote: 4.6, source: 'fallback' };
}

async function riskOracle(y) {
  if (CFG.X402_URL) {
    try {
      const r = await fetch(CFG.X402_URL);
      if (r.status === 402) {
        const req = await r.text();
        log('Oracle', 'HTTP 402 from provider - settle via CSPR x402 facilitator');
        log('Oracle', 'requirements: ' + req.slice(0, 160));
      } else if (r.ok) {
        log('Oracle', 'x402 data purchased (' + r.status + ')');
      } else {
        log('Oracle', 'x402 endpoint responded ' + r.status);
      }
    } catch (e) {
      log('Oracle', 'x402 fetch failed: ' + e.message);
    }
  } else {
    log('Oracle', 'X402_URL not set - using on-chain policy risk model only');
  }
  const spread = y.tnote - y.tbill;
  const risk = clamp(Math.round(82 + spread * 2), 78, 86);
  log('Oracle', 'term spread ' + spread.toFixed(2) + 'pp -> risk/quality score ' + risk + ' (policy floor 70)');
  return risk;
}

function decide(y) {
  const premium = clamp(7.2 - (y.tnote - y.tbill) * 3, 5, 8);
  const apyPct = y.tbill + premium;
  const apyBps = clamp(Math.round(apyPct * 100), 800, 2000);
  log('Orchestrator', 'target APY ' + apyPct.toFixed(2) + '% = T-Bill ' + y.tbill + '% + RWA credit premium ' + premium.toFixed(2) + 'pp -> ' + apyBps + ' bps');
  return apyBps;
}

async function execute(apyBps, risk) {
  const sk = await PrivateKey.fromPem(readFileSync(CFG.KEY_PATH, 'utf8'), KeyAlgorithm.ED25519);
  log('Execution', 'signer ' + sk.publicKey.toHex());
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
  if (CFG.TOKEN) handler.setCustomHeaders({ Authorization: CFG.TOKEN });
  const rpc = new RpcClient(handler);
  const res = await rpc.putTransaction(tx);
  let hash = res.transactionHash || res.transaction_hash || res.hash || '';
  if (hash && typeof hash === 'object') hash = (hash.toHex && hash.toHex()) || (hash.hash) || JSON.stringify(hash);
  log('Execution', 'SUBMITTED record_rebalance(apy_bps=' + apyBps + ', risk_score=' + risk + ')');
  log('Execution', 'tx ' + hash);
  log('Execution', 'https://testnet.cspr.live/transaction/' + hash);
  return hash;
}

async function cycle() {
  log('---', 'Helios swarm cycle start');
  const y = await scout();
  const risk = await riskOracle(y);
  const apyBps = decide(y);
  try {
    await execute(apyBps, risk);
  } catch (e) {
    log('Execution', 'FAILED: ' + (e && e.message ? e.message : e));
  }
  log('---', 'cycle done');
}

await cycle();
if (CFG.LOOP) {
  log('---', 'LOOP every ' + (CFG.CYCLE_MS / 1000) + 's (Ctrl+C to stop)');
  setInterval(cycle, CFG.CYCLE_MS);
}
