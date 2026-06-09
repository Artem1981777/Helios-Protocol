import sdk from 'casper-js-sdk';
import fs from 'fs';
const { SessionBuilder, Args, CLValue, PrivateKey, KeyAlgorithm, HttpHandler, RpcClient } = sdk;

const HOME = process.env.HOME;
const RPC  = 'https://node.testnet.cspr.cloud/rpc';
const TOKEN= '***REMOVED***';
const CHAIN= 'casper-test';
const WASM = HOME + '/Helios-Protocol/contracts/wasm/ReputationRegistry.wasm';
const KEY  = HOME + '/keys/secret_key.pem';
const PAYMENT = 600000000000; // 600 CSPR
const PKG_KEY = 'ReputationRegistry_package_hash';

const bj = o => JSON.stringify(o, (k,v)=> typeof v==='bigint'? v.toString(): v, 2);
const hexOf = h => !h ? null : (h.toHex ? h.toHex() : (h.hash && h.hash.toHex ? h.hash.toHex() : String(h)));

const wasmBytes = new Uint8Array(fs.readFileSync(WASM));
const pem = fs.readFileSync(KEY, 'utf8');

const args = () => Args.fromMap({
  odra_cfg_package_hash_key_name: CLValue.newCLString(PKG_KEY),
  odra_cfg_allow_key_override:    CLValue.newCLValueBool(true),
  odra_cfg_is_upgradable:         CLValue.newCLValueBool(false),
  odra_cfg_is_upgrade:            CLValue.newCLValueBool(false),
});

(async () => {
  console.log('wasm bytes:', wasmBytes.length);
  const key = await PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
  const pub = (typeof key.publicKey === 'function') ? key.publicKey() : key.publicKey;
  console.log('public key:', pub.toHex ? pub.toHex() : String(pub));

  const handler = new HttpHandler(RPC);
  handler.setCustomHeaders({ Authorization: TOKEN });
  const client = new RpcClient(handler);

  const baseV1 = () => new SessionBuilder().from(pub).chainName(CHAIN)
    .wasm(wasmBytes).installOrUpgrade().runtimeArgs(args()).payment(PAYMENT, 5);
  const baseLegacy = () => new SessionBuilder().from(pub).chainName(CHAIN)
    .wasm(wasmBytes).runtimeArgs(args()).payment(PAYMENT, 5);

  let res, hash, mode;
  try {
    mode = 'TransactionV1';
    const tx = baseV1().build();
    const s = tx.sign(key); if (s && s.then) await s;
    console.log('Отправка V1 install...');
    res = await client.putTransaction(tx);
    hash = hexOf(res.transactionHash || (res.transaction && res.transaction.hash));
  } catch (e1) {
    console.error('V1 не прошёл:', e1 && e1.message ? e1.message : e1);
    console.log('Фоллбэк -> legacy Deploy (put_deploy)...');
    mode = 'legacy Deploy';
    const dep = baseLegacy().buildFor1_5();
    const s = dep.sign(key); if (s && s.then) await s;
    res = await client.putDeploy(dep);
    hash = hexOf(res.deployHash || res.deploy_hash || res.transactionHash);
  }

  console.log('=== ОТПРАВЛЕНО (' + mode + ') ===');
  console.log(bj(res));
  console.log('HASH:', hash);
  console.log('Explorer: https://testnet.cspr.live/' + (mode==='legacy Deploy'?'deploy/':'transaction/') + (hash||''));
})().catch(e => { console.error('=== ОШИБКА ИНСТАЛЛА ==='); console.error(e && e.stack ? e.stack : e); process.exit(1); });
