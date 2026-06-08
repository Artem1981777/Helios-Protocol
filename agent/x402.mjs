import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createPrivateKey, createPublicKey, sign as edSign, randomBytes } from 'node:crypto'
import sha3 from 'js-sha3'
import blakejs from 'blakejs'
import { CFG, scout, riskOracle } from './helios-core.mjs'
const { keccak256 } = sha3
const { blake2b } = blakejs

const FAC = 'https://x402-facilitator.cspr.cloud'
const NETWORK = 'casper:casper-test'

// ---- EIP-712 движок (сверен с casper-eip-712 tests/vectors.json) ----
const u8  = (hex) => Uint8Array.from(Buffer.from(hex.replace(/^0x/, ''), 'hex'))
const kec = (bytes) => u8(keccak256(bytes))
const hx  = (b) => Buffer.from(b).toString('hex')
const cat = (...a) => { const t=a.reduce((s,x)=>s+x.length,0); const o=new Uint8Array(t); let p=0; for(const x of a){o.set(x,p);p+=x.length} return o }
const encString  = (s) => kec(new TextEncoder().encode(s))
const encBytes32 = (hex) => { const b=u8(hex); if(b.length!==32) throw new Error('bytes32 != 32: '+b.length); return b }
const encUint    = (v) => { let n=BigInt(v); const o=new Uint8Array(32); for(let i=31;i>=0;i--){o[i]=Number(n&0xffn);n>>=8n} return o }
function encAddress(hex){ const b=u8(hex); if(b.length===20){ const o=new Uint8Array(32); o.set(b,12); return o } if(b.length===33){ return kec(b) } throw new Error('address must be 20|33 bytes, got '+b.length) }
function encField(type,val){
  if(type==='address') return encAddress(String(val))
  if(type==='bytes32') return encBytes32(String(val))
  if(type==='string')  return encString(String(val))
  if(type.startsWith('uint')||type.startsWith('int')) return encUint(val)
  throw new Error('unsupported type: '+type)
}
const typeString = (name,fields) => name+'('+fields.map(f=>f.type+' '+f.name).join(',')+')'
function hashStruct(primaryType,types,msg){
  const fields=types[primaryType]
  const parts=[kec(new TextEncoder().encode(typeString(primaryType,fields)))]
  for(const f of fields) parts.push(encField(f.type,msg[f.name]))
  return kec(cat(...parts))
}
const DOMAIN_TYPES=[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chain_name',type:'string'},{name:'contract_package_hash',type:'bytes32'}]
function domainSep(d){
  const parts=[kec(new TextEncoder().encode(typeString('EIP712Domain',DOMAIN_TYPES)))]
  for(const f of DOMAIN_TYPES) parts.push(encField(f.type,d[f.name]))
  return kec(cat(...parts))
}
const digestOf=(domain,primaryType,types,msg)=>kec(cat(Uint8Array.from([0x19,0x01]),domainSep(domain),hashStruct(primaryType,types,msg)))

const TWA={ TransferWithAuthorization:[
  {name:'from',type:'address'},{name:'to',type:'address'},{name:'value',type:'uint256'},
  {name:'validAfter',type:'uint256'},{name:'validBefore',type:'uint256'},{name:'nonce',type:'bytes32'} ] }

function selftest(){
  const VEC=[
   { n:'transfer_with_authorization', pt:'TransferWithAuthorization', t:TWA,
     d:{name:'CasperToken',version:'1',chain_name:'casper:casper-test',contract_package_hash:'0x7777777777777777777777777777777777777777777777777777777777777777'},
     m:{from:'0x1234567890123456789012345678901234567890',to:'0xabcdef1234567890abcdef1234567890abcdef12',value:'0x000000000000000000000000000000000000000000000000000000000000002a',validAfter:'0x0000000000000000000000000000000000000000000000000000000000000000',validBefore:'0x00000000000000000000000000000000000000000000000000000000ffffffff',nonce:'0xabababababababababababababababababababababababababababababababab'},
     ds:'488cd1d6726df2bcee44969efe9fc945d057e1706bffa93a292fefca5a790b66', sh:'30498052d4b856c2f6461af8162f03c402573367016c736111dc4f1e659d641f', dg:'8868576c5993b484967680e92f7d59bda3cdeb3e32443258479662866c604288' },
   { n:'casper_address_permit', pt:'Permit', t:{ Permit:[{name:'owner',type:'address'},{name:'spender',type:'address'},{name:'value',type:'uint256'},{name:'nonce',type:'uint256'},{name:'deadline',type:'uint256'}] },
     d:{name:'CasperToken',version:'1',chain_name:'casper:casper-test',contract_package_hash:'0x7777777777777777777777777777777777777777777777777777777777777777'},
     m:{owner:'0x00abababababababababababababababababababababababababababababababab',spender:'0x01cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',value:'0x000000000000000000000000000000000000000000000000000000000000002a',nonce:'0x0000000000000000000000000000000000000000000000000000000000000001',deadline:'0x000000000000000000000000000000000000000000000000000000006666ffff'},
     ds:'488cd1d6726df2bcee44969efe9fc945d057e1706bffa93a292fefca5a790b66', sh:'3c9d714e753e49ba21597b4edd127090a9372023a4e5f2d79972af3b01c24535', dg:'455d22eedf146e59cac6b8b4fa5de7f4b03747e9f4acdc85cf09f54a0c922d84' } ]
  let ok=true
  for(const v of VEC){
    const ds=hx(domainSep(v.d)), sh=hx(hashStruct(v.pt,v.t,v.m)), dg=hx(digestOf(v.d,v.pt,v.t,v.m))
    const pass = ds===v.ds && sh===v.sh && dg===v.dg
    ok = ok && pass
    console.log('[selftest] '+v.n+': '+(pass?'PASS':'FAIL'))
    if(!pass){ console.log('   domainSep exp',v.ds,'got',ds); console.log('   structHash exp',v.sh,'got',sh); console.log('   digest exp',v.dg,'got',dg) }
  }
  return ok
}

const priv   = createPrivateKey(readFileSync(CFG.KEY_PATH,'utf8'))
const pubDer = createPublicKey(priv).export({format:'der', type:'spki'})
const pubRaw = pubDer.subarray(pubDer.length-32)
const pubHex = '01'+hx(pubRaw)
const accHash = (raw) => hx(blake2b(Buffer.concat([Buffer.from('ed25519'),Buffer.from([0]),Buffer.from(raw)]),undefined,32))
const myHash    = accHash(pubRaw)
const payeeHash = accHash(Buffer.from('4371b02df1d899a4f70ce3f956851c287e5e2e9aeb2670bf2c9b08d2c66ece8e','hex'))

async function facilitator(path, body){
  const r = await fetch(FAC+path, { method: body?'POST':'GET', headers:{ 'authorization':CFG.TOKEN, 'content-type':'application/json' }, body: body?JSON.stringify(body):undefined })
  const text = await r.text(); let json; try{ json=JSON.parse(text) }catch{ json=text }
  return { status:r.status, json }
}

function defaultRequirements(){ return { scheme:'exact', network:NETWORK, payTo:'00'+payeeHash, amount:'100', asset:CFG.PKG, maxTimeoutSeconds:600, extra:{ name:'HeliosUSD', version:'1', decimals:'2', symbol:'hUSD' } } }

function buildSignedPayload(req){
  req = req || defaultRequirements()
  const now = Math.floor(Date.now()/1000)
  const validAfter = String(now-60), validBefore = String(now+(req.maxTimeoutSeconds||600))
  const nonce = randomBytes(32).toString('hex')
  const domain = { name:req.extra.name, version:req.extra.version, chain_name:req.network, contract_package_hash:'0x'+req.asset }
  const msg = { from:'0x00'+myHash, to:'0x'+req.payTo, value:BigInt(req.amount), validAfter:BigInt(validAfter), validBefore:BigInt(validBefore), nonce:'0x'+nonce }
  const digest = digestOf(domain, 'TransferWithAuthorization', TWA, msg)
  const signature = '01'+hx(edSign(null, Buffer.from(digest), priv))
  const payload = { signature, publicKey:pubHex, authorization:{ from:'00'+myHash, to:req.payTo, value:req.amount, validAfter, validBefore, nonce } }
  const paymentPayload = { x402Version:2, payload, resource:{ url:'https://helios-protocol.vercel.app/premium/treasury-signal', description:'Helios premium treasury rebalance signal', mimeType:'application/json' }, accepted:req }
  return { paymentPayload, paymentRequirements:req, digest:hx(digest), signature }
}

async function premiumSignal(){
  try{ const y=await scout(); const risk=riskOracle(y); return { ts:new Date().toISOString(), source:'US Treasury fiscaldata API', yields:y, riskScore:risk } }
  catch(e){ return { ts:new Date().toISOString(), note:'live scout unavailable', error:String(e) } }
}

async function handle(req,res){
  if(!req.url.startsWith('/premium')){ res.writeHead(404,{'content-type':'application/json'}); res.end(JSON.stringify({error:'not found'})); return }
  const reqs = defaultRequirements()
  const sigHeader = req.headers['payment-signature']
  if(!sigHeader){ res.writeHead(402,{'content-type':'application/json'}); res.end(JSON.stringify({ x402Version:2, error:'payment required', accepts:[reqs] })); return }
  let paymentPayload
  try{ paymentPayload = JSON.parse(Buffer.from(sigHeader,'base64').toString('utf8')) }
  catch{ res.writeHead(400,{'content-type':'application/json'}); res.end(JSON.stringify({error:'bad PAYMENT-SIGNATURE'})); return }
  const v = await facilitator('/verify', { paymentPayload, paymentRequirements:reqs })
  if(v.json && v.json.isValid===true){
    const signal = await premiumSignal()
    res.writeHead(200,{'content-type':'application/json','x-payment-response':Buffer.from(JSON.stringify({payer:v.json.payer})).toString('base64')})
    res.end(JSON.stringify({ paid:true, payer:v.json.payer, signal }))
  } else {
    res.writeHead(402,{'content-type':'application/json'}); res.end(JSON.stringify({ x402Version:2, error:'invalid payment', facilitator:v.json }))
  }
}

function startServer(port){
  const server = createServer((req,res)=>{ handle(req,res).catch(e=>{ res.writeHead(500,{'content-type':'application/json'}); res.end(JSON.stringify({error:String(e)})) }) })
  return new Promise(resolve=>server.listen(port||0,()=>resolve(server)))
}

async function demo(){
  const server = await startServer(0)
  const base = 'http://127.0.0.1:'+server.address().port
  console.log('[demo] resource server on '+base)
  const r1 = await fetch(base+'/premium/treasury-signal'); const j1 = await r1.json()
  console.log('[demo] step1 GET (no payment) -> '+r1.status); console.log(JSON.stringify(j1,null,2))
  const built = buildSignedPayload(j1.accepts[0])
  console.log('[demo] step2 signed TransferWithAuthorization, digest '+built.digest)
  const header = Buffer.from(JSON.stringify(built.paymentPayload)).toString('base64')
  const r2 = await fetch(base+'/premium/treasury-signal',{ headers:{ 'payment-signature':header } }); const j2 = await r2.json()
  console.log('[demo] step3 GET (PAYMENT-SIGNATURE) -> '+r2.status); console.log(JSON.stringify(j2,null,2))
  server.close()
  if(r2.status!==200 || !j2.paid){ console.log('[demo] FAILED'); process.exit(1) }
  console.log('[demo] OK — full x402 402->pay->200 loop verified by live CSPR.cloud facilitator')
}

const cmd = process.argv[2] || 'verify'
console.log('[x402] signer pubkey :', pubHex)
console.log('[x402] account hash  :', myHash)
if(cmd==='supported'){ const r=await facilitator('/supported'); console.log('[/supported]',r.status,JSON.stringify(r.json,null,2)) }
else if(cmd==='selftest'){ process.exit(selftest()?0:1) }
else if(cmd==='serve'){ const p=Number(process.env.PORT||4021); await startServer(p); console.log('[x402] resource server on http://127.0.0.1:'+p+'/premium/treasury-signal') }
else if(cmd==='demo'){ if(!selftest()){ console.log('[x402] selftest FAILED'); process.exit(1) } await demo() }
else {
  if(!selftest()){ console.log('[x402] selftest FAILED — не иду в сеть'); process.exit(1) }
  const b = buildSignedPayload()
  console.log('[x402] eip712 digest :', b.digest)
  console.log('[x402] signature     :', b.signature.slice(0,20)+'… ('+b.signature.length+' hex)')
  const ep = cmd==='settle'?'/settle':'/verify'
  const r = await facilitator(ep, { paymentPayload:b.paymentPayload, paymentRequirements:b.paymentRequirements })
  console.log('['+ep+']', r.status, JSON.stringify(r.json,null,2))
}
