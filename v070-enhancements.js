// ===================== v0.7.0 Enhancements v18 (additive, non-destructive) =====================
// - Fault Level panel now uses the SAME .v070-result-box treatment as CT Saturation:
//   centered result lines, bold label / dim value, replacing the native output display.
// - Keeps the Transformer type label/toggle font fix from v17.
(function () {
  function onReady(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn, 0);
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function injectResultLineStyles() {
    var existing = document.getElementById('v070-style-fix');
    if (existing) existing.remove();
    var style = document.createElement('style');
    style.id = 'v070-style-fix';
    style.textContent =
      '.v070-result-box .result-line {' +
      '  display: flex;' +
      '  flex-direction: row;' +
      '  align-items: baseline;' +
      '  justify-content: center;' +
      '  text-align: center;' +
      '  gap: 6px;' +
      '  padding: 8px 4px;' +
      '  border-bottom: 1px solid rgba(159,176,207,0.15);' +
      '  font-size: 1rem;' +
      '}' +
      '.v070-result-box .result-line:last-child { border-bottom: none; }' +
      '.v070-result-box .result-line span {' +
      '  font-weight: 700;' +
      '  font-size: 1rem;' +
      '}' +
      '.v070-result-box .result-line b {' +
      '  font-weight: 400;' +
      '  color: var(--text-dim);' +
      '  font-size: 1rem;' +
      '}' +
      '.v070-xfmr-type > label {' +
      '  font-family: inherit;' +
      '  font-size: 0.85rem;' +
      '  font-weight: 600;' +
      '  color: var(--text-dim);' +
      '  text-transform: none;' +
      '  display: block;' +
      '  margin-bottom: 6px;' +
      '}' +
      '.v070-xfmr-type .v070-type-btn {' +
      '  font-family: inherit;' +
      '  font-size: 0.95rem;' +
      '  font-weight: 500;' +
      '}';
    document.head.appendChild(style);
  }

  function renderKatexInto(el, tex, displayMode) {
    if (!el) return;
    if (window.katex) {
      try { katex.render(tex, el, { throwOnError: false, displayMode: !!displayMode }); return; } catch (e) {}
    }
    el.textContent = tex;
  }

  function addFormulaBlock(panelId, title, formulas) {
    var panel = document.getElementById(panelId);
    if (!panel || panel.querySelector('.v070-formula-block')) return;
    var block = document.createElement('div');
    block.className = 'card v070-formula-block';
    block.style.marginTop = '16px';
    var h = document.createElement('h3');
    h.textContent = title;
    h.style.marginTop = '0';
    h.style.fontSize = '0.95rem';
    h.style.color = 'var(--text-dim)';
    block.appendChild(h);
    formulas.forEach(function (f) {
      var d = document.createElement('div');
      d.style.margin = '10px 0';
      block.appendChild(d);
      renderKatexInto(d, f, true);
    });
    panel.appendChild(block);
  }

  function findFieldByLabel(fields, regex) {
    for (var i = 0; i < fields.length; i++) {
      var label = fields[i].querySelector('label');
      var input = fields[i].querySelector('input[type="number"], input:not([type]), select');
      if (label && input && regex.test(label.textContent.toLowerCase())) {
        return { field: fields[i], label: label, input: input };
      }
    }
    return null;
  }

  function safeNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  function buildResultBox(rightCard, afterEl) {
    var existingTable = rightCard.querySelector('table');
    if (existingTable) existingTable.style.display = 'none';
    var existingResults = rightCard.querySelector('.results:not(.v070-result-box)');
    if (existingResults) existingResults.style.display = 'none';
    var box = document.createElement('div');
    box.className = 'results v070-result-box';
    if (afterEl) afterEl.insertAdjacentElement('afterend', box);
    else rightCard.appendChild(box);
    return box;
  }

  function lineHtml(label, value) {
    return '<div class="result-line"><span>' + label + '</span><b>' + value + '</b></div>';
  }

  function enhanceTransformerTool() {
    var panel = document.getElementById('panel-txfmr');
    if (!panel || panel.dataset.v070Done) return;

    var grid = panel.querySelector('.grid');
    if (!grid) return;
    var cards = grid.querySelectorAll(':scope > .card');
    if (cards.length < 2) return;
    var leftCard = cards[0];
    var rightCard = cards[1];
    var resultsTable = rightCard.querySelector('table');
    if (!resultsTable) return;

    var fields = leftCard.querySelectorAll('.field');
    var powerInput = null, vpInput = null, vsInput = null, zpcInput = null;
    var powerField = null, vpField = null, vsField = null;
    fields.forEach(function (field) {
      var label = field.querySelector('label');
      var input = field.querySelector('input[type="number"]');
      if (!label || !input) return;
      var t = label.textContent.toLowerCase();
      if (/rated power|power/.test(t) && !powerInput) { powerInput = input; powerField = field; }
      else if (/primary/.test(t) && !vpInput) { vpInput = input; vpField = field; }
      else if (/secondary/.test(t) && !vsInput) { vsInput = input; vsField = field; }
      else if (/impedance|%z|zpc/.test(t) && !zpcInput) { zpcInput = input; }
    });
    if (!powerInput || !vpInput || !vsInput) return;
    panel.dataset.v070Done = '1';

    resultsTable.style.display = 'none';

    function makeInlineUnitToggle(field, input, units, defaultUnit) {
      var label = field.querySelector('label');
      if (label) label.textContent = label.textContent.replace(/\s*\([^)]*\)\s*$/, '').trim();
      var row = document.createElement('div');
      row.className = 'row2 v070-unit-row';
      row.style.display = 'flex';
      row.style.gap = '6px';
      row.style.alignItems = 'stretch';
      input.insertAdjacentElement('beforebegin', row);
      row.appendChild(input);
      input.style.flex = '1 1 auto';
      input.style.minWidth = '0';
      var select = document.createElement('select');
      select.className = 'v070-unit-toggle';
      select.style.flex = '0 0 auto';
      select.style.width = 'auto';
      select.style.minWidth = '72px';
      select.style.maxWidth = 'none';
      select.style.whiteSpace = 'nowrap';
      select.style.overflow = 'visible';
      units.forEach(function (u) {
        var opt = document.createElement('option');
        opt.value = u; opt.textContent = u;
        select.appendChild(opt);
      });
      row.appendChild(select);
      select.value = defaultUnit;
      input.dataset.v070Unit = select.value;
      select.addEventListener('change', function () {
        input.dataset.v070Unit = select.value;
        recompute();
      });
      return select;
    }

    makeInlineUnitToggle(powerField, powerInput, ['MVA', 'kVA'], 'MVA');
    makeInlineUnitToggle(vpField, vpInput, ['kV', 'V'], 'kV');
    makeInlineUnitToggle(vsField, vsInput, ['kV', 'V'], 'kV');

    var typeCard = document.createElement('div');
    typeCard.className = 'field full v070-xfmr-type';
    typeCard.innerHTML =
      '<label>Transformer type</label>' +
      '<div class="fault-type-grid" style="grid-template-columns:1fr 1fr;">' +
      '<button type="button" class="fault-type-btn v070-type-btn active" data-type="3ph">Three-Phase</button>' +
      '<button type="button" class="fault-type-btn v070-type-btn" data-type="1ph">Single-Phase</button>' +
      '</div>';
    powerField.parentElement.insertBefore(typeCard, powerField);

    var xfmrType = '3ph';
    var typeBtns = typeCard.querySelectorAll('.v070-type-btn');
    typeBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        typeBtns.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        xfmrType = b.dataset.type;
        recompute();
      });
    });

    var resultBox = buildResultBox(rightCard, resultsTable);

    function toMVA(val, unit) { return unit === 'kVA' ? val / 1000 : val; }
    function toKV(val, unit) { return unit === 'V' ? val / 1000 : val; }

    function recompute() {
      var mva = toMVA(safeNum(powerInput.value), powerInput.dataset.v070Unit || 'MVA');
      var vpKv = toKV(safeNum(vpInput.value), vpInput.dataset.v070Unit || 'kV');
      var vsKv = toKV(safeNum(vsInput.value), vsInput.dataset.v070Unit || 'kV');
      var zpc = zpcInput ? safeNum(zpcInput.value) : 0;
      var typeLabel = xfmrType === '1ph' ? 'Single-Phase' : 'Three-Phase';
      if (!mva || !vpKv || !vsKv || !zpc) {
        resultBox.innerHTML =
          lineHtml('Transformer type', typeLabel) +
          '<div class="note">Enter power, primary/secondary voltage and %Z to complete this result.</div>';
        return;
      }
      var divisor = xfmrType === '1ph' ? 1 : Math.sqrt(3);
      var flcPrimary = (mva * 1e6) / (divisor * vpKv * 1e3);
      var flcSecondary = (mva * 1e6) / (divisor * vsKv * 1e3);
      var faultPrimary = flcPrimary / (zpc / 100);
      var faultSecondary = flcSecondary / (zpc / 100);
      resultBox.innerHTML =
        lineHtml('Transformer type', typeLabel) +
        lineHtml('Primary FLC', flcPrimary.toFixed(1) + ' A') +
        lineHtml('Secondary FLC', flcSecondary.toFixed(1) + ' A') +
        lineHtml('Primary fault current', faultPrimary.toFixed(0) + ' A (' + (faultPrimary/1000).toFixed(2) + ' kA)') +
        lineHtml('Secondary fault current', faultSecondary.toFixed(0) + ' A (' + (faultSecondary/1000).toFixed(2) + ' kA)');
    }

    [powerInput, vpInput, vsInput, zpcInput].forEach(function (inp) {
      if (inp) { inp.addEventListener('input', recompute); inp.addEventListener('change', recompute); }
    });
    recompute();

    addFormulaBlock('panel-txfmr', 'Reference formulas', [
      String.raw`\text{FLC}_{3\phi} = \dfrac{S}{\sqrt{3}\,V_{LL}}, \quad \text{FLC}_{1\phi} = \dfrac{S}{V}`,
      String.raw`I''_k = \dfrac{\text{FLC}}{Z_{pu}}`
    ]);
  }

  function enhanceFaultLevelTool() {
    var panel = document.getElementById('panel-fault');
    if (!panel || panel.dataset.v070ResultDone) return;

    var grid = panel.querySelector('.grid');
    if (!grid) return;
    var cards = grid.querySelectorAll(':scope > .card');
    if (cards.length < 2) return;
    var leftCard = cards[0];
    var rightCard = cards[1];

    var fields = leftCard.querySelectorAll('.field');
    var vn = findFieldByLabel(fields, /voltage|kv|vn/);
    var z1 = findFieldByLabel(fields, /positive|z1|impedance/);
    var z0 = findFieldByLabel(fields, /zero|z0/);
    var c = findFieldByLabel(fields, /voltage factor|^c\b/);
    if (!vn || !z1) {
      addFormulaBlock('panel-fault', 'Reference formulas', [
        String.raw`I''_{k,3\phi} = \dfrac{c \cdot V_n}{\sqrt{3}\,Z_1}`,
        String.raw`I''_{k,1\phi} = \dfrac{\sqrt{3}\,c \cdot V_n}{2Z_1 + Z_0}`
      ]);
      return;
    }
    panel.dataset.v070ResultDone = '1';

    var resultBox = buildResultBox(rightCard, null);

    function recompute() {
      var vnKv = safeNum(vn.input.value);
      var z1Ohm = safeNum(z1.input.value);
      var z0Ohm = z0 ? safeNum(z0.input.value) : 0;
      var cFactor = c ? (safeNum(c.input.value) || 1) : 1.1;
      if (!vnKv || !z1Ohm) {
        resultBox.innerHTML = '<div class="note">Enter system voltage and positive-sequence impedance to see fault levels.</div>';
        return;
      }
      var i3ph = (cFactor * vnKv * 1000) / (Math.sqrt(3) * z1Ohm);
      var lines = [lineHtml('Three-phase fault current', i3ph.toFixed(0) + ' A (' + (i3ph/1000).toFixed(2) + ' kA)')];
      if (z0Ohm) {
        var i1ph = (Math.sqrt(3) * cFactor * vnKv * 1000) / (2 * z1Ohm + z0Ohm);
        lines.push(lineHtml('Single-phase fault current', i1ph.toFixed(0) + ' A (' + (i1ph/1000).toFixed(2) + ' kA)'));
      }
      resultBox.innerHTML = lines.join('');
    }

    [vn.input, z1.input, z0 && z0.input, c && c.input].forEach(function (inp) {
      if (inp) { inp.addEventListener('input', recompute); inp.addEventListener('change', recompute); }
    });
    recompute();

    addFormulaBlock('panel-fault', 'Reference formulas', [
      String.raw`I''_{k,3\phi} = \dfrac{c \cdot V_n}{\sqrt{3}\,Z_1}`,
      String.raw`I''_{k,1\phi} = \dfrac{\sqrt{3}\,c \cdot V_n}{2Z_1 + Z_0}`
    ]);
  }

  function enhanceCTTool() {
    var panel = document.getElementById('panel-ctsat');
    if (!panel || panel.dataset.v070ResultDone) return;

    var grid = panel.querySelector('.grid');
    if (!grid) return;
    var cards = grid.querySelectorAll(':scope > .card');
    if (cards.length < 2) return;
    var leftCard = cards[0];
    var rightCard = cards[1];

    var fields = leftCard.querySelectorAll('.field');
    var kFac = findFieldByLabel(fields, /dimensioning|k factor|^k\b/);
    var iFault = findFieldByLabel(fields, /fault current|secondary fault/);
    var rct = findFieldByLabel(fields, /r_?ct|ct resistance/);
    var rl = findFieldByLabel(fields, /lead|r_?l\b/);
    var rrelay = findFieldByLabel(fields, /relay/);
    if (!kFac || !iFault) return;
    panel.dataset.v070ResultDone = '1';

    var resultBox = buildResultBox(rightCard, null);

    function recompute() {
      var k = safeNum(kFac.input.value);
      var isec = safeNum(iFault.input.value);
      var rCt = rct ? safeNum(rct.input.value) : 0;
      var rLead = rl ? safeNum(rl.input.value) : 0;
      var rRel = rrelay ? safeNum(rrelay.input.value) : 0;
      if (!k || !isec) {
        resultBox.innerHTML = '<div class="note">Enter dimensioning factor (K) and secondary fault current to see the required knee-point voltage.</div>';
        return;
      }
      var vk = k * isec * (rCt + rLead + rRel);
      resultBox.innerHTML = lineHtml('Required knee-point voltage', vk.toFixed(1) + ' V');
    }

    [kFac.input, iFault.input, rct && rct.input, rl && rl.input, rrelay && rrelay.input].forEach(function (inp) {
      if (inp) { inp.addEventListener('input', recompute); inp.addEventListener('change', recompute); }
    });
    recompute();

    addFormulaBlock('panel-ctsat', 'Reference formula', [
      String.raw`V_k \geq K \times I_{fault,sec} \times (R_{CT} + R_L + R_{relay})`
    ]);
  }

  function enhanceSymComp() {
    var panel = document.getElementById('panel-symcomp');
    if (!panel || panel.dataset.v070Done) return;

    var beforeCanvas = document.getElementById('symBeforeCanvas');
    var afterCanvas = document.getElementById('symAfterCanvas');
    var dirSelect = document.getElementById('symDir');
    if (!beforeCanvas || !afterCanvas || !dirSelect) return;
    panel.dataset.v070Done = '1';

    var rightCard = beforeCanvas.closest('.card');
    if (!rightCard) return;

    var beforeHeading = beforeCanvas.previousElementSibling;
    var afterHeading = afterCanvas.previousElementSibling;

    var row = document.createElement('div');
    row.className = 'v070-symcomp-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 1fr';
    row.style.gap = '16px';

    var beforeCol = document.createElement('div');
    var afterCol = document.createElement('div');

    if (beforeHeading) beforeCol.appendChild(beforeHeading);
    beforeCol.appendChild(beforeCanvas);
    if (afterHeading) {
      afterHeading.style.marginTop = '0';
      afterCol.appendChild(afterHeading);
    }
    afterCol.appendChild(afterCanvas);

    row.appendChild(beforeCol);
    row.appendChild(afterCol);
    rightCard.appendChild(row);

    function updateLabels() {
      var dir = dirSelect.value;
      var beforeLabel = dir === 'p2s' ? 'Before (Phase)' : 'Before (Sequence)';
      var afterLabel = dir === 'p2s' ? 'After (Sequence)' : 'After (Phase)';
      if (beforeHeading) beforeHeading.textContent = beforeLabel;
      if (afterHeading) afterHeading.textContent = afterLabel;
    }
    dirSelect.addEventListener('change', updateLabels);
    updateLabels();
  }

  function enhanceTCCTool() {
    addFormulaBlock('panel-tcc', 'Reference formula', [
      String.raw`t = TMS\left(\dfrac{A}{(I/I_s)^p - 1} + B\right)`
    ]);
  }

  function hideLossOfField() {
    var navBtn = document.querySelector('.side-link[data-tool="lof"]');
    if (navBtn && navBtn.style.display !== 'none') navBtn.style.display = 'none';
    var panel = document.getElementById('panel-lof');
    if (panel) panel.style.display = 'none';
  }

  function tryEnhanceAll() {
    injectResultLineStyles();
    enhanceTransformerTool();
    enhanceSymComp();
    enhanceFaultLevelTool();
    enhanceCTTool();
    enhanceTCCTool();
    hideLossOfField();
  }

  onReady(function () {
    var attempts = 0;
    var interval = setInterval(function () {
      tryEnhanceAll();
      attempts++;
      if (attempts > 20) clearInterval(interval);
    }, 300);

    var observer = new MutationObserver(function () { tryEnhanceAll(); });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
