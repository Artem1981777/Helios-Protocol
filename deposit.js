/* Helios Protocol — deposit via csprclick native transfer */
(function () {
  var TREASURY = '014371b02df1d899a4f70ce3f956851c287e5e2e9aeb2670bf2c9b08d2c66ece8e';
  var MIN_CSPR = 2.5;
  function $(id) { return document.getElementById(id); }
  function note(t, m) { try { if (typeof toast === 'function') toast(t, m); } catch (e) {} }
  function log() { try { console.log.apply(console, ['[helios/deposit]'].concat([].slice.call(arguments))); } catch (e) {} }
  var btn = $('depBtn');
  log('init; depBtn found =', !!btn);
  if (!btn) return;
  btn.onclick = async function () {
    var acct = window.csprclick ? window.csprclick.getActiveAccount() : null;
    if (!acct || !acct.public_key) { note('Connect wallet first', ''); return; }
    var amt = parseFloat(($('depInput') && $('depInput').value) || '0');
    if (!(amt >= MIN_CSPR)) { note('Minimum ' + MIN_CSPR + ' CSPR', ''); return; }
    var motes = String(Math.round(amt * 1e9));
    log('sending', motes, 'motes to', TREASURY);
    var orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Awaiting signature…';
    try {
      var res = await window.csprclick.send({
        deploy: {
          session: {
            Transfer: {
              args: [
                ["amount", {"cl_type": "U512", "bytes": motes, "parsed": motes}],
                ["target", {"cl_type": "PublicKey", "bytes": TREASURY, "parsed": TREASURY}],
                ["id", {"cl_type": {"Option": "U64"}, "bytes": String(Date.now()), "parsed": Date.now()}]
              ]
            }
          },
          payment: {
            ModuleBytes: {
              module_bytes: "",
              args: [["amount", {"cl_type": "U512", "bytes": "100000000", "parsed": "100000000"}]]
            }
          }
        }
      }, acct.public_key);
      log('result', res);
      if (res && res.deployHash) {
        note('Deposit sent!', res.deployHash);
      } else {
        note('Done', JSON.stringify(res));
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
