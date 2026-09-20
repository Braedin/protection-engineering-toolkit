/*
 * Differential pickup test values (SEL-787, with CT compensation)
 * Source: "Differential Pickup SEL 787.xlsx"
 *
 * Winding 1 = HV side, Winding 2 = LV side.
 * The 1-phase-to-earth multiplier depends on the CT compensation setting
 * (W1CTC / W2CTC). The lookup below is carried over unchanged from the sheet:
 *   odd number      -> sqrt(3)
 *   2, 4, 8, 10     -> 3
 *   6, 12           -> 1.5
 * NOTE: please verify this table against the SEL-787 instruction manual.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TK = root.TK || {}; root.TK.calcs = root.TK.calcs || {}; root.TK.calcs.differentialPickup = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SQRT3 = Math.sqrt(3);

  function ctcFactor(n) {
    if (n % 2 === 1) return SQRT3;
    if (n === 2 || n === 4 || n === 8 || n === 10) return 3;
    if (n === 6 || n === 12) return 1.5;
    return NaN;
  }

  function compute(v) {
    var warnings = [];
    var ip = (v.mva * 1e6) / (SQRT3 * v.vp);
    var is = (v.mva * 1e6) / (SQRT3 * v.vs);
    var f1 = ctcFactor(v.w1ctc), f2 = ctcFactor(v.w2ctc);
    if (isNaN(f1)) warnings.push('W1CTC = ' + v.w1ctc + ' has no 1-phase-to-earth multiplier in the lookup table.');
    if (isNaN(f2)) warnings.push('W2CTC = ' + v.w2ctc + ' has no 1-phase-to-earth multiplier in the lookup table.');

    var hvLL = v.o87p * ip / v.ctrHv;     // A secondary
    var lvLL = v.o87p * is / v.ctrLv;
    var hvLE = hvLL * f1;
    // FIX: the original LV L-E cell always multiplied by sqrt(3); use the W2CTC multiplier
    // (identical for W2CTC = 11, which is what the sheet used).
    var lvLE = lvLL * f2;

    // Injection values (mA). CT ratio is now applied; the original divided nothing
    // for the HV side and so was only correct when the HV CT ratio was 1000.
    var hvLLmA = hvLL * 1000, lvLLmA = lvLL * 1000;
    var deltaIa = hvLLmA * f1 + (v.dIb + v.dIc) / 2;   // original: (LL*3 + (Ib+Ic)) / 2 for factor 1.5
    var starIa = lvLLmA * f2 + v.sIc;                  // original: LL*sqrt(3) + Ic for factor sqrt(3)

    if (!(v.w1ctc === 12 && v.w2ctc === 11)) {
      warnings.push('The injection formulas (Ia pickup with return current on Ib/Ic) were derived in the original sheet for W1CTC = 12 and W2CTC = 11. Verify them before using other settings.');
    }

    return {
      ip: ip, is: is, f1: f1, f2: f2,
      hv: { ll: hvLL, llTol: hvLL * 0.05, le: hvLE, leTol: hvLE * 0.05 },
      lv: { ll: lvLL, llTol: lvLL * 0.05, le: lvLE, leTol: lvLE * 0.05 },
      inj: {
        deltaLLmA: hvLLmA, deltaIa: deltaIa,
        starLLmA: lvLLmA,  starIa: starIa
      },
      warnings: warnings
    };
  }
  return { compute: compute, ctcFactor: ctcFactor };
});
