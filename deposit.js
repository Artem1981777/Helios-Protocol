/* Helios Protocol — deposit via csprclick + casper-js-sdk */
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
      var CasperClient = sdk.default.CasperClient || sdk.CasperClient;
      var DeployUtil = sdk.default.DeployUtil || sdk.DeployUtil;
      var CLPublicKey = sdk.default.CLPublicKey || sdk.CLPublicKey;
      log('CLPublicKey=', typeof CLPublicKey, 'DeployUtil=', typeof DeployUtil);
      var sender = CLPublicKey.fromHex(acct.public_key);
      var target = CLPublicKey.fromHex(TREASURY);
      var chain = 'casper-test';
      var deployParams = new DeployUtil.DeployParams(sender, chain, 1, 1800000);
      var session = DeployUtil.ExecutableDeployItem.newTransfer(motes, target, null, Date.now());
      var payment = DeployUtil.standardPayment(100000000);
      var deploy = DeployUtil.makeDeploy(deployParams, session, payment);
      var json = DeployUtil.deployToJson(deploy);
      log('deploy json ready, signing...');
      var res = await window.csprclick.sign(json, acct.public_key);
      log('sign result', res);
      if (res && res.deploy) {
        var client = new CasperClient('https://node.testnet.casper.network/rpc');
        var hash = await client.putDeploy(res.deploy);
        note('Deposit sent!', hash);
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
