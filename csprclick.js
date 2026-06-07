/* Helios Protocol — real Casper wallet connect via CSPR.click (v2: diagnostics) */
(function () {
  function log() {
    try { console.log.apply(console, ['[helios/csprclick]'].concat([].slice.call(arguments))); } catch (e) {}
  }
  function note(t, m) {
    try { if (typeof toast === 'function') toast(t, m); } catch (e) {}
  }
  window.clickSDKOptions = {
    appName: 'Helios Protocol',
    appId: '00f0c909-02a2-4973-8e88-dc99426c',
    contentMode: 'iframe',
    providers: ['casper-wallet', 'ledger', 'metamask-snap'],
  };
  window.clickUIOptions = {
    uiContainer: 'csprclick-ui',
    rootAppElement: 'body',
    defaultTheme: 'dark',
    accountMenuItems: ['AccountCardMenuItem', 'CopyHashMenuItem'],
    networkSettings: {
      networks: ['Testnet', 'Mainnet'],
      currentNetwork: 'Testnet',
      onNetworkSwitch: function (n) { if (window.csprclickUI) window.csprclickUI.setNetwork(n); },
    },
  };
  if (!document.getElementById('csprclick-ui')) {
    var d = document.createElement('div');
    d.id = 'csprclick-ui';
    document.body.insertBefore(d, document.body.firstChild);
  }
  var btn = document.getElementById('connectBtn');
  log('init; connectBtn found =', !!btn);
  var short = function (pk) { return pk ? pk.slice(0, 5) + '\u2026' + pk.slice(-4) : ''; };
  function on(pk) {
    try { connected = true; } catch (e) {}
    if (btn) {
      btn.textContent = '\u26ac ' + short(pk);
      btn.style.background = 'var(--panel-strong)';
      btn.style.color = 'var(--text)';
      btn.style.border = '1px solid var(--border-glow)';
    }
    note('Wallet connected', 'CSPR.click \u00b7 ' + short(pk));
  }
  function off() {
    try { connected = false; } catch (e) {}
    if (btn) {
      btn.textContent = '\u26ac Connect Wallet';
      btn.style.background = '';
      btn.style.color = '';
      btn.style.border = '';
    }
  }
  window.addEventListener('csprclick:loaded', function () {
    log('csprclick:loaded fired; window.csprclick =', typeof window.csprclick);
    note('Wallet SDK ready', 'CSPR.click loaded');
    try {
      window.csprclick.on('csprclick:signed_in', function (e) { on(e && e.account && e.account.public_key); });
      window.csprclick.on('csprclick:switched_account', function (e) { on(e && e.account && e.account.public_key); });
      window.csprclick.on('csprclick:signed_out', function () { off(); note('Wallet disconnected', 'Session closed'); });
      window.csprclick.on('csprclick:disconnected', function () { off(); });
      window.csprclick.on('csprclick:unsolicited_account_change', function (e) { if (e && e.account) window.csprclick.signInWithAccount(e.account); });
    } catch (err) { log('listener registration error', err); }
  });
  if (btn) {
    btn.onclick = function () {
      log('Connect tapped; csprclick =', typeof window.csprclick, 'signIn =', window.csprclick && typeof window.csprclick.signIn);
      if (!window.csprclick || typeof window.csprclick.signIn !== 'function') {
        note('Loading wallet SDK\u2026', 'CSPR.click is still initializing \u2014 wait a few seconds and tap again.');
        return;
      }
      var c = false;
      try { c = !!connected; } catch (e) {}
      try {
        note('Opening CSPR.click\u2026', 'Choose your wallet');
        if (c) window.csprclick.switchAccount();
        else window.csprclick.signIn();
      } catch (err) {
        log('signIn error', err);
        note('Wallet error', String((err && err.message) || err));
      }
    };
  }
  var id = 'csprclick-script';
  if (!document.getElementById(id)) {
    var s = document.createElement('script');
    s.id = id;
    s.src = 'https://cdn.cspr.click/ui/v2.0.0/csprclick-client-2.0.0.js';
    s.defer = true;
    s.onerror = function () { note('SDK failed to load', 'Could not fetch cdn.cspr.click \u2014 check VPN / network.'); };
    document.head.appendChild(s);
  }
})();
