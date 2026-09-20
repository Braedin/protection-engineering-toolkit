/*
 * Differential stability / CT injection check
 * Source: "Diff Stability.xls"
 *
 * Injected secondary current x CT ratio = expected primary-side reading.
 * The relay reading is compared with the expected value against a tolerance.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TK = root.TK || {}; root.TK.calcs = root.TK.calcs || {}; root.TK.calcs.differentialStability = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function check(reading, injected, ratio, tol) {
    var expected = injected * ratio;
    var errPct;
    if (expected === 0) errPct = reading === 0 ? 0 : Infinity;
    else errPct = 100 * (reading - expected) / expected;
    return { reading: reading, injected: injected, expected: expected, errPct: errPct, pass: Math.abs(errPct) <= tol };
  }

  /* v: { ctrP, ctrS, tol, readP:[3], injP:[3], readS:[3], injS:[3] } */
  function compute(v) {
    var warnings = [];
    var p = [0, 1, 2].map(function (i) { return check(v.readP[i], v.injP[i], v.ctrP, v.tol); });
    var s = [0, 1, 2].map(function (i) { return check(v.readS[i], v.injS[i], v.ctrS, v.tol); });
    var all = p.concat(s);
    var pass = all.every(function (r) { return r.pass; });
    if (v.tol <= 0) warnings.push('Tolerance must be greater than zero.');
    return { primary: p, secondary: s, pass: pass, warnings: warnings };
  }
  return { compute: compute, check: check };
});
