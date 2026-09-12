
// ===================== Protection Engineering Toolkit =====================
// Reference implementation of common protection calculations to IEC / AS-NZS standards.

const TOOLS = [
  {id:'tcc', label:'TCC Plotter'},
  {id:'symcomp', label:'Symmetrical Components'},
  {id:'ctsat', label:'CT Knee-Point / Saturation'},
  {id:'diff87', label:'Transformer Differential (87T)'},
  {id:'fault', label:'Fault Level Calculator'},
  {id:'arcflash', label:'Arc Flash Reference'},
];

const CURVES = {
  'IEC-SI':   {name:'IEC Standard Inverse (SI)',   A:0.14,  p:0.02, B:0, family:'IEC'},
  'IEC-VI':   {name:'IEC Very Inverse (VI)',       A:13.5,  p:1.0,  B:0, family:'IEC'},
  'IEC-EI':   {name:'IEC Extremely Inverse (EI)',  A:80.0,  p:2.0,  B:0, family:'IEC'},
  'IEC-LTI':  {name:'IEC Long-Time Inverse (LTI)', A:120.0, p:1.0,  B:0, family:'IEC'},
  'IEEE-MI':  {name:'IEEE Moderately Inverse',     A:0.0515,p:0.02, B:0.114, family:'IEEE'},
  'IEEE-VI':  {name:'IEEE Very Inverse',           A:19.61, p:2.0,  B:0.491, family:'IEEE'},
  'IEEE-EI':  {name:'IEEE Extremely Inverse',      A:28.2,  p:2.0,  B:0.1217, family:'IEEE'},
};

function curveTime(curveKey, Ir, TMS){
  const c = CURVES[curveKey];
  if (Ir <= 1.0001) return null;
  return TMS * (c.A / (Math.pow(Ir, c.p) - 1) + c.B);
}

let tccChart = null;
let activeCurves = [ {key:'IEC-SI', pickup:100, tms:0.1, id:cryptoId()} ];
function cryptoId(){ return Math.random().toString(36).slice(2,9); }

function renderTCC(container){
  container.innerHTML = `
    <h2>Time-Current Curve (TCC) Plotter <span class="std-badge">IEC 60255-151 / IEEE C37.112</span></h2>
    <p class="tool-desc">Plot IDMT overcurrent relay curves, adjust pickup current and TMS/TD, and read off operating time at any multiple of pickup to check coordination margins between devices.</p>
    <div class="grid">
      <div class="card">
        <div id="curveEditor"></div>
        <button class="btn btn-secondary" id="addCurveBtn" style="margin-top:8px;width:100%;">+ Add curve</button>
        <div class="field" style="margin-top:16px;">
          <label>Evaluate at fault current multiple (x Is)</label>
          <input type="number" id="evalMultiple" value="10" step="0.1" min="1.01">
        </div>
        <div class="results" id="evalResults"></div>
        <div class="note">Formula: t = TMS &times; [A / ((I/Is)<sup>p</sup> &minus; 1) + B]. IEC curves use B=0. IEEE curves (C37.112) use the additive B term. AS 2067 / relay OEM manuals may apply additional minimum time / reset settings not shown here.</div>
      </div>
      <div class="chart-wrap">
        <canvas id="tccCanvas"></canvas>
      </div>
    </div>
  `;
  document.getElementById('addCurveBtn').onclick = () => {
    activeCurves.push({key:'IEC-VI', pickup:100, tms:0.1, id:cryptoId()});
    renderCurveEditor();
    updateTCCChart();
  };
  document.getElementById('evalMultiple').oninput = updateTCCChart;
  renderCurveEditor();
  updateTCCChart();
}

function renderCurveEditor(){
  const el = document.getElementById('curveEditor');
  el.innerHTML = activeCurves.map((c,i) => `
    <div class="card" style="background:var(--panel-2);margin-bottom:10px;padding:12px;">
      <div class="row2">
        <div class="field">
          <label>Curve type</label>
          <select data-id="${c.id}" data-field="key" class="curveField">
            ${Object.entries(CURVES).map(([k,v]) => `<option value="${k}" ${c.key===k?'selected':''}>${v.name}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Pickup Is (A)</label>
          <input type="number" data-id="${c.id}" data-field="pickup" class="curveField" value="${c.pickup}" step="1" min="0.1">
        </div>
      </div>
      <div class="row2">
        <div class="field">
          <label>TMS / TD</label>
          <input type="number" data-id="${c.id}" data-field="tms" class="curveField" value="${c.tms}" step="0.01" min="0.01">
        </div>
        <div class="field" style="display:flex;align-items:flex-end;">
          ${activeCurves.length>1 ? `<button class="btn btn-secondary" style="width:100%;" onclick="removeCurve('${c.id}')">Remove</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
  document.querySelectorAll('.curveField').forEach(elm => {
    elm.onchange = (e) => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const curve = activeCurves.find(c=>c.id===id);
      curve[field] = field==='key' ? e.target.value : parseFloat(e.target.value);
      updateTCCChart();
    };
  });
}

function removeCurve(id){
  activeCurves = activeCurves.filter(c=>c.id!==id);
  renderCurveEditor();
  updateTCCChart();
}

function updateTCCChart(){
  const ctx = document.getElementById('tccCanvas');
  if (!ctx) return;
  const colors = ['#4fb0ff','#ffb74f','#4fd88a','#ff6b6b','#c792ea','#ff8fab'];
  const datasets = activeCurves.map((c, idx) => {
    const points = [];
    for (let m = 1.05; m <= 20; m *= 1.03){
      const t = curveTime(c.key, m, c.tms);
      if (t !== null && t < 1000) points.push({x: c.pickup*m, y: t});
    }
    return {
      label: `${CURVES[c.key].name} (Is=${c.pickup}A, TMS=${c.tms})`,
      data: points,
      borderColor: colors[idx % colors.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0,
    };
  });

  if (tccChart) tccChart.destroy();
  tccChart = new Chart(ctx, {
    type:'line',
    data:{datasets},
    options:{
      responsive:true,
      scales:{
        x:{type:'logarithmic', title:{display:true,text:'Current (A)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}},
        y:{type:'logarithmic', title:{display:true,text:'Operating Time (s)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}},
      },
      plugins:{
        legend:{labels:{color:'#e7ecf7', font:{size:11}}},
        tooltip:{mode:'nearest'}
      }
    }
  });

  const mult = parseFloat(document.getElementById('evalMultiple').value) || 10;
  const evalEl = document.getElementById('evalResults');
  evalEl.innerHTML = activeCurves.map(c => {
    const t = curveTime(c.key, mult, c.tms);
    return `<div class="result-line"><span>${CURVES[c.key].name} @ ${mult}xIs (${(c.pickup*mult).toFixed(1)}A)</span><b>${t!==null ? t.toFixed(3)+' s' : 'undefined'}</b></div>`;
  }).join('');
}

function complexMul(a, b){ return {re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re}; }
function complexAdd(a, b){ return {re: a.re+b.re, im: a.im+b.im}; }
function polarToRect(mag, angDeg){ const r = angDeg*Math.PI/180; return {re: mag*Math.cos(r), im: mag*Math.sin(r)}; }
function rectToPolar(c){ return {mag: Math.sqrt(c.re*c.re+c.im*c.im), ang: Math.atan2(c.im,c.re)*180/Math.PI}; }
const a_op = polarToRect(1,120);
const a2_op = polarToRect(1,240);

function renderSymComp(container){
  container.innerHTML = `
    <h2>Symmetrical Components Calculator <span class="std-badge">Fortescue / IEC 60909</span></h2>
    <p class="tool-desc">Convert unbalanced three-phase phasors (Ia, Ib, Ic or Va, Vb, Vc) to positive, negative and zero sequence components, or vice versa. Useful for fault phasor analysis and unbalance studies.</p>
    <div class="grid">
      <div class="card">
        <div class="field">
          <label>Conversion direction</label>
          <select id="symDir">
            <option value="p2s">Phase → Sequence</option>
            <option value="s2p">Sequence → Phase</option>
          </select>
        </div>
        <div id="symInputs"></div>
        <button class="btn" id="symCalcBtn" style="width:100%;margin-top:8px;">Calculate</button>
      </div>
      <div class="card">
        <h3 style="margin-top:0;font-size:1rem;">Results</h3>
        <div id="symResults" class="results"></div>
      </div>
    </div>
  `;
  document.getElementById('symDir').onchange = renderSymInputs;
  renderSymInputs();
  document.getElementById('symCalcBtn').onclick = calcSymComp;
}

function renderSymInputs(){
  const dir = document.getElementById('symDir').value;
  const el = document.getElementById('symInputs');
  if (dir === 'p2s'){
    el.innerHTML = `
      <div class="field"><label>Phase A: magnitude / angle (deg)</label><div class="row2"><input id="s1m" type="number" value="100"><input id="s1a" type="number" value="0"></div></div>
      <div class="field"><label>Phase B: magnitude / angle (deg)</label><div class="row2"><input id="s2m" type="number" value="100"><input id="s2a" type="number" value="-120"></div></div>
      <div class="field"><label>Phase C: magnitude / angle (deg)</label><div class="row2"><input id="s3m" type="number" value="100"><input id="s3a" type="number" value="120"></div></div>
    `;
  } else {
    el.innerHTML = `
      <div class="field"><label>Zero seq: magnitude / angle (deg)</label><div class="row2"><input id="s1m" type="number" value="0"><input id="s1a" type="number" value="0"></div></div>
      <div class="field"><label>Positive seq: magnitude / angle (deg)</label><div class="row2"><input id="s2m" type="number" value="100"><input id="s2a" type="number" value="0"></div></div>
      <div class="field"><label>Negative seq: magnitude / angle (deg)</label><div class="row2"><input id="s3m" type="number" value="0"><input id="s3a" type="number" value="0"></div></div>
    `;
  }
}

function calcSymComp(){
  const dir = document.getElementById('symDir').value;
  const m1 = parseFloat(document.getElementById('s1m').value), a1 = parseFloat(document.getElementById('s1a').value);
  const m2 = parseFloat(document.getElementById('s2m').value), a2 = parseFloat(document.getElementById('s2a').value);
  const m3 = parseFloat(document.getElementById('s3m').value), a3 = parseFloat(document.getElementById('s3a').value);
  const v1 = polarToRect(m1,a1), v2 = polarToRect(m2,a2), v3 = polarToRect(m3,a3);
  const resEl = document.getElementById('symResults');

  if (dir === 'p2s'){
    const i0 = {re:(v1.re+v2.re+v3.re)/3, im:(v1.im+v2.im+v3.im)/3};
    const i1terms = complexAdd(v1, complexAdd(complexMul(a_op,v2), complexMul(a2_op,v3)));
    const i1 = {re:i1terms.re/3, im:i1terms.im/3};
    const i2terms = complexAdd(v1, complexAdd(complexMul(a2_op,v2), complexMul(a_op,v3)));
    const i2 = {re:i2terms.re/3, im:i2terms.im/3};
    const p0=rectToPolar(i0), p1=rectToPolar(i1), p2=rectToPolar(i2);
    resEl.innerHTML = `
      <div class="result-line"><span>Zero sequence (I0 / V0)</span><b>${p0.mag.toFixed(3)} ∠ ${p0.ang.toFixed(2)}°</b></div>
      <div class="result-line"><span>Positive sequence (I1 / V1)</span><b>${p1.mag.toFixed(3)} ∠ ${p1.ang.toFixed(2)}°</b></div>
      <div class="result-line"><span>Negative sequence (I2 / V2)</span><b>${p2.mag.toFixed(3)} ∠ ${p2.ang.toFixed(2)}°</b></div>
      <div class="note">Unbalance factor (I2/I1): ${(p1.mag>0 ? (p2.mag/p1.mag*100).toFixed(2) : '0.00')}%</div>
    `;
  } else {
    const ia = complexAdd(v1, complexAdd(v2, v3));
    const ib = complexAdd(v1, complexAdd(complexMul(a2_op,v2), complexMul(a_op,v3)));
    const ic = complexAdd(v1, complexAdd(complexMul(a_op,v2), complexMul(a2_op,v3)));
    const pa=rectToPolar(ia), pb=rectToPolar(ib), pc=rectToPolar(ic);
    resEl.innerHTML = `
      <div class="result-line"><span>Phase A</span><b>${pa.mag.toFixed(3)} ∠ ${pa.ang.toFixed(2)}°</b></div>
      <div class="result-line"><span>Phase B</span><b>${pb.mag.toFixed(3)} ∠ ${pb.ang.toFixed(2)}°</b></div>
      <div class="result-line"><span>Phase C</span><b>${pc.mag.toFixed(3)} ∠ ${pc.ang.toFixed(2)}°</b></div>
    `;
  }
}

function renderCTSat(container){
  container.innerHTML = `
    <h2>CT Knee-Point &amp; Saturation Calculator <span class="std-badge">IEC 61869-2 / AS/NZS 61869</span></h2>
    <p class="tool-desc">Estimate required CT knee-point voltage for protection-class current transformers and check against a nameplate value. Based on the IEC 61869-2 definition: the point at which a 10% increase in secondary excitation voltage produces a 50% increase in exciting current.</p>
    <div class="grid">
      <div class="card">
        <div class="field"><label>CT ratio (primary : secondary A)</label>
          <div class="row2"><input id="ctPrim" type="number" value="1000"><input id="ctSec" type="number" value="1"></div>
        </div>
        <div class="field"><label>Maximum through-fault current, primary (A)</label><input id="ctIf" type="number" value="20000"></div>
        <div class="field"><label>CT secondary winding resistance R_CT (Ω)</label><input id="ctRct" type="number" value="2.5" step="0.01"></div>
        <div class="field"><label>Total lead (loop) resistance R_L (Ω)</label><input id="ctRl" type="number" value="0.8" step="0.01"></div>
        <div class="field"><label>Relay/relay burden resistance R_relay (Ω)</label><input id="ctRr" type="number" value="0.1" step="0.01"></div>
        <div class="field"><label>Dimensioning / safety factor K</label>
          <select id="ctK">
            <option value="1">1.0 (no margin — min. theoretical Vk)</option>
            <option value="1.5">1.5 (moderate DC offset margin)</option>
            <option value="2" selected>2.0 (typical differential / REF applications)</option>
          </select>
        </div>
        <div class="field"><label>Nameplate knee-point voltage Vk (V) — optional, for check</label><input id="ctVkActual" type="number" placeholder="e.g. 150"></div>
        <button class="btn" id="ctCalcBtn" style="width:100%;">Calculate</button>
      </div>
      <div class="card">
        <h3 style="margin-top:0;font-size:1rem;">Results</h3>
        <div id="ctResults" class="results"></div>
        <div class="note">V_k ≥ K × (I_fault,sec) × (R_CT + 2·R_L,one-way-equiv already summed as loop + R_relay). This is a simplified high-impedance / differential dimensioning check per IEC 61869-2 guidance — confirm against the actual protection scheme (87, REF, 67N) design formula, X/R ratio and remanence requirements before finalising CT selection.</div>
      </div>
    </div>
  `;
  document.getElementById('ctCalcBtn').onclick = calcCTSat;
  calcCTSat();
}

function calcCTSat(){
  const prim = parseFloat(document.getElementById('ctPrim').value);
  const sec = parseFloat(document.getElementById('ctSec').value);
  const If = parseFloat(document.getElementById('ctIf').value);
  const Rct = parseFloat(document.getElementById('ctRct').value);
  const Rl = parseFloat(document.getElementById('ctRl').value);
  const Rr = parseFloat(document.getElementById('ctRr').value);
  const K = parseFloat(document.getElementById('ctK').value);
  const vkActual = parseFloat(document.getElementById('ctVkActual').value);

  const ratio = prim/sec;
  const IfSec = If/ratio;
  const Vk_required = K * IfSec * (Rct + Rl + Rr);
  const resEl = document.getElementById('ctResults');

  let flagHtml = '';
  if (!isNaN(vkActual)){
    if (vkActual >= Vk_required){
      flagHtml = `<div class="result-flag flag-good">✓ Nameplate Vk (${vkActual} V) meets or exceeds required Vk (${Vk_required.toFixed(1)} V)</div>`;
    } else {
      flagHtml = `<div class="result-flag flag-warn">⚠ Nameplate Vk (${vkActual} V) is below required Vk (${Vk_required.toFixed(1)} V) — CT may saturate under this fault condition</div>`;
    }
  }

  resEl.innerHTML = `
    <div class="result-line"><span>CT ratio</span><b>${ratio.toFixed(1)} : 1</b></div>
    <div class="result-line"><span>Fault current referred to secondary</span><b>${IfSec.toFixed(2)} A</b></div>
    <div class="result-line"><span>Total secondary burden (R_CT+R_L+R_relay)</span><b>${(Rct+Rl+Rr).toFixed(2)} Ω</b></div>
    <div class="result-line"><span>Required knee-point voltage V_k</span><b>${Vk_required.toFixed(1)} V</b></div>
    ${flagHtml}
  `;
}

function renderDiff87(container){
  container.innerHTML = `
    <h2>Transformer Differential (87T) Plotter <span class="std-badge">Dual-Slope Percentage Restraint</span></h2>
    <p class="tool-desc">Visualise a dual-slope percentage-restraint differential characteristic for transformer protection. Adjust pickup and slope breakpoints to evaluate stability against CT mismatch, tap changer range and through-fault current.</p>
    <div class="grid">
      <div class="card">
        <div class="field"><label>Minimum pickup (Id_min, pu)</label><input id="dPickup" type="number" value="0.3" step="0.01"></div>
        <div class="field"><label>Slope 1 (%)</label><input id="dSlope1" type="number" value="25" step="1"></div>
        <div class="field"><label>Breakpoint 1 (Ir, pu)</label><input id="dBp1" type="number" value="2.5" step="0.1"></div>
        <div class="field"><label>Slope 2 (%)</label><input id="dSlope2" type="number" value="60" step="1"></div>
        <div class="field"><label>Max restraint shown (Ir, pu)</label><input id="dMaxIr" type="number" value="10" step="0.5"></div>
        <hr style="border-color:var(--border);margin:14px 0;">
        <div class="field"><label>Test point — restraint current Ir (pu)</label><input id="dTestIr" type="number" value="4" step="0.1"></div>
        <div class="field"><label>Test point — differential current Id (pu)</label><input id="dTestId" type="number" value="1.5" step="0.1"></div>
        <button class="btn" id="dCalcBtn" style="width:100%;">Plot &amp; check point</button>
        <div class="results" id="dResults"></div>
      </div>
      <div class="chart-wrap"><canvas id="diffCanvas"></canvas></div>
    </div>
  `;
  document.getElementById('dCalcBtn').onclick = updateDiffChart;
  updateDiffChart();
}

let diffChart = null;
function diffCharacteristic(ir, pickup, s1, bp1, s2){
  if (ir <= bp1) return Math.max(pickup, s1/100*ir);
  const idAtBp1 = Math.max(pickup, s1/100*bp1);
  return idAtBp1 + (s2/100)*(ir-bp1);
}

function updateDiffChart(){
  const pickup = parseFloat(document.getElementById('dPickup').value);
  const s1 = parseFloat(document.getElementById('dSlope1').value);
  const bp1 = parseFloat(document.getElementById('dBp1').value);
  const s2 = parseFloat(document.getElementById('dSlope2').value);
  const maxIr = parseFloat(document.getElementById('dMaxIr').value);
  const testIr = parseFloat(document.getElementById('dTestIr').value);
  const testId = parseFloat(document.getElementById('dTestId').value);

  const points = [];
  for (let ir=0; ir<=maxIr; ir+=maxIr/200){
    points.push({x:ir, y:diffCharacteristic(ir,pickup,s1,bp1,s2)});
  }
  const thresholdAtTest = diffCharacteristic(testIr,pickup,s1,bp1,s2);
  const willOperate = testId > thresholdAtTest;

  const ctx = document.getElementById('diffCanvas');
  if (diffChart) diffChart.destroy();
  diffChart = new Chart(ctx, {
    type:'line',
    data:{
      datasets:[
        {label:'Operate boundary', data:points, borderColor:'#4fb0ff', backgroundColor:'rgba(79,176,255,0.08)', fill:true, pointRadius:0, borderWidth:2},
        {label:'Test point', data:[{x:testIr,y:testId}], borderColor: willOperate?'#ff6b6b':'#4fd88a', backgroundColor: willOperate?'#ff6b6b':'#4fd88a', pointRadius:7, showLine:false, type:'scatter'}
      ]
    },
    options:{
      responsive:true,
      scales:{
        x:{title:{display:true,text:'Restraint Current Ir (pu)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}},
        y:{title:{display:true,text:'Differential Current Id (pu)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}},
      },
      plugins:{legend:{labels:{color:'#e7ecf7'}}}
    }
  });

  document.getElementById('dResults').innerHTML = `
    <div class="result-line"><span>Operate threshold at Ir=${testIr}</span><b>${thresholdAtTest.toFixed(3)} pu</b></div>
    <div class="result-flag ${willOperate?'flag-warn':'flag-good'}">${willOperate ? '⚡ Point is ABOVE characteristic — relay would OPERATE' : '✓ Point is below characteristic — relay RESTRAINED'}</div>
  `;
}

function renderFault(container){
  container.innerHTML = `
    <h2>Fault Level Calculator <span class="std-badge">IEC 60909 (simplified)</span></h2>
    <p class="tool-desc">Quick three-phase fault level estimate from system voltage and source/transformer impedance, plus per-unit conversion. For full IEC 60909 studies (c-factor, X/R, motor contribution) use a proper power-system analysis tool such as PowerFactory — this is a fast sanity-check calculator.</p>
    <div class="grid">
      <div class="card">
        <div class="field"><label>Nominal system voltage, line-line (kV)</label><input id="fVn" type="number" value="11" step="0.1"></div>
        <div class="field"><label>Source / transformer impedance to fault (%Z, on transformer base)</label><input id="fZpc" type="number" value="6" step="0.1"></div>
        <div class="field"><label>Transformer / source rated MVA</label><input id="fMva" type="number" value="10" step="0.1"></div>
        <div class="field"><label>Voltage factor c (IEC 60909)</label>
          <select id="fC">
            <option value="1.1">c=1.1 (max fault, LV/MV per IEC 60909)</option>
            <option value="1.0">c=1.0 (nominal)</option>
            <option value="0.95">c=0.95 (min fault)</option>
          </select>
        </div>
        <div class="field"><label>X/R ratio (for asymmetry factor)</label><input id="fXr" type="number" value="15" step="0.1"></div>
        <button class="btn" id="fCalcBtn" style="width:100%;">Calculate</button>
      </div>
      <div class="card">
        <h3 style="margin-top:0;font-size:1rem;">Results</h3>
        <div id="fResults" class="results"></div>
        <div class="note">I''k = c × Vn / (√3 × Zsource). Base impedance Zbase = Vn² / MVA. Peak asymmetrical factor κ ≈ 1.02 + 0.98·e^(-3·R/X). Verify against full network fault study for protection grading &amp; equipment rating (AS/NZS 3000, AS 62271).</div>
      </div>
    </div>
  `;
  document.getElementById('fCalcBtn').onclick = calcFault;
  calcFault();
}

function calcFault(){
  const Vn = parseFloat(document.getElementById('fVn').value);
  const Zpc = parseFloat(document.getElementById('fZpc').value);
  const Mva = parseFloat(document.getElementById('fMva').value);
  const c = parseFloat(document.getElementById('fC').value);
  const xr = parseFloat(document.getElementById('fXr').value);

  const Zbase = (Vn*Vn)/Mva;
  const Zactual = (Zpc/100)*Zbase;
  const IkA_sym = (c*Vn*1000) / (Math.sqrt(3)*Zactual) / 1000;
  const IkA_base = Mva/(Math.sqrt(3)*Vn);
  const kappa = 1.02 + 0.98*Math.exp(-3/xr);
  const ipeak = kappa * Math.sqrt(2) * IkA_sym;

  document.getElementById('fResults').innerHTML = `
    <div class="result-line"><span>Base impedance (Zbase)</span><b>${Zbase.toFixed(4)} Ω</b></div>
    <div class="result-line"><span>Actual fault-path impedance</span><b>${Zactual.toFixed(4)} Ω</b></div>
    <div class="result-line"><span>Rated full-load current</span><b>${IkA_base.toFixed(3)} kA</b></div>
    <div class="result-line"><span>Symmetrical fault current I''k</span><b>${IkA_sym.toFixed(3)} kA</b></div>
    <div class="result-line"><span>Asymmetry factor κ</span><b>${kappa.toFixed(3)}</b></div>
    <div class="result-line"><span>Peak fault current ip</span><b>${ipeak.toFixed(3)} kA</b></div>
  `;
}

function renderArcFlash(container){
  container.innerHTML = `
    <h2>Arc Flash Quick Reference <span class="std-badge">AS/NZS 4836 · IEC 61482 · IEC/TR 60909</span></h2>
    <p class="tool-desc">Arc flash energy in Australia is generally assessed using the IEEE 1584 incident-energy method combined with AS/NZS 4836 electrical safety work practice requirements — there is no standalone Australian arc-flash calculation standard. This panel gives PPE category guidance and links the relevant standards; use dedicated software (ETAP, SKM, EasyPower or PowerFactory arc-flash module) for a site incident-energy calculation.</p>
    <div class="card">
      <table class="ref-table">
        <thead><tr><th>Standard</th><th>Scope</th></tr></thead>
        <tbody>
          <tr><td>IEEE 1584-2018</td><td>Incident energy &amp; arc-flash boundary calculation method (most widely used basis for AU studies)</td></tr>
          <tr><td>AS/NZS 4836:2023</td><td>Safe working on or near low-voltage and high-voltage electrical installations — PPE &amp; work practice requirements</td></tr>
          <tr><td>IEC 61482-1-1 / -2</td><td>Test methods &amp; requirements for arc-rated clothing (open arc / box test)</td></tr>
          <tr><td>IEC/TR 60909</td><td>Short-circuit current basis often used as input to incident energy studies</td></tr>
          <tr><td>AS 2067</td><td>Substation earthing, switchgear &amp; general HV substation design — relevant boundary conditions for arc studies</td></tr>
        </tbody>
      </table>
    </div>
    <div class="card" style="margin-top:16px;">
      <h3 style="margin-top:0;font-size:1rem;">Indicative PPE categories (guidance only — confirm with site incident-energy study)</h3>
      <table class="ref-table">
        <thead><tr><th>Incident energy at working distance</th><th>Typical PPE category</th><th>Minimum ATPV/EBT</th></tr></thead>
        <tbody>
          <tr><td>&le; 1.2 cal/cm²</td><td>Category 1</td><td>4 cal/cm²</td></tr>
          <tr><td>&le; 8 cal/cm²</td><td>Category 2</td><td>8 cal/cm²</td></tr>
          <tr><td>&le; 25 cal/cm²</td><td>Category 3</td><td>25 cal/cm²</td></tr>
          <tr><td>&le; 40 cal/cm²</td><td>Category 4</td><td>40 cal/cm²</td></tr>
          <tr><td>&gt; 40 cal/cm²</td><td>No safe PPE — de-energise / remote switching required</td><td>—</td></tr>
        </tbody>
      </table>
      <div class="note">Category boundaries follow the widely used NFPA 70E-style banding referenced informally in Australian practice; always base actual PPE selection on the calculated incident energy from a full study, not this table alone.</div>
    </div>
  `;
}

function initApp(){
  const nav = document.getElementById('tabnav');
  const app = document.getElementById('app');
  nav.innerHTML = TOOLS.map(t => `<button data-tool="${t.id}">${t.label}</button>`).join('');
  app.innerHTML = TOOLS.map(t => `<section class="tool-panel" id="panel-${t.id}"></section>`).join('');

  const renderers = {
    tcc: renderTCC,
    symcomp: renderSymComp,
    ctsat: renderCTSat,
    diff87: renderDiff87,
    fault: renderFault,
    arcflash: renderArcFlash,
  };

  function activate(id){
    document.querySelectorAll('.tabnav button').forEach(b => b.classList.toggle('active', b.dataset.tool===id));
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.toggle('active', p.id===`panel-${id}`));
    const panel = document.getElementById(`panel-${id}`);
    if (!panel.dataset.rendered){
      renderers[id](panel);
      panel.dataset.rendered = '1';
    }
  }

  nav.querySelectorAll('button').forEach(b => b.onclick = () => activate(b.dataset.tool));
  activate(TOOLS[0].id);
}

document.addEventListener('DOMContentLoaded', initApp);
