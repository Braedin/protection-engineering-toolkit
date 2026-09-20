/*
 * Distance protection quadrilateral zone (ABB REF630) and Omicron "line cartesian" values
 * Source: "REF 630 Distance Protection R1.xlsx" (Relay Data + Graph Data sheets)
 *
 * The zone is bounded by five lines. Each line is described by a point and an angle:
 *   L1  through origin at (360 - maxPhaseAngle)     lower directional line
 *   L2  vertical at R = Rmin                        (angle 90)
 *   L3  parallel to the reach line, crossing the R axis at Rmax
 *   L4  horizontal at X = X1                        (angle 180)
 *   L5  through origin at minPhaseAngle             upper-left directional line
 *
 * Ph-E reach uses the residual-compensated loop: (2*Z1 + Z0) / 3.
 *
 * Tilt angle handling from the original sheet is not carried over (see CHANGES.md).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TK = root.TK || {}; root.TK.calcs = root.TK.calcs || {}; root.TK.calcs.distanceRef630 = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var D2R = Math.PI / 180;
  function deg(rad) { return rad / D2R; }
  function norm360(a) { a = a % 360; return a < 0 ? a + 360 : a; }

  // Intersection of two lines, each {r, x, angle(deg)}; null when parallel.
  function intersect(a, b) {
    var ad = [Math.cos(a.angle * D2R), Math.sin(a.angle * D2R)];
    var bd = [Math.cos(b.angle * D2R), Math.sin(b.angle * D2R)];
    var det = ad[0] * bd[1] - ad[1] * bd[0];
    if (Math.abs(det) < 1e-12) return null;
    var t = ((b.r - a.r) * bd[1] - (b.x - a.x) * bd[0]) / det;
    return [a.r + t * ad[0], a.x + t * ad[1]];
  }
  function clean(n) { return Math.abs(n) < 1e-9 ? 0 : n; }

  function zone(z1r, z1x, rMax, rMin, minAng, maxAng, throughReachPoint) {
    var reachAngle = deg(Math.atan2(z1x, z1r));
    var lines = [
      { name: 'Lower directional line', r: 0,    x: 0,  angle: norm360(360 - maxAng) },
      { name: 'Right vertical (R-min)', r: rMin, x: 0,  angle: 90 },
      { name: 'Reach-parallel line',    r: throughReachPoint ? rMax + z1r : rMax, x: throughReachPoint ? z1x : 0, angle: reachAngle },
      { name: 'Top reactance line',     r: 0,    x: z1x, angle: 180 },
      { name: 'Upper directional line', r: 0,    x: 0,  angle: minAng }
    ];
    var verts = [];
    for (var i = 0; i < lines.length; i++) {
      var p = intersect(lines[i], lines[(i + 1) % lines.length]);
      verts.push(p ? [clean(p[0]), clean(p[1])] : null);
    }
    // vertex i is the corner between line i and line i+1; re-order so the polygon starts at the origin
    var poly = [];
    for (var k = 0; k < verts.length; k++) if (verts[k]) poly.push(verts[k]);
    if (poly.length) poly.push(poly[0]);
    return { reachAngle: reachAngle, r1: z1r, x1: z1x, lines: lines, polygon: poly };
  }

  /* v: { r1, x1, r0, x0, rMaxPP, rMinPP, rMaxGE, rMinGE, minAngle, maxAngle } */
  function compute(v) {
    var warnings = [];
    var r1e = (2 * v.r1 + v.r0) / 3;
    var x1e = (2 * v.x1 + v.x0) / 3;
    if (v.r1 <= 0 || v.x1 <= 0) warnings.push('R1 and X1 must be positive.');
    if (v.minAngle <= 90 || v.minAngle >= 180) warnings.push('Min phase angle is normally between 90° and 180°.');
    if (v.maxAngle <= 0 || v.maxAngle >= 90) warnings.push('Max phase angle is normally between 0° and 90°.');
    if (v.rMinPP !== v.rMaxPP || v.rMinGE !== v.rMaxGE) {
      warnings.push('R-min differs from R-max. The vertical line uses R-min and the reach-parallel line uses R-max, so the corner between them sits off the R axis.');
    }
    return {
      residual: { r: r1e, x: x1e, angle: deg(Math.atan2(x1e, r1e)) },
      phPh: zone(v.r1, v.x1, v.rMaxPP, v.rMinPP, v.minAngle, v.maxAngle, false),
      phE:  zone(r1e, x1e, v.rMaxGE, v.rMinGE, v.minAngle, v.maxAngle, true),
      warnings: warnings
    };
  }
  return { compute: compute, intersect: intersect };
});
