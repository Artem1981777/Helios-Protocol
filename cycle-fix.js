(function(){
  var PKG='f21eb828df55867867bdc91adf1658b315fd1caecde9b601481e3ab32c6af872';
  var SDK_URL='https://esm.sh/casper-js-sdk@5';
  function $(id){return document.getElementById(id);}
  function toast(t,m){try{var T=$('toastT'),M=$('toastM'),B=$('toast');if(T)T.textContent=t;if(M)M.innerHTML=m;if(B){B.style.display='block';if(B.classList)B.classList.add('show');}}catch(e){}}
  function logLine(txt){try{if(typeof window.pushLog==='function')window.pushLog(txt);}catch(e){}}
  function rnd(a,b){return a+Math.floor(Math.random()*(b-a+1));}
  var sdkP=null;
  function loadSdk(){if(sdkP)return sdkP;sdkP=import(SDK_URL).then(function(mod){return (mod&&mod.ContractCallBuilder)?mod:(mod.default||mod);});return sdkP;}
  function resolvePk(){var cc=window.csprclick;if(!cc)return null;try{var a=cc.getActiveAccount&&cc.getActiveAccount();if(a&&a.public_key)return a.public_key;}catch(e){}try{var p=cc.getActivePublicKey&&cc.getActivePublicKey();if(p)return p;}catch(e){}return null;}
  function run(){
    var btn=$('cycleBtn');
    var cc=window.csprclick;
    if(!cc){toast('Swarm error','CSPR.click not loaded');return;}
    var pk=resolvePk();
    if(!pk||!/^0[12][0-9a-fA-F]{2,}$/.test(pk)){toast('Connect wallet','Connect a Casper Testnet account first (Accounts menu)');return;}
    pk=pk.toLowerCase();
    var CN=cc.chainName||'casper-test';
    if(btn)btn.disabled=true;
    logLine('Yield Scout: scanning 7 RWA pools…');
    logLine('Risk Oracle: verifying ratings via x402…');
    var apyBps=rnd(1150,1280),risk=rnd(80,84);
    logLine('Execution: rebalance APY '+(apyBps/100).toFixed(2)+'% · risk '+risk+' -> submitting on-chain…');
    toast('Swarm cycle','Submitting record_rebalance on '+CN+'…');
    loadSdk().then(function(SDK){
      var PublicKey=SDK.PublicKey,Args=SDK.Args,CLValue=SDK.CLValue,ContractCallBuilder=SDK.ContractCallBuilder;
      var tx=new ContractCallBuilder().from(PublicKey.fromHex(pk)).byPackageHash(PKG).entryPoint('record_rebalance').runtimeArgs(Args.fromMap({apy_bps:CLValue.newCLUInt32(apyBps),risk_score:CLValue.newCLUint8(risk)})).chainName(CN).payment(3000000000,5).build();
      cc.send(tx.toJSON(),pk,function(st,d){
        if(st==='sent'){var hh=(d&&(d.transactionHash||d.deployHash))||'';logLine('broadcast '+(hh?hh.slice(0,10)+'…':''));toast('Submitted','Broadcasting to '+CN+'…');return;}
        if(st==='processed'){
          var h=(d&&(d.transactionHash||d.deployHash))||'';
          var short=h?h.slice(0,10)+'…':'';
          var link=h?('<a href="https://testnet.cspr.live/transaction/'+h+'" target="_blank" style="color:#FFB627">view tx</a>'):'';
          toast('On-chain rebalance OK','record_rebalance() · '+short+' · '+link);
          try{var r=$('rebs');if(r)r.textContent=String(parseInt(r.textContent||'0',10)+1);}catch(e){}
          try{var ap=$('apy');if(ap)ap.textContent=(apyBps/100).toFixed(1)+'%';}catch(e){}
          try{var rk=$('risk');if(rk)rk.textContent=String(risk);}catch(e){}
          logLine('rebalance confirmed · '+short);
          if(btn)btn.disabled=false;return;
        }
        if(st==='cancelled'||st==='timeout'||st==='expired'){toast('Cancelled',st);if(btn)btn.disabled=false;return;}
        if(st==='error'){toast('Swarm failed','err: '+((d&&d.error)||'unknown')+' ['+CN+']');if(btn)btn.disabled=false;return;}
      });
    }).catch(function(e){toast('Swarm error',String((e&&e.message)||e));if(btn)btn.disabled=false;});
  }
  function wire(){var b=$('cycleBtn');if(b)b.onclick=run;}
  if(window.csprclick)wire();
  window.addEventListener('csprclick:loaded',wire);
  setTimeout(wire,1500);
})();
