(function(){
  window.clickSDKOptions={appName:'Helios Protocol',appId:'csprclick-template',providers:['casper-wallet','ledger','metamask-snap']};
  window.clickUIOptions={uiContainer:'csprclick-ui',rootAppElement:'body',defaultTheme:'dark',accountMenuItems:['AccountCardMenuItem','CopyHashMenuItem'],networkSettings:{networks:['Testnet','Mainnet'],currentNetwork:'Testnet',onNetworkSwitch:function(n){if(window.csprclickUI)window.csprclickUI.setNetwork(n);}}};
  if(!document.getElementById('csprclick-ui')){var d=document.createElement('div');d.id='csprclick-ui';document.body.insertBefore(d,document.body.firstChild);}
  var btn=document.getElementById('connectBtn');
  var short=function(pk){return pk?pk.slice(0,5)+'\u2026'+pk.slice(-4):'';};
  function on(pk){try{connected=true;}catch(e){}if(btn){btn.textContent='\u26ac '+short(pk);btn.style.background='var(--panel-strong)';btn.style.color='var(--text)';btn.style.border='1px solid var(--border-glow)';}}
  function off(){try{connected=false;}catch(e){}if(btn){btn.textContent='\u26ac Connect Wallet';btn.style.background='';btn.style.color='';btn.style.border='';}}
  function note(t,m){if(typeof toast==='function')toast(t,m);}
  window.addEventListener('csprclick:loaded',function(){
    window.csprclick.on('csprclick:signed_in',function(e){var pk=e&&e.account&&e.account.public_key;on(pk);note('Wallet connected','CSPR.click \u00b7 '+short(pk));});
    window.csprclick.on('csprclick:switched_account',function(e){var pk=e&&e.account&&e.account.public_key;on(pk);note('Account switched',short(pk));});
    window.csprclick.on('csprclick:signed_out',function(){off();note('Wallet disconnected','Session closed');});
    window.csprclick.on('csprclick:disconnected',function(){off();});
    window.csprclick.on('csprclick:unsolicited_account_change',function(e){if(e&&e.account)window.csprclick.signInWithAccount(e.account);});
  });
  if(btn){btn.onclick=function(){if(!window.csprclick){note('Loading\u2026','CSPR.click is initializing, try again.');return;}var c=false;try{c=!!connected;}catch(e){}if(c)window.csprclick.switchAccount();else window.csprclick.signIn();};}
  var id='csprclick-script';
  if(!document.getElementById(id)){var s=document.createElement('script');s.id=id;s.src='https://cdn.cspr.click/ui/v2.0.0/csprclick-client-2.0.0.js';s.defer=true;document.head.appendChild(s);}
})();
