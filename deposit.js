/* Helios Protocol — deposit via csprclick */
(function () {
  var TREASURY = '014371b02df1d899a4f70ce3f956851c287e5e2e9aeb2670bf2c9b08d2c66ece8e';
  var SDK_URL = 'https://esm.sh/casper-js-sdk@5.0.3';
  var MIN_CSPR = 2.5;
  function $(id) { return document.getElementById(id); }
  function note(t, m) { try { if (typeof toast === 'function') toast(t, m); } catch (e) {} }
  function log() { try { console.log.apply(console, ['[helios/deposit]'].concat([].slice.call(arguments))); } catch (e) {} }
  var btn = $('depBtn');
  if (!btn) return;
  btn.onclick = async function () {
    var acct = window.csprclick ? window.csprclick.getActiveAccount() : null;
    if (!acct || !acct.public_key) { note('Connect wallet first', ''); return; }
    var amt = parseFloat(($('depInput') && $('depInput').value) || '0');
    if (!(amt >= MIN_CSPR)) { note('Minimum ' + MIN_CSPR + ' CSPR', ''); return; }
    var motes = String(Math.round(amt * 1e9));
    var orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Awaiting signature…';
    try {
      var sdk = await import(SDK_URL);
      var s = sdk.default;
      var makeCsprTransferDeploy = s.makeCsprTransferDeploy;
      var PublicKey = s.PublicKey;
      log('PublicKey methods:', Object.getOwnPropertyNames(PublicKey));
      var deploy = makeCsprTransferDeploy({
        fromPublicKeyHex: acct.public_key,
        toPublicKeyHex: TREASURY,
        amountMotes: motes,
        transferId: String(Date.now()),
        chainName: 'casper-test',
        paymentAmount: '100000000'
      });
      log('deploy built, signing...');
      var json = deploy.toJson ? deploy.toJson() : JSON.parse(JSON.stringify(deploy));
      var res = await window.csprclick.sign(json, acct.public_key);
      log('sign result', JSON.stringify(res).slice(0, 200));
      if (res && !res.cancelled) {
        note('Deposit sent!', 'Transaction submitted');
      } else {
        note('Cancelled', '');
      }
    } catch(err) {
      log('error', err);
      note('Error', err.message || String(err));
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  };
})();
