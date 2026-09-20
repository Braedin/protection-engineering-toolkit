/*
 * Regression tests: each expected value is the cached result from the original
 * spreadsheet (same inputs), so the web calculators can be checked against them.
 *   node tests/run.js
 */
'use strict';
const path = require('path');
const c = (n) => require(path.join('..', 'js', 'calcs', n + '.js'));

let failed = 0, passed = 0;
function near(name, got, want, tol) {
  tol = tol === undefined ? 1e-6 : tol;
  const ok = Math.abs(got - want) <= tol;
  if (ok) passed++; else { failed++; console.log('FAIL', name, 'got', got, 'want', want); }
}
function is(name, got, want) {
  const ok = got === want;
  if (ok) passed++; else { failed++; console.log('FAIL', name, 'got', got, 'want', want); }
}

// ---- Current imbalance (sheet: Ia 222.5, Ib 168, Ic 168, FLC 140, CTR 250) ----
{
  const r = c('current-imbalance').compute({ ia: 222.5, ib: 168, ic: 168, flc: 140, ctPri: 250, ctSec: 1, alarmPct: 15, alarmTime: 5, tripPct: 20, tripTime: 10 });
  near('imb.ctr', r.ctr, 250); near('imb.iav', r.iav, 186.16666666666666); near('imb.im', r.im, 36.33333333333334);
  near('imb.pctFlc', r.pctFlc, 25.95238095238096); near('imb.pctIav', r.pctIav, 19.51656222023277);
  near('imb.sec0', r.secondary[0], 0.89); near('imb.flcSec', r.flcSecondary, 0.56);
  is('imb.basis', r.basis, 'average current');
  // regression for the fixed bug: one LOW phase must drive the imbalance
  const low = c('current-imbalance').compute({ ia: 140, ib: 140, ic: 100, flc: 140, ctPri: 250, ctSec: 1, alarmPct: 15, alarmTime: 5, tripPct: 20, tripTime: 10 });
  near('imb.lowPhase.im', low.im, 26.666666666666657, 1e-9);
}

// ---- Differential curve (O87P .3, U87P 8, IRS1 3, SLP1 25, SLP2 50) ----
{
  const r = c('differential-curve').compute({ o87p: 0.3, u87p: 8, irs1: 3, slp1: 25, slp2: 50 });
  near('dc.x1', r.x1, 1.2); near('dc.h', r.h, 1.5); near('dc.yIrs', r.yIrs, 0.75); near('dc.x3', r.x3, 17.5);
}

// ---- Differential pickup (15 MVA, 11000/3450, CTR 1000/3000, O87P .3, W1CTC 12, W2CTC 11) ----
{
  const r = c('differential-pickup').compute({ mva: 15, vp: 11000, vs: 3450, ctrHv: 1000, ctrLv: 3000, o87p: 0.3, w1ctc: 12, w2ctc: 11, dIb: -100, dIc: -100, sIc: -100 });
  near('dp.ip', r.ip, 787.295821622217); near('dp.is', r.is, 2510.218561694025);
  near('dp.hvLL', r.hv.ll, 0.2361887464866651); near('dp.hvLE', r.hv.le, 0.35428311972999765);
  near('dp.hvTol', r.hv.llTol, 0.011809437324333255);
  near('dp.lvLL', r.lv.ll, 0.25102185616940254); near('dp.lvLE', r.lv.le, 0.4347826086956522);
  near('dp.deltaIa', r.inj.deltaIa, 254.28311972999762, 1e-9); near('dp.starIa', r.inj.starIa, 334.7826086956522, 1e-9);
  is('dp.f1', r.f1, 1.5);
  is('dp.warnings', r.warnings.length, 0);
}

// ---- Differential stability (CTR 500/1500, injected 1.37/1.4) ----
{
  const r = c('differential-stability').compute({
    ctrP: 500, ctrS: 1500, tol: 1.5,
    readP: [687, 686.7, 685.7], injP: [1.37, 1.37, 1.37],
    readS: [2103.3, 2099.4, 2099.4], injS: [1.4, 1.4, 1.4]
  });
  is('ds.pass', r.pass, true); near('ds.expectedP', r.primary[0].expected, 685); near('ds.expectedS', r.secondary[0].expected, 2100);
  const bad = c('differential-stability').compute({ ctrP: 500, ctrS: 1500, tol: 1.5, readP: [700, 686, 686], injP: [1.37, 1.37, 1.37], readS: [2100, 2100, 2100], injS: [1.4, 1.4, 1.4] });
  is('ds.fail', bad.primary[0].pass, false); is('ds.failOverall', bad.pass, false);
}

// ---- Underpower (3300/110 V, CTR 100, sheet used 0.139 A per phase, 1905 V L-N) ----
{
  const r = c('underpower').compute({ vtPri: 3300, vtSec: 110, ctr: 100, flc: 140, pf: 1, pickupKw: 80, tripKw: 100, ia: 0.139, ib: 0.139, ic: 0.139 });
  near('up.kw', r.kw, 79.4385, 0.02);             // sheet: 79.4385 (typed 1905 V; 3300/sqrt3 = 1905.26 V)
  near('up.iPickup', r.pickup.iSec, 0.13996, 1e-4);
  near('up.vLNsec', r.vLNsec, 63.509, 0.001);      // sheet: 63.509
}

// ---- Loss of field ----
{
  const calc = c('loss-of-field').compute({ mode: 'calc', kv: 20, mva: 492, pt: 167, ct: 3600, xd: 1.1888, xdp: 0.20577, z1t: 0.1, z2t: 0.5 });
  near('lof.zb', calc.zb, 17.525923762231635); near('lof.vnom', calc.vnom, 119.76047904191617); near('lof.inom', calc.inom, 3.945226839462443);
  near('lof.z1d', calc.z1.diameter, 17.525923762231635); near('lof.z1o', calc.z1.offset, -1.8031546662772018);
  near('lof.z2d', calc.z2.diameter, 20.83481816854097);
  near('lof.z1|Z|', calc.z1.omicron.z, 10.566116547393019); near('lof.z2|Z|', calc.z2.omicron.z, 12.220563750547687);
  near('lof.z1r', calc.z1.omicron.radius, 8.762961881115817); is('lof.phi', calc.z1.omicron.phi, 270);
  // first curve point (angle 0): R = radius, X = -|Z|
  near('lof.pt0.R', calc.z1.points[0][0], 8.762961881115817); near('lof.pt0.X', calc.z1.points[0][1], -10.566116547393019);
  // test block (manual)
  const man = c('loss-of-field').compute({ mode: 'manual', kv: 11, mva: 15.829, pt: 167, ct: 3600, xd: 1.18, xdp: 0.2, z1t: 0.5, z2t: 3, z1d: 114.7, z1o: -12.6, z2d: 149.1, z2o: -12.6 });
  near('lof.man.zb', man.zb, 164.78509277483948); near('lof.man.z1|Z|', man.z1.omicron.z, 69.95); near('lof.man.z2|Z|', man.z2.omicron.z, 87.15);
  near('lof.man.z1r', man.z1.omicron.radius, 57.35);
  // fixed placeholder: positive offset no longer returns text
  is('lof.phi.pos', c('loss-of-field').omicron(100, 80).phi, 90);
}

// ---- REF630 distance (sheet defaults) ----
{
  const r = c('distance-ref630').compute({ r1: 14, x1: 30, r0: 6, x0: 60, rMaxPP: 10, rMinPP: 10, rMaxGE: 100, rMinGE: 100, minAngle: 100, maxAngle: 60 });
  near('d.pe.r', r.residual.r, 11.333333333333334); near('d.pe.x', r.residual.x, 40); near('d.pe.angle', r.residual.angle, 74.18080605249986);
  near('d.pp.angle', r.phPh.reachAngle, 64.98310652189997);
  const pe = r.phE.lines, pp = r.phPh.lines;
  const row = (l, R, X, A, n) => { near(n + '.R', l.r, R, 1e-6); near(n + '.X', l.x, X, 1e-6); near(n + '.A', l.angle, A, 1e-6); };
  row(pe[0], 0, 0, 300, 'pe.L1');   row(pe[1], 100, 0, 90, 'pe.L2');  row(pe[2], 111.33333333333333, 40, 74.18080605249986, 'pe.L3'); row(pe[3], 0, 40, 180, 'pe.L4'); row(pe[4], 0, 0, 100, 'pe.L5');
  row(pp[0], 0, 0, 300, 'pp.L1');   row(pp[1], 10, 0, 90, 'pp.L2');   row(pp[2], 10, 0, 64.98310652189997, 'pp.L3');   row(pp[3], 0, 30, 180, 'pp.L4'); row(pp[4], 0, 0, 100, 'pp.L5');
  // polygon corners: (10,0), (24,30), (-5.2898,30), (0,0)
  const has = (poly, R, X) => poly.some(p => Math.abs(p[0] - R) < 1e-6 && Math.abs(p[1] - X) < 1e-6);
  is('d.pp.vertex(10,0)', has(r.phPh.polygon, 10, 0), true);
  is('d.pp.vertex(24,30)', has(r.phPh.polygon, 24, 30), true);
  near('d.pp.topLeft', r.phPh.polygon.find(p => p[1] === 30 && p[0] < 0)[0], -5.289809421253949, 1e-9);   // sheet Graph Data A18
  near('d.pe.topLeft', r.phE.polygon.find(p => Math.abs(p[1] - 40) < 1e-9 && p[0] < 0)[0], -7.053079228338599, 1e-9); // sheet Graph Data D18
}

// ---- Volts/Hz ----
{
  const r = c('volts-hz').compute({ vnom: 63.51, fnom: 50, trip1: 1.18, trip2: 1.1, fset: 48.48, freqList: '48.48' });
  near('vhz.ratio', r.ratio, 1.2702); near('vhz.t1', r.t1, 1.4988359999999998); near('vhz.t2', r.t2, 1.3972200000000001);
  near('vhz.v1', r.v1, 72.66356927999999); near('vhz.v2', r.v2, 67.7372256);
}

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
