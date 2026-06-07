/* Helios deposit-fix v7 — on-chain record_rebalance, chainName from csprclick */
(function(){
  const LOG=(...a)=>console.log('[helios/dep4]',...a);
  const PKG='f21eb828df55867867bdc91adf1658b315fd1caecde9b601481e3ab32c6af872';
  const SDK_URL='https://esm.sh/casper-js-sdk@5';
  const $=id=>document.getElementById(id);
  function resolvePk(){
    try{
      const cc=window.csprclick;
      if(cc){
        const acc=cc.getActiveAccount&&cc.getActiveAccount();
        if(acc&&acc.public_key)return acc.public_key;
        const pk=cc.getActivePublicKey&&cc.getActivePublicKey();
        if(pk)return pk;
      }
    }catch(e){LOG('pk err',e);}
    return null;
  }
  let _sdk=null;
  async function loadSdk(){
    if(_sdk)return _sdk;
    const mod=await import(SDK_URL);
    _sdk=mod.ContractCallBuilder?mod:(mod.default||mod);
    return _sdk;
  }
  function setToast(t,m,link){
    try{
      if($('toastT'))$('toastT').textContent=t;
      if($('toastM'))$('toastM').innerHTML=m+(link?' · <a href="'+link+'" target="_blank" rel="noopener">view tx</a>':'');
      if($('toast')){$('toast').classList.add('show');clearTimeout(window._tt);window._tt=setTimeout(()=>$('toast').classList.remove('show'),7000);}
    }catch(e){LOG('toast err',e);}
  }
  async function doDeposit(){
    let pk=resolvePk();
    if(!pk||!/^0[12][0-9a-fA-F]{2,}$/.test(pk)){setToast('⚠️ Connect wallet','Open the wallet and connect first.');return;}
    pk=pk.toLowerCase();
    const CN=(window.csprclick&&window.csprclick.chainName)||'casper-test';
    LOG('csprclick.chainName =',window.csprclick&&window.csprclick.chainName,'| using',CN);
    setToast('Submitting…','Network: '+CN);
    let sdk;
    try{sdk=await loadSdk();}catch(e){LOG('sdk',e);setToast('SDK error',String(e&&e.message||e));return;}
    const {ContractCallBuilder,Args,CLValue,PublicKey}=sdk;
    let tx;
    try{
      const args=Args.fromMap({apy_bps:CLValue.newCLUInt32(1180),risk_score:CLValue.newCLUint8(82)});
      tx=new ContractCallBuilder()
        .from(PublicKey.fromHex(pk))
        .byPackageHash(PKG)
        .entryPoint('record_rebalance')
        .runtimeArgs(args)
        .chainName(CN)
        .payment(3000000000,5)
        .build();
    }catch(e){LOG('build',e);setToast('Build error',String(e&&e.message||e));return;}
    try{
      const res=await window.csprclick.send(tx.toJSON(),pk,(st,d)=>LOG('status',st,d));
      LOG('send result',res);
      if(res&&res.cancelled){setToast('Cancelled','You rejected the transaction.');return;}
      if(res&&res.error){setToast('Failed ['+CN+']','err: '+res.error+(res.errorData?(' / '+JSON.stringify(res.errorData)):''));return;}
      const hash=res&&(res.transactionHash||res.deployHash);
      if(hash){
        setToast('On-chain tx confirmed','record_rebalance() · '+hash.slice(0,10)+'…','https://testnet.cspr.live/transaction/'+hash);
        try{deposited=true;render();startStream();if($('dash'))$('dash').classList.remove('locked');}catch(e){LOG('demo',e);}
      }else{setToast('Submitted ['+CN+']','Sent to network');}
    }catch(e){LOG('send',e);setToast('Failed',String(e&&e.message||e));}
  }
  function wire(){
    const btn=$('depBtn');
    if(!btn){setTimeout(wire,400);return;}
    btn.onclick=doDeposit;
    LOG('wired v7 chainName=',window.csprclick&&window.csprclick.chainName);
  }
  if(window.csprclick)wire();else{window.addEventListener('csprclick:loaded',wire);setTimeout(wire,1500);}
})();
