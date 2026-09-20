/*
 * Underpower test current
 * Source: "Underpower Current.xlsx"
 *
 * Balanced three-phase power:  P = sqrt(3) * V(L-L) * I * pf
 * Given a power setting, the secondary current to inject is
 *   I_sec = P / (sqrt(3) * V(L-L, primary) * pf) / CT ratio
 * with the relay supplied with nominal secondary voltage.
 *
 * The original sheet used 3 x V(L-N) x I on typed-in phase voltages; this is the
 * same calculation using VT ratio inputs.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TK = root.TK || {}; root.TK.calcs = root.TK.calcs || {}; root.TK.calcs.underpower = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SQRT3 = Math.sqrt(3);

  function currentFor(kw, v) { return (kw * 1000) / (SQRT3 * v.vtPri * v.pf) / v.ctr; }

  function settingTable(kw, v) {
    return [90, 95, 100, 105, 110].map(function (pct) {
      var p = kw * pct / 100;
      var i = currentFor(p, v);
      return { pct: pct, kw: p, iSec: i, iPri: i * v.ctr, pctFlc: 100 * i * v.ctr / v.flc };
    });
  }

  /* v: { vtPri, vtSec (L-L volts), ctr, flc, pf, pickupKw, tripKw, ia, ib, ic (A secondary) } */
  function compute(v) {
    var warnings = [];
    if (v.pf <= 0 || v.pf > 1) warnings.push('Power factor should be between 0 and 1.');
    var vLNpri = v.vtPri / SQRT3, vLNsec = v.vtSec / SQRT3;
    var vtRatio = v.vtPri / v.vtSec;

    var iPri = [v.ia, v.ib, v.ic].map(function (i) { return i * v.ctr; });
    var kw = iPri.reduce(function (sum, i) { return sum + vLNpri * i * v.pf; }, 0) / 1000;

    return {
      vtRatio: vtRatio, vLNpri: vLNpri, vLNsec: vLNsec,
      iPri: iPri, kw: kw,
      pickup: { kw: v.pickupKw, iSec: currentFor(v.pickupKw, v), table: settingTable(v.pickupKw, v) },
      trip:   { kw: v.tripKw,   iSec: currentFor(v.tripKw, v),   table: settingTable(v.tripKw, v) },
      warnings: warnings
    };
  }
  return { compute: compute, currentFor: currentFor };
});
