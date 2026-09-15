// ===================== Protection Engineering Toolkit v0.6.0 =====================
const TOOL_GROUPS = [
  { label: 'Overcurrent', tools: [ {id:'tcc', label:'TCC Plotter'} ] },
  { label: 'System Analysis', tools: [ {id:'symcomp', label:'Symmetrical Components'}, {id:'fault', label:'Fault Level Calculator'} ] },
  { label: 'Transformers', tools: [ {id:'diff87', label:'Differential (87T)'}, {id:'txfmr', label:'FLC & Fault Current'} ] },
  { label: 'Generator Protection', tools: [ {id:'lof', label:'Loss of Field (40)'} ] },
  { label: 'Line Protection', tools: [ {id:'distprot', label:'Distance Protection (Quad/Mho)'} ] },
  { label: 'CT / Instrument Transformers', tools: [ {id:'ctsat', label:'CT Knee-Point / Saturation'} ] },
  { label: 'Reference', tools: [ {id:'arcflash', label:'Arc Flash Reference'}, {id:'references', label:'Standards Library'} ] },
];
const TOOLS = TOOL_GROUPS.flatMap(g => g.tools);
function safeNum(val, fallback=0){ const n = parseFloat(val); return isNaN(n) ? fallback : n; }
const CURVES = {
  'IEC-SI':{name:'IEC Standard Inverse (SI)',A:0.14,p:0.02,B:0},
  'IEC-VI':{name:'IEC Very Inverse (VI)',A:13.5,p:1.0,B:0},
  'IEC-EI':{name:'IEC Extremely Inverse (EI)',A:80.0,p:2.0,B:0},
  'IEC-LTI':{name:'IEC Long-Time Inverse (LTI)',A:120.0,p:1.0,B:0},
  'IEEE-MI':{name:'IEEE Moderately Inverse',A:0.0515,p:0.02,B:0.114},
  'IEEE-VI':{name:'IEEE Very Inverse',A:19.61,p:2.0,B:0.491},
  'IEEE-EI':{name:'IEEE Extremely Inverse',A:28.2,p:2.0,B:0.1217},
};
function curveTime(curveKey, Ir, TMS){ const c = CURVES[curveKey]; if (Ir <= 1.0001) return null; return TMS * (c.A / (Math.pow(Ir, c.p) - 1) + c.B); }
let tccChart = null;
let activeCurves = [ {key:'IEC-SI', pickup:100, tms:0.1, ctRatio:1, id:cryptoId()} ];
function cryptoId(){ return Math.random().toString(36).slice(2,9); }
function renderTCC(container){
  container.innerHTML = `
    <h2>Time-Current Curve (TCC) Plotter <span class="std-badge">IEC 60255-151 / IEEE C37.112</span></h2>
    <p class="tool-desc">Plot IDMT overcurrent relay curves, adjust pickup current and TMS/TD, and read off operating time at any multiple of pickup to check coordination margins between devices. Each curve can be displayed in secondary (relay) current or referred to the primary system current using its CT ratio.</p>
    <div class="grid">
      <div class="card">
        <div class="field"><label>Plot axis reference</label>
          <select id="tccAxisMode"><option value="secondary">Secondary (relay) current</option><option value="primary">Primary (system) current</option></select>
        </div>
        <div id="curveEditor"></div>
        <button class="btn btn-secondary" id="addCurveBtn" style="margin-top:8px;width:100%;">+ Add curve</button>
        <div class="field" style="margin-top:16px;"><label>Fault current to evaluate (A, in selected axis reference)</label><input type="number" id="evalCurrent" value="1000" step="1" min="0"></div>
        <div class="results" id="evalResults"></div>
        <div class="note">Formula: t = TMS &times; [A / ((I/Is)<sup>p</sup> &minus; 1) + B]. IEC curves use B=0. IEEE curves (C37.112) use the additive B term. The dashed vertical line marks your evaluated fault current and its intersection with every curve.</div>
      </div>
      <div class="chart-wrap"><canvas id="tccCanvas"></canvas></div>
    </div>
  `;
  document.getElementById('addCurveBtn').onclick = () => { activeCurves.push({key:'IEC-VI', pickup:100, tms:0.1, ctRatio:1, id:cryptoId()}); renderCurveEditor(); updateTCCChart(); };
  document.getElementById('evalCurrent').oninput = updateTCCChart;
  document.getElementById('tccAxisMode').onchange = updateTCCChart;
  renderCurveEditor();
  updateTCCChart();
}
function renderCurveEditor(){
  const el = document.getElementById('curveEditor');
  el.innerHTML = activeCurves.map((c,i) => `
    <div class="card" style="background:var(--panel-2);margin-bottom:10px;padding:12px;">
      <div class="row2">
        <div class="field"><label>Curve type</label><select data-id="${c.id}" data-field="key" class="curveField">${Object.entries(CURVES).map(([k,v]) => `<option value="${k}" ${c.key===k?'selected':''}>${v.name}</option>`).join('')}</select></div>
        <div class="field"><label>Pickup Is (A, secondary)</label><input type="number" data-id="${c.id}" data-field="pickup" class="curveField" value="${c.pickup}" step="1" min="0.1"></div>
      </div>
      <div class="row2">
        <div class="field"><label>TMS / TD</label><input type="number" data-id="${c.id}" data-field="tms" class="curveField" value="${c.tms}" step="0.01" min="0.01"></div>
        <div class="field"><label>CT ratio (e.g. 400 for 400/1)</label><input type="number" data-id="${c.id}" data-field="ctRatio" class="curveField" value="${c.ctRatio}" step="1" min="1"></div>
      </div>
      ${activeCurves.length>1 ? `<button class="btn btn-secondary" style="width:100%;" onclick="removeCurve('${c.id}')">Remove curve</button>` : ''}
    </div>
  `).join('');
  document.querySelectorAll('.curveField').forEach(elm => { elm.onchange = (e) => { const id = e.target.dataset.id; const field = e.target.dataset.field; const curve = activeCurves.find(c=>c.id===id); curve[field] = field==='key' ? e.target.value : safeNum(e.target.value, field==='ctRatio'?1:0); updateTCCChart(); }; });
}
function removeCurve(id){ activeCurves = activeCurves.filter(c=>c.id!==id); renderCurveEditor(); updateTCCChart(); }
function updateTCCChart(){
  const ctx = document.getElementById('tccCanvas'); if (!ctx) return;
  const axisMode = document.getElementById('tccAxisMode').value;
  const evalCurrent = safeNum(document.getElementById('evalCurrent').value, 0);
  const colors = ['#4fb0ff','#ffb74f','#4fd88a','#ff6b6b','#c792ea','#ff8fab'];
  const datasets = activeCurves.map((c, idx) => {
    const points = []; const refMultiplier = axisMode==='primary' ? c.ctRatio : 1;
    for (let m = 1.05; m <= 30; m *= 1.03){ const t = curveTime(c.key, m, c.tms); if (t !== null && t < 1000) points.push({x: c.pickup*m*refMultiplier, y: t}); }
    return { label: `${CURVES[c.key].name} (Is=${c.pickup}A sec, CT=${c.ctRatio}/1, TMS=${c.tms})`, data: points, borderColor: colors[idx % colors.length], backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0, parsing: false };
  });
  let minY = 0.01, maxY = 100;
  if (evalCurrent > 0){
    const allTimes = activeCurves.map(c => { const refMultiplier = axisMode==='primary' ? c.ctRatio : 1; const effectivePickup = c.pickup * refMultiplier; const ratio = evalCurrent / effectivePickup; return curveTime(c.key, ratio, c.tms); }).filter(t => t !== null);
    if (allTimes.length){ minY = Math.min(...allTimes) * 0.3; maxY = Math.max(...allTimes) * 3; }
    datasets.push({ label: `Evaluated fault current (${evalCurrent} A)`, data: [{x:evalCurrent, y:minY}, {x:evalCurrent, y:maxY}], borderColor: '#ffffff', borderDash: [6,4], borderWidth: 1.5, pointRadius: 0, parsing: false, fill: false });
    activeCurves.forEach((c, idx) => {
      const refMultiplier = axisMode==='primary' ? c.ctRatio : 1; const effectivePickup = c.pickup * refMultiplier; const ratio = evalCurrent / effectivePickup; const t = curveTime(c.key, ratio, c.tms);
      if (t !== null){ datasets.push({ label: `Intersection: ${CURVES[c.key].name}`, data: [{x:evalCurrent, y:t}], borderColor: colors[idx % colors.length], backgroundColor: colors[idx % colors.length], pointRadius: 6, showLine: false, type: 'scatter', parsing: false }); }
    });
  }
  if (tccChart) tccChart.destroy();
  tccChart = new Chart(ctx, { type:'line', data:{datasets}, options:{ responsive:true, parsing: false, scales:{ x:{type:'logarithmic', title:{display:true,text:axisMode==='primary' ? 'Primary Current (A)' : 'Secondary Current (A)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}}, y:{type:'logarithmic', title:{display:true,text:'Operating Time (s)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}} }, plugins:{ legend:{labels:{color:'#e7ecf7', font:{size:10}}}, tooltip:{mode:'nearest'} } } });
  const evalEl = document.getElementById('evalResults');
  if (evalCurrent > 0){ evalEl.innerHTML = activeCurves.map(c => { const refMultiplier = axisMode==='primary' ? c.ctRatio : 1; const effectivePickup = c.pickup * refMultiplier; const ratio = evalCurrent / effectivePickup; const t = curveTime(c.key, ratio, c.tms); return `<div class="result-line"><span>${CURVES[c.key].name} @ ${evalCurrent}A</span><b>${t!==null ? t.toFixed(3)+' s' : 'below pickup'}</b></div>`; }).join(''); } else { evalEl.innerHTML = ''; }
}
function complexMul(a, b){ return {re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re}; }
function complexAdd(a, b){ return {re: a.re+b.re, im: a.im+b.im}; }
function polarToRect(mag, angDeg){ const r = angDeg*Math.PI/180; return {re: mag*Math.cos(r), im: mag*Math.sin(r)}; }
function rectToPolar(c){ return {mag: Math.sqrt(c.re*c.re+c.im*c.im), ang: Math.atan2(c.im,c.re)*180/Math.PI}; }
const a_op = polarToRect(1,120); const a2_op = polarToRect(1,240);
function renderSymComp(container){
  container.innerHTML = `
    <h2>Symmetrical Components Calculator <span class="std-badge">Fortescue / IEC 60909</span></h2>
    <p class="tool-desc">Convert unbalanced three-phase phasors (Ia, Ib, Ic or Va, Vb, Vc) to positive, negative and zero sequence components, or vice versa. The "Before" diagram shows your input quantities; "After" shows the calculated result.</p>
    <div class="grid">
      <div class="card"><div class="field"><label>Conversion direction</label><select id="symDir"><option value="p2s">Phase → Sequence</option><option value="s2p">Sequence → Phase</option></select></div><div id="symInputs"></div><div class="results" id="symResults"></div></div>
      <div class="card"><h3 style="margin-top:0;font-size:0.95rem;color:var(--text-dim);">Before (input)</h3><canvas id="symBeforeCanvas" width="380" height="380" style="max-width:100%;"></canvas><h3 style="font-size:0.95rem;color:var(--text-dim);margin-top:16px;">After (result)</h3><canvas id="symAfterCanvas" width="380" height="380" style="max-width:100%;"></canvas></div>
    </div>
  `;
  document.getElementById('symDir').onchange = renderSymInputs;
  renderSymInputs();
}
function renderSymInputs(){
  const dir = document.getElementById('symDir').value; const el = document.getElementById('symInputs');
  if (dir === 'p2s'){ el.innerHTML = `<div class="field"><label>Phase A: magnitude / angle (deg)</label><div class="row2"><input id="s1m" type="number" value="100"><input id="s1a" type="number" value="0"></div></div><div class="field"><label>Phase B: magnitude / angle (deg)</label><div class="row2"><input id="s2m" type="number" value="100"><input id="s2a" type="number" value="-120"></div></div><div class="field"><label>Phase C: magnitude / angle (deg)</label><div class="row2"><input id="s3m" type="number" value="100"><input id="s3a" type="number" value="120"></div></div>`; }
  else { el.innerHTML = `<div class="field"><label>Zero seq: magnitude / angle (deg)</label><div class="row2"><input id="s1m" type="number" value="0"><input id="s1a" type="number" value="0"></div></div><div class="field"><label>Positive seq: magnitude / angle (deg)</label><div class="row2"><input id="s2m" type="number" value="100"><input id="s2a" type="number" value="0"></div></div><div class="field"><label>Negative seq: magnitude / angle (deg)</label><div class="row2"><input id="s3m" type="number" value="0"><input id="s3a" type="number" value="0"></div></div>`; }
  ['s1m','s1a','s2m','s2a','s3m','s3a'].forEach(id => { document.getElementById(id).oninput = calcSymComp; });
  calcSymComp();
}
function drawPhasorDiagram(canvasId, phasors){
  const canvas = document.getElementById(canvasId); if (!canvas) return; const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height; const cx = w/2, cy = h/2; const maxMag = Math.max(1, ...phasors.map(p => p.mag)); const scale = (Math.min(w,h)/2 - 40) / maxMag;
  ctx.clearRect(0,0,w,h); ctx.strokeStyle = '#2a3654'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0,cy); ctx.lineTo(w,cy); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx,h); ctx.stroke();
  for (let r = maxMag/4; r <= maxMag; r += maxMag/4){ ctx.beginPath(); ctx.arc(cx, cy, r*scale, 0, 2*Math.PI); ctx.strokeStyle = 'rgba(159,176,207,0.15)'; ctx.stroke(); }
  phasors.forEach(p => {
    const rad = -p.ang * Math.PI/180; const x = cx + p.mag*scale*Math.cos(rad); const y = cy + p.mag*scale*Math.sin(rad); ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y); ctx.stroke();
    const headLen = 9; const angle = Math.atan2(y-cy, x-cx); ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x - headLen*Math.cos(angle-Math.PI/6), y - headLen*Math.sin(angle-Math.PI/6)); ctx.lineTo(x - headLen*Math.cos(angle+Math.PI/6), y - headLen*Math.sin(angle+Math.PI/6)); ctx.closePath(); ctx.fillStyle = p.color; ctx.fill();
    ctx.fillStyle = p.color; ctx.font = '12px Segoe UI'; ctx.fillText(p.label, x + (x>cx?6:-24), y + (y>cy?14:-6));
  });
}
function calcSymComp(){
  const dir = document.getElementById('symDir').value;
  const m1 = safeNum(document.getElementById('s1m').value), a1 = safeNum(document.getElementById('s1a').value); const m2 = safeNum(document.getElementById('s2m').value), a2 = safeNum(document.getElementById('s2a').value); const m3 = safeNum(document.getElementById('s3m').value), a3 = safeNum(document.getElementById('s3a').value);
  const v1 = polarToRect(m1,a1), v2 = polarToRect(m2,a2), v3 = polarToRect(m3,a3); const resEl = document.getElementById('symResults');
  if (dir === 'p2s'){
    const i0 = {re:(v1.re+v2.re+v3.re)/3, im:(v1.im+v2.im+v3.im)/3};
    const i1terms = complexAdd(v1, complexAdd(complexMul(a_op,v2), complexMul(a2_op,v3))); const i1 = {re:i1terms.re/3, im:i1terms.im/3};
    const i2terms = complexAdd(v1, complexAdd(complexMul(a2_op,v2), complexMul(a_op,v3))); const i2 = {re:i2terms.re/3, im:i2terms.im/3};
    const p0=rectToPolar(i0), p1=rectToPolar(i1), p2=rectToPolar(i2);
    resEl.innerHTML = `<div class="result-line"><span>Zero sequence (I0 / V0)</span><b>${p0.mag.toFixed(3)} ∠ ${p0.ang.toFixed(2)}°</b></div><div class="result-line"><span>Positive sequence (I1 / V1)</span><b>${p1.mag.toFixed(3)} ∠ ${p1.ang.toFixed(2)}°</b></div><div class="result-line"><span>Negative sequence (I2 / V2)</span><b>${p2.mag.toFixed(3)} ∠ ${p2.ang.toFixed(2)}°</b></div><div class="note">Unbalance factor (I2/I1): ${(p1.mag>0 ? (p2.mag/p1.mag*100).toFixed(2) : '0.00')}%</div>`;
    drawPhasorDiagram('symBeforeCanvas', [ {mag:m1, ang:a1, color:'#4fb0ff', label:'A'}, {mag:m2, ang:a2, color:'#ffb74f', label:'B'}, {mag:m3, ang:a3, color:'#4fd88a', label:'C'} ]);
    drawPhasorDiagram('symAfterCanvas', [ {mag:p0.mag, ang:p0.ang, color:'#9fb0cf', label:'I0'}, {mag:p1.mag, ang:p1.ang, color:'#ff6b6b', label:'I1'}, {mag:p2.mag, ang:p2.ang, color:'#c792ea', label:'I2'} ]);
  } else {
    const ia = complexAdd(v1, complexAdd(v2, v3)); const ib = complexAdd(v1, complexAdd(complexMul(a2_op,v2), complexMul(a_op,v3))); const ic = complexAdd(v1, complexAdd(complexMul(a_op,v2), complexMul(a2_op,v3)));
    const pa=rectToPolar(ia), pb=rectToPolar(ib), pc=rectToPolar(ic);
    resEl.innerHTML = `<div class="result-line"><span>Phase A</span><b>${pa.mag.toFixed(3)} ∠ ${pa.ang.toFixed(2)}°</b></div><div class="result-line"><span>Phase B</span><b>${pb.mag.toFixed(3)} ∠ ${pb.ang.toFixed(2)}°</b></div><div class="result-line"><span>Phase C</span><b>${pc.mag.toFixed(3)} ∠ ${pc.ang.toFixed(2)}°</b></div>`;
    drawPhasorDiagram('symBeforeCanvas', [ {mag:m1, ang:a1, color:'#9fb0cf', label:'I0'}, {mag:m2, ang:a2, color:'#ff6b6b', label:'I1'}, {mag:m3, ang:a3, color:'#c792ea', label:'I2'} ]);
    drawPhasorDiagram('symAfterCanvas', [ {mag:pa.mag, ang:pa.ang, color:'#4fb0ff', label:'A'}, {mag:pb.mag, ang:pb.ang, color:'#ffb74f', label:'B'}, {mag:pc.mag, ang:pc.ang, color:'#4fd88a', label:'C'} ]);
  }
}
let ctChart = null;
function renderCTSat(container){
  container.innerHTML = `
    <h2>CT Knee-Point &amp; Saturation Calculator <span class="std-badge">IEC 61869-2 / AS/NZS 61869</span></h2>
    <p class="tool-desc">Estimate required CT knee-point voltage for protection-class current transformers and check against a nameplate value.</p>
    <div class="grid">
      <div class="card">
        <div class="field"><label>CT ratio (primary : secondary A)</label><div class="row2"><input id="ctPrim" type="number" value="1000"><input id="ctSec" type="number" value="1"></div></div>
        <div class="field"><label>Maximum through-fault current, primary (A)</label><input id="ctIf" type="number" value="20000"></div>
        <div class="field"><label>CT secondary winding resistance R_CT (Ω)</label><input id="ctRct" type="number" value="2.5" step="0.01"></div>
        <div class="field"><label>Total lead (loop) resistance R_L (Ω)</label><input id="ctRl" type="number" value="0.8" step="0.01"></div>
        <div class="field"><label>Relay burden resistance R_relay (Ω)</label><input id="ctRr" type="number" value="0.1" step="0.01"></div>
        <div class="field"><label>Dimensioning / safety factor K</label><select id="ctK"><option value="1">1.0 (no margin)</option><option value="1.5">1.5 (moderate DC offset margin)</option><option value="2" selected>2.0 (typical differential / REF)</option></select></div>
        <div class="field"><label>Nameplate knee-point voltage Vk (V) — optional</label><input id="ctVkActual" type="number" placeholder="e.g. 150"></div>
      </div>
      <div class="chart-wrap"><canvas id="ctCanvas"></canvas><div id="ctResults" class="results"></div><div class="diagram-note">V_k ≥ K × (I_fault,sec) × (R_CT + R_L + R_relay). Chart shows an idealised excitation curve — not a manufacturer-tested characteristic.</div></div>
    </div>
  `;
  ['ctPrim','ctSec','ctIf','ctRct','ctRl','ctRr','ctK','ctVkActual'].forEach(id => { document.getElementById(id).addEventListener('input', calcCTSat); document.getElementById(id).addEventListener('change', calcCTSat); });
  calcCTSat();
}
function calcCTSat(){
  const prim = safeNum(document.getElementById('ctPrim').value, 1); const sec = safeNum(document.getElementById('ctSec').value, 1); const If = safeNum(document.getElementById('ctIf').value); const Rct = safeNum(document.getElementById('ctRct').value); const Rl = safeNum(document.getElementById('ctRl').value); const Rr = safeNum(document.getElementById('ctRr').value); const K = safeNum(document.getElementById('ctK').value, 2);
  const vkActualRaw = document.getElementById('ctVkActual').value; const vkActual = vkActualRaw === '' ? NaN : safeNum(vkActualRaw);
  const ratio = prim/sec; const IfSec = If/ratio; const Vk_required = K * IfSec * (Rct + Rl + Rr); const resEl = document.getElementById('ctResults');
  let flagHtml = '';
  if (!isNaN(vkActual)){ if (vkActual >= Vk_required){ flagHtml = `<div class="result-flag flag-good">✓ Nameplate Vk (${vkActual} V) meets or exceeds required Vk (${Vk_required.toFixed(1)} V)</div>`; } else { flagHtml = `<div class="result-flag flag-warn">⚠ Nameplate Vk (${vkActual} V) is below required Vk (${Vk_required.toFixed(1)} V)</div>`; } }
  resEl.innerHTML = `<div class="result-line"><span>CT ratio</span><b>${ratio.toFixed(1)} : 1</b></div><div class="result-line"><span>Fault current referred to secondary</span><b>${IfSec.toFixed(2)} A</b></div><div class="result-line"><span>Total secondary burden</span><b>${(Rct+Rl+Rr).toFixed(2)} Ω</b></div><div class="result-line"><span>Required knee-point voltage V_k</span><b>${Vk_required.toFixed(1)} V</b></div>${flagHtml}`;
  const vkPlot = !isNaN(vkActual) ? vkActual : Vk_required; const knee_I = vkPlot / (Rct + Rl + Rr) * 0.5;
  const linPoints = []; for (let i=0; i<=knee_I; i+=knee_I/20){ linPoints.push({x:i, y: (vkPlot/knee_I)*i}); }
  const satPoints = []; const maxI = knee_I*8; for (let i=knee_I; i<=maxI; i+=(maxI-knee_I)/30){ const y = vkPlot + (vkPlot*0.15) * Math.log(1 + (i-knee_I)/(knee_I*0.5)); satPoints.push({x:i, y}); }
  const ctx = document.getElementById('ctCanvas'); if (ctChart) ctChart.destroy();
  ctChart = new Chart(ctx, { type:'line', data:{ datasets:[ {label:'Excitation curve (indicative)', data:[...linPoints, ...satPoints], borderColor:'#4fb0ff', backgroundColor:'transparent', borderWidth:2, pointRadius:0, parsing:false}, {label:'Knee point', data:[{x:knee_I, y:vkPlot}], borderColor:'#ffb74f', backgroundColor:'#ffb74f', pointRadius:7, showLine:false, type:'scatter', parsing:false}, {label:'Operating fault point', data:[{x:IfSec, y: IfSec*(Rct+Rl+Rr)}], borderColor:'#ff6b6b', backgroundColor:'#ff6b6b', pointRadius:7, showLine:false, type:'scatter', parsing:false} ] }, options:{ responsive:true, parsing:false, scales:{ x:{title:{display:true,text:'Exciting Current (A)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}}, y:{title:{display:true,text:'Secondary Voltage (V)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}} }, plugins:{legend:{labels:{color:'#e7ecf7'}}} } });
}
let diffChart = null;
function renderDiff87(container){
  container.innerHTML = `
    <h2>Transformer Differential (87T) Plotter <span class="std-badge">Dual-Slope Percentage Restraint</span></h2>
    <p class="tool-desc">Visualise a dual-slope percentage-restraint differential characteristic. Enter a measured operating point to check if it falls in the trip or restraint region.</p>
    <div class="grid">
      <div class="card">
        <div class="field"><label>Minimum pickup (Id_min, pu)</label><input id="dPickup" type="number" value="0.3" step="0.01"></div>
        <div class="field"><label>Slope 1 (%)</label><input id="dSlope1" type="number" value="25" step="1"></div>
        <div class="field"><label>Breakpoint 1 (Ir, pu)</label><input id="dBp1" type="number" value="2.5" step="0.1"></div>
        <div class="field"><label>Slope 2 (%)</label><input id="dSlope2" type="number" value="60" step="1"></div>
        <div class="field"><label>Max restraint shown (Ir, pu)</label><input id="dMaxIr" type="number" value="10" step="0.5"></div>
        <hr style="border-color:var(--border);margin:14px 0;">
        <div class="field"><label>Measured restraint current Ir (pu)</label><input id="dTestIr" type="number" value="4" step="0.1"></div>
        <div class="field"><label>Measured differential current Id (pu)</label><input id="dTestId" type="number" value="1.5" step="0.1"></div>
        <div class="results" id="dResults"></div>
      </div>
      <div class="chart-wrap"><canvas id="diffCanvas"></canvas></div>
    </div>
  `;
  ['dPickup','dSlope1','dBp1','dSlope2','dMaxIr','dTestIr','dTestId'].forEach(id => { document.getElementById(id).oninput = updateDiffChart; });
  updateDiffChart();
}
function diffCharacteristic(ir, pickup, s1, bp1, s2){ if (ir <= bp1) return Math.max(pickup, s1/100*ir); const idAtBp1 = Math.max(pickup, s1/100*bp1); return idAtBp1 + (s2/100)*(ir-bp1); }
function updateDiffChart(){
  const pickup = safeNum(document.getElementById('dPickup').value, 0.3); const s1 = safeNum(document.getElementById('dSlope1').value, 25); const bp1 = safeNum(document.getElementById('dBp1').value, 2.5); const s2 = safeNum(document.getElementById('dSlope2').value, 60); const maxIr = safeNum(document.getElementById('dMaxIr').value, 10); const testIr = safeNum(document.getElementById('dTestIr').value); const testId = safeNum(document.getElementById('dTestId').value);
  const points = []; const steps = 200; for (let i=0; i<=steps; i++){ const ir = (maxIr/steps)*i; points.push({x:ir, y:diffCharacteristic(ir,pickup,s1,bp1,s2)}); }
  const thresholdAtTest = diffCharacteristic(testIr,pickup,s1,bp1,s2); const willOperate = testId > thresholdAtTest;
  const ctx = document.getElementById('diffCanvas'); if (diffChart) diffChart.destroy();
  diffChart = new Chart(ctx, { type:'line', data:{ datasets:[ {label:'Operate boundary', data:points, borderColor:'#4fb0ff', backgroundColor:'rgba(79,176,255,0.08)', fill:true, pointRadius:0, borderWidth:2, parsing:false}, {label:'Measured operating point', data:[{x:testIr,y:testId}], borderColor: willOperate?'#ff6b6b':'#4fd88a', backgroundColor: willOperate?'#ff6b6b':'#4fd88a', pointRadius:7, showLine:false, type:'scatter', parsing:false} ] }, options:{ responsive:true, parsing:false, scales:{ x:{type:'linear', min:0, max:maxIr, title:{display:true,text:'Restraint Current Ir (pu)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}}, y:{type:'linear', min:0, title:{display:true,text:'Differential Current Id (pu)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}} }, plugins:{legend:{labels:{color:'#e7ecf7'}}} } });
  document.getElementById('dResults').innerHTML = `<div class="result-line"><span>Operate threshold at measured Ir=${testIr}</span><b>${thresholdAtTest.toFixed(3)} pu</b></div><div class="result-flag ${willOperate?'flag-warn':'flag-good'}">${willOperate ? '⚡ Measured point is ABOVE characteristic — relay would OPERATE' : '✓ Measured point is below characteristic — relay RESTRAINED'}</div>`;
}
let currentFaultType = '3ph';
function renderFault(container){
  container.innerHTML = `
    <h2>Fault Level Calculator <span class="std-badge">IEC 60909 (simplified)</span></h2>
    <p class="tool-desc">Quick fault level estimate from system voltage and source/transformer impedance. Select a fault type to see the approximate current for that condition.</p>
    <div class="grid">
      <div class="card">
        <label style="display:block;font-size:0.78rem;color:var(--text-dim);margin-bottom:8px;">Fault type</label>
        <div class="fault-type-grid"><button class="fault-type-btn active" data-type="3ph">3-Phase</button><button class="fault-type-btn" data-type="2ph">Phase-Phase</button><button class="fault-type-btn" data-type="1ph">Single Phase-Earth</button><button class="fault-type-btn" data-type="2phe">Phase-Phase-Earth</button></div>
        <div class="field"><label>Nominal system voltage, line-line (kV)</label><input id="fVn" type="number" value="11" step="0.1"></div>
        <div class="field"><label>Source / transformer impedance to fault (%Z, positive-seq)</label><input id="fZpc" type="number" value="6" step="0.1"></div>
        <div class="field"><label>Transformer / source rated MVA</label><input id="fMva" type="number" value="10" step="0.1"></div>
        <div class="field"><label>Zero-sequence impedance ratio Z0/Z1 (for earth faults)</label><input id="fZ0Ratio" type="number" value="1.5" step="0.1"></div>
        <div class="field"><label>Voltage factor c (IEC 60909)</label><select id="fC"><option value="1.1">c=1.1 (max fault, LV/MV)</option><option value="1.0">c=1.0 (nominal)</option><option value="0.95">c=0.95 (min fault)</option></select></div>
        <div class="field"><label>X/R ratio (for asymmetry factor)</label><input id="fXr" type="number" value="15" step="0.1"></div>
      </div>
      <div class="card"><canvas id="sldCanvas" width="560" height="360" style="max-width:100%;"></canvas><div id="fResults" class="results"></div></div>
    </div>
    <div class="card" style="margin-top:16px;"><p class="note" style="margin:0;">I''k formulas (IEC 60909, simplified): 3-phase = c·Vn/(√3·Z1). Phase-phase = c·Vn/(2·Z1). Single phase-earth = √3·c·Vn/(2·Z1+Z0). Phase-phase-earth uses combined parallel sequence networks. Base impedance Zbase = Vn²/MVA; peak asymmetry factor κ ≈ 1.02 + 0.98·e<sup>(-3·R/X)</sup>. Diagram is a simplified single-source SLD for visualisation only — verify against a full network fault study for protection grading &amp; equipment rating (AS/NZS 3000, AS 62271).</p></div>
  `;
  document.querySelectorAll('.fault-type-btn').forEach(btn => { btn.onclick = () => { document.querySelectorAll('.fault-type-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); currentFaultType = btn.dataset.type; calcFault(); }; });
  ['fVn','fZpc','fMva','fZ0Ratio','fC','fXr'].forEach(id => { document.getElementById(id).oninput = calcFault; });
  calcFault();
}
function drawSLD(vn, mva, zpc, ikA, ipeak, faultLabel){
  const canvas = document.getElementById('sldCanvas'); if (!canvas) return; const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = '#9fb0cf'; ctx.fillStyle = '#e7ecf7'; ctx.font = '13px Segoe UI'; ctx.lineWidth = 2;
  const busY = 60; const srcX = 100, srcTopY = 20;
  ctx.beginPath(); ctx.arc(srcX, srcTopY, 16, 0, 2*Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(srcX-8, srcTopY); ctx.bezierCurveTo(srcX-8,srcTopY-8, srcX,srcTopY-8, srcX,srcTopY); ctx.bezierCurveTo(srcX,srcTopY+8, srcX+8,srcTopY+8, srcX+8,srcTopY); ctx.stroke();
  ctx.fillText('Source', srcX-24, srcTopY-24);
  ctx.beginPath(); ctx.moveTo(srcX, srcTopY+16); ctx.lineTo(srcX, busY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(60, busY); ctx.lineTo(w-60, busY); ctx.lineWidth = 4; ctx.strokeStyle = '#4fb0ff'; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#9fb0cf'; ctx.fillStyle = '#4fb0ff'; ctx.font = 'bold 13px Segoe UI'; ctx.fillText(`Bus (${vn} kV)`, 60, busY-12);
  const txX = w/2; ctx.strokeStyle = '#9fb0cf'; ctx.fillStyle = '#e7ecf7'; ctx.font = '13px Segoe UI'; ctx.beginPath(); ctx.moveTo(txX, busY); ctx.lineTo(txX, busY+40); ctx.stroke();
  ctx.beginPath(); ctx.arc(txX-10, busY+55, 16, 0, 2*Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(txX+10, busY+55, 16, 0, 2*Math.PI); ctx.stroke(); ctx.fillText(`T1: ${mva} MVA, ${zpc}%Z`, txX+24, busY+58);
  ctx.beginPath(); ctx.moveTo(txX, busY+71); ctx.lineTo(txX, busY+130); ctx.stroke();
  const faultY = busY+130; ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3; const boltSize = 18;
  ctx.beginPath(); ctx.moveTo(txX-boltSize, faultY-boltSize); ctx.lineTo(txX+4, faultY-4); ctx.lineTo(txX-4, faultY+4); ctx.lineTo(txX+boltSize, faultY+boltSize); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(txX, faultY+4); ctx.lineTo(txX, faultY+50); ctx.strokeStyle = '#9fb0cf'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(txX-15, faultY+50); ctx.lineTo(txX+15, faultY+50); ctx.moveTo(txX-10, faultY+58); ctx.lineTo(txX+10, faultY+58); ctx.moveTo(txX-5, faultY+66); ctx.lineTo(txX+5, faultY+66); ctx.stroke();
  const boxY = faultY + 90; ctx.fillStyle = 'rgba(255,107,107,0.1)'; ctx.fillRect(30, boxY, w-60, 70); ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 1; ctx.strokeRect(30, boxY, w-60, 70);
  ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 14px Segoe UI'; ctx.fillText(faultLabel, 44, boxY+22); ctx.font = 'bold 16px Segoe UI'; ctx.fillText(`I''k = ${ikA.toFixed(2)} kA`, 44, boxY+42); ctx.font = '13px Segoe UI'; ctx.fillStyle = '#9fb0cf'; ctx.fillText(`ip = ${ipeak.toFixed(2)} kA`, 44, boxY+60);
}
const FAULT_LABELS = { '3ph': '3-PHASE FAULT', '2ph': 'PHASE-PHASE FAULT', '1ph': 'SINGLE PHASE-EARTH FAULT', '2phe': 'PHASE-PHASE-EARTH FAULT' };
function calcFault(){
  const Vn = safeNum(document.getElementById('fVn').value, 11); const Zpc = safeNum(document.getElementById('fZpc').value, 6); const Mva = safeNum(document.getElementById('fMva').value, 10); const Z0Ratio = safeNum(document.getElementById('fZ0Ratio').value, 1.5); const c = safeNum(document.getElementById('fC').value, 1.1); const xr = safeNum(document.getElementById('fXr').value, 15);
  const Zbase = (Vn*Vn)/Mva; const Z1 = (Zpc/100)*Zbase; const Z0 = Z1 * Z0Ratio; const Z2 = Z1;
  let IkA;
  if (currentFaultType === '3ph'){ IkA = (c*Vn*1000) / (Math.sqrt(3)*Z1) / 1000; }
  else if (currentFaultType === '2ph'){ IkA = (c*Vn*1000) / (2*Z1) / 1000; }
  else if (currentFaultType === '1ph'){ IkA = (Math.sqrt(3)*c*Vn*1000) / (2*Z1+Z0) / 1000; }
  else { const Ea = c*Vn*1000/Math.sqrt(3); const I1 = Ea / (Z1 + (Z2*Z0)/(Z2+Z0)); const I2 = -I1 * Z0/(Z2+Z0); const I0 = -I1 * Z2/(Z2+Z0); const aOp = polarToRect(1,120); const a2Op = polarToRect(1,240); const Ib = complexAdd({re:I0,im:0}, complexAdd(complexMul(a2Op,{re:I1,im:0}), complexMul(aOp,{re:I2,im:0}))); IkA = rectToPolar(Ib).mag / 1000; }
  const IkA_base = Mva/(Math.sqrt(3)*Vn); const kappa = 1.02 + 0.98*Math.exp(-3/xr); const ipeak = kappa * Math.sqrt(2) * IkA;
  document.getElementById('fResults').innerHTML = `<div class="result-line"><span>Base impedance (Zbase)</span><b>${Zbase.toFixed(4)} Ω</b></div><div class="result-line"><span>Positive-seq impedance Z1</span><b>${Z1.toFixed(4)} Ω</b></div><div class="result-line"><span>Zero-seq impedance Z0</span><b>${Z0.toFixed(4)} Ω</b></div><div class="result-line"><span>Rated full-load current</span><b>${IkA_base.toFixed(3)} kA</b></div><div class="result-line"><span>Fault current I''k (${FAULT_LABELS[currentFaultType]})</span><b>${IkA.toFixed(3)} kA</b></div><div class="result-line"><span>Asymmetry factor κ</span><b>${kappa.toFixed(3)}</b></div><div class="result-line"><span>Peak fault current ip</span><b>${ipeak.toFixed(3)} kA</b></div>`;
  drawSLD(Vn, Mva, Zpc, IkA, ipeak, FAULT_LABELS[currentFaultType]);
}
function renderTxfmr(container){
  container.innerHTML = `
    <h2>Transformer FLC &amp; Fault Current <span class="std-badge">IEC 60076 / IEC 60909 (simplified)</span></h2>
    <p class="tool-desc">Full-load current and expected fault current from transformer nameplate data.</p>
    <div class="grid">
      <div class="card">
        <div class="compact-form">
          <div class="field"><label>Rated power (MVA)</label><input id="tMva" type="number" value="10" step="0.1"></div>
          <div class="field"><label>Impedance %Z</label><input id="tZpc" type="number" value="8" step="0.1"></div>
          <div class="field"><label>Primary kV</label><input id="tVp" type="number" value="66" step="0.1"></div>
          <div class="field"><label>Secondary kV</label><input id="tVs" type="number" value="11" step="0.1"></div>
        </div>
      </div>
      <div class="card"><table class="ref-table" id="tResultsTable"></table></div>
    </div>
    <div class="card" style="margin-top:16px;"><p class="note" style="margin:0;">FLC = MVA×10<sup>6</sup> / (√3×kV×10<sup>3</sup>). Fault current = FLC / (%Z/100).</p></div>
  `;
  ['tMva','tVp','tVs','tZpc'].forEach(id => { document.getElementById(id).addEventListener('input', calcTxfmr); document.getElementById(id).addEventListener('change', calcTxfmr); });
  calcTxfmr();
}
function calcTxfmr(){
  const mva = safeNum(document.getElementById('tMva').value, 10); const vp = safeNum(document.getElementById('tVp').value, 66); const vs = safeNum(document.getElementById('tVs').value, 11); const zpc = safeNum(document.getElementById('tZpc').value, 8);
  const flcPrimary = (mva*1e6) / (Math.sqrt(3)*vp*1e3); const flcSecondary = (mva*1e6) / (Math.sqrt(3)*vs*1e3);
  const faultPrimary = flcPrimary / (zpc/100); const faultSecondary = flcSecondary / (zpc/100);
  let rows = `<thead><tr><th>Quantity</th><th>Primary (${vp} kV)</th><th>Secondary (${vs} kV)</th></tr></thead><tbody><tr><td>Full-load current</td><td>${flcPrimary.toFixed(1)} A</td><td>${flcSecondary.toFixed(1)} A</td></tr><tr><td>Fault current</td><td>${faultPrimary.toFixed(0)} A (${(faultPrimary/1000).toFixed(2)} kA)</td><td>${faultSecondary.toFixed(0)} A (${(faultSecondary/1000).toFixed(2)} kA)</td></tr>`;
  rows += `</tbody>`; document.getElementById('tResultsTable').innerHTML = rows;
}

// ===================== Loss of Field (40) Mho Setting Calculator =====================
let lofChart = null;
function renderLossOfField(container){
  container.innerHTML = `
    <h2>Loss of Field (40) Mho Setting Calculator <span class="std-badge">Dual Mho, R-X Plane</span></h2>
    <p class="tool-desc">Calculate dual-zone offset mho loss-of-field settings from generator nameplate data, and visualise the characteristic on the R-X impedance plane. Zone 1 (fast) is sized on transient reactance Xd'; Zone 2 (slow, all LOF conditions) is sized on synchronous reactance Xd.</p>
    <div class="grid">
      <div class="card">
        <div class="compact-form">
          <div class="field"><label>Voltage, line-line (kV)</label><input id="lofV" type="number" value="20" step="0.1"></div>
          <div class="field"><label>Rated power (MVA)</label><input id="lofMva" type="number" value="492" step="0.1"></div>
          <div class="field"><label>PT ratio</label><input id="lofPT" type="number" value="167" step="1"></div>
          <div class="field"><label>CT ratio</label><input id="lofCT" type="number" value="3600" step="1"></div>
          <div class="field"><label>Xd (pu, synchronous reactance)</label><input id="lofXd" type="number" value="1.1888" step="0.001"></div>
          <div class="field"><label>Xd' (pu, transient reactance)</label><input id="lofXdp" type="number" value="0.20577" step="0.001"></div>
        </div>
        <hr style="border-color:var(--border);margin:14px 0;">
        <div class="field"><label>Zone 1 trip time (s)</label><input id="lofZ1t" type="number" value="0.1" step="0.01"></div>
        <div class="field"><label>Zone 2 trip time (s)</label><input id="lofZ2t" type="number" value="0.5" step="0.01"></div>
        <div class="results" id="lofResults"></div>
      </div>
      <div class="chart-wrap"><canvas id="lofCanvas"></canvas></div>
    </div>
    <div class="card" style="margin-top:16px;">
      <p class="note" style="margin:0;">ZB = (V²/MVA) × (CT/PT). VNOM = V×1000/PT. INOM = (MVA×10<sup>6</sup>)/(√3×V×1000)/CT. Zone 1 diameter = ZB/(√3×Xd'), offset = &minus;Xd×ZB/2. Zone 2 diameter = Xd×ZB, offset = same as Zone 1. Both circles are centred on the negative reactance axis (offset mho into ‑jX), per standard generator loss-of-field protection practice. Verify against relay-specific setting conventions (e.g. SEL, GE) before commissioning.</p>
    </div>
  `;
  ['lofV','lofMva','lofPT','lofCT','lofXd','lofXdp','lofZ1t','lofZ2t'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcLossOfField);
  });
  calcLossOfField();
}
function drawMhoCircles(zones){
  const canvas = document.getElementById('lofCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const datasets = zones.map(z => {
    const points = [];
    for (let a = 0; a <= 360; a += 2){
      const rad = a * Math.PI/180;
      const x = z.centerR + z.radius*Math.cos(rad);
      const y = z.centerX + z.radius*Math.sin(rad);
      points.push({x, y});
    }
    return {
      label: z.label,
      data: points,
      borderColor: z.color,
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      showLine: true,
      fill: false,
      parsing: false,
    };
  });
  if (lofChart) lofChart.destroy();
  lofChart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      parsing: false,
      aspectRatio: 1,
      scales: {
        x: { type:'linear', title:{display:true,text:'R (Ω secondary)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'} },
        y: { type:'linear', title:{display:true,text:'X (Ω secondary)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'} },
      },
      plugins: { legend: { labels: { color: '#e7ecf7' } } }
    }
  });
}
function calcLossOfField(){
  const V = safeNum(document.getElementById('lofV').value, 20);
  const MVA = safeNum(document.getElementById('lofMva').value, 492);
  const PT = safeNum(document.getElementById('lofPT').value, 167);
  const CT = safeNum(document.getElementById('lofCT').value, 3600);
  const Xd = safeNum(document.getElementById('lofXd').value, 1.1888);
  const Xdp = safeNum(document.getElementById('lofXdp').value, 0.20577);
  const Z1t = safeNum(document.getElementById('lofZ1t').value, 0.1);
  const Z2t = safeNum(document.getElementById('lofZ2t').value, 0.5);
  const ZB = (V*V/MVA)*(CT/PT);
  const VNOM = V*1000/PT;
  const INOM = (MVA*1e6)/(Math.sqrt(3)*V*1000)/CT;
  const Z1_diameter = ZB/(Math.sqrt(3)*Xdp);
  const Z1_offset = -Xd*ZB/2;
  const Z2_diameter = Xd*ZB;
  const Z2_offset = Z1_offset;
  const Z1_radius = Z1_diameter/2;
  const Z2_radius = Z2_diameter/2;
  const Z1_centerX = Z1_offset - Z1_radius;
  const Z2_centerX = Z2_offset - Z2_radius;
  document.getElementById('lofResults').innerHTML = `
    <div class="result-line"><span>Base impedance ZB</span><b>${ZB.toFixed(3)} Ω</b></div>
    <div class="result-line"><span>VNOM (secondary)</span><b>${VNOM.toFixed(2)} V</b></div>
    <div class="result-line"><span>INOM (secondary)</span><b>${INOM.toFixed(3)} A</b></div>
    <div class="result-line"><span>Zone 1 diameter</span><b>${Z1_diameter.toFixed(2)} Ω</b></div>
    <div class="result-line"><span>Zone 1 offset</span><b>${Z1_offset.toFixed(2)} Ω</b></div>
    <div class="result-line"><span>Zone 1 trip time</span><b>${Z1t} s</b></div>
    <div class="result-line"><span>Zone 2 diameter</span><b>${Z2_diameter.toFixed(2)} Ω</b></div>
    <div class="result-line"><span>Zone 2 offset</span><b>${Z2_offset.toFixed(2)} Ω</b></div>
    <div class="result-line"><span>Zone 2 trip time</span><b>${Z2t} s</b></div>
  `;
  drawMhoCircles([
    {label:`Zone 2 (Xd, ${Z2t}s)`, centerR:0, centerX:Z2_centerX, radius:Z2_radius, color:'#ffb74f'},
    {label:`Zone 1 (Xd', ${Z1t}s)`, centerR:0, centerX:Z1_centerX, radius:Z1_radius, color:'#4fb0ff'},
  ]);
}

// ===================== Distance Protection (Quad / Mho) Calculator =====================
let distChart = null;
function renderDistProt(container){
  container.innerHTML = `
    <h2>Distance Protection Zone Plotter <span class="std-badge">ABB Quadrilateral / Mho, R-X Plane</span></h2>
    <p class="tool-desc">Plot a distance protection zone characteristic (quadrilateral or mho) on the R-X impedance plane from relay reach settings, based on ABB REx630/REL670-style parameters (reach, directional load blinders, tilt angle). Supports Ph-Ph and Ph-E loops.</p>
    <div class="grid">
      <div class="card">
        <label style="display:block;font-size:0.78rem;color:var(--text-dim);margin-bottom:8px;">Characteristic</label>
        <div class="fault-type-grid"><button class="dp-type-btn active" data-type="quad">Quadrilateral</button><button class="dp-type-btn" data-type="mho">Mho (circular)</button></div>
        <label style="display:block;font-size:0.78rem;color:var(--text-dim);margin:12px 0 8px;">Loop</label>
        <div class="fault-type-grid"><button class="dp-loop-btn active" data-loop="phph">Ph-Ph</button><button class="dp-loop-btn" data-loop="phe">Ph-E</button></div>
        <div class="compact-form" style="margin-top:12px;">
          <div class="field"><label>R1 (Ω secondary)</label><input id="dpR1" type="number" value="12.86" step="0.01"></div>
          <div class="field"><label>X1 (Ω secondary)</label><input id="dpX1" type="number" value="28.78" step="0.01"></div>
          <div class="field" id="dpRbWrap"><label>Resistive blinder reach Rb (Ω)</label><input id="dpRb" type="number" value="7.77" step="0.01"></div>
          <div class="field" id="dpRevWrap" style="display:none;"><label>Reverse reach (Ω, mho offset, 0=self-polarised)</label><input id="dpRev" type="number" value="0" step="0.01"></div>
          <div class="field"><label>Max Phase Angle (right blinder, deg)</label><input id="dpMaxAng" type="number" value="45" step="0.1" min="0" max="60"></div>
          <div class="field"><label>Min Phase Angle (left blinder, deg)</label><input id="dpMinAng" type="number" value="115" step="0.1" min="90" max="150"></div>
          <div class="field"><label>Tilt angle (deg, +ve increases area)</label><input id="dpTilt" type="number" value="0" step="0.1" min="-45" max="45"></div>
        </div>
        <div class="checkrow"><input type="checkbox" id="dpShowBlinders" checked><label for="dpShowBlinders" style="margin:0;">Show directional load blinders</label></div>
        <div class="results" id="dpResults"></div>
      </div>
      <div class="chart-wrap"><canvas id="dpCanvas"></canvas></div>
    </div>
    <div class="card" style="margin-top:16px;"><p class="note" style="margin:0;">Quadrilateral: vertices at origin → (Rb, −Rb·tan(MaxAngle)) → (Rb, 0) → (Rb+R1, X1) → (X1/tan(MinAngle), X1) → origin, then rotated by the tilt angle. Mho: circle with diameter between the forward reach point R1∠(atan2(X1,R1)) and the reverse-reach point (0 for self-polarised), reproducing ABB's DSTPDIS quadrilateral/mho settings (Max/Min phase angle = right/left load-blinder angle, tilt angle increases zone area). Simplified for visualisation only — verify against the relay's technical/application manual before commissioning.</p></div>
  `;
  document.querySelectorAll('.dp-type-btn').forEach(btn => { btn.onclick = () => { document.querySelectorAll('.dp-type-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); document.getElementById('dpRbWrap').style.display = btn.dataset.type==='quad' ? '' : 'none'; document.getElementById('dpRevWrap').style.display = btn.dataset.type==='mho' ? '' : 'none'; calcDistProt(); }; });
  document.querySelectorAll('.dp-loop-btn').forEach(btn => { btn.onclick = () => { document.querySelectorAll('.dp-loop-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); calcDistProt(); }; });
  ['dpR1','dpX1','dpRb','dpRev','dpMaxAng','dpMinAng','dpTilt','dpShowBlinders'].forEach(id => { document.getElementById(id).addEventListener('input', calcDistProt); document.getElementById(id).addEventListener('change', calcDistProt); });
  calcDistProt();
}
function dpRotate(pt, tiltRad){ return { x: pt.x*Math.cos(tiltRad) - pt.y*Math.sin(tiltRad), y: pt.x*Math.sin(tiltRad) + pt.y*Math.cos(tiltRad) }; }
function calcDistProt(){
  const type = document.querySelector('.dp-type-btn.active').dataset.type;
  const loop = document.querySelector('.dp-loop-btn.active').dataset.loop;
  const R1 = safeNum(document.getElementById('dpR1').value, 12.86);
  const X1 = safeNum(document.getElementById('dpX1').value, 28.78);
  const Rb = safeNum(document.getElementById('dpRb').value, 7.77);
  const Rev = safeNum(document.getElementById('dpRev').value, 0);
  const maxAngDeg = safeNum(document.getElementById('dpMaxAng').value, 45);
  const minAngDeg = safeNum(document.getElementById('dpMinAng').value, 115);
  const tiltDeg = safeNum(document.getElementById('dpTilt').value, 0);
  const showBlinders = document.getElementById('dpShowBlinders').checked;
  const tiltRad = tiltDeg*Math.PI/180;
  const lineAngleDeg = Math.atan2(X1, R1)*180/Math.PI;
  const maxAngRad = maxAngDeg*Math.PI/180, minAngRad = minAngDeg*Math.PI/180;

  const datasets = [];
  let resultsHtml = `<div class="result-line"><span>Line angle (atan2(X1,R1))</span><b>${lineAngleDeg.toFixed(2)}°</b></div>`;

  if (type === 'quad'){
    const verts = [
      {x:0, y:0},
      {x:Rb, y:-Rb*Math.tan(maxAngRad)},
      {x:Rb, y:0},
      {x:Rb+R1, y:X1},
      {x:X1/Math.tan(minAngRad), y:X1},
      {x:0, y:0},
    ].map(p => dpRotate(p, tiltRad));
    datasets.push({ label:`${loop==='phph'?'Ph-Ph':'Ph-E'} Quadrilateral Zone`, data:verts, borderColor:'#4fb0ff', backgroundColor:'rgba(79,176,255,0.10)', fill:true, borderWidth:2, pointRadius:0, showLine:true, parsing:false });
    resultsHtml += `<div class="result-line"><span>Vertex (right blinder base)</span><b>(${verts[1].x.toFixed(2)}, ${verts[1].y.toFixed(2)})</b></div><div class="result-line"><span>Vertex (top-right, Rb+R1, X1)</span><b>(${verts[3].x.toFixed(2)}, ${verts[3].y.toFixed(2)})</b></div><div class="result-line"><span>Vertex (top-left, load blinder)</span><b>(${verts[4].x.toFixed(2)}, ${verts[4].y.toFixed(2)})</b></div>`;
  } else {
    const fwd = dpRotate({x:R1, y:X1}, 0);
    const revAngRad = Math.atan2(X1,R1) + Math.PI;
    const revPt = {x:Rev*Math.cos(revAngRad), y:Rev*Math.sin(revAngRad)};
    const center = dpRotate({x:(fwd.x+revPt.x)/2, y:(fwd.y+revPt.y)/2}, tiltRad);
    const radius = Math.sqrt((fwd.x-revPt.x)**2 + (fwd.y-revPt.y)**2)/2;
    const circlePts = [];
    for (let a=0; a<=360; a+=2){ const rad=a*Math.PI/180; circlePts.push({x:center.x+radius*Math.cos(rad), y:center.y+radius*Math.sin(rad)}); }
    datasets.push({ label:`${loop==='phph'?'Ph-Ph':'Ph-E'} Mho Zone`, data:circlePts, borderColor:'#4fd88a', backgroundColor:'rgba(79,216,138,0.10)', fill:true, borderWidth:2, pointRadius:0, showLine:true, parsing:false });
    resultsHtml += `<div class="result-line"><span>Circle centre</span><b>(${center.x.toFixed(2)}, ${center.y.toFixed(2)}) Ω</b></div><div class="result-line"><span>Circle radius (diameter/2)</span><b>${radius.toFixed(2)} Ω</b></div>`;
  }

  if (showBlinders){
    const spanLen = Math.max(R1, X1, Rb) * 1.6 + 5;
    const rightBlinder = [ dpRotate({x:0,y:0}, tiltRad), dpRotate({x:spanLen*Math.cos(-maxAngRad), y:spanLen*Math.sin(-maxAngRad)}, tiltRad) ];
    const leftBlinder = [ dpRotate({x:0,y:0}, tiltRad), dpRotate({x:spanLen*Math.cos(minAngRad), y:spanLen*Math.sin(minAngRad)}, tiltRad) ];
    datasets.push({ label:'Right load blinder (Max Phase Angle)', data:rightBlinder, borderColor:'#ffb74f', borderDash:[6,4], borderWidth:1.5, pointRadius:0, showLine:true, fill:false, parsing:false });
    datasets.push({ label:'Left load blinder (Min Phase Angle)', data:leftBlinder, borderColor:'#c792ea', borderDash:[6,4], borderWidth:1.5, pointRadius:0, showLine:true, fill:false, parsing:false });
  }

  const ctx = document.getElementById('dpCanvas');
  if (distChart) distChart.destroy();
  distChart = new Chart(ctx, { type:'line', data:{datasets}, options:{ responsive:true, parsing:false, aspectRatio:1.1, scales:{ x:{type:'linear', title:{display:true,text:'R (Ω secondary)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}}, y:{type:'linear', title:{display:true,text:'X (Ω secondary)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}} }, plugins:{legend:{labels:{color:'#e7ecf7', font:{size:10}}}} } });
  document.getElementById('dpResults').innerHTML = resultsHtml;
}

function renderArcFlash(container){
  container.innerHTML = `
    <h2>Arc Flash Quick Reference <span class="std-badge">AS/NZS 4836 · IEC 61482 · IEC/TR 60909</span></h2>
    <p class="tool-desc">PPE category guidance and standards links. Use dedicated software for a site incident-energy calculation.</p>
    <div class="card"><table class="ref-table"><thead><tr><th>Standard</th><th>Scope</th></tr></thead><tbody><tr><td>IEEE 1584-2018</td><td>Incident energy &amp; arc-flash boundary calculation method</td></tr><tr><td>AS/NZS 4836:2023</td><td>Safe working on or near electrical installations — PPE &amp; work practice</td></tr><tr><td>IEC 61482-1-1 / -2</td><td>Test methods for arc-rated clothing</td></tr><tr><td>IEC/TR 60909</td><td>Short-circuit current basis for incident energy studies</td></tr><tr><td>AS 2067</td><td>Substation earthing, switchgear &amp; general HV substation design</td></tr></tbody></table></div>
    <div class="card" style="margin-top:16px;"><h3 style="margin-top:0;font-size:1rem;">Indicative PPE categories</h3><table class="ref-table"><thead><tr><th>Incident energy</th><th>PPE category</th><th>Min. ATPV/EBT</th></tr></thead><tbody><tr><td>&le; 1.2 cal/cm²</td><td>Category 1</td><td>4 cal/cm²</td></tr><tr><td>&le; 8 cal/cm²</td><td>Category 2</td><td>8 cal/cm²</td></tr><tr><td>&le; 25 cal/cm²</td><td>Category 3</td><td>25 cal/cm²</td></tr><tr><td>&le; 40 cal/cm²</td><td>Category 4</td><td>40 cal/cm²</td></tr><tr><td>&gt; 40 cal/cm²</td><td>No safe PPE — de-energise</td><td>—</td></tr></tbody></table><div class="note">Always base actual PPE selection on the calculated incident energy from a full study.</div></div>
  `;
}
const REFERENCE_DOCS = {
  'General': [ {name:'AS 2067-2016 — Substations and HV installations exceeding 1 kV a.c.', std:'AS 2067'} ],
  'Switchgear': [ {name:'AS IEC 62271-1-2017 — Switchgear Standards', std:'AS IEC 62271-1'}, {name:'AS IEC 62271-200-2026 — Switchgear Standards', std:'AS IEC 62271-200'} ],
  'Instrument Transformers': [ {name:'AS 60044.1-2007 — Current transformers', std:'AS 60044.1'}, {name:'AS 60044.2-2007 — Voltage transformers', std:'AS 60044.2'}, {name:'AS 60044.3-2004 — Combined transformers', std:'AS 60044.3'}, {name:'AS 61869.1-2024 — Instrument transformers, General', std:'AS 61869.1'}, {name:'AS 61869.2-2021 — Current transformers', std:'AS 61869.2'}, {name:'AS 61869.4-2021 — Additional standards', std:'AS 61869.4'}, {name:'AS 61869.5-2021 — Additional standards', std:'AS 61869.5'} ],
  'Power Transformers': [ {name:'AS 2374.1-1997 — General', std:'AS 2374.1'}, {name:'AS 2374.2-1997 — General', std:'AS 2374.2'}, {name:'AS 2374.3.0-1982 — General', std:'AS 2374.3.0'}, {name:'AS 2374.3.1-1992 — General', std:'AS 2374.3.1'}, {name:'AS 2374.4-1982 — General', std:'AS 2374.4'}, {name:'AS 2374.6-1994 — General', std:'AS 2374.6'}, {name:'AS 2374.8-2000 — General', std:'AS 2374.8'}, {name:'AS/NZS 60076.1-2014 — General', std:'AS/NZS 60076.1'} ],
  'Protection Devices': [ {name:'AS/NZS 60255.1-2025 — Measuring relays and protection equipment', std:'AS/NZS 60255.1'}, {name:'AS/NZS 60255.26-2025 — Protection devices', std:'AS/NZS 60255.26'}, {name:'AS/NZS 60255.127-2025 — Protection devices', std:'AS/NZS 60255.127'}, {name:'AS/NZS 60255.181-2025 — Measuring relays and protection equipment', std:'AS/NZS 60255.181'} ],
};
function renderReferences(container){
  const cats = Object.keys(REFERENCE_DOCS);
  container.innerHTML = `
    <h2>Standards Library <span class="std-badge">AS / AS-NZS / IEC</span></h2>
    <p class="tool-desc">Reference index of standards used across this toolkit. This is a document index only — the standards themselves are copyrighted publications and must be sourced from SAI Global / Standards Australia or your organisation's library.</p>
    <div class="card">
      <div class="ref-tabs" id="refTabs">${cats.map((cat,i) => `<button class="ref-tab-btn ${i===0?'active':''}" data-idx="${i}">${cat}</button>`).join('')}</div>
      <div id="refPanels">${cats.map((cat,i) => `<div class="ref-panel ${i===0?'active':''}" data-idx="${i}">${REFERENCE_DOCS[cat].map(d => `<div class="ref-doc-link"><span>${d.name}</span><span class="std-badge">${d.std}</span></div>`).join('')}</div>`).join('')}</div>
    </div>
  `;
  const tabBtns = container.querySelectorAll('.ref-tab-btn'); const panels = container.querySelectorAll('.ref-panel');
  tabBtns.forEach(btn => { btn.addEventListener('click', () => { tabBtns.forEach(b => b.classList.remove('active')); panels.forEach(p => p.classList.remove('active')); btn.classList.add('active'); const idx = btn.dataset.idx; container.querySelector(`.ref-panel[data-idx="${idx}"]`).classList.add('active'); }); });
}
function initApp(){
  const sideNav = document.getElementById('sideNav'); const app = document.getElementById('app'); const topbarTitle = document.getElementById('topbarTitle');
  sideNav.innerHTML = TOOL_GROUPS.map(g => `<div class="side-group"><div class="side-group-label">${g.label}</div>${g.tools.map(t => `<button type="button" class="side-link" data-tool="${t.id}">${t.label}</button>`).join('')}</div>`).join('');
  app.innerHTML = TOOLS.map(t => `<section class="tool-panel" id="panel-${t.id}"></section>`).join('');
  const renderers = { tcc: renderTCC, symcomp: renderSymComp, ctsat: renderCTSat, diff87: renderDiff87, fault: renderFault, txfmr: renderTxfmr, lof: renderLossOfField, distprot: renderDistProt, arcflash: renderArcFlash, references: renderReferences };
  function activate(id){
    document.querySelectorAll('.side-link').forEach(b => b.classList.toggle('active', b.dataset.tool===id));
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.toggle('active', p.id===`panel-${id}`));
    const panel = document.getElementById(`panel-${id}`); if (!panel.dataset.rendered){ renderers[id](panel); panel.dataset.rendered = '1'; }
    const toolMeta = TOOLS.find(t => t.id === id); if (toolMeta) topbarTitle.textContent = toolMeta.label;
    if (window.innerWidth <= 850){ document.getElementById('sidebar').classList.remove('mobile-open'); }
  }
  sideNav.querySelectorAll('.side-link').forEach(b => b.addEventListener('click', () => activate(b.dataset.tool)));
  const sidebar = document.getElementById('sidebar'); const toggleBtn = document.getElementById('sidebarToggle');
  toggleBtn.addEventListener('click', () => { if (window.innerWidth <= 850){ sidebar.classList.toggle('mobile-open'); } else { sidebar.classList.toggle('collapsed'); } });
  activate(TOOLS[0].id);
}
document.addEventListener('DOMContentLoaded', initApp);
