// mcp-server.mjs — Helios Protocol MCP server (stdio, zero-dependency JSON-RPC 2.0)
import { createInterface } from 'node:readline';
import { scout, riskOracle, decide, execute, CFG } from './helios-core.mjs';

const TOOLS = [
  {
    name: 'helios_scout',
    description: 'Fetch live US Treasury average interest rates (T-Bills / T-Notes) as the RWA risk-free benchmark. Read-only, no gas.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'helios_analyze',
    description: 'Read-only pipeline: scout live yields, score risk vs on-chain policy, and compute the target APY in basis points. No transaction sent.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'helios_rebalance',
    description: 'Execute an on-chain record_rebalance on HeliosVault (Casper Testnet). apy_bps/risk_score are computed from live data if omitted. Set dry_run=true to sign without submitting (no gas).',
    inputSchema: {
      type: 'object',
      properties: {
        apy_bps: { type: 'integer', description: 'Target APY in basis points (800-2000). Optional.' },
        risk_score: { type: 'integer', description: 'Risk/quality score (policy floor 70). Optional.' },
        dry_run: { type: 'boolean', description: 'If true, sign locally but do not submit (no gas).' },
      },
      additionalProperties: false,
    },
  },
];

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function ok(id, result) { send({ jsonrpc: '2.0', id, result }); }
function rpcErr(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }
function textResult(obj) {
  const text = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  return { content: [{ type: 'text', text }] };
}

async function callTool(name, args) {
  const a = args || {};
  if (name === 'helios_scout') return textResult(await scout());
  if (name === 'helios_analyze') {
    const y = await scout();
    const o = await riskOracle(y);
    const d = decide(y);
    return textResult({ yields: y, risk: o, decision: d });
  }
  if (name === 'helios_rebalance') {
    const y = await scout();
    const o = await riskOracle(y);
    const d = decide(y);
    const apy = Number.isInteger(a.apy_bps) ? a.apy_bps : d.apyBps;
    const risk = Number.isInteger(a.risk_score) ? a.risk_score : o.risk;
    const ex = await execute(apy, risk, { dryRun: a.dry_run === true });
    return textResult({ inputs: { apy_bps: apy, risk_score: risk }, execution: ex });
  }
  throw new Error('Unknown tool: ' + name);
}

async function handle(req) {
  const { id, method, params } = req;
  if (method === 'initialize') {
    const pv = (params && params.protocolVersion) || '2024-11-05';
    return ok(id, { protocolVersion: pv, capabilities: { tools: {} }, serverInfo: { name: 'helios-protocol', version: '1.0.0' } });
  }
  if (method === 'notifications/initialized' || method === 'initialized') return;
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS });
  if (method === 'tools/call') {
    try {
      const result = await callTool(params.name, params.arguments);
      return ok(id, result);
    } catch (e) {
      return ok(id, { content: [{ type: 'text', text: 'Error: ' + String((e && e.message) || e) }], isError: true });
    }
  }
  if (id !== undefined) return rpcErr(id, -32601, 'Method not found: ' + method);
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const s = line.trim();
  if (s.length === 0) return;
  let req;
  try { req = JSON.parse(s); } catch (e) { return; }
  Promise.resolve(handle(req)).catch((e) => {
    if (req && req.id !== undefined) rpcErr(req.id, -32603, String((e && e.message) || e));
  });
});
process.stderr.write('[helios-mcp] ready - signer ' + CFG.KEY_PATH + ', chain ' + CFG.CHAIN + '\n');
