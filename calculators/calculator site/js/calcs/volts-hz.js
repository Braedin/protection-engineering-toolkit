/*
 * Volts/Hz (24) overexcitation test values
 * Source: "Volts-Hz Overexcitation.xlsx"
 *
 * Nominal V/Hz = nominal voltage / nominal frequency
 * Pickup V/Hz  = setting (pu) x nominal V/Hz
 * Voltage to apply at test frequency f = f x pickup V/Hz
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TK = root.TK || {}; root.TK.calcs = root.TK.calcs || {}; root.TK.calcs.voltsHz = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function parseList(text) {
    return String(text).split(/[\s,;]+/).filter(Boolean).map(Number).filter(function (n) { return isFinite(n) && n > 0; });
  }

  /* v: { vnom, fnom, trip1, trip2, fset, freqList (string) } */
  function compute(v) {
    var warnings = [];
    var ratio = v.vnom / v.fnom;
    var t1 = v.trip1 * ratio, t2 = v.trip2 * ratio;
    var freqs = parseList(v.freqList || '');
    if (v.trip2 > v.trip1) warnings.push('Trip 2 is above Trip 1; normally the higher setting is the faster stage.');
    if (v.freqList && !freqs.length) warnings.push('No valid frequencies found in the sweep list.');
    var sweep = freqs.map(function (f) {
      return { f: f, v1: f * t1, v2: f * t2, pct1: 100 * f * t1 / v.vnom, pct2: 100 * f * t2 / v.vnom };
    });
    return {
      ratio: ratio, t1: t1, t2: t2,
      v1: v.fset * t1, v2: v.fset * t2,
      sweep: sweep, warnings: warnings
    };
  }
  return { compute: compute, parseList: parseList };
});
