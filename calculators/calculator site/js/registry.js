/*
 * Site registry: the home page cards and the header links are built from this list.
 * To add a calculator: create calculators/<name>.html and add one entry here.
 */
(function (root) {
  root.TK = root.TK || {};
  root.TK.registry = [
    {
      group: 'Transformer differential (SEL-787)',
      title: 'Differential characteristic',
      desc: 'Dual-slope operate / restraint curve: breakpoints, line equations and plot.',
      href: 'calculators/differential-curve.html',
      source: 'Differential Curve SEL 787.xlsx'
    },
    {
      group: 'Transformer differential (SEL-787)',
      title: 'Differential pickup',
      desc: 'O87P pickup in secondary amps (L-L and L-E) with CT compensation, plus injection values.',
      href: 'calculators/differential-pickup.html',
      source: 'Differential Pickup SEL 787.xlsx'
    },
    {
      group: 'Transformer differential (SEL-787)',
      title: 'Differential stability',
      desc: 'Compare injected current with relay readings on both windings and get a pass / fail.',
      href: 'calculators/differential-stability.html',
      source: 'Diff Stability.xls'
    },
    {
      group: 'Motor protection',
      title: 'Current imbalance',
      desc: 'Phase current unbalance against alarm and trip levels, with secondary values.',
      href: 'calculators/current-imbalance.html',
      source: 'Current Imbalance.xlsx'
    },
    {
      group: 'Motor protection',
      title: 'Underpower test current',
      desc: 'Secondary current to inject for a kW setting, and the kW a given current represents.',
      href: 'calculators/underpower.html',
      source: 'Underpower Current.xlsx'
    },
    {
      group: 'Generator protection',
      title: 'Loss of field (40)',
      desc: 'Two-zone mho settings from generator data, Omicron test values and R-X plot.',
      href: 'calculators/loss-of-field.html',
      source: 'Loss of Field Calculations.xlsx'
    },
    {
      group: 'Generator protection',
      title: 'Volts / Hz overexcitation',
      desc: 'Pickup V/Hz and the voltage to apply at each test frequency.',
      href: 'calculators/volts-hz.html',
      source: 'Volts-Hz Overexcitation.xlsx'
    },
    {
      group: 'Line distance protection',
      title: 'Distance zone (REF630)',
      desc: 'Ph-Ph and Ph-E quadrilateral zones, Omicron line-cartesian values and plots.',
      href: 'calculators/distance-ref630.html',
      source: 'REF 630 Distance Protection R1.xlsx'
    }
  ];
})(typeof self !== 'undefined' ? self : this);
