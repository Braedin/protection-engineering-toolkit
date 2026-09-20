# Changelog

All notable changes to the Protection Engineering Toolkit are documented here.

## [0.9.1] - 2026-09-20

### Fixed
- **Loss of Field (40): the R-X mho plot could render as a broken/open arc instead of two closed circles.** Chart.js's automatic axis scaling picked a window that didn't even cover the circle data for some zone size combinations (e.g. the manual-mode test preset). Both axes now use explicit, equal-span bounds computed from the actual zone geometry, the same approach already used for the Distance Protection plot. Verified against a real Chart.js build in both calc and manual mode.

## [0.9.0] - 2026-09-20

### Added
- Integrated six new calculators from the separately-reviewed "calculator site" spreadsheet port into the main app (`app.js`), each with a formula block and full save/load support: **Current Imbalance (46)**, **SEL-787 Differential Curve**, **SEL-787 Differential Pickup**, **Differential Stability Check** (CT injection pass/fail), **Underpower (32)**, and **Volts/Hz Overexcitation (24)**. New "Motor Protection" nav group added for the first two.
- **Loss of Field (40)**: added a calc/manual zone-sizing toggle, an Omicron test-value table (|Z|, Phi, radius), input warnings (Zone 2 smaller than Zone 1, Zone 2 faster than Zone 1, Xd/Xd' entered as percent instead of pu), and two load-example presets.

### Fixed
- **Loss of Field (40): Zone 1 diameter and offset formulas were swapped.** Zone 1 diameter was computed as `ZB/(√3×Xd')` and offset as `-Xd×ZB/2`; standard practice (confirmed against a verified, spreadsheet-tested reference implementation) is Zone 1 diameter = 1.0 pu (= ZB) and offset = `-Xd'×ZB/2`. For the 492 MVA worked example this changed Zone 1 diameter from ~49 Ω to the correct 17.53 Ω. This affected every setting calculated with this tool since it was added — resettle any values taken from it.
- **Distance Protection quadrilateral: incorrect corner when Min Ris Reach ≠ Max Ris Reach.** The blinder/reach-line corner was hardcoded to `(MinRis, 0)`, which is only correct when the two resistive-reach settings are equal; it's now the true line intersection, `(MinRis, (MinRis−MaxRis)×X1/R1)`. Min/Max Ris Reach are now also set independently per loop (Ph-Ph vs Ph-E), matching real relay setting sheets, plus added range warnings on the phase angle inputs.

### Changed
- Merged latest `main` (which added the reviewed calculator-site source under `calculators/calculator site/` and removed the old raw spreadsheet files) into this branch. That folder stays out of the deployed site per `.assetsignore` until specifically integrated tool-by-tool as above.

## [0.8.0] - 2026-09-20

### Changed
- Folded `v070-enhancements.js` (the DOM-patching, polling/MutationObserver-based enhancement script) directly into `app.js` and `style.css`. Unit toggles, KaTeX formula blocks, and the centered result-box styling are now first-class parts of each tool's own render function instead of being retrofitted after the fact by regex-matching label text.
- Fixed an inconsistency where the Loss of Field (40) calculator was fully built and wired up but silently hidden from the nav and CSS-hidden by the enhancement script. It is visible again.
- Re-badged Fault Level Calculator, TCC Plotter, CT Saturation, and Transformer FLC tools to cite the AS/NZS standard numbers (AS/NZS 60909, AS/NZS 60255.151, AS/NZS 61869-2, AS/NZS 60076.1) as the primary reference, since these are direct Australian adoptions of the equivalent IEC standards.

### Added
- **Save / Load** on every calculator: name and store the current inputs to `localStorage`, then reload or delete them later. Works generically across all tools (including button-group toggles and regenerated fields) via a shared collect/apply framework, with a custom handler for the TCC Plotter's curve list.
- **Fault Level Calculator**: new "Include upstream network source impedance" mode. Given an upstream network fault level (MVA) and X/R ratio, the tool now derives the network feeder's equivalent impedance (Zk = c·Vup²/Ssc per IEC/AS 60909), splits it into R/X, refers it through the transformer ratio to the fault-side bus, and combines it in series (complex R+jX) with the transformer's own impedance (also split via its own X/R ratio) — replacing the previous single-impedance-only model.
- **Distance Protection Zone Plotter**: restructured around a generic quadrilateral/mho R-X plane engine with a "Relay type / convention" selector. Ships with "Generic (R-X Ohms)" and "ABB Relion REx630" presets (identical underlying geometry, different field naming/notes); more vendor presets (SEL, GE, Siemens, etc.) can be added as additional entries once their specific setting conventions are confirmed.

## [0.3.0] - 2026-09-13

### Added
- New **Transformer FLC & Fault Current** section: calculates primary/secondary full-load current and expected fault current (infinite source and source-impedance-corrected) from transformer nameplate MVA, voltage ratio, and %Z.
- TCC Plotter now supports plotting curves referred to **primary or secondary current** using a CT ratio input per curve, so relay curves (secondary-based) and primary system currents can be viewed on the same axis.
- CHANGELOG now tracked in-repo for all future updates.

### Fixed
- Transformer Differential (87T) chart was rendering as a single vertical line instead of the dual-slope characteristic curve, caused by a missing linear x-axis type declaration and Chart.js auto-parsing conflicting with `{x,y}` point data. Chart now renders correctly with `parsing:false` and explicit `type:'linear'` scales.
- All calculators now live-update their charts/results on input change (`oninput`), not only on button click.

## [0.2.0] - 2026-09-13

### Added
- CT Knee-Point & Saturation calculator now includes an indicative excitation curve chart, marking the knee point and the actual operating fault point.
- Symmetrical Components calculator now includes a canvas-drawn phasor diagram showing input phase quantities and calculated sequence components.
- Fault Level Calculator now includes a live single-line diagram (SLD) showing source, transformer, bus, and fault location, annotated with calculated I''k and peak fault current.

## [0.1.0] - 2026-09-12

### Added
- Initial release: Time-Current Curve (TCC) Plotter (IEC 60255-151 / IEEE C37.112), Symmetrical Components Calculator (Fortescue / IEC 60909), CT Knee-Point & Saturation Calculator (IEC 61869-2 / AS/NZS 61869), Transformer Differential (87T) Plotter, Fault Level Calculator (IEC 60909 simplified), Arc Flash Quick Reference (AS/NZS 4836, IEC 61482).
