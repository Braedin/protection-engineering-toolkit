/*
 * Loss-of-field (40) mho settings and Omicron test values
 * Source: "Loss of Field Calculations.xlsx" (Settings + Curve sheets)
 *
 * Mode "calc":   Z1 diameter = 1.0 pu (VNOM / (sqrt3 * INOM) = ZB),
 *                Z1 offset   = -X'd * ZB / 2,
 *                Z2 diameter = Xd * ZB,  Z2 offset = Z1 offset.
 * Mode "manual": diameters and offsets are entered directly (the sheet's
 *                "For Testing" block).
 *
 * "Offset" is the top of the circle on the X axis (negative = below the R axis),
 * so the circle centre sits at  offset - diameter/2.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TK = root.TK || {}; root.TK.calcs = root.TK.calcs || {}; root.TK.calcs.lossOfField = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SQRT3 = Math.sqrt(3);

  function omicron(diameter, offset) {
    var centre = offset - diameter / 2;
    return {
      diameter: diameter, offset: offset, centre: centre,
      z: Math.abs(centre),
      // FIX: the sheet returned the text "IDK" when the offset was not negative.
      // A centre below the R axis is 270 deg, above it is 90 deg.
      phi: centre < 0 ? 270 : 90,
      radius: diameter / 2,
      start: 360, end: 0
    };
  }

  function circlePoints(diameter, offset, stepDeg) {
    var r = diameter / 2, c = offset - r, pts = [];
    for (var a = 0; a <= 360; a += stepDeg) {
      var t = a * Math.PI / 180;
      pts.push([r * Math.cos(t), c + r * Math.sin(t)]);
    }
    return pts;
  }

  /* v: { mode, kv, mva, pt, ct, xd, xdp, z1t, z2t, z1d, z1o, z2d, z2o } */
  function compute(v) {
    var warnings = [];
    var zb = (v.kv * v.kv / v.mva) * v.ct / v.pt;
    var vnom = v.kv * 1000 / v.pt;
    var inom = (v.mva * 1e6) / (SQRT3 * v.kv * 1000) / v.ct;

    var z1d, z1o, z2d, z2o;
    if (v.mode === 'manual') {
      z1d = v.z1d; z1o = v.z1o; z2d = v.z2d; z2o = v.z2o;
    } else {
      z1d = vnom / (SQRT3 * inom);
      z1o = -v.xdp * zb / 2;
      z2d = v.xd * zb;
      z2o = z1o;
    }
    if (z2d < z1d) warnings.push('Zone 2 diameter is smaller than Zone 1.');
    if (v.z2t < v.z1t) warnings.push('Zone 2 trip time is shorter than Zone 1.');
    if (v.mode !== 'manual' && (v.xd > 5 || v.xdp > 5)) warnings.push('Xd / X\'d look like percentages. Enter them in per-unit (e.g. 1.19, not 119).');

    return {
      zb: zb, vnom: vnom, inom: inom,
      z1: { diameter: z1d, offset: z1o, time: v.z1t, pu: z1d / zb, offsetPu: z1o / zb, omicron: omicron(z1d, z1o), points: circlePoints(z1d, z1o, 5) },
      z2: { diameter: z2d, offset: z2o, time: v.z2t, pu: z2d / zb, offsetPu: z2o / zb, omicron: omicron(z2d, z2o), points: circlePoints(z2d, z2o, 5) },
      warnings: warnings
    };
  }
  return { compute: compute, omicron: omicron, circlePoints: circlePoints };
});
