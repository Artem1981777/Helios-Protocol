import { writeFileSync } from 'node:fs'
import { reputationOf } from './helios-core.mjs'

const AGENT = process.env.AGENT_HASH || 'f3fc45961e794fa0acd30ef0841e0f193521cbc68b83319dd9dec7cb13ea3987'
const PUB = process.env.AGENT_PUBKEY || '01e6bd20af8ddf77d4bb30ad2658b5ceecf8ce3bd94cf39eda523db786133f6434'

try {
  const r = await reputationOf(AGENT)
  const out = {
    reputation: r.reputation ?? null,
    decisions: r.decisions ?? null,
    passport: r.passport ?? null,
    lastApyBps: r.last_apy_bps ?? null,
    lastRiskScore: r.last_risk_score ?? null,
    registered: r.registered ?? null,
    contract: r.contract ?? null,
    agent: r.agent ?? AGENT,
    agentPublicKey: PUB,
    explorer: 'https://testnet.cspr.live/account/' + PUB,
    source: r.source ?? 'ces',
    updated: new Date().toISOString(),
  }
  writeFileSync(new URL('../reputation.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
  console.log('WROTE reputation.json:', JSON.stringify(out))
} catch (e) {
  console.error('SNAPSHOT-FAIL:', e && e.message ? e.message : e)
  process.exit(1)
}
