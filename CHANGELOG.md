# Changelog

All notable changes to the Protection Engineering Toolkit are documented here.

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
