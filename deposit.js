/* Helios Protocol — deposit via csprclick sign-deploy */
(function () {
  var TREASURY = '014371b02df1d899a4f70ce3f956851c287e5e2e9aeb2670bf2c9b08d2c66ece8e';
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
      var res = await window.csprclick.send(
        JSON.stringify({
          deploy: {
            header: {
              account: acct.public_key,
              timestamp: new Date().toISOString(),
              ttl: "30m",
              gas_price: 1,
              body_hash: "",
              dependencies: [],
              chain_name: "casper-test"
            },
            payment: {
              ModuleBytes: {
                module_bytes: "",
                args: [["amount", {"cl_type": "U512", "bytes": "0500e8764817", "parsed": "100000000"}]]
              }
            },
            session: {
              Transfer: {
                args: [
                  ["amount", {"cl_type": "U512", "bytes": "", "parsed": motes}],
                  ["target", {"cl_type": "PublicKey", "bytes": TREASURY, "parsed": TREASURY}],
                  ["id", {"cl_type": {"Option": "U64"}, "bytes": "", "parsed": Date.now()}]
                ]
              }
            },
            approvals: []
          }
        }),
        acct.public_key
      );
      log('result', JSON.stringify(res).slice(0,300));
      if (res && !res.cancelled) note('Submitted!', '');
      else note('Cancelled', '');
    } catch(err) {
      log('error', err.message);
      note('Error', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  };
})();
