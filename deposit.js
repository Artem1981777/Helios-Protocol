/* Helios Protocol — deposit via makeTransferTransaction */
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
      var makeTransferTransaction = sdk.default.makeTransferTransaction || sdk.default.makeCsprTransferTransaction;
      log('makeTransferTransaction=', typeof makeTransferTransaction);
      var chain = window.csprclick.chainName || 'casper-test';
      var transaction = makeTransferTransaction(
        acct.public_key,
        TREASURY,
        motes,
        chain
      );
      log('transaction built, type=', typeof transaction);
      var res = await window.csprclick.send(transaction, acct.public_key);
      log('result', JSON.stringify(res).slice(0,200));
      if (res && res.deployHash) note('Deposit sent!', res.deployHash);
      else if (res && res.cancelled) note('Cancelled', '');
      else note('Done', JSON.stringify(res).slice(0,100));
    } catch(err) {
      log('error', err.message);
      note('Error', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  };
})();
