import { writeFileSync } from 'node:fs'
import sdkNs from 'casper-js-sdk'
import { CFG, clBytes, decodeEvent, REP_EVENTS_UREF, REP_EVENTS_LEN_UREF } from './helios-core.mjs'
const sdk = sdkNs.PrivateKey ? sdkNs : (sdkNs.default || sdkNs)
const { RpcClient, HttpHandler } = sdk

const NAMES = {
  'f3fc45961e794fa0acd30ef0841e0f193521cbc68b83319dd9dec7cb13ea3987': 'Helios Orchestrator',
}
const PUBKEYS = {
  'f3fc45961e794fa0acd30ef0841e0f193521cbc68b83319dd9dec7cb13ea3987': '01e6bd20af8ddf77d4bb30ad2658b5ceecf8ce3bd94cf39eda523db786133f6434',
}

const handler = new HttpHandler(CFG.RPC_URL)
handler.setCustomHeaders({ Authorization: CFG.TOKEN })
const rpc = new RpcClient(handler)

const len = Number((await rpc.queryLatestGlobalState(REP_EVENTS_LEN_UREF)).storedValue.clValue)
const byAgent = new Map()
for (let i = 0; i < len; i++) {
  const r = await rpc.getDictionaryItem(null, REP_EVENTS_UREF, String(i))
  const ev = decodeEvent(clBytes(r.storedValue.clValue))
  if (!ev.agent) continue
  const cur = byAgent.get(ev.agent) || { agent: ev.agent, registered: false, passport: null, reputation: 0, decisions: 0, lastApyBps: null, lastRiskScore: null }
  if (ev.name === 'event_PassportMinted') { cur.registered = true; cur.passport = ev.token_id }
  if (ev.name === 'event_DecisionRecorded') {
    cur.registered = true
    cur.reputation = ev.reputation; cur.decisions = ev.decisions
    cur.lastApyBps = ev.apy_bps; cur.lastRiskScore = ev.risk_score
  }
  byAgent.set(ev.agent, cur)
}
const rows = [...byAgent.values()].map((a) => {
  const pk = PUBKEYS[a.agent] || null
  return { ...a, name: NAMES[a.agent] || ('Agent ' + a.agent.slice(0,6) + '…' + a.agent.slice(-4)), publicKey: pk, explorer: pk ? 'https://testnet.cspr.live/account/' + pk : 'https://testnet.cspr.live/account-hash/' + a.agent }
})
rows.sort((x, y) => (y.reputation - x.reputation) || (y.decisions - x.decisions))
rows.forEach((r, idx) => { r.rank = idx + 1 })
const out = { contract: 'ReputationRegistry', source: 'on-chain CES events (casper-test)', events: len, agents: rows, updated: new Date().toISOString() }
writeFileSync(new URL('../leaderboard.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.log('WROTE leaderboard.json: agents=' + rows.length + ' events=' + len)
for (const r of rows) console.log('  #' + r.rank + ' ' + r.name + '  rep=' + r.reputation + ' decisions=' + r.decisions + ' passport=' + r.passport)
