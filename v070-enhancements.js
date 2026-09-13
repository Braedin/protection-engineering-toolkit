// ===================== v0.7.0 Enhancements (additive, non-destructive) =====================
// Adds unit toggles + single-phase fault current to the Transformer tool,
// and renders KaTeX formula reference blocks, without modifying app.js.
(function () {
  function onReady(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn, 0);
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function findPanelByHeading(regex) {
    var panels = document.querySelectorAll('.tool-panel, main, #app, body');
    for (var i = 0; i < panels.length; i++) {
      var h = panels[i].querySelector('h2, h3');
      if (h && regex.test(h.textContent)) return panels[i];
    }
    var heads = document.querySelectorAll('h2, h3');
    for (var j = 0; j < heads.length; j++) {
      if (regex.test(heads[j].textContent)) {
        return heads[j].closest('.tool-panel') || heads[j].parentElement;
      }
    }
    return null;
  }

  function renderKatexInto(el, tex, displayMode) {
    if (!el) return;
    if (window.katex) {
      try { katex.render(tex, el, { throwOnError: false, displayMode: !!displayMode }); return; } catch (e) {}
    }
    el.textContent = tex;
  }

  function addFormulaBlock(panel, title, formulas) {
    if (!panel || panel.querySelector('.v070-formula-block')) return;
    var block = document.createElement('div');
    block.className = 'v070-formula-block';
    block.style.marginTop = '16px';
    block.style.paddingTop = '10px';
    block.style.borderTop = '1px solid rgba(159,176,207,0.25)';
    var h = document.createElement('h3');
    h.textContent = title;
    h.style.fontSize = '0.95rem';
    h.style.color = 'var(--text-dim, #9fb0cf)';
    h.style.marginTop = '0';
    block.appendChild(h);
    formulas.forEach(function (f) {
      var d = document.createElement('div');
      d.style.margin = '8px 0';
      block.appendChild(d);
      renderKatexInto(d, f, true);
    });
    panel.appendChild(block);
  }

  function enhanceTransformerTool() {
    var panel = findPanelByHeading(/Transformer/i);
    if (!panel) return false;
    if (panel.querySelector('.v070-unit-toggle')) return true;

    var numberInputs = Array.prototype.slice.call(panel.querySelectorAll('input[type="number"]'));
    if (numberInputs.length < 3) return false;

    var powerInput = numberInputs[0];
    var vpInput = numberInputs[1];
    var vsInput = numberInputs[2];

    function makeUnitToggle(input, units, defaultUnit) {
      var wrap = document.createElement('span');
      wrap.className = 'v070-unit-toggle';
      wrap.style.marginLeft = '6px';
      var select = document.createElement('select');
      select.style.marginLeft = '4px';
      units.forEach(function (u) {
        var opt = document.createElement('option');
        opt.value = u; opt.textContent = u;
        if (u === defaultUnit) opt.selected = true;
        select.appendChild(opt);
      });
      wrap.appendChild(select);
      input.insertAdjacentElement('afterend', wrap);
      input.dataset.v070Unit = defaultUnit;
      select.addEventListener('change', function () {
        input.dataset.v070Unit = select.value;
        recompute();
      });
      return select;
    }

    makeUnitToggle(powerInput, ['MVA', 'kVA'], 'MVA');
    makeUnitToggle(vpInput, ['kV', 'V'], 'kV');
    makeUnitToggle(vsInput, ['kV', 'V'], 'kV');

    var phaseWrap = document.createElement('div');
    phaseWrap.className = 'v070-phase-toggle';
    phaseWrap.style.margin = '10px 0';
    phaseWrap.innerHTML =
      '<label style="display:block;font-size:0.78rem;color:var(--text-dim,#9fb0cf);margin-bottom:6px;">Fault current phase mode (v0.7 addition)</label>' +
      '<button type="button" data-phase="3ph" class="v070-phase-btn" style="margin-right:6px;padding:6px 10px;">Three-Phase</button>' +
      '<button type="button" data-phase="1ph" class="v070-phase-btn" style="padding:6px 10px;">Single-Phase</button>';
    powerInput.closest('.field, div') && powerInput.parentElement.insertAdjacentElement('afterend', phaseWrap);

    var currentPhaseMode = '3ph';
    var btns = phaseWrap.querySelectorAll('.v070-phase-btn');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.style.outline = ''; });
        b.style.outline = '2px solid #4fb0ff';
        currentPhaseMode = b.dataset.phase;
        recompute();
      });
    });
    btns[0].style.outline = '2px solid #4fb0ff';

    var resultBox = document.createElement('div');
    resultBox.className = 'v070-result-box';
    resultBox.style.marginTop = '10px';
    resultBox.style.padding = '10px';
    resultBox.style.border = '1px solid rgba(159,176,207,0.25)';
    resultBox.style.borderRadius = '6px';
    resultBox.style.fontSize = '0.85rem';
    phaseWrap.insertAdjacentElement('afterend', resultBox);

    function toMVA(val, unit) { return unit === 'kVA' ? val / 1000 : val; }
    function toKV(val, unit) { return unit === 'V' ? val / 1000 : val; }
    function safeNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

    function findZpcInput() {
      var labels = panel.querySelectorAll('label');
      for (var i = 0; i < labels.length; i++) {
        if (/impedance|%z|zpc/i.test(labels[i].textContent)) {
          var inp = labels[i].parentElement && labels[i].parentElement.querySelector('input[type="number"]');
          if (inp) return inp;
        }
      }
      return numberInputs[3] || null;
    }
    var zpcInput = findZpcInput();

    function recompute() {
      var mva = toMVA(safeNum(powerInput.value), powerInput.dataset.v070Unit || 'MVA');
      var vpKv = toKV(safeNum(vpInput.value), vpInput.dataset.v070Unit || 'kV');
      var vsKv = toKV(safeNum(vsInput.value), vsInput.dataset.v070Unit || 'kV');
      var zpc = zpcInput ? safeNum(zpcInput.value) : 8;
      if (!mva || !vpKv || !vsKv || !zpc) {
        resultBox.innerHTML = '<em>Enter power, primary/secondary voltage and %Z to see the v0.7 unit-aware result.</em>';
        return;
      }
      var flcPrimary = (mva * 1e6) / (Math.sqrt(3) * vpKv * 1e3);
      var flcSecondary = (mva * 1e6) / (Math.sqrt(3) * vsKv * 1e3);
      var phaseMultiplier = currentPhaseMode === '1ph' ? Math.sqrt(3) : 1;
      var phaseLabel = currentPhaseMode === '1ph' ? 'Single-Phase' : 'Three-Phase';
      var faultPrimary = (flcPrimary / (zpc / 100)) * phaseMultiplier;
      var faultSecondary = (flcSecondary / (zpc / 100)) * phaseMultiplier;
      resultBox.innerHTML =
        '<div><b>' + phaseLabel + ' result (v0.7 unit-aware)</b></div>' +
        '<div>Primary FLC: ' + flcPrimary.toFixed(1) + ' A &nbsp; | &nbsp; Secondary FLC: ' + flcSecondary.toFixed(1) + ' A</div>' +
        '<div>Primary fault current: ' + faultPrimary.toFixed(0) + ' A (' + (faultPrimary/1000).toFixed(2) + ' kA)</div>' +
        '<div>Secondary fault current: ' + faultSecondary.toFixed(0) + ' A (' + (faultSecondary/1000).toFixed(2) + ' kA)</div>';
    }

    [powerInput, vpInput, vsInput, zpcInput].forEach(function (inp) {
      if (inp) { inp.addEventListener('input', recompute); inp.addEventListener('change', recompute); }
    });
    recompute();

    addFormulaBlock(panel, 'Reference formulas (v0.7 addition)', [
      String.raw`\text{FLC} = \dfrac{S}{\sqrt{3}\,V_{LL}}`,
      String.raw`I''_{k,3\phi} = \dfrac{\text{FLC}}{Z_{pu}}`,
      String.raw`I''_{k,1\phi} = \sqrt{3}\times I''_{k,3\phi}`
    ]);

    return true;
  }

  function enhanceFaultLevelTool() {
    var panel = findPanelByHeading(/Fault Level/i);
    if (!panel) return false;
    addFormulaBlock(panel, 'Reference formulas (v0.7 addition)', [
      String.raw`I''_{k,3\phi} = \dfrac{c \cdot V_n}{\sqrt{3}\,Z_1}`,
      String.raw`I''_{k,1\phi} = \dfrac{\sqrt{3}\,c \cdot V_n}{2Z_1 + Z_0}`
    ]);
    return true;
  }

  function enhanceCTTool() {
    var panel = findPanelByHeading(/Knee-Point|CT Saturation|Saturation/i);
    if (!panel) return false;
    addFormulaBlock(panel, 'Reference formula (v0.7 addition)', [
      String.raw`V_k \geq K \times I_{fault,sec} \times (R_{CT} + R_L + R_{relay})`
    ]);
    return true;
  }

  function enhanceTCCTool() {
    var panel = findPanelByHeading(/Time-Current|TCC/i);
    if (!panel) return false;
    addFormulaBlock(panel, 'Reference formula (v0.7 addition)', [
      String.raw`t = TMS\left(\dfrac{A}{(I/I_s)^p - 1} + B\right)`
    ]);
    return true;
  }

  function enhanceLossOfFieldTool() {
    var panel = findPanelByHeading(/Loss of Field/i);
    if (!panel) return false;
    addFormulaBlock(panel, 'Reference formulas (v0.7 addition)', [
      String.raw`Z_B = \dfrac{V^2}{S}\times\dfrac{CT}{PT}`,
      String.raw`\text{Zone 1 Diameter} = \dfrac{Z_B}{\sqrt{3}\,X_d'}, \quad \text{Zone 2 Diameter} = X_d\,Z_B`
    ]);
    return true;
  }

  function tryEnhanceAll() {
    enhanceTransformerTool();
    enhanceFaultLevelTool();
    enhanceCTTool();
    enhanceTCCTool();
    enhanceLossOfFieldTool();
  }

  onReady(function () {
    var attempts = 0;
    var interval = setInterval(function () {
      tryEnhanceAll();
      attempts++;
      if (attempts > 20) clearInterval(interval);
    }, 500);

    var observer = new MutationObserver(function () { tryEnhanceAll(); });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
