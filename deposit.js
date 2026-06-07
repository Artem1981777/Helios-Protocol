/* Helios Protocol — manual deploy JSON */
(function () {
  var TREASURY = '014371b02df1d899a4f70ce3f956851c287e5e2e9aeb2670bf2c9b08d2c66ece8e';
  var MIN_CSPR = 2.5;
  function $(id) { return document.getElementById(id); }
  function note(t, m) { try { if (typeof toast === 'function') toast(t, m); } catch (e) {} }
  function log() { try { console.log.apply(console, ['[helios/deposit]'].concat([].slice.call(arguments))); } catch (e) {} }
  function u512hex(n) {
    var hex = BigInt(n).toString(16);
    if (hex.length % 2) hex = '0' + hex;
    var len = (hex.length / 2).toString(16).padStart(2, '0');
    return len + hex;
  }
  var btn = $('depBtn');
  if (!btn) return;
  btn.onclick = async function () {
    var acct = window.csprclick ? window.csprclick.getActiveAccount() : null;
    if (!acct || !acct.public_key) { note('Connect wallet first', ''); return; }
    var amt = parseFloat(($('depInput') && $('depInput').value) || '0');
    if (!(amt >= MIN_CSPR)) { note('Minimum ' + MIN_CSPR + ' CSPR', ''); return; }
    var motes = Math.round(amt * 1e9).toString();
    var now = new Date().toISOString();
    var transferId = Date.now();
    var deploy = {
      hash: "0000000000000000000000000000000000000000000000000000000000000000",
      header: {
        account: acct.public_key,
        timestamp: now,
        ttl: "30m",
        gas_price: 1,
        body_hash: "0000000000000000000000000000000000000000000000000000000000000000",
        dependencies: [],
        chain_name: "casper-test"
      },
      payment: {
        ModuleBytes: {
          module_bytes: "",
          args: [
            ["amount", {
              cl_type: "U512",
              bytes: u512hex(100000000),
              parsed: "100000000"
            }]
          ]
        }
      },
      session: {
        Transfer: {
          args: [
            ["amount", {
              cl_type: "U512",
              bytes: u512hex(motes),
              parsed: motes
            }],
            ["target", {
              cl_type: "PublicKey",
              bytes: TREASURY,
              parsed: TREASURY
            }],
            ["id", {
              cl_type: {Option: "U64"},
              bytes: "01" + transferId.toString(16).padStart(16, '0'),
              parsed: transferId
            }]
          ]
        }
      },
      approvals: []
    };
    var orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Awaiting signature...';
    try {
      log('sending deploy...');
      var res = await window.csprclick.send(JSON.stringify({deploy: deploy}), acct.public_key);
      log('result', JSON.stringify(res).slice(0,200));
      if (res && res.deployHash) note('Deposit sent!', res.deployHash);
      else if (res && res.cancelled) note('Cancelled', '');
      else note('Response', JSON.stringify(res).slice(0,100));
    } catch(err) {
      log('error', err.message);
      note('Error', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  };
})();
