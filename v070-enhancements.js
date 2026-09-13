// ===================== v0.7.0 Enhancements v13 (additive, non-destructive) =====================
// Results box: label and value on ONE line, centered as a block (not split left/right,
// not stacked). e.g. "Primary FLC 87.5 A" - matches explicit feedback.
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
      '}' +
      '.v070-result-box .result-line:last-child { border-bottom: none; }' +
      '.v070-result-box .result-line span { color: var(--text-dim); }' +
      '.v070-result-box .result-line b { font-size: 1.05rem; }';
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

    var resultBox = document.createElement('div');
    resultBox.className = 'results v070-result-box';
    resultsTable.insertAdjacentElement('afterend', resultBox);

    function toMVA(val, unit) { return unit === 'kVA' ? val / 1000 : val; }
    function toKV(val, unit) { return unit === 'V' ? val / 1000 : val; }
    function safeNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

    function recompute() {
      var mva = toMVA(safeNum(powerInput.value), powerInput.dataset.v070Unit || 'MVA');
      var vpKv = toKV(safeNum(vpInput.value), vpInput.dataset.v070Unit || 'kV');
      var vsKv = toKV(safeNum(vsInput.value), vsInput.dataset.v070Unit || 'kV');
      var zpc = zpcInput ? safeNum(zpcInput.value) : 0;
      var typeLabel = xfmrType === '1ph' ? 'Single-Phase' : 'Three-Phase';
      if (!mva || !vpKv || !vsKv || !zpc) {
        resultBox.innerHTML =
          '<div class="result-line"><span>Transformer type</span><b>' + typeLabel + '</b></div>' +
          '<div class="note">Enter power, primary/secondary voltage and %Z to complete this result.</div>';
        return;
      }
      var divisor = xfmrType === '1ph' ? 1 : Math.sqrt(3);
      var flcPrimary = (mva * 1e6) / (divisor * vpKv * 1e3);
      var flcSecondary = (mva * 1e6) / (divisor * vsKv * 1e3);
      var faultPrimary = flcPrimary / (zpc / 100);
      var faultSecondary = flcSecondary / (zpc / 100);
      resultBox.innerHTML =
        '<div class="result-line"><span>Transformer type</span><b>' + typeLabel + '</b></div>' +
        '<div class="result-line"><span>Primary FLC</span><b>' + flcPrimary.toFixed(1) + ' A</b></div>' +
        '<div class="result-line"><span>Secondary FLC</span><b>' + flcSecondary.toFixed(1) + ' A</b></div>' +
        '<div class="result-line"><span>Primary fault current</span><b>' + faultPrimary.toFixed(0) + ' A (' + (faultPrimary/1000).toFixed(2) + ' kA)</b></div>' +
        '<div class="result-line"><span>Secondary fault current</span><b>' + faultSecondary.toFixed(0) + ' A (' + (faultSecondary/1000).toFixed(2) + ' kA)</b></div>';
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

  function enhanceFaultLevelTool() {
    addFormulaBlock('panel-fault', 'Reference formulas', [
      String.raw`I''_{k,3\phi} = \dfrac{c \cdot V_n}{\sqrt{3}\,Z_1}`,
      String.raw`I''_{k,1\phi} = \dfrac{\sqrt{3}\,c \cdot V_n}{2Z_1 + Z_0}`
    ]);
  }

  function enhanceCTTool() {
    addFormulaBlock('panel-ctsat', 'Reference formula', [
      String.raw`V_k \geq K \times I_{fault,sec} \times (R_{CT} + R_L + R_{relay})`
    ]);
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
