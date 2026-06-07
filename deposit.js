/* Helios Protocol — real on-chain deposit via CSPR.click + casper-js-sdk */
(function () {
  var TREASURY = '014371b02df1d899a4f70ce3f956851c287e5e2e9aeb2670bf2c9b08d2c66ece8e';
  var SDK_URL = 'https://esm.sh/casper-js-sdk@5';
  var MIN_CSPR = 2.5;
  var sdkPromise = null;
  function $(id) { return document.getElementById(id); }
  function note(t, m, link) { try { if (typeof toast === 'function') toast(t, m, link); } catch (e) {} }
  function log() { try { console.log.apply(console, ['[helios/deposit]'].concat([].slice.call(arguments))); } catch (e) {} }
  function loadSdk() {
    if (!sdkPromise) {
      note('Loading transaction engine…', 'Fetching casper-js-sdk (one-time)');
      sdkPromise = import(SDK_URL).catch(function (e) { sdkPromise = null; throw e; });
    }
    return sdkPromise;
  }
  function explorer(hash) { return 'https://testnet.cspr.live/transaction/' + hash; }
  var btn = $('depBtn');
  log('init; depBtn found =', !!btn);
  if (!btn) return;
  btn.onclick = async function () {
    var acct = (window.csprclick && window.csprclick.getActiveAccount) ? window.csprclick.getActiveAccount() : null;
    if (!acct || !acct.public_key) { note('⚠️ Connect wallet', 'Connect your Casper wallet first.'); return; }
    var amt = parseFloat(($('depInput') && $('depInput').value) || '0');
    if (!(amt > 0)) { note('Enter amount', 'Type how much CSPR to deposit.'); return; }
    if (amt < MIN_CSPR) { note('Minimum ' + MIN_CSPR + ' CSPR', 'Casper native transfers require at least ' + MIN_CSPR + ' CSPR.'); return; }
    var senderPk = acct.public_key.toLowerCase();
    var motes = BigInt(Math.round(amt * 1e9)).toString();
    var orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    try {
      var sdk = await loadSdk();
      var NativeTransferBuilder = sdk.NativeTransferBuilder;
      var PublicKey = sdk.PublicKey;
      var chain = (window.csprclick && window.csprclick.chainName) || 'casper-test';
      var tx = new NativeTransferBuilder()
        .from(PublicKey.fromHex(senderPk))
        .target(PublicKey.fromHex(TREASURY))
        .amount(motes)
        .id(Date.now())
        .chainName(chain)
        .payment(100000000)
        .build();
      note('Confirm in wallet', 'Approve the deposit transaction…');
      btn.textContent = 'Awaiting signature…';
      var onStatus = function (status, data) {
        log('status', status, data);
        if (status === 'sent') note('Deposit submitted', 'Broadcasting to Casper Testnet…');
        else if (status === 'processed') note('✅ Deposit confirmed', 'Executed on-chain');
        else if (status === 'timeout') note('Still processing', 'Network is slow — check explorer.');
        else if (status === 'error') note('On-chain error', (data && (data.message || JSON.stringify(data))) || 'Execution failed');
      };
      log('tx json', JSON.stringify(tx.toJSON()).slice(0,200));
      log('csprclick methods', Object.keys(window.csprclick));
      var res = await window.csprclick.sign(tx.toJSON(), senderPk);
      log('send result', res);
      if (res && res.transactionHash) {
        var h = res.transactionHash;
        note('✅ Deposit sent', amt + ' CSPR · view on explorer', explorer(h));
        try { deposited = true; } catch (e) {}
        try { connected = true; } catch (e) {}
        try { tvm = (typeof tvm === 'number' ? tvm : 0) + amt; } catch (e) {}
        try { if (typeof render === 'function') render(); } catch (e) {}
        try { if (typeof startStream === 'function') startStream(); } catch (e) {}
        try { if (typeof pushLog === 'function') pushLog('💰', 'now', 'On-chain deposit', amt + ' CSPR → Helios treasury'); } catch (e) {}
      } else if (res && res.cancelled) {
        note('Cancelled', 'You rejected the transaction.');
      } else {
        note('Deposit failed', (res && (res.error || JSON.stringify(res.errorData))) || 'Unknown error');
      }
    } catch (err) {
      log('deposit error', err);
      var msg = (err && err.message) || String(err);
      if (/import|fetch|network|Failed to fetch/i.test(msg)) note('SDK load failed', 'Could not fetch casper-js-sdk — check VPN/network.');
      else note('Deposit error', msg);
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  };
})();
