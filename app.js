
// ===================== Protection Engineering Toolkit =====================
const TOOLS = [
  {id:'tcc', label:'TCC Plotter'},
  {id:'symcomp', label:'Symmetrical Components'},
  {id:'ctsat', label:'CT Knee-Point / Saturation'},
  {id:'diff87', label:'Transformer Differential (87T)'},
  {id:'fault', label:'Fault Level Calculator'},
  {id:'txfmr', label:'Transformer FLC & Fault Current'},
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
let activeCurves = [ {key:'IEC-SI', pickup:100, tms:0.1, ctRatio:1, id:cryptoId()} ];
function cryptoId(){ return Math.random().toString(36).slice(2,9); }

function renderTCC(container){
  container.innerHTML = `
    <h2>Time-Current Curve (TCC) Plotter <span class="std-badge">IEC 60255-151 / IEEE C37.112</span></h2>
    <p class="tool-desc">Plot IDMT overcurrent relay curves, adjust pickup current and TMS/TD, and read off operating time at any multiple of pickup to check coordination margins between devices. Each curve can be displayed in secondary (relay) current or referred to the primary system current using its CT ratio.</p>
    <div class="grid">
      <div class="card">
        <div class="field">
          <label>Plot axis reference</label>
          <select id="tccAxisMode">
            <option value="secondary">Secondary (relay) current</option>
            <option value="primary">Primary (system) current</option>
          </select>
        </div>
        <div id="curveEditor"></div>
        <button class="btn btn-secondary" id="addCurveBtn" style="margin-top:8px;width:100%;">+ Add curve</button>
        <div class="field" style="margin-top:16px;">
          <label>Evaluate at fault current multiple (x Is)</label>
          <input type="number" id="evalMultiple" value="10" step="0.1" min="1.01">
        </div>
        <div class="results" id="evalResults"></div>
        <div class="note">Formula: t = TMS &times; [A / ((I/Is)<sup>p</sup> &minus; 1) + B]. IEC curves use B=0. IEEE curves (C37.112) use the additive B term. Primary current = secondary current &times; CT ratio (e.g. 400/1 = ratio 400).</div>
      </div>
      <div class="chart-wrap">
        <canvas id="tccCanvas"></canvas>
      </div>
    </div>
  `;
  document.getElementById('addCurveBtn').onclick = () => {
    activeCurves.push({key:'IEC-VI', pickup:100, tms:0.1, ctRatio:1, id:cryptoId()});
    renderCurveEditor();
    updateTCCChart();
  };
  document.getElementById('evalMultiple').oninput = updateTCCChart;
  document.getElementById('tccAxisMode').onchange = updateTCCChart;
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
          <label>Pickup Is (A, secondary)</label>
          <input type="number" data-id="${c.id}" data-field="pickup" class="curveField" value="${c.pickup}" step="1" min="0.1">
        </div>
      </div>
      <div class="row2">
        <div class="field">
          <label>TMS / TD</label>
          <input type="number" data-id="${c.id}" data-field="tms" class="curveField" value="${c.tms}" step="0.01" min="0.01">
        </div>
        <div class="field">
          <label>CT ratio (e.g. 400 for 400/1)</label>
          <input type="number" data-id="${c.id}" data-field="ctRatio" class="curveField" value="${c.ctRatio}" step="1" min="1">
        </div>
      </div>
      ${activeCurves.length>1 ? `<button class="btn btn-secondary" style="width:100%;" onclick="removeCurve('${c.id}')">Remove curve</button>` : ''}
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
  const axisMode = document.getElementById('tccAxisMode').value;
  const colors = ['#4fb0ff','#ffb74f','#4fd88a','#ff6b6b','#c792ea','#ff8fab'];
  const datasets = activeCurves.map((c, idx) => {
    const points = [];
    const refMultiplier = axisMode==='primary' ? c.ctRatio : 1;
    for (let m = 1.05; m <= 20; m *= 1.03){
      const t = curveTime(c.key, m, c.tms);
      if (t !== null && t < 1000) points.push({x: c.pickup*m*refMultiplier, y: t});
    }
    return {
      label: `${CURVES[c.key].name} (Is=${c.pickup}A sec, CT=${c.ctRatio}/1, TMS=${c.tms})`,
      data: points,
      borderColor: colors[idx % colors.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0,
      parsing: false,
    };
  });

  if (tccChart) tccChart.destroy();
  tccChart = new Chart(ctx, {
    type:'line',
    data:{datasets},
    options:{
      responsive:true,
      parsing: false,
      scales:{
        x:{type:'logarithmic', title:{display:true,text:axisMode==='primary' ? 'Primary Current (A)' : 'Secondary Current (A)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}},
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
    const refMultiplier = axisMode==='primary' ? c.ctRatio : 1;
    const displayCurrent = (c.pickup*mult*refMultiplier).toFixed(1);
    const unit = axisMode==='primary' ? 'A primary' : 'A secondary';
    return `<div class="result-line"><span>${CURVES[c.key].name} @ ${mult}xIs (${displayCurrent}${unit})</span><b>${t!==null ? t.toFixed(3)+' s' : 'undefined'}</b></div>`;
  }).join('');
}

// ===================== Symmetrical Components (with phasor diagram) =====================
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
      <div class="chart-wrap">
        <canvas id="symPhasorCanvas" width="500" height="500" style="max-width:100%;"></canvas>
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
  drawPhasorDiagram([]);
}

function drawPhasorDiagram(phasors){
  const canvas = document.getElementById('symPhasorCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w/2, cy = h/2;
  const maxMag = Math.max(1, ...phasors.map(p => p.mag));
  const scale = (Math.min(w,h)/2 - 40) / maxMag;

  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = '#2a3654';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,cy); ctx.lineTo(w,cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx,h); ctx.stroke();

  for (let r = maxMag/4; r <= maxMag; r += maxMag/4){
    ctx.beginPath();
    ctx.arc(cx, cy, r*scale, 0, 2*Math.PI);
    ctx.strokeStyle = 'rgba(159,176,207,0.15)';
    ctx.stroke();
  }

  phasors.forEach(p => {
    const rad = -p.ang * Math.PI/180;
    const x = cx + p.mag*scale*Math.cos(rad);
    const y = cy + p.mag*scale*Math.sin(rad);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(x,y);
    ctx.stroke();

    const headLen = 10;
    const angle = Math.atan2(y-cy, x-cx);
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x - headLen*Math.cos(angle-Math.PI/6), y - headLen*Math.sin(angle-Math.PI/6));
    ctx.lineTo(x - headLen*Math.cos(angle+Math.PI/6), y - headLen*Math.sin(angle+Math.PI/6));
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.font = '13px Segoe UI';
    ctx.fillText(p.label, x + (x>cx?8:-30), y + (y>cy?16:-8));
  });
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
    drawPhasorDiagram([
      {mag:m1, ang:a1, color:'#4fb0ff', label:'A'},
      {mag:m2, ang:a2, color:'#ffb74f', label:'B'},
      {mag:m3, ang:a3, color:'#4fd88a', label:'C'},
      {mag:p1.mag, ang:p1.ang, color:'#ff6b6b', label:'I1'},
      {mag:p2.mag, ang:p2.ang, color:'#c792ea', label:'I2'},
    ]);
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
    drawPhasorDiagram([
      {mag:pa.mag, ang:pa.ang, color:'#4fb0ff', label:'A'},
      {mag:pb.mag, ang:pb.ang, color:'#ffb74f', label:'B'},
      {mag:pc.mag, ang:pc.ang, color:'#4fd88a', label:'C'},
    ]);
  }
}

// ===================== CT Knee-Point / Saturation (with excitation curve chart) =====================
let ctChart = null;
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
      <div class="chart-wrap">
        <canvas id="ctCanvas"></canvas>
        <div id="ctResults" class="results"></div>
        <div class="note">V_k ≥ K × (I_fault,sec) × (R_CT + R_L + R_relay). Chart shows an idealised excitation curve: linear region up to the knee point, then a saturation "knee" beyond which secondary voltage barely rises for large increases in exciting current. This is a simplified conceptual plot, not a manufacturer-tested excitation characteristic.</div>
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

  const vkPlot = !isNaN(vkActual) ? vkActual : Vk_required;
  const knee_I = vkPlot / (Rct + Rl + Rr) * 0.5;

  const linPoints = [];
  for (let i=0; i<=knee_I; i+=knee_I/20){
    linPoints.push({x:i, y: (vkPlot/knee_I)*i});
  }
  const satPoints = [];
  const maxI = knee_I*8;
  for (let i=knee_I; i<=maxI; i+=(maxI-knee_I)/30){
    const y = vkPlot + (vkPlot*0.15) * Math.log(1 + (i-knee_I)/(knee_I*0.5));
    satPoints.push({x:i, y});
  }

  const ctx = document.getElementById('ctCanvas');
  if (ctChart) ctChart.destroy();
  ctChart = new Chart(ctx, {
    type:'line',
    data:{
      datasets:[
        {label:'Excitation curve (indicative)', data:[...linPoints, ...satPoints], borderColor:'#4fb0ff', backgroundColor:'transparent', borderWidth:2, pointRadius:0, parsing:false},
        {label:'Knee point', data:[{x:knee_I, y:vkPlot}], borderColor:'#ffb74f', backgroundColor:'#ffb74f', pointRadius:7, showLine:false, type:'scatter', parsing:false},
        {label:'Operating fault point', data:[{x:IfSec, y: IfSec*(Rct+Rl+Rr)}], borderColor:'#ff6b6b', backgroundColor:'#ff6b6b', pointRadius:7, showLine:false, type:'scatter', parsing:false},
      ]
    },
    options:{
      responsive:true,
      parsing:false,
      scales:{
        x:{title:{display:true,text:'Exciting Current (A)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}},
        y:{title:{display:true,text:'Secondary Voltage (V)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}},
      },
      plugins:{legend:{labels:{color:'#e7ecf7'}}}
    }
  });
}

// ===================== Transformer Differential 87T (fixed linear chart) =====================
let diffChart = null;
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
  ['dPickup','dSlope1','dBp1','dSlope2','dMaxIr','dTestIr','dTestId'].forEach(id => {
    document.getElementById(id).oninput = updateDiffChart;
  });
  document.getElementById('dCalcBtn').onclick = updateDiffChart;
  updateDiffChart();
}

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
  const steps = 200;
  for (let i=0; i<=steps; i++){
    const ir = (maxIr/steps)*i;
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
        {label:'Operate boundary', data:points, borderColor:'#4fb0ff', backgroundColor:'rgba(79,176,255,0.08)', fill:true, pointRadius:0, borderWidth:2, parsing:false},
        {label:'Test point', data:[{x:testIr,y:testId}], borderColor: willOperate?'#ff6b6b':'#4fd88a', backgroundColor: willOperate?'#ff6b6b':'#4fd88a', pointRadius:7, showLine:false, type:'scatter', parsing:false}
      ]
    },
    options:{
      responsive:true,
      parsing:false,
      scales:{
        x:{type:'linear', min:0, max:maxIr, title:{display:true,text:'Restraint Current Ir (pu)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}},
        y:{type:'linear', min:0, title:{display:true,text:'Differential Current Id (pu)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}},
      },
      plugins:{legend:{labels:{color:'#e7ecf7'}}}
    }
  });

  document.getElementById('dResults').innerHTML = `
    <div class="result-line"><span>Operate threshold at Ir=${testIr}</span><b>${thresholdAtTest.toFixed(3)} pu</b></div>
    <div class="result-flag ${willOperate?'flag-warn':'flag-good'}">${willOperate ? '⚡ Point is ABOVE characteristic — relay would OPERATE' : '✓ Point is below characteristic — relay RESTRAINED'}</div>
  `;
}

// ===================== Fault Level Calculator (with live SLD) =====================
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
      <div class="chart-wrap">
        <canvas id="sldCanvas" width="560" height="380" style="max-width:100%;"></canvas>
        <div id="fResults" class="results"></div>
        <div class="note">I''k = c × Vn / (√3 × Zsource). Base impedance Zbase = Vn² / MVA. Peak asymmetrical factor κ ≈ 1.02 + 0.98·e^(-3·R/X). Diagram is a simplified single-source, single-transformer SLD for visualisation only — verify against full network fault study for protection grading &amp; equipment rating (AS/NZS 3000, AS 62271).</div>
      </div>
    </div>
  `;
  ['fVn','fZpc','fMva','fC','fXr'].forEach(id => {
    document.getElementById(id).oninput = calcFault;
  });
  document.getElementById('fCalcBtn').onclick = calcFault;
  calcFault();
}

function drawSLD(vn, mva, zpc, ikA_sym, ipeak){
  const canvas = document.getElementById('sldCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  ctx.strokeStyle = '#9fb0cf';
  ctx.fillStyle = '#e7ecf7';
  ctx.font = '13px Segoe UI';
  ctx.lineWidth = 2;

  const busY = 60;
  const srcX = 100, srcTopY = 20;
  ctx.beginPath();
  ctx.arc(srcX, srcTopY, 16, 0, 2*Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(srcX-8, srcTopY);
  ctx.bezierCurveTo(srcX-8,srcTopY-8, srcX,srcTopY-8, srcX,srcTopY);
  ctx.bezierCurveTo(srcX,srcTopY+8, srcX+8,srcTopY+8, srcX+8,srcTopY);
  ctx.stroke();
  ctx.fillText('Source', srcX-24, srcTopY-24);

  ctx.beginPath();
  ctx.moveTo(srcX, srcTopY+16);
  ctx.lineTo(srcX, busY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(60, busY);
  ctx.lineTo(w-60, busY);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#4fb0ff';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#9fb0cf';
  ctx.fillStyle = '#4fb0ff';
  ctx.font = 'bold 13px Segoe UI';
  ctx.fillText(`Bus (${vn} kV)`, 60, busY-12);

  const txX = w/2;
  ctx.strokeStyle = '#9fb0cf';
  ctx.fillStyle = '#e7ecf7';
  ctx.font = '13px Segoe UI';
  ctx.beginPath();
  ctx.moveTo(txX, busY);
  ctx.lineTo(txX, busY+40);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(txX-10, busY+55, 16, 0, 2*Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(txX+10, busY+55, 16, 0, 2*Math.PI);
  ctx.stroke();
  ctx.fillText(`T1: ${mva} MVA, ${zpc}%Z`, txX+24, busY+58);

  ctx.beginPath();
  ctx.moveTo(txX, busY+71);
  ctx.lineTo(txX, busY+130);
  ctx.stroke();

  const faultY = busY+130;
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 3;
  const boltSize = 18;
  ctx.beginPath();
  ctx.moveTo(txX-boltSize, faultY-boltSize);
  ctx.lineTo(txX+4, faultY-4);
  ctx.lineTo(txX-4, faultY+4);
  ctx.lineTo(txX+boltSize, faultY+boltSize);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#9fb0cf';

  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 14px Segoe UI';
  ctx.fillText('3-PHASE FAULT', txX+28, faultY+4);
  ctx.font = 'bold 16px Segoe UI';
  ctx.fillText(`I''k = ${ikA_sym.toFixed(2)} kA`, txX+28, faultY+26);
  ctx.font = '13px Segoe UI';
  ctx.fillStyle = '#9fb0cf';
  ctx.fillText(`ip = ${ipeak.toFixed(2)} kA`, txX+28, faultY+46);

  ctx.beginPath();
  ctx.moveTo(txX, faultY+4);
  ctx.lineTo(txX, faultY+60);
  ctx.strokeStyle = '#9fb0cf';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(txX-15, faultY+60);
  ctx.lineTo(txX+15, faultY+60);
  ctx.moveTo(txX-10, faultY+68);
  ctx.lineTo(txX+10, faultY+68);
  ctx.moveTo(txX-5, faultY+76);
  ctx.lineTo(txX+5, faultY+76);
  ctx.stroke();
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

  drawSLD(Vn, Mva, Zpc, IkA_sym, ipeak);
}

// ===================== Transformer FLC & Fault Current =====================
function renderTxfmr(container){
  container.innerHTML = `
    <h2>Transformer FLC &amp; Fault Current <span class="std-badge">IEC 60076 / IEC 60909 (simplified)</span></h2>
    <p class="tool-desc">Calculate transformer full-load current (FLC) on primary and secondary windings, and the expected three-phase fault current at the transformer terminals from nameplate MVA, voltage ratio and %impedance. Includes an optional upstream source fault level to combine source and transformer impedance.</p>
    <div class="grid">
      <div class="card">
        <div class="field"><label>Transformer rated power (MVA)</label><input id="tMva" type="number" value="10" step="0.1"></div>
        <div class="row2">
          <div class="field"><label>Primary voltage, line-line (kV)</label><input id="tVp" type="number" value="66" step="0.1"></div>
          <div class="field"><label>Secondary voltage, line-line (kV)</label><input id="tVs" type="number" value="11" step="0.1"></div>
        </div>
        <div class="field"><label>Transformer impedance %Z (nameplate)</label><input id="tZpc" type="number" value="8" step="0.1"></div>
        <div class="field"><label>Voltage factor c (IEC 60909)</label>
          <select id="tC">
            <option value="1.1">c=1.1 (max fault, LV/MV per IEC 60909)</option>
            <option value="1.0">c=1.0 (nominal)</option>
            <option value="0.95">c=0.95 (min fault)</option>
          </select>
        </div>
        <hr style="border-color:var(--border);margin:14px 0;">
        <div class="checkrow"><input type="checkbox" id="tUseSource"><label for="tUseSource" style="margin:0;">Include upstream source fault level (finite source)</label></div>
        <div class="field"><label>Upstream source fault level at primary bus (MVA, 3-phase)</label><input id="tSourceMva" type="number" value="500" step="1"></div>
        <button class="btn" id="tCalcBtn" style="width:100%;">Calculate</button>
      </div>
      <div class="card">
        <h3 style="margin-top:0;font-size:1rem;">Results</h3>
        <div id="tResults" class="results"></div>
        <div class="note">FLC = MVA×10<sup>6</sup> / (√3 × kV×10<sup>3</sup>). Infinite-source fault current at terminals = FLC / (%Z/100). When an upstream source fault level is included, transformer %Z and equivalent source %Z (on transformer base) are combined in series: Z_total% = Z_source% + Z_xfmr%, where Z_source% = (MVA_xfmr / MVA_source) × 100.</div>
      </div>
    </div>
  `;
  ['tMva','tVp','tVs','tZpc','tC','tUseSource','tSourceMva'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcTxfmr);
    document.getElementById(id).addEventListener('change', calcTxfmr);
  });
  document.getElementById('tCalcBtn').onclick = calcTxfmr;
  calcTxfmr();
}

function calcTxfmr(){
  const mva = parseFloat(document.getElementById('tMva').value);
  const vp = parseFloat(document.getElementById('tVp').value);
  const vs = parseFloat(document.getElementById('tVs').value);
  const zpc = parseFloat(document.getElementById('tZpc').value);
  const c = parseFloat(document.getElementById('tC').value);
  const useSource = document.getElementById('tUseSource').checked;
  const sourceMva = parseFloat(document.getElementById('tSourceMva').value);

  const flcPrimary = (mva*1e6) / (Math.sqrt(3)*vp*1e3);
  const flcSecondary = (mva*1e6) / (Math.sqrt(3)*vs*1e3);

  const zSourcePctOnXfmrBase = useSource ? (mva/sourceMva)*100 : 0;
  const zTotalPct = zpc + zSourcePctOnXfmrBase;

  const faultPrimary_infinite = flcPrimary / (zpc/100) * c;
  const faultSecondary_infinite = flcSecondary / (zpc/100) * c;
  const faultSecondary_withSource = flcSecondary / (zTotalPct/100) * c;
  const faultPrimary_withSource = flcPrimary / (zTotalPct/100) * c;

  let sourceRows = '';
  if (useSource){
    sourceRows = `
      <div class="result-line"><span>Equivalent source %Z (on transformer base)</span><b>${zSourcePctOnXfmrBase.toFixed(3)} %</b></div>
      <div class="result-line"><span>Combined %Z (source + transformer)</span><b>${zTotalPct.toFixed(3)} %</b></div>
      <div class="result-flag flag-good">Fault current with finite source, secondary side: ${faultSecondary_withSource.toFixed(1)} A (${(faultSecondary_withSource/1000).toFixed(3)} kA)</div>
      <div class="result-flag flag-good">Fault current with finite source, primary side: ${faultPrimary_withSource.toFixed(1)} A (${(faultPrimary_withSource/1000).toFixed(3)} kA)</div>
    `;
  }

  document.getElementById('tResults').innerHTML = `
    <div class="result-line"><span>Full-load current, primary (${vp} kV)</span><b>${flcPrimary.toFixed(2)} A</b></div>
    <div class="result-line"><span>Full-load current, secondary (${vs} kV)</span><b>${flcSecondary.toFixed(2)} A</b></div>
    <div class="result-line"><span>Turns/current ratio (approx.)</span><b>${(vp/vs).toFixed(3)} : 1</b></div>
    <div class="result-line"><span>Fault current, primary (infinite source)</span><b>${faultPrimary_infinite.toFixed(1)} A (${(faultPrimary_infinite/1000).toFixed(3)} kA)</b></div>
    <div class="result-line"><span>Fault current, secondary (infinite source)</span><b>${faultSecondary_infinite.toFixed(1)} A (${(faultSecondary_infinite/1000).toFixed(3)} kA)</b></div>
    ${sourceRows}
  `;
}

// ===================== Arc Flash Quick Reference =====================
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

// ===================== App Shell =====================
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
    txfmr: renderTxfmr,
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
