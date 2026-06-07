/* Helios Protocol — deposit via csprclick + casper-js-sdk v5 */
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
    btn.textContent = 'Awaiting signature...';
    try {
      var sdk = await import(SDK_URL);
      var makeCsprTransferDeploy = sdk.default.makeCsprTransferDeploy;
      var deploy = makeCsprTransferDeploy({
        senderPublicKeyHex: acct.public_key,
        recipientPublicKeyHex: TREASURY,
        transferAmount: motes,
        chainName: window.csprclick.chainName || 'casper-test'
      });
      log('deploy built OK');
      log('deploy methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(deploy)));
      log('sdk serialize methods:', Object.keys(sdk.default).filter(k => k.toLowerCase().includes('serial') || k.toLowerCase().includes('json') || k.toLowerCase().includes('deploy')));
      var serializeDeploy = sdk.default.serializeDeploy || sdk.default.DeployUtil && sdk.default.DeployUtil.deployToJson;
      var json = serializeDeploy ? serializeDeploy(deploy) : deploy.toJSON();
      log('json', JSON.stringify(json).slice(0,100));
      var res = await window.csprclick.send(JSON.stringify({deploy: json}), acct.public_key);
      log('result', JSON.stringify(res).slice(0,200));
      if (res && res.deployHash) note('Deposit sent!', res.deployHash);
      else if (res && res.cancelled) note('Cancelled', '');
      else note('Done', JSON.stringify(res).slice(0,100));
    } catch(err) {
      log('error', err.message, err.stack);
      note('Error', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  };
})();
