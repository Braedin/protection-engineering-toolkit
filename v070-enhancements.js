// ===================== v0.7.0 Enhancements v2 (additive, non-destructive) =====================
// Scoped strictly by panel id to avoid cross-panel bleed. Uses app's own CSS classes.
(function () {
  function onReady(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn, 0);
    else document.addEventListener('DOMContentLoaded', fn);
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
    if (!panel || panel.querySelector('.v070-unit-toggle')) return;

    var fields = panel.querySelectorAll('.field');
    var powerInput = null, vpInput = null, vsInput = null, zpcInput = null;
    fields.forEach(function (field) {
      var label = field.querySelector('label');
      var input = field.querySelector('input[type="number"]');
      if (!label || !input) return;
      var t = label.textContent.toLowerCase();
      if (/rated power|power/.test(t) && !powerInput) powerInput = input;
      else if (/primary/.test(t) && !vpInput) vpInput = input;
      else if (/secondary/.test(t) && !vsInput) vsInput = input;
      else if (/impedance|%z|zpc/.test(t) && !zpcInput) zpcInput = input;
    });
    if (!powerInput || !vpInput || !vsInput) return;

    var powerLabel = powerInput.closest('.field').querySelector('label');

    function makeUnitToggle(input, units, defaultUnit, onChangeExtra) {
      var select = document.createElement('select');
      select.className = 'v070-unit-toggle';
      select.style.marginLeft = '8px';
      select.style.width = 'auto';
      select.style.display = 'inline-block';
      units.forEach(function (u) {
        var opt = document.createElement('option');
        opt.value = u; opt.textContent = u;
        if (u === defaultUnit) opt.selected = true;
        select.appendChild(opt);
      });
      input.insertAdjacentElement('afterend', select);
      input.dataset.v070Unit = defaultUnit;
      select.addEventListener('change', function () {
        input.dataset.v070Unit = select.value;
        if (onChangeExtra) onChangeExtra();
        recompute();
      });
      return select;
    }

    makeUnitToggle(powerInput, ['MVA', 'kVA'], 'MVA', function () {
      if (powerLabel) powerLabel.firstChild.textContent = 'Rated power (' + powerInput.dataset.v070Unit + ')';
    });
    makeUnitToggle(vpInput, ['kV', 'V'], 'kV');
    makeUnitToggle(vsInput, ['kV', 'V'], 'kV');
    if (powerLabel) powerLabel.firstChild.textContent = 'Rated power (MVA)';

    var phaseCard = document.createElement('div');
    phaseCard.className = 'field full v070-phase-toggle';
    phaseCard.style.marginTop = '10px';
    phaseCard.innerHTML =
      '<label>Fault current phase mode</label>' +
      '<div class="fault-type-grid" style="grid-template-columns:1fr 1fr;">' +
      '<button type="button" class="fault-type-btn v070-phase-btn active" data-phase="3ph">Three-Phase</button>' +
      '<button type="button" class="fault-type-btn v070-phase-btn" data-phase="1ph">Single-Phase</button>' +
      '</div>';
    var compactForm = panel.querySelector('.compact-form');
    if (compactForm) compactForm.insertAdjacentElement('afterend', phaseCard);
    else powerInput.closest('.card').appendChild(phaseCard);

    var currentPhaseMode = '3ph';
    var btns = phaseCard.querySelectorAll('.v070-phase-btn');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        currentPhaseMode = b.dataset.phase;
        recompute();
      });
    });

    var resultBox = document.createElement('div');
    resultBox.className = 'results v070-result-box';
    phaseCard.insertAdjacentElement('afterend', resultBox);

    function toMVA(val, unit) { return unit === 'kVA' ? val / 1000 : val; }
    function toKV(val, unit) { return unit === 'V' ? val / 1000 : val; }
    function safeNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

    function recompute() {
      var mva = toMVA(safeNum(powerInput.value), powerInput.dataset.v070Unit || 'MVA');
      var vpKv = toKV(safeNum(vpInput.value), vpInput.dataset.v070Unit || 'kV');
      var vsKv = toKV(safeNum(vsInput.value), vsInput.dataset.v070Unit || 'kV');
      var zpc = zpcInput ? safeNum(zpcInput.value) : 0;
      if (!mva || !vpKv || !vsKv || !zpc) {
        resultBox.innerHTML = '<div class="note">Enter power, primary/secondary voltage and %Z to see the phase-mode result.</div>';
        return;
      }
      var flcPrimary = (mva * 1e6) / (Math.sqrt(3) * vpKv * 1e3);
      var flcSecondary = (mva * 1e6) / (Math.sqrt(3) * vsKv * 1e3);
      var phaseMultiplier = currentPhaseMode === '1ph' ? Math.sqrt(3) : 1;
      var phaseLabel = currentPhaseMode === '1ph' ? 'Single-Phase' : 'Three-Phase';
      var faultPrimary = (flcPrimary / (zpc / 100)) * phaseMultiplier;
      var faultSecondary = (flcSecondary / (zpc / 100)) * phaseMultiplier;
      resultBox.innerHTML =
        '<div class="result-line"><span>Primary FLC</span><b>' + flcPrimary.toFixed(1) + ' A</b></div>' +
        '<div class="result-line"><span>Secondary FLC</span><b>' + flcSecondary.toFixed(1) + ' A</b></div>' +
        '<div class="result-line"><span>Primary fault current (' + phaseLabel + ')</span><b>' + faultPrimary.toFixed(0) + ' A (' + (faultPrimary/1000).toFixed(2) + ' kA)</b></div>' +
        '<div class="result-line"><span>Secondary fault current (' + phaseLabel + ')</span><b>' + faultSecondary.toFixed(0) + ' A (' + (faultSecondary/1000).toFixed(2) + ' kA)</b></div>';
    }

    [powerInput, vpInput, vsInput, zpcInput].forEach(function (inp) {
      if (inp) { inp.addEventListener('input', recompute); inp.addEventListener('change', recompute); }
    });
    recompute();

    addFormulaBlock('panel-txfmr', 'Reference formulas', [
      String.raw`\text{FLC} = \dfrac{S}{\sqrt{3}\,V_{LL}}`,
      String.raw`I''_{k,3\phi} = \dfrac{\text{FLC}}{Z_{pu}}`,
      String.raw`I''_{k,1\phi} = \sqrt{3}\times I''_{k,3\phi}`
    ]);
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
    if (navBtn && navBtn.style.display !== 'none') {
      navBtn.style.display = 'none';
    }
    var panel = document.getElementById('panel-lof');
    if (panel) panel.style.display = 'none';
  }

  function tryEnhanceAll() {
    enhanceTransformerTool();
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
