/* Helios Protocol — on-chain deposit via CSPR.click + casper-js-sdk NativeTransferBuilder */
(function () {
  var TREASURY = '014371b02df1d899a4f70ce3f956851c287e5e2e9aeb2670bf2c9b08d2c66ece8e';
  var SDK_URL = 'https://esm.sh/casper-js-sdk@5';
  var MIN_CSPR = 2.5;
  var sdkPromise = null;
  function L() { try { console.log.apply(console, ['[helios/dep2]'].concat([].slice.call(arguments))); } catch (e) {} }
  function $(id) { return document.getElementById(id); }
  function note(t, m, link) { try { if (typeof toast === 'function') toast(t, m, link); } catch (e) {} }
  function loadSdk() {
    if (!sdkPromise) {
      sdkPromise = import(SDK_URL).then(function (mod) {
        var sdk = (mod && mod.NativeTransferBuilder) ? mod : ((mod && mod.default) ? mod.default : mod);
        L('sdk keys', Object.keys(sdk || {}).slice(0, 40).join(','));
        return sdk;
      }).catch(function (e) { sdkPromise = null; throw e; });
    }
    return sdkPromise;
  }
  async function resolvePk() {
    try {
      var a = window.csprclick && window.csprclick.getActiveAccount && window.csprclick.getActiveAccount();
      L('getActiveAccount', a ? JSON.stringify({ provider: a.provider, public_key: a.public_key }) : 'null');
      if (a && a.public_key) return String(a.public_key).toLowerCase();
    } catch (e) { L('getActiveAccount threw', String(e)); }
    try {
      if (window.csprclick && window.csprclick.getActivePublicKey) {
        var k = await window.csprclick.getActivePublicKey();
        L('getActivePublicKey', k);
        if (k) return String(k).toLowerCase();
      }
    } catch (e) { L('getActivePublicKey threw', String(e)); }
    return null;
  }
  function bind() {
    var btn = $('depBtn');
    L('init; depBtn =', !!btn, '; csprclick =', !!window.csprclick);
    if (!btn) return false;
    btn.onclick = async function () {
      var orig = btn.textContent;
      try {
        var amt = parseFloat(($('depInput') && $('depInput').value) || '0');
        if (!(amt > 0)) { note('Enter amount', 'Type how much CSPR to deposit.'); return; }
        if (amt < MIN_CSPR) { note('Minimum ' + MIN_CSPR + ' CSPR', 'Casper native transfers need at least ' + MIN_CSPR + ' CSPR.'); return; }
        var pk = await resolvePk();
        if (!pk || !/^0[12][0-9a-f]{2,}$/.test(pk)) { L('no valid pk ->', pk); note('Connect wallet', 'Could not read account key. Reconnect wallet.'); return; }
        L('sender pk', pk);
        if (!window.csprclick || typeof window.csprclick.send !== 'function') { note('SDK not ready', 'Reload the page.'); return; }
        btn.disabled = true; btn.textContent = 'Loading...';
        note('Loading transaction engine...', 'Fetching casper-js-sdk (one-time)');
        var sdk = await loadSdk();
        var NativeTransferBuilder = sdk.NativeTransferBuilder, PublicKey = sdk.PublicKey;
        if (!NativeTransferBuilder || !PublicKey) { L('missing exports', typeof NativeTransferBuilder, typeof PublicKey); note('SDK error', 'No NativeTransferBuilder in casper-js-sdk.'); return; }
        var motes = BigInt(Math.round(amt * 1e9)).toString();
        var chain = 'casper-test';
        L('building tx', pk, '->', TREASURY, motes, chain);
        var tx = new NativeTransferBuilder()
          .from(PublicKey.fromHex(pk))
          .target(PublicKey.fromHex(TREASURY))
          .amount(motes)
          .id(Date.now())
          .chainName(chain)
          .payment(100000000).gasPriceTolerance(1)
          .build();
        var txJson = tx.toJSON();
        L('tx built; calling send');
        note('Confirm in wallet', 'Approve the deposit in your Casper wallet...');
        btn.textContent = 'Awaiting signature...';
        var onStatus = function (status, data) {
          L('status', status, data);
          if (status === 'sent') note('Deposit submitted', 'Broadcasting to Casper Testnet...');
          else if (status === 'processed') note('Deposit confirmed', 'Executed on-chain');
          else if (status === 'error') note('On-chain error', (data && (data.message || JSON.stringify(data))) || 'failed');
        };
        var res = await window.csprclick.send(txJson, pk, onStatus);
        L('send result', res);
        if (res && res.transactionHash) {
          note('Deposit sent', amt + ' CSPR - view tx', 'https://testnet.cspr.live/transaction/' + res.transactionHash);
          try { deposited = true; connected = true; tvm = (typeof tvm === 'number' ? tvm : 0) + amt; if (typeof render === 'function') render(); if (typeof startStream === 'function') startStream(); if (typeof pushLog === 'function') pushLog('\uD83D\uDCB0', 't-green', 'On-chain deposit', amt + ' CSPR -> Helios treasury'); } catch (e) { L('ui upd err', String(e)); }
        } else if (res && res.cancelled) { note('Cancelled', 'You rejected the transaction.'); }
        else { note('Deposit failed', (res && (res.error || JSON.stringify(res.errorData))) || 'Unknown error'); }
      } catch (err) {
        var msg = (err && err.message) || String(err);
        L('deposit error', msg, err);
        if (/import|fetch|network|Failed to fetch|chunk/i.test(msg)) note('SDK load failed', 'Could not fetch casper-js-sdk - check VPN/network.');
        else note('Deposit error', msg);
      } finally { btn.disabled = false; btn.textContent = orig; }
    };
    return true;
  }
  if (!bind()) document.addEventListener('DOMContentLoaded', bind);
})();
