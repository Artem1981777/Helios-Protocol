import sdk from 'casper-js-sdk';
import fs from 'fs';
const { ContractCallBuilder, Args, CLValue, PrivateKey, KeyAlgorithm, HttpHandler, RpcClient } = sdk;
const RPC='https://node.testnet.cspr.cloud/rpc';
const TOKEN=process.env.CSPR_CLOUD_AUTH_TOKEN;
const CHAIN='casper-test';
const KEY=process.env.HOME+'/keys/secret_key.pem';
const PKG='c49efa353ff058fbbbd960cb742b6711e09ce25cdc3d0e0857aac13d8ad0b716';
const PKG_NAME='ReputationRegistry_package_hash';
const APY=1169, RISK=81, PAYMENT=5000000000;
const bj=o=>JSON.stringify(o,(k,v)=>typeof v==='bigint'?v.toString():v,2);
const hexOf=h=>!h?null:(h.toHex?h.toHex():(h.hash&&h.hash.toHex?h.hash.toHex():String(h)));
const args=()=>Args.fromMap({ apy_bps:CLValue.newCLUInt32(APY), risk_score:CLValue.newCLUint8(RISK) });

(async()=>{
  const key=await PrivateKey.fromPem(fs.readFileSync(KEY,'utf8'),KeyAlgorithm.ED25519);
  const pub=(typeof key.publicKey==='function')?key.publicKey():key.publicKey;
  const h=new HttpHandler(RPC); h.setCustomHeaders({Authorization:TOKEN});
  const c=new RpcClient(h);
  const targets=[
    ['byPackageHash', b=>b.byPackageHash(PKG)],
    ['byPackageName', b=>b.byPackageName(PKG_NAME)],
  ];
  let res,hash,used;
  for(const [name,apply] of targets){
    try{
      let b=new ContractCallBuilder().from(pub).chainName(CHAIN);
      b=apply(b);
      const tx=b.entryPoint('record_decision').runtimeArgs(args()).payment(PAYMENT,5).build();
      const s=tx.sign(key); if(s&&s.then)await s;
      console.log('Отправка record_decision через '+name+'...');
      res=await c.putTransaction(tx);
      hash=hexOf(res.transactionHash||(res.transaction&&res.transaction.hash));
      used=name; break;
    }catch(e){ console.log(name+' не прошёл: '+(e&&e.message?e.message:e)); }
  }
  if(!hash){ console.log('Все варианты не прошли'); process.exit(1); }
  console.log('=== ОТПРАВЛЕНО ('+used+') ===');
  console.log(bj(res));
  console.log('HASH:',hash);
  console.log('Explorer: https://testnet.cspr.live/transaction/'+hash);
})().catch(e=>{console.error('ERR',e&&e.stack?e.stack:e);process.exit(1)});
