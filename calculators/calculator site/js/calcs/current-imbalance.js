/*
 * Current imbalance (motor protection)
 * Source: "Current Imbalance.xlsx"
 *
 * Imbalance is the largest deviation of any phase from the average current.
 * Expressed as % of FLC when the load is below FLC, and % of the average
 * current when the load is at or above FLC (matches the "% Imbalance when >100"
 * note in the original sheet).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TK = root.TK || {}; root.TK.calcs = root.TK.calcs || {}; root.TK.calcs.currentImbalance = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function compute(v) {
    var warnings = [];
    var ctr = v.ctPri / v.ctSec;
    var phases = [v.ia, v.ib, v.ic];
    var iav = (v.ia + v.ib + v.ic) / 3;
    var imax = Math.max.apply(null, phases);
    var imin = Math.min.apply(null, phases);
    // FIX: the original used MAX(Imax-Iav, Imin-Iav). Imin-Iav is never positive,
    // so a low phase was ignored. Use the absolute deviation of every phase.
    var im = Math.max(Math.abs(imax - iav), Math.abs(imin - iav));

    var pctFlc = 100 * im / v.flc;
    var pctIav = iav > 0 ? 100 * im / iav : NaN;
    var basis = iav >= v.flc ? 'average current' : 'FLC';
    var pct = iav >= v.flc ? pctIav : pctFlc;

    var state = 'normal';
    if (pct >= v.tripPct) state = 'trip';
    else if (pct >= v.alarmPct) state = 'alarm';

    if (v.alarmPct > v.tripPct) warnings.push('Alarm level is above the trip level.');
    if (iav === 0) warnings.push('Average current is zero; % of average is undefined.');

    return {
      ctr: ctr,
      secondary: phases.map(function (i) { return i / ctr; }),
      flcSecondary: v.flc / ctr,
      iav: iav, imax: imax, imin: imin, im: im,
      pctFlc: pctFlc, pctIav: pctIav, basis: basis, pct: pct,
      state: state,
      warnings: warnings
    };
  }
  return { compute: compute };
});
