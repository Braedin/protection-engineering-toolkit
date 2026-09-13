// ===================== v0.7.0 Enhancements v3 (additive, non-destructive) =====================
// Scoped strictly by panel id. Unit dropdowns inline with inputs. Transformer type
// selector (3ph/1ph) at top of form; results pane shows both fault-current figures.
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

    function makeInlineUnitToggle(field, input, units, defaultUnit, onChangeExtra) {
      var label = field.querySelector('label');
      if (label) {
        label.textContent = label.textContent.replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
      var row = document.createElement('div');
      row.className = 'row2';
      input.insertAdjacentElement('beforebegin', row);
      row.appendChild(input);
      var select = document.createElement('select');
      select.className = 'v070-unit-toggle';
      units.forEach(function (u) {
        var opt = document.createElement('option');
        opt.value = u; opt.textContent = u;
        if (u === defaultUnit) opt.selected = true;
        select.appendChild(opt);
      });
      row.appendChild(select);
      input.dataset.v070Unit = defaultUnit;
      select.addEventListener('change', function () {
        input.dataset.v070Unit = select.value;
        if (onChangeExtra) onChangeExtra();
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
    var zpcField = zpcInput ? zpcInput.closest('.field') : null;
    if (zpcField) zpcField.insertAdjacentElement('afterend', resultBox);
    else powerField.closest('.card').appendChild(resultBox);

    function toMVA(val, unit) { return unit === 'kVA' ? val / 1000 : val; }
    function toKV(val, unit) { return unit === 'V' ? val / 1000 : val; }
    function safeNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

    function recompute() {
      var mva = toMVA(safeNum(powerInput.value), powerInput.dataset.v070Unit || 'MVA');
      var vpKv = toKV(safeNum(vpInput.value), vpInput.dataset.v070Unit || 'kV');
      var vsKv = toKV(safeNum(vsInput.value), vsInput.dataset.v070Unit || 'kV');
      var zpc = zpcInput ? safeNum(zpcInput.value) : 0;
      if (!mva || !vpKv || !vsKv || !zpc) {
        resultBox.innerHTML = '<div class="note">Enter power, primary/secondary voltage and %Z to see the unit-aware result.</div>';
        return;
      }
      var divisor = xfmrType === '1ph' ? 1 : Math.sqrt(3);
      var flcPrimary = (mva * 1e6) / (divisor * vpKv * 1e3);
      var flcSecondary = (mva * 1e6) / (divisor * vsKv * 1e3);
      var faultPrimary = flcPrimary / (zpc / 100);
      var faultSecondary = flcSecondary / (zpc / 100);
      var typeLabel = xfmrType === '1ph' ? 'Single-Phase' : 'Three-Phase';
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
