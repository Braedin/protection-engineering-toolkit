/*
 * Dual-slope differential characteristic (SEL-787)
 * Source: "Differential Curve SEL 787.xlsx"
 *
 * Axes: x = restraint current (multiples of TAP), y = operate current (multiples of TAP)
 *   Line 1: y = O87P                       (0 .. O87P/SLP1)
 *   Line 2: y = SLP1 * x                   (O87P/SLP1 .. IRS1)
 *   Line 3: y = SLP2 * (x - h)             (IRS1 .. U87P/SLP2 + h)
 *           h = IRS1 - SLP1*IRS1/SLP2
 *   Above U87P the element is unrestrained.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TK = root.TK || {}; root.TK.calcs = root.TK.calcs || {}; root.TK.calcs.differentialCurve = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function compute(v) {
    var warnings = [];
    var s1 = v.slp1 / 100, s2 = v.slp2 / 100;
    var x1 = v.o87p / s1;                 // Line 1 -> Line 2 break
    var yIrs = s1 * v.irs1;               // operate value at IRS1
    var h = v.irs1 - (s1 * v.irs1) / s2;  // x-intercept of slope 2
    var x3 = v.u87p / s2 + h;             // Line 3 meets U87P

    if (s2 < s1) warnings.push('SLP2 is smaller than SLP1; the SEL-787 requires SLP2 ≥ SLP1.');
    if (x1 >= v.irs1) warnings.push('IRS1 is not beyond the Line 1 / Line 2 break (' + x1.toFixed(3) + '); Slope 1 is never reached.');
    if (yIrs >= v.u87p) warnings.push('The curve reaches U87P (' + v.u87p + ') before IRS1; check the settings.');

    var lines = [
      { name: 'Line 1', x1: 0,   y1: v.o87p, x2: x1,    y2: v.o87p },
      { name: 'Line 2', x1: x1,  y1: v.o87p, x2: v.irs1, y2: yIrs },
      { name: 'Line 3', x1: v.irs1, y1: yIrs, x2: x3,   y2: v.u87p }
    ];
    return { x1: x1, yIrs: yIrs, h: h, x3: x3, lines: lines, warnings: warnings };
  }
  return { compute: compute };
});
