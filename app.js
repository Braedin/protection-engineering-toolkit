// ===================== Protection Engineering Toolkit v0.9.4 =====================
const TOOL_GROUPS = [
  { label: 'Overcurrent', tools: [ {id:'tcc', label:'TCC Plotter'} ] },
  { label: 'System Analysis', tools: [ {id:'symcomp', label:'Symmetrical Components'}, {id:'fault', label:'Fault Level Calculator'} ] },
  { label: 'Transformers', tools: [ {id:'diff87', label:'Differential (87T)'}, {id:'txfmr', label:'FLC & Fault Current'}, {id:'diffpickup787', label:'SEL-787 Differential Pickup'}, {id:'diffstability', label:'Differential Stability Check'} ] },
  { label: 'Motor Protection', tools: [ {id:'currentimbalance', label:'Current Imbalance (46)'}, {id:'underpower', label:'Underpower (32)'} ] },
  { label: 'Generator Protection', tools: [ {id:'lof', label:'Loss of Field (40)'}, {id:'voltshz', label:'Volts/Hz Overexcitation (24)'} ] },
  { label: 'Line Protection', tools: [ {id:'distprot', label:'Distance Protection (Quad/Mho)'} ] },
  { label: 'CT / Instrument Transformers', tools: [ {id:'ctsat', label:'CT Knee-Point / Saturation'} ] },
  { label: 'Reference', tools: [ {id:'arcflash', label:'Arc Flash Reference'}, {id:'references', label:'Standards Library'} ] },
];
const TOOLS = TOOL_GROUPS.flatMap(g => g.tools);
function safeNum(val, fallback=0){ const n = parseFloat(val); return isNaN(n) ? fallback : n; }
function safeChart(ctx, config){
  if (typeof Chart === 'undefined') return null;
  try { return new Chart(ctx, config); }
  catch(e){ console.warn('Chart render failed:', e); return null; }
}

// ===================== Formula helper (KaTeX) =====================
function renderFormulaBlock(container, title, formulas){
  if (!container) return;
  const block = document.createElement('div');
  block.className = 'card formula-block';
  block.style.marginTop = '16px';
  const h = document.createElement('h3');
  h.textContent = title; h.style.marginTop = '0'; h.style.fontSize = '0.95rem'; h.style.color = 'var(--text-dim)';
  block.appendChild(h);
  formulas.forEach(tex => {
    const d = document.createElement('div'); d.style.margin = '10px 0';
    if (window.katex) { try { katex.render(tex, d, { throwOnError:false, displayMode:true }); } catch(e){ d.textContent = tex; } }
    else d.textContent = tex;
    block.appendChild(d);
  });
  container.appendChild(block);
}

// ===================== Save / Load framework (per-tool, localStorage) =====================
const SAVE_KEY_PREFIX = 'pet.saves.';
const NO_SAVE_TOOLS = new Set(['arcflash', 'references']);
const SAVE_HANDLERS = {};

function loadSaves(toolId){
  try { const raw = localStorage.getItem(SAVE_KEY_PREFIX + toolId); return raw ? JSON.parse(raw) : []; }
  catch(e){ return []; }
}
function writeSaves(toolId, list){
  try { localStorage.setItem(SAVE_KEY_PREFIX + toolId, JSON.stringify(list)); }
  catch(e){ /* storage unavailable or full — save/load degrades silently */ }
}
function genericCollect(panel){
  const data = {};
  panel.querySelectorAll('select[id]').forEach(el => { data[el.id] = el.value; });
  panel.querySelectorAll('[data-savegroup]').forEach(group => {
    const active = group.querySelector('.active[data-value]');
    if (active) data['group:' + group.dataset.savegroup] = active.dataset.value;
  });
  panel.querySelectorAll('input[id]').forEach(el => { data[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
  return data;
}
function genericApply(panel, data){
  panel.querySelectorAll('select[id]').forEach(el => {
    if (data[el.id] === undefined) return;
    el.value = data[el.id];
    el.dispatchEvent(new Event('change', { bubbles:true }));
  });
  panel.querySelectorAll('[data-savegroup]').forEach(group => {
    const key = 'group:' + group.dataset.savegroup;
    if (data[key] === undefined) return;
    const btn = group.querySelector(`[data-value="${CSS.escape(String(data[key]))}"]`);
    if (btn) btn.click();
  });
  panel.querySelectorAll('input[id]').forEach(el => {
    if (data[el.id] === undefined) return;
    if (el.type === 'checkbox') el.checked = data[el.id]; else el.value = data[el.id];
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  });
}
function getSaveHandler(toolId){ return SAVE_HANDLERS[toolId] || { collect: genericCollect, apply: genericApply }; }
function attachSaveLoadUI(panel, toolId){
  if (NO_SAVE_TOOLS.has(toolId)) return;
  if (panel.querySelector('.save-load-card')) return;
  const card = document.createElement('div');
  card.className = 'card save-load-card';
  card.innerHTML = `
    <div class="save-load-header">Saved setups</div>
    <div class="save-load-row"><input type="text" class="saveNameInput" placeholder="Name this setup…"><button type="button" class="btn saveBtn">Save current</button></div>
    <div class="save-list"></div>
  `;
  panel.appendChild(card);
  const nameInput = card.querySelector('.saveNameInput');
  const listEl = card.querySelector('.save-list');
  const handler = getSaveHandler(toolId);
  function refreshList(){
    const saves = loadSaves(toolId);
    listEl.innerHTML = saves.length ? saves.map((s,i) => `
      <div class="save-item">
        <span class="save-item-name">${s.name}</span>
        <span class="save-item-date">${new Date(s.ts).toLocaleDateString()}</span>
        <button type="button" class="btn-icon loadSaveBtn" data-idx="${i}">Load</button>
        <button type="button" class="btn-icon deleteSaveBtn" data-idx="${i}">✕</button>
      </div>`).join('') : '<div class="note">No saved setups yet.</div>';
    listEl.querySelectorAll('.loadSaveBtn').forEach(btn => { btn.onclick = () => { const saves = loadSaves(toolId); const entry = saves[btn.dataset.idx]; if (entry) handler.apply(panel, entry.data); }; });
    listEl.querySelectorAll('.deleteSaveBtn').forEach(btn => { btn.onclick = () => { const saves = loadSaves(toolId); saves.splice(btn.dataset.idx, 1); writeSaves(toolId, saves); refreshList(); }; });
  }
  card.querySelector('.saveBtn').onclick = () => {
    const name = nameInput.value.trim() || `Setup ${new Date().toLocaleString()}`;
    const saves = loadSaves(toolId);
    saves.push({ name, ts: Date.now(), data: handler.collect(panel) });
    writeSaves(toolId, saves);
    nameInput.value = '';
    refreshList();
  };
  refreshList();
}

// ===================== TCC Plotter =====================
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
    <h2>Time-Current Curve (TCC) Plotter <span class="std-badge">AS/NZS 60255.151 / IEEE C37.112</span></h2>
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
  renderFormulaBlock(container, 'Reference formula', [
    String.raw`t = TMS\left(\dfrac{A}{(I/I_s)^p - 1} + B\right)`
  ]);
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
  tccChart = safeChart(ctx, { type:'line', data:{datasets}, options:{ responsive:true, parsing: false, scales:{ x:{type:'logarithmic', title:{display:true,text:axisMode==='primary' ? 'Primary Current (A)' : 'Secondary Current (A)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}}, y:{type:'logarithmic', title:{display:true,text:'Operating Time (s)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}} }, plugins:{ legend:{labels:{color:'#e7ecf7', font:{size:10}}}, tooltip:{mode:'nearest'} } } });
  const evalEl = document.getElementById('evalResults');
  if (evalCurrent > 0){ evalEl.innerHTML = activeCurves.map(c => { const refMultiplier = axisMode==='primary' ? c.ctRatio : 1; const effectivePickup = c.pickup * refMultiplier; const ratio = evalCurrent / effectivePickup; const t = curveTime(c.key, ratio, c.tms); return `<div class="result-line"><span>${CURVES[c.key].name} @ ${evalCurrent}A</span><b>${t!==null ? t.toFixed(3)+' s' : 'below pickup'}</b></div>`; }).join(''); } else { evalEl.innerHTML = ''; }
}
SAVE_HANDLERS.tcc = {
  collect(){ return { axisMode: document.getElementById('tccAxisMode').value, evalCurrent: document.getElementById('evalCurrent').value, curves: activeCurves.map(c => ({key:c.key, pickup:c.pickup, tms:c.tms, ctRatio:c.ctRatio})) }; },
  apply(panel, data){
    if (Array.isArray(data.curves) && data.curves.length){ activeCurves = data.curves.map(c => Object.assign({}, c, {id: cryptoId()})); renderCurveEditor(); }
    if (data.axisMode !== undefined) document.getElementById('tccAxisMode').value = data.axisMode;
    if (data.evalCurrent !== undefined) document.getElementById('evalCurrent').value = data.evalCurrent;
    updateTCCChart();
  }
};

// ===================== Symmetrical Components =====================
function complexMul(a, b){ return {re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re}; }
function complexAdd(a, b){ return {re: a.re+b.re, im: a.im+b.im}; }
function polarToRect(mag, angDeg){ const r = angDeg*Math.PI/180; return {re: mag*Math.cos(r), im: mag*Math.sin(r)}; }
function rectToPolar(c){ return {mag: Math.sqrt(c.re*c.re+c.im*c.im), ang: Math.atan2(c.im,c.re)*180/Math.PI}; }
const a_op = polarToRect(1,120); const a2_op = polarToRect(1,240);
function renderSymComp(container){
  container.innerHTML = `
    <h2>Symmetrical Components Calculator <span class="std-badge">Fortescue / AS/NZS 60909</span></h2>
    <p class="tool-desc">Convert unbalanced three-phase phasors (Ia, Ib, Ic or Va, Vb, Vc) to positive, negative and zero sequence components, or vice versa. The "Before" diagram shows your input quantities; "After" shows the calculated result.</p>
    <div class="grid">
      <div class="card"><div class="field"><label>Conversion direction</label><select id="symDir"><option value="p2s">Phase → Sequence</option><option value="s2p">Sequence → Phase</option></select></div><div id="symInputs"></div><div class="results" id="symResults"></div></div>
      <div class="card">
        <div class="symcomp-canvases">
          <div><h3 class="canvas-label" id="symBeforeLabel">Before (input)</h3><canvas id="symBeforeCanvas" width="380" height="380" style="max-width:100%;"></canvas></div>
          <div><h3 class="canvas-label" id="symAfterLabel">After (result)</h3><canvas id="symAfterCanvas" width="380" height="380" style="max-width:100%;"></canvas></div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('symDir').onchange = renderSymInputs;
  renderSymInputs();
}
function updateSymLabels(){
  const dir = document.getElementById('symDir').value;
  document.getElementById('symBeforeLabel').textContent = dir === 'p2s' ? 'Before (Phase)' : 'Before (Sequence)';
  document.getElementById('symAfterLabel').textContent = dir === 'p2s' ? 'After (Sequence)' : 'After (Phase)';
}
function renderSymInputs(){
  const dir = document.getElementById('symDir').value; const el = document.getElementById('symInputs');
  if (dir === 'p2s'){ el.innerHTML = `<div class="field"><label>Phase A: magnitude / angle (deg)</label><div class="row2"><input id="s1m" type="number" value="100"><input id="s1a" type="number" value="0"></div></div><div class="field"><label>Phase B: magnitude / angle (deg)</label><div class="row2"><input id="s2m" type="number" value="100"><input id="s2a" type="number" value="-120"></div></div><div class="field"><label>Phase C: magnitude / angle (deg)</label><div class="row2"><input id="s3m" type="number" value="100"><input id="s3a" type="number" value="120"></div></div>`; }
  else { el.innerHTML = `<div class="field"><label>Zero seq: magnitude / angle (deg)</label><div class="row2"><input id="s1m" type="number" value="0"><input id="s1a" type="number" value="0"></div></div><div class="field"><label>Positive seq: magnitude / angle (deg)</label><div class="row2"><input id="s2m" type="number" value="100"><input id="s2a" type="number" value="0"></div></div><div class="field"><label>Negative seq: magnitude / angle (deg)</label><div class="row2"><input id="s3m" type="number" value="0"><input id="s3a" type="number" value="0"></div></div>`; }
  ['s1m','s1a','s2m','s2a','s3m','s3a'].forEach(id => { document.getElementById(id).oninput = calcSymComp; });
  updateSymLabels();
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

// ===================== CT Knee-Point & Saturation =====================
let ctChart = null;
function renderCTSat(container){
  container.innerHTML = `
    <h2>CT Knee-Point &amp; Saturation Calculator <span class="std-badge">AS/NZS 61869-2</span></h2>
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
      <div class="chart-wrap"><canvas id="ctCanvas"></canvas><div id="ctResults" class="results centered"></div><div class="diagram-note">V_k ≥ K × (I_fault,sec) × (R_CT + R_L + R_relay). Chart shows an idealised excitation curve — not a manufacturer-tested characteristic.</div></div>
    </div>
  `;
  ['ctPrim','ctSec','ctIf','ctRct','ctRl','ctRr','ctK','ctVkActual'].forEach(id => { document.getElementById(id).addEventListener('input', calcCTSat); document.getElementById(id).addEventListener('change', calcCTSat); });
  calcCTSat();
  renderFormulaBlock(container, 'Reference formula', [
    String.raw`V_k \geq K \times I_{fault,sec} \times (R_{CT} + R_L + R_{relay})`
  ]);
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
  ctChart = safeChart(ctx, { type:'line', data:{ datasets:[ {label:'Excitation curve (indicative)', data:[...linPoints, ...satPoints], borderColor:'#4fb0ff', backgroundColor:'transparent', borderWidth:2, pointRadius:0, parsing:false}, {label:'Knee point', data:[{x:knee_I, y:vkPlot}], borderColor:'#ffb74f', backgroundColor:'#ffb74f', pointRadius:7, showLine:false, type:'scatter', parsing:false}, {label:'Operating fault point', data:[{x:IfSec, y: IfSec*(Rct+Rl+Rr)}], borderColor:'#ff6b6b', backgroundColor:'#ff6b6b', pointRadius:7, showLine:false, type:'scatter', parsing:false} ] }, options:{ responsive:true, parsing:false, scales:{ x:{title:{display:true,text:'Exciting Current (A)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}}, y:{title:{display:true,text:'Secondary Voltage (V)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}} }, plugins:{legend:{labels:{color:'#e7ecf7'}}} } });
}

// ===================== Transformer Differential (87T) =====================
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
  diffChart = safeChart(ctx, { type:'line', data:{ datasets:[ {label:'Operate boundary', data:points, borderColor:'#4fb0ff', backgroundColor:'rgba(79,176,255,0.08)', fill:true, pointRadius:0, borderWidth:2, parsing:false}, {label:'Measured operating point', data:[{x:testIr,y:testId}], borderColor: willOperate?'#ff6b6b':'#4fd88a', backgroundColor: willOperate?'#ff6b6b':'#4fd88a', pointRadius:7, showLine:false, type:'scatter', parsing:false} ] }, options:{ responsive:true, parsing:false, scales:{ x:{type:'linear', min:0, max:maxIr, title:{display:true,text:'Restraint Current Ir (pu)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}}, y:{type:'linear', min:0, title:{display:true,text:'Differential Current Id (pu)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'}} }, plugins:{legend:{labels:{color:'#e7ecf7'}}} } });
  document.getElementById('dResults').innerHTML = `<div class="result-line"><span>Operate threshold at measured Ir=${testIr}</span><b>${thresholdAtTest.toFixed(3)} pu</b></div><div class="result-flag ${willOperate?'flag-warn':'flag-good'}">${willOperate ? '⚡ Measured point is ABOVE characteristic — relay would OPERATE' : '✓ Measured point is below characteristic — relay RESTRAINED'}</div>`;
}

// ===================== Fault Level Calculator =====================
let currentFaultType = '3ph';
const FAULT_LABELS = { '3ph': '3-PHASE FAULT', '2ph': 'PHASE-PHASE FAULT', '1ph': 'SINGLE PHASE-EARTH FAULT', '2phe': 'PHASE-PHASE-EARTH FAULT' };
function renderFault(container){
  container.innerHTML = `
    <h2>Fault Level Calculator <span class="std-badge">AS/NZS 60909 (simplified)</span></h2>
    <p class="tool-desc">Fault level estimate from system voltage and impedance to the fault point. Optionally combine an upstream network fault level through a transformer to the fault-side bus, per the IEC/AS 60909 equivalent-source method.</p>
    <div class="grid">
      <div class="card">
        <label style="display:block;font-size:0.78rem;color:var(--text-dim);margin-bottom:8px;">Fault type</label>
        <div class="fault-type-grid" data-savegroup="faultType"><button class="fault-type-btn active" data-value="3ph">3-Phase</button><button class="fault-type-btn" data-value="2ph">Phase-Phase</button><button class="fault-type-btn" data-value="1ph">Single Phase-Earth</button><button class="fault-type-btn" data-value="2phe">Phase-Phase-Earth</button></div>
        <div class="checkrow"><input type="checkbox" id="fUseUpstream"><label for="fUseUpstream" style="margin:0;">Include upstream network source impedance</label></div>
        <div class="field"><label>System voltage at fault point, line-line (kV)</label><input id="fVn" type="number" value="11" step="0.1"></div>
        <div class="field"><label id="fZpcLabel">Source / transformer impedance to fault (%Z, positive-seq)</label><input id="fZpc" type="number" value="6" step="0.1"></div>
        <div class="field"><label id="fMvaLabel">Transformer / source rated MVA</label><input id="fMva" type="number" value="10" step="0.1"></div>
        <div class="field" id="fXrWrap"><label>X/R ratio (for asymmetry factor)</label><input id="fXr" type="number" value="15" step="0.1"></div>
        <div id="fUpstreamFields" style="display:none;">
          <div class="field"><label>Upstream network fault level Ssc (MVA)</label><input id="fSsc" type="number" value="500" step="1"></div>
          <div class="field"><label>Upstream nominal voltage, line-line (kV)</label><input id="fVup" type="number" value="66" step="0.1"></div>
          <div class="field"><label>Upstream X/R ratio</label><input id="fXrUp" type="number" value="15" step="0.1"></div>
          <div class="field"><label>Transformer X/R ratio</label><input id="fXrT" type="number" value="20" step="0.1"></div>
        </div>
        <div class="field"><label>Zero-sequence impedance ratio Z0/Z1 (for earth faults)</label><input id="fZ0Ratio" type="number" value="1.5" step="0.1"></div>
        <div class="field"><label>Voltage factor c (IEC/AS 60909)</label><select id="fC"><option value="1.1">c=1.1 (max fault, LV/MV)</option><option value="1.0">c=1.0 (nominal)</option><option value="0.95">c=0.95 (min fault)</option></select></div>
      </div>
      <div class="card"><canvas id="sldCanvas" width="560" height="360" style="max-width:100%;"></canvas><div id="fResults" class="results centered"></div></div>
    </div>
    <div class="card" style="margin-top:16px;"><p class="note" style="margin:0;">I''k formulas (AS/NZS 60909, simplified): 3-phase = c·Vn/(√3·Z1). Phase-phase = c·Vn/(2·Z1). Single phase-earth = √3·c·Vn/(2·Z1+Z0). Phase-phase-earth uses combined parallel sequence networks. With upstream source included: the network feeder is modelled as Zk = c·Vup²/Ssc, split into R and X via the given X/R ratio, referred to the fault-side voltage by (Vn/Vup)², and added in series (complex R+jX) with the transformer's own impedance (also split via its own X/R ratio). This assumes the source connects directly to the transformer primary with no intervening line/cable impedance, and uses a single Z0/Z1 ratio for the combined zero-sequence network. Peak asymmetry factor κ ≈ 1.02 + 0.98·e<sup>(-3·R/X)</sup> using the combined X/R. Diagram is a simplified single-source SLD for visualisation only — verify against a full network fault study for protection grading &amp; equipment rating (AS/NZS 3000, AS 2067).</p></div>
  `;
  container.querySelectorAll('.fault-type-btn').forEach(btn => { btn.onclick = () => { container.querySelectorAll('.fault-type-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); currentFaultType = btn.dataset.value; calcFault(); }; });
  const upstreamCheckbox = document.getElementById('fUseUpstream');
  const upstreamFields = document.getElementById('fUpstreamFields');
  const xrWrap = document.getElementById('fXrWrap');
  const zpcLabel = document.getElementById('fZpcLabel');
  const mvaLabel = document.getElementById('fMvaLabel');
  function syncUpstreamVisibility(){
    const on = upstreamCheckbox.checked;
    upstreamFields.style.display = on ? '' : 'none';
    xrWrap.style.display = on ? 'none' : '';
    zpcLabel.textContent = on ? 'Transformer impedance %Z (positive-seq)' : 'Source / transformer impedance to fault (%Z, positive-seq)';
    mvaLabel.textContent = on ? 'Transformer rated MVA' : 'Transformer / source rated MVA';
  }
  upstreamCheckbox.addEventListener('change', () => { syncUpstreamVisibility(); calcFault(); });
  syncUpstreamVisibility();
  ['fVn','fZpc','fMva','fZ0Ratio','fC','fXr','fSsc','fVup','fXrUp','fXrT'].forEach(id => { const el = document.getElementById(id); el.addEventListener('input', calcFault); el.addEventListener('change', calcFault); });
  calcFault();
  renderFormulaBlock(container, 'Reference formulas', [
    String.raw`I''_{k,3\phi} = \dfrac{c \cdot V_n}{\sqrt{3}\,Z_1}`,
    String.raw`Z_{k,\text{source}} = \dfrac{c \cdot V_{up}^2}{S_k''}`
  ]);
}
function drawSLD(vn, mva, zpc, ikA, ipeak, faultLabel, upstreamLabel){
  const canvas = document.getElementById('sldCanvas'); if (!canvas) return; const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = '#9fb0cf'; ctx.fillStyle = '#e7ecf7'; ctx.font = '13px Segoe UI'; ctx.lineWidth = 2;
  const busY = 60; const srcX = 100, srcTopY = 20;
  ctx.beginPath(); ctx.arc(srcX, srcTopY, 16, 0, 2*Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(srcX-8, srcTopY); ctx.bezierCurveTo(srcX-8,srcTopY-8, srcX,srcTopY-8, srcX,srcTopY); ctx.bezierCurveTo(srcX,srcTopY+8, srcX+8,srcTopY+8, srcX+8,srcTopY); ctx.stroke();
  ctx.fillText('Source', srcX-24, srcTopY-24);
  if (upstreamLabel){ ctx.font = '11px Segoe UI'; ctx.fillStyle = '#9fb0cf'; ctx.fillText(upstreamLabel, srcX+22, srcTopY+4); ctx.font = '13px Segoe UI'; ctx.fillStyle = '#e7ecf7'; }
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
function calcFault(){
  const Vn = safeNum(document.getElementById('fVn').value, 11); const Zpc = safeNum(document.getElementById('fZpc').value, 6); const Mva = safeNum(document.getElementById('fMva').value, 10); const Z0Ratio = safeNum(document.getElementById('fZ0Ratio').value, 1.5); const c = safeNum(document.getElementById('fC').value, 1.1);
  const useUpstream = document.getElementById('fUseUpstream').checked;
  let Z1, xrCombined, upstreamHtml, upstreamLabel = null;
  if (useUpstream){
    const Ssc = safeNum(document.getElementById('fSsc').value, 500); const Vup = safeNum(document.getElementById('fVup').value, 66); const xrUp = safeNum(document.getElementById('fXrUp').value, 15); const xrT = safeNum(document.getElementById('fXrT').value, 20);
    const ZsUpMag = Ssc > 0 ? (c*Vup*Vup)/Ssc : 0;
    const XsUp = ZsUpMag * (xrUp/Math.sqrt(1+xrUp*xrUp)); const RsUp = xrUp > 0 ? XsUp/xrUp : ZsUpMag;
    const referFactor = Vup > 0 ? Math.pow(Vn/Vup, 2) : 0;
    const Rs = RsUp*referFactor, Xs = XsUp*referFactor;
    const ZbaseT = Mva > 0 ? (Vn*Vn)/Mva : 0; const Z1Tmag = (Zpc/100)*ZbaseT;
    const Xt = Z1Tmag * (xrT/Math.sqrt(1+xrT*xrT)); const Rt = xrT > 0 ? Xt/xrT : Z1Tmag;
    const R1 = Rs+Rt, X1 = Xs+Xt;
    Z1 = Math.sqrt(R1*R1+X1*X1);
    xrCombined = R1 > 0 ? X1/R1 : xrT;
    upstreamLabel = `Ssc = ${Ssc} MVA`;
    upstreamHtml = `<div class="result-line"><span>Upstream source impedance (referred)</span><b>${Math.sqrt(Rs*Rs+Xs*Xs).toFixed(4)} Ω</b></div><div class="result-line"><span>Transformer impedance</span><b>${Z1Tmag.toFixed(4)} Ω</b></div><div class="result-line"><span>Combined X/R ratio</span><b>${xrCombined.toFixed(2)}</b></div>`;
  } else {
    const Zbase = Mva > 0 ? (Vn*Vn)/Mva : 0; Z1 = (Zpc/100)*Zbase; xrCombined = safeNum(document.getElementById('fXr').value, 15);
    upstreamHtml = `<div class="result-line"><span>Base impedance (Zbase)</span><b>${Zbase.toFixed(4)} Ω</b></div>`;
  }
  const Z0 = Z1*Z0Ratio; const Z2 = Z1;
  let IkA;
  if (currentFaultType === '3ph'){ IkA = (c*Vn*1000) / (Math.sqrt(3)*Z1) / 1000; }
  else if (currentFaultType === '2ph'){ IkA = (c*Vn*1000) / (2*Z1) / 1000; }
  else if (currentFaultType === '1ph'){ IkA = (Math.sqrt(3)*c*Vn*1000) / (2*Z1+Z0) / 1000; }
  else { const Ea = c*Vn*1000/Math.sqrt(3); const I1 = Ea / (Z1 + (Z2*Z0)/(Z2+Z0)); const I2 = -I1 * Z0/(Z2+Z0); const I0 = -I1 * Z2/(Z2+Z0); const aOp = polarToRect(1,120); const a2Op = polarToRect(1,240); const Ib = complexAdd({re:I0,im:0}, complexAdd(complexMul(a2Op,{re:I1,im:0}), complexMul(aOp,{re:I2,im:0}))); IkA = rectToPolar(Ib).mag / 1000; }
  const IkA_base = Vn > 0 ? Mva/(Math.sqrt(3)*Vn) : 0; const kappa = 1.02 + 0.98*Math.exp(-3/xrCombined); const ipeak = kappa * Math.sqrt(2) * IkA;
  document.getElementById('fResults').innerHTML = `${upstreamHtml}<div class="result-line"><span>Positive-seq impedance Z1 (total)</span><b>${Z1.toFixed(4)} Ω</b></div><div class="result-line"><span>Zero-seq impedance Z0</span><b>${Z0.toFixed(4)} Ω</b></div><div class="result-line"><span>Rated full-load current</span><b>${IkA_base.toFixed(3)} kA</b></div><div class="result-line"><span>Fault current I''k (${FAULT_LABELS[currentFaultType]})</span><b>${IkA.toFixed(3)} kA</b></div><div class="result-line"><span>Asymmetry factor κ</span><b>${kappa.toFixed(3)}</b></div><div class="result-line"><span>Peak fault current ip</span><b>${ipeak.toFixed(3)} kA</b></div>`;
  drawSLD(Vn, Mva, Zpc, IkA, ipeak, FAULT_LABELS[currentFaultType], upstreamLabel);
}

// ===================== Transformer FLC & Fault Current =====================
function renderTxfmr(container){
  container.innerHTML = `
    <h2>Transformer FLC &amp; Fault Current <span class="std-badge">AS/NZS 60076.1 / AS/NZS 60909 (simplified)</span></h2>
    <p class="tool-desc">Full-load current and expected fault current from transformer nameplate data.</p>
    <div class="grid">
      <div class="card">
        <div class="field" style="margin-bottom:14px;">
          <label>Transformer type</label>
          <div class="fault-type-grid" data-savegroup="xfmrType" style="grid-template-columns:1fr 1fr;">
            <button type="button" class="fault-type-btn active" data-value="3ph">Three-Phase</button>
            <button type="button" class="fault-type-btn" data-value="1ph">Single-Phase</button>
          </div>
        </div>
        <div class="compact-form">
          <div class="field"><label>Rated power</label><div class="row2"><input id="tMva" type="number" value="10" step="0.1"><select id="tMvaUnit"><option value="MVA">MVA</option><option value="kVA">kVA</option></select></div></div>
          <div class="field"><label>Impedance %Z</label><input id="tZpc" type="number" value="8" step="0.1"></div>
          <div class="field"><label>Primary</label><div class="row2"><input id="tVp" type="number" value="66" step="0.1"><select id="tVpUnit"><option value="kV">kV</option><option value="V">V</option></select></div></div>
          <div class="field"><label>Secondary</label><div class="row2"><input id="tVs" type="number" value="11" step="0.1"><select id="tVsUnit"><option value="kV">kV</option><option value="V">V</option></select></div></div>
        </div>
      </div>
      <div class="card"><div class="results centered" id="tResults"></div></div>
    </div>
  `;
  container.querySelectorAll('.fault-type-btn').forEach(btn => { btn.onclick = () => { container.querySelectorAll('.fault-type-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); calcTxfmr(); }; });
  ['tMva','tZpc','tVp','tVs','tMvaUnit','tVpUnit','tVsUnit'].forEach(id => { const el = document.getElementById(id); el.addEventListener('input', calcTxfmr); el.addEventListener('change', calcTxfmr); });
  calcTxfmr();
  renderFormulaBlock(container, 'Reference formulas', [
    String.raw`\text{FLC}_{3\phi} = \dfrac{S}{\sqrt{3}\,V_{LL}}, \quad \text{FLC}_{1\phi} = \dfrac{S}{V}`,
    String.raw`I''_k = \dfrac{\text{FLC}}{Z_{pu}}`
  ]);
}
function calcTxfmr(){
  const panel = document.getElementById('panel-txfmr');
  const type = panel.querySelector('.fault-type-btn.active').dataset.value;
  const mvaUnit = document.getElementById('tMvaUnit').value; const vpUnit = document.getElementById('tVpUnit').value; const vsUnit = document.getElementById('tVsUnit').value;
  let mva = safeNum(document.getElementById('tMva').value, 10); if (mvaUnit === 'kVA') mva /= 1000;
  let vp = safeNum(document.getElementById('tVp').value, 66); if (vpUnit === 'V') vp /= 1000;
  let vs = safeNum(document.getElementById('tVs').value, 11); if (vsUnit === 'V') vs /= 1000;
  const zpc = safeNum(document.getElementById('tZpc').value, 8);
  const divisor = type === '1ph' ? 1 : Math.sqrt(3);
  const flcPrimary = (mva*1e6)/(divisor*vp*1e3); const flcSecondary = (mva*1e6)/(divisor*vs*1e3);
  const faultPrimary = flcPrimary/(zpc/100); const faultSecondary = flcSecondary/(zpc/100);
  document.getElementById('tResults').innerHTML = `
    <div class="result-line"><span>Transformer type</span><b>${type==='1ph'?'Single-Phase':'Three-Phase'}</b></div>
    <div class="result-line"><span>Primary FLC</span><b>${flcPrimary.toFixed(1)} A</b></div>
    <div class="result-line"><span>Secondary FLC</span><b>${flcSecondary.toFixed(1)} A</b></div>
    <div class="result-line"><span>Primary fault current</span><b>${faultPrimary.toFixed(0)} A (${(faultPrimary/1000).toFixed(2)} kA)</b></div>
    <div class="result-line"><span>Secondary fault current</span><b>${faultSecondary.toFixed(0)} A (${(faultSecondary/1000).toFixed(2)} kA)</b></div>
  `;
}

// ===================== Loss of Field (40) Mho Setting Calculator =====================
let lofChart = null;
const LOF_PRESETS = {
  '492': { label: '492 MVA unit (calculated)', values: { lofMode:'calc', lofV:'20', lofMva:'492', lofPT:'167', lofCT:'3600', lofXd:'1.1888', lofXdp:'0.20577', lofZ1t:'0.1', lofZ2t:'0.5' } },
  '158': { label: "15.8 MVA test settings (manual)", values: { lofMode:'manual', lofV:'11', lofMva:'15.829', lofPT:'167', lofCT:'3600', lofXd:'1.18', lofXdp:'0.2', lofZ1d:'114.7', lofZ1o:'-12.6', lofZ2d:'149.1', lofZ2o:'-12.6', lofZ1t:'0.5', lofZ2t:'3' } },
};
function renderLossOfField(container){
  container.innerHTML = `
    <h2>Loss of Field (40) Mho Setting Calculator <span class="std-badge">Dual Mho, R-X Plane</span></h2>
    <p class="tool-desc">Calculate dual-zone offset mho loss-of-field settings from generator nameplate data, and visualise the characteristic on the R-X impedance plane. Zone 1 (fast) is sized on transient reactance Xd'; Zone 2 (slow, all LOF conditions) is sized on synchronous reactance Xd.</p>
    <div class="grid">
      <div class="card">
        <div class="field"><label>Load example</label><select id="lofPreset"><option value="">— pick a preset —</option>${Object.entries(LOF_PRESETS).map(([k,p]) => `<option value="${k}">${p.label}</option>`).join('')}</select></div>
        <div class="compact-form">
          <div class="field"><label>Voltage, line-line (kV)</label><input id="lofV" type="number" value="20" step="0.1"></div>
          <div class="field"><label>Rated power (MVA)</label><input id="lofMva" type="number" value="492" step="0.1"></div>
          <div class="field"><label>PT ratio</label><input id="lofPT" type="number" value="167" step="1"></div>
          <div class="field"><label>CT ratio</label><input id="lofCT" type="number" value="3600" step="1"></div>
          <div class="field"><label>Xd (pu, synchronous reactance)</label><input id="lofXd" type="number" value="1.1888" step="0.001"></div>
          <div class="field"><label>Xd' (pu, transient reactance)</label><input id="lofXdp" type="number" value="0.20577" step="0.001"></div>
        </div>
        <hr style="border-color:var(--border);margin:14px 0;">
        <div class="field"><label>Zone sizes</label><div class="fault-type-grid" data-savegroup="lofMode"><button class="fault-type-btn active" data-value="calc">Calculate from Xd, Xd'</button><button class="fault-type-btn" data-value="manual">Enter diameter/offset</button></div></div>
        <div class="compact-form" id="lofManualWrap" style="display:none;margin-top:10px;">
          <div class="field"><label>Zone 1 diameter (Ω sec)</label><input id="lofZ1d" type="number" value="17.53" step="0.01"></div>
          <div class="field"><label>Zone 1 offset (Ω sec)</label><input id="lofZ1o" type="number" value="-1.8" step="0.01"></div>
          <div class="field"><label>Zone 2 diameter (Ω sec)</label><input id="lofZ2d" type="number" value="20.83" step="0.01"></div>
          <div class="field"><label>Zone 2 offset (Ω sec)</label><input id="lofZ2o" type="number" value="-1.8" step="0.01"></div>
        </div>
        <hr style="border-color:var(--border);margin:14px 0;">
        <div class="field"><label>Zone 1 trip time (s)</label><input id="lofZ1t" type="number" value="0.1" step="0.01"></div>
        <div class="field"><label>Zone 2 trip time (s)</label><input id="lofZ2t" type="number" value="0.5" step="0.01"></div>
        <div class="results" id="lofResults"></div>
      </div>
      <div class="chart-wrap"><canvas id="lofCanvas"></canvas><table class="ref-table" id="lofOmicronTable" style="margin-top:16px;"></table></div>
    </div>
    <div class="card" style="margin-top:16px;">
      <p class="note" style="margin:0;">ZB = (V²/MVA) × (CT/PT). VNOM = V×1000/PT. INOM = (MVA×10<sup>6</sup>)/(√3×V×1000)/CT. Zone 1 diameter = 1.0 pu (= ZB), offset = &minus;Xd'×ZB/2. Zone 2 diameter = Xd×ZB, offset = same as Zone 1. Both circles are centred on the negative reactance axis (offset mho into ‑jX), per standard generator loss-of-field protection practice. Omicron |Z|/Phi: circle centre = offset − diameter/2; |Z| = |centre|; Phi = 270° if the centre is below the R axis (offset mho, the normal case), else 90°. Verify against relay-specific setting conventions (e.g. SEL, GE) before commissioning.</p>
    </div>
  `;
  document.getElementById('lofPreset').addEventListener('change', (e) => {
    const key = e.target.value; if (!key) return;
    const vals = LOF_PRESETS[key].values;
    Object.entries(vals).forEach(([id,val]) => {
      if (id === 'lofMode'){ document.querySelector(`[data-savegroup="lofMode"] [data-value="${val}"]`).click(); return; }
      const el = document.getElementById(id); if (el) el.value = val;
    });
    e.target.value = '';
    calcLossOfField();
  });
  container.querySelectorAll('[data-savegroup="lofMode"] .fault-type-btn').forEach(btn => { btn.onclick = () => { container.querySelectorAll('[data-savegroup="lofMode"] .fault-type-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); document.getElementById('lofManualWrap').style.display = btn.dataset.value==='manual' ? '' : 'none'; calcLossOfField(); }; });
  ['lofV','lofMva','lofPT','lofCT','lofXd','lofXdp','lofZ1d','lofZ1o','lofZ2d','lofZ2o','lofZ1t','lofZ2t'].forEach(id => { document.getElementById(id).addEventListener('input', calcLossOfField); });
  calcLossOfField();
}
function lofOmicron(diameter, offset){
  const centre = offset - diameter/2;
  return { z: Math.abs(centre), phi: centre < 0 ? 270 : 90, radius: diameter/2 };
}
function drawMhoCircles(zones){
  const canvas = document.getElementById('lofCanvas'); if (!canvas) return; const ctx = canvas.getContext('2d');
  const datasets = zones.map(z => {
    const points = []; for (let a = 0; a <= 360; a += 2){ const rad = a * Math.PI/180; const x = z.centerR + z.radius*Math.cos(rad); const y = z.centerX + z.radius*Math.sin(rad); points.push({x, y}); }
    return { label: z.label, data: points, borderColor: z.color, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, showLine: true, fill: false, parsing: false };
  });
  // Chart.js's auto-scale can pick an axis window that doesn't even cover the data when two
  // circles of different size/offset are plotted together (observed: window ended up entirely
  // to one side of an origin-centred circle). Compute explicit, equal-span bounds ourselves.
  let boundsX = [0], boundsY = [0];
  zones.forEach(z => { boundsX.push(z.centerR - z.radius, z.centerR + z.radius); boundsY.push(z.centerX - z.radius, z.centerX + z.radius); });
  const minDataX = Math.min(...boundsX), maxDataX = Math.max(...boundsX), minDataY = Math.min(...boundsY), maxDataY = Math.max(...boundsY);
  const span = Math.max(maxDataX-minDataX, maxDataY-minDataY, 1) * 1.15;
  const midX = (minDataX+maxDataX)/2, midY = (minDataY+maxDataY)/2;
  const minX = midX-span/2, maxX = midX+span/2, minY = midY-span/2, maxY = midY+span/2;
  if (lofChart) lofChart.destroy();
  lofChart = safeChart(ctx, { type: 'line', data: { datasets }, options: { responsive: true, parsing: false, aspectRatio: 1, scales: { x: { type:'linear', min:minX, max:maxX, title:{display:true,text:'R (Ω secondary)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'} }, y: { type:'linear', min:minY, max:maxY, title:{display:true,text:'X (Ω secondary)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#2a3654'} } }, plugins: { legend: { labels: { color: '#e7ecf7' } } } } });
}
function calcLossOfField(){
  const panel = document.getElementById('panel-lof');
  const mode = panel.querySelector('[data-savegroup="lofMode"] .active').dataset.value;
  const V = safeNum(document.getElementById('lofV').value, 20); const MVA = safeNum(document.getElementById('lofMva').value, 492); const PT = safeNum(document.getElementById('lofPT').value, 167); const CT = safeNum(document.getElementById('lofCT').value, 3600);
  const Xd = safeNum(document.getElementById('lofXd').value, 1.1888); const Xdp = safeNum(document.getElementById('lofXdp').value, 0.20577); const Z1t = safeNum(document.getElementById('lofZ1t').value, 0.1); const Z2t = safeNum(document.getElementById('lofZ2t').value, 0.5);
  const ZB = (V*V/MVA)*(CT/PT); const VNOM = V*1000/PT; const INOM = (MVA*1e6)/(Math.sqrt(3)*V*1000)/CT;
  let Z1_diameter, Z1_offset, Z2_diameter, Z2_offset;
  if (mode === 'manual'){
    Z1_diameter = safeNum(document.getElementById('lofZ1d').value, 17.53); Z1_offset = safeNum(document.getElementById('lofZ1o').value, -1.8);
    Z2_diameter = safeNum(document.getElementById('lofZ2d').value, 20.83); Z2_offset = safeNum(document.getElementById('lofZ2o').value, -1.8);
  } else {
    Z1_diameter = ZB; Z1_offset = -Xdp*ZB/2; Z2_diameter = Xd*ZB; Z2_offset = Z1_offset;
  }
  const Z1_radius = Z1_diameter/2; const Z2_radius = Z2_diameter/2; const Z1_centerX = Z1_offset - Z1_radius; const Z2_centerX = Z2_offset - Z2_radius;
  let warnHtml = '';
  if (Z2_diameter < Z1_diameter) warnHtml += `<div class="result-flag flag-warn">⚠ Zone 2 diameter is smaller than Zone 1.</div>`;
  if (Z2t < Z1t) warnHtml += `<div class="result-flag flag-warn">⚠ Zone 2 trip time is shorter than Zone 1.</div>`;
  if (mode !== 'manual' && (Xd > 5 || Xdp > 5)) warnHtml += `<div class="result-flag flag-warn">⚠ Xd / Xd' look like percentages. Enter them in per-unit (e.g. 1.19, not 119).</div>`;
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
    ${warnHtml}
  `;
  const o1 = lofOmicron(Z1_diameter, Z1_offset), o2 = lofOmicron(Z2_diameter, Z2_offset);
  document.getElementById('lofOmicronTable').innerHTML = `<thead><tr><th>Omicron test values</th><th>|Z| (Ω)</th><th>Phi (°)</th><th>Radius (Ω)</th><th>Start (°)</th><th>End (°)</th></tr></thead><tbody>
    <tr><td>Zone 1</td><td>${o1.z.toFixed(3)}</td><td>${o1.phi}</td><td>${o1.radius.toFixed(3)}</td><td>360</td><td>0</td></tr>
    <tr><td>Zone 2</td><td>${o2.z.toFixed(3)}</td><td>${o2.phi}</td><td>${o2.radius.toFixed(3)}</td><td>360</td><td>0</td></tr>
  </tbody>`;
  drawMhoCircles([
    {label:`Zone 2 (Xd, ${Z2t}s)`, centerR:0, centerX:Z2_centerX, radius:Z2_radius, color:'#ffb74f'},
    {label:`Zone 1 (Xd', ${Z1t}s)`, centerR:0, centerX:Z1_centerX, radius:Z1_radius, color:'#4fb0ff'},
  ]);
}

// ===================== Distance Protection (Quad / Mho) Calculator =====================
const DP_RELAY_PRESETS = {
  generic: {
    label: 'Generic (R-X Ohms)',
    fieldLabels: {
      r1: 'R1 reach, Ph-Ph (Ω)', x1: 'X1 reach, Ph-Ph (Ω)', r0: 'R0 reach, zero-seq (Ω)', x0: 'X0 reach, zero-seq (Ω)',
      minRis: 'Min resistive reach, Ph-Ph (Ω)', maxRis: 'Max resistive reach, Ph-Ph (Ω)', minRisGE: 'Min resistive reach, Ph-E (Ω)', maxRisGE: 'Max resistive reach, Ph-E (Ω)', rev: 'Reverse reach override (Ω, mho, 0=auto)',
      maxAng: 'Right blinder angle (deg)', minAng: 'Left blinder angle (deg)', tilt: 'Tilt angle (deg)'
    },
    note: "Generic quadrilateral/mho R-X plane model using plain engineering terminology. Verify field mapping against your specific relay's setting/application manual before commissioning."
  },
  abb630: {
    label: 'ABB Relion REx630',
    fieldLabels: {
      r1: 'R1 Zone, Ph-Ph (Ω)', x1: 'X1 Zone, Ph-Ph (Ω)', r0: 'R0 Zone, zero-seq (Ω)', x0: 'X0 Zone, zero-seq (Ω)',
      minRis: 'Min Ris Reach, Ph-Ph (Ω)', maxRis: 'Max Ris Reach, Ph-Ph (Ω)', minRisGE: 'Min Ris Reach, Ph-E (Ω)', maxRisGE: 'Max Ris Reach, Ph-E (Ω)', rev: 'Circle Radius override (Ω, mho, 0=auto)',
      maxAng: 'Max Phase Angle (right blinder, deg)', minAng: 'Min Phase Angle (left blinder, deg)', tilt: 'Tilt angle (deg, +ve increases area)'
    },
    note: 'ABB REx630-style parameter names. Ph-E reach auto-derived via (2×Z1+Z0)/3, matching the relay setting-sheet formula. Verified against REx630 example data.'
  }
};
let distChart = null;
if (typeof Chart !== 'undefined' && !Chart._dpLabelPluginRegistered) {
  Chart.register({
    id: 'dpLabelPlugin',
    afterDatasetsDraw(chart){
      const ctx = chart.ctx;
      chart.data.datasets.forEach((ds, dsIndex) => {
        if (!ds.showLabels) return;
        const meta = chart.getDatasetMeta(dsIndex);
        meta.data.forEach((point, idx) => {
          const raw = ds.data[idx];
          if (!raw) return;
          ctx.save();
          ctx.fillStyle = '#e7ecf7';
          ctx.font = '10px Segoe UI';
          ctx.fillText(`(${raw.x.toFixed(1)}, ${raw.y.toFixed(1)})`, point.x + 5, point.y - 5);
          ctx.restore();
        });
      });
    }
  });
  Chart._dpLabelPluginRegistered = true;
}
function renderDistProt(container){
  container.innerHTML = `
    <h2>Distance Protection Zone Plotter <span class="std-badge">Quadrilateral / Mho, R-X Plane</span></h2>
    <p class="tool-desc">Plot a distance protection zone characteristic (quadrilateral or mho) on the R-X impedance plane. Choose a relay type below to switch parameter naming conventions — the underlying reach geometry is the same generic model either way. Ph-E reach is derived automatically from Ph-Ph reach and zero-sequence impedance: (2×Z1+Z0)/3.</p>
    <div class="grid">
      <div class="card">
        <div class="field"><label>Relay type / convention</label><select id="dpRelayType">${Object.entries(DP_RELAY_PRESETS).map(([k,v]) => `<option value="${k}" ${k==='abb630'?'selected':''}>${v.label}</option>`).join('')}</select></div>
        <label style="display:block;font-size:0.78rem;color:var(--text-dim);margin-bottom:8px;">Characteristic</label>
        <div class="fault-type-grid" data-savegroup="dpType"><button class="dp-type-btn active" data-value="quad">Quadrilateral</button><button class="dp-type-btn" data-value="mho">Mho (circular)</button></div>
        <label style="display:block;font-size:0.78rem;color:var(--text-dim);margin:12px 0 8px;">Loop</label>
        <div class="fault-type-grid" data-savegroup="dpLoop"><button class="dp-loop-btn active" data-value="phph">Ph-Ph</button><button class="dp-loop-btn" data-value="phe">Ph-E</button></div>
        <div class="compact-form" style="margin-top:12px;">
          <div class="field"><label id="dpR1Label">R1 Zone, Ph-Ph (Ω)</label><input id="dpR1" type="number" value="12.86" step="0.01"></div>
          <div class="field"><label id="dpX1Label">X1 Zone, Ph-Ph (Ω)</label><input id="dpX1" type="number" value="28.78" step="0.01"></div>
          <div class="field"><label id="dpR0Label">R0 Zone, zero-seq (Ω)</label><input id="dpR0" type="number" value="5" step="0.01"></div>
          <div class="field"><label id="dpX0Label">X0 Zone, zero-seq (Ω)</label><input id="dpX0" type="number" value="65.5" step="0.01"></div>
          <div class="field" id="dpRisWrap"><label id="dpMinRisLabel">Min Ris Reach, Ph-Ph (Ω)</label><input id="dpMinRisPP" type="number" value="10" step="0.01"></div>
          <div class="field" id="dpMaxRisWrap"><label id="dpMaxRisLabel">Max Ris Reach, Ph-Ph (Ω)</label><input id="dpMaxRisPP" type="number" value="10" step="0.01"></div>
          <div class="field" id="dpRisGEWrap"><label id="dpMinRisGELabel">Min Ris Reach, Ph-E (Ω)</label><input id="dpMinRisGE" type="number" value="100" step="0.01"></div>
          <div class="field" id="dpMaxRisGEWrap"><label id="dpMaxRisGELabel">Max Ris Reach, Ph-E (Ω)</label><input id="dpMaxRisGE" type="number" value="100" step="0.01"></div>
          <div class="field" id="dpRevWrap" style="display:none;"><label id="dpRevLabel">Circle Radius override (Ω, mho, 0=auto)</label><input id="dpRev" type="number" value="0" step="0.01"></div>
          <div class="field"><label id="dpMaxAngLabel">Max Phase Angle (right blinder, deg)</label><input id="dpMaxAng" type="number" value="45" step="0.1" min="0" max="60"></div>
          <div class="field"><label id="dpMinAngLabel">Min Phase Angle (left blinder, deg)</label><input id="dpMinAng" type="number" value="115" step="0.1" min="90" max="150"></div>
          <div class="field"><label id="dpTiltLabel">Tilt angle (deg, +ve increases area)</label><input id="dpTilt" type="number" value="0" step="0.1" min="-45" max="45"></div>
        </div>
        <div class="checkrow"><input type="checkbox" id="dpShowBlinders" checked><label for="dpShowBlinders" style="margin:0;">Show directional load blinders</label></div>
        <div class="checkrow"><input type="checkbox" id="dpShowLabels" checked><label for="dpShowLabels" style="margin:0;">Show vertex coordinates</label></div>
        <div class="results" id="dpResults"></div>
      </div>
      <div class="chart-wrap"><canvas id="dpCanvas"></canvas></div>
    </div>
    <div class="card" style="margin-top:16px;"><p class="note" style="margin:0;" id="dpPresetNote"></p></div>
    <div class="card" style="margin-top:16px;"><p class="note" style="margin:0;">Ph-E reach: R1_PhE = (2×R1_PhPh + R0)/3, X1_PhE = (2×X1_PhPh + X0)/3 — each loop uses its own Min/Max Ris Reach. Quadrilateral vertices: origin → (MinRis, −MinRis·tan(MaxAngle)) → (MinRis, (MinRis−MaxRis)·X1/R1) → (MaxRis+R1, X1) → (X1/tan(MinAngle), X1) → origin, rotated by the tilt angle. The middle vertex is the true intersection of the R=MinRis blinder with the reach-parallel line through R=MaxRis — it only sits on the R axis when MinRis equals MaxRis. Mho: circle with diameter between forward reach R1∠(atan2(X1,R1)) and the reverse point (0 = self-polarised), or overridden directly by the reverse reach field. Simplified for visualisation only — verify against the relay's technical/application manual before commissioning.</p></div>
  `;
  container.querySelectorAll('.dp-type-btn').forEach(btn => { btn.onclick = () => { container.querySelectorAll('.dp-type-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); const isQuad = btn.dataset.value==='quad'; document.getElementById('dpRisWrap').style.display = isQuad ? '' : 'none'; document.getElementById('dpMaxRisWrap').style.display = isQuad ? '' : 'none'; document.getElementById('dpRisGEWrap').style.display = isQuad ? '' : 'none'; document.getElementById('dpMaxRisGEWrap').style.display = isQuad ? '' : 'none'; document.getElementById('dpRevWrap').style.display = isQuad ? 'none' : ''; calcDistProt(); }; });
  container.querySelectorAll('.dp-loop-btn').forEach(btn => { btn.onclick = () => { container.querySelectorAll('.dp-loop-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); calcDistProt(); }; });
  document.getElementById('dpRelayType').addEventListener('change', () => { applyDpPreset(); calcDistProt(); });
  ['dpR1','dpX1','dpR0','dpX0','dpMinRisPP','dpMaxRisPP','dpMinRisGE','dpMaxRisGE','dpRev','dpMaxAng','dpMinAng','dpTilt','dpShowBlinders','dpShowLabels'].forEach(id => { document.getElementById(id).addEventListener('input', calcDistProt); document.getElementById(id).addEventListener('change', calcDistProt); });
  applyDpPreset();
  calcDistProt();
}
function applyDpPreset(){
  const key = document.getElementById('dpRelayType').value;
  const preset = DP_RELAY_PRESETS[key] || DP_RELAY_PRESETS.generic;
  const map = { dpR1Label:'r1', dpX1Label:'x1', dpR0Label:'r0', dpX0Label:'x0', dpMinRisLabel:'minRis', dpMaxRisLabel:'maxRis', dpMinRisGELabel:'minRisGE', dpMaxRisGELabel:'maxRisGE', dpRevLabel:'rev', dpMaxAngLabel:'maxAng', dpMinAngLabel:'minAng', dpTiltLabel:'tilt' };
  Object.entries(map).forEach(([elId,fk]) => { const el = document.getElementById(elId); if (el) el.textContent = preset.fieldLabels[fk] || el.textContent; });
  const noteEl = document.getElementById('dpPresetNote'); if (noteEl) noteEl.textContent = preset.note;
}
function dpRotate(pt, tiltRad){ return { x: pt.x*Math.cos(tiltRad) - pt.y*Math.sin(tiltRad), y: pt.x*Math.sin(tiltRad) + pt.y*Math.cos(tiltRad) }; }
function calcDistProt(){
  const panel = document.getElementById('panel-distprot');
  const type = panel.querySelector('.dp-type-btn.active').dataset.value;
  const loop = panel.querySelector('.dp-loop-btn.active').dataset.value;
  const R1pp = safeNum(document.getElementById('dpR1').value, 12.86);
  const X1pp = safeNum(document.getElementById('dpX1').value, 28.78);
  const R0 = safeNum(document.getElementById('dpR0').value, 5);
  const X0 = safeNum(document.getElementById('dpX0').value, 65.5);
  const MinRisPP = safeNum(document.getElementById('dpMinRisPP').value, 10);
  const MaxRisPP = safeNum(document.getElementById('dpMaxRisPP').value, 10);
  const MinRisGE = safeNum(document.getElementById('dpMinRisGE').value, 100);
  const MaxRisGE = safeNum(document.getElementById('dpMaxRisGE').value, 100);
  const Rev = safeNum(document.getElementById('dpRev').value, 0);
  const maxAngDeg = safeNum(document.getElementById('dpMaxAng').value, 45);
  const minAngDeg = safeNum(document.getElementById('dpMinAng').value, 115);
  const tiltDeg = safeNum(document.getElementById('dpTilt').value, 0);
  const showBlinders = document.getElementById('dpShowBlinders').checked;
  const showLabels = document.getElementById('dpShowLabels').checked;
  const tiltRad = tiltDeg*Math.PI/180;
  const maxAngRad = maxAngDeg*Math.PI/180, minAngRad = minAngDeg*Math.PI/180;

  const R1e = (2*R1pp + R0)/3;
  const X1e = (2*X1pp + X0)/3;
  const R1 = loop==='phph' ? R1pp : R1e;
  const X1 = loop==='phph' ? X1pp : X1e;
  const MinRis = loop==='phph' ? MinRisPP : MinRisGE;
  const MaxRis = loop==='phph' ? MaxRisPP : MaxRisGE;
  const lineAngleDeg = Math.atan2(X1, R1)*180/Math.PI;

  const datasets = [];
  let resultsHtml = `<div class="result-line"><span>Ph-Ph line angle</span><b>${(Math.atan2(X1pp,R1pp)*180/Math.PI).toFixed(2)}°</b></div><div class="result-line"><span>Ph-E R1 / X1 (derived)</span><b>${R1e.toFixed(2)} / ${X1e.toFixed(2)} Ω</b></div><div class="result-line"><span>Ph-E line angle</span><b>${(Math.atan2(X1e,R1e)*180/Math.PI).toFixed(2)}°</b></div><div class="result-line"><span>Active loop line angle</span><b>${lineAngleDeg.toFixed(2)}°</b></div>`;
  if (R1 <= 0 || X1 <= 0) resultsHtml += `<div class="result-flag flag-warn">⚠ R1 and X1 must be positive for the active loop.</div>`;
  if (minAngDeg <= 90 || minAngDeg >= 180) resultsHtml += `<div class="result-flag flag-warn">⚠ Min phase angle is normally between 90° and 180°.</div>`;
  if (maxAngDeg <= 0 || maxAngDeg >= 90) resultsHtml += `<div class="result-flag flag-warn">⚠ Max phase angle is normally between 0° and 90°.</div>`;

  let boundsX = [0], boundsY = [0];
  if (type === 'quad'){
    const cornerY = R1 > 0 ? (MinRis-MaxRis)*X1/R1 : 0;
    if (MinRis !== MaxRis) resultsHtml += `<div class="note">Min/Max Ris Reach differ for this loop, so the blinder-to-reach-line corner sits off the R axis at (${MinRis.toFixed(2)}, ${cornerY.toFixed(2)}) rather than on it.</div>`;
    const verts = [
      {x:0, y:0},
      {x:MinRis, y:-MinRis*Math.tan(maxAngRad)},
      {x:MinRis, y:cornerY},
      {x:MaxRis+R1, y:X1},
      {x:X1/Math.tan(minAngRad), y:X1},
      {x:0, y:0},
    ].map(p => dpRotate(p, tiltRad));
    verts.forEach(v => { boundsX.push(v.x); boundsY.push(v.y); });
    datasets.push({ label:`${loop==='phph'?'Ph-Ph':'Ph-E'} Quadrilateral Zone`, data:verts, borderColor:'#4fb0ff', backgroundColor:'rgba(79,176,255,0.10)', fill:true, borderWidth:2, pointRadius:3, pointBackgroundColor:'#4fb0ff', showLine:true, parsing:false, showLabels:showLabels });
    resultsHtml += `<div class="result-line"><span>Vertex (right blinder base)</span><b>(${verts[1].x.toFixed(2)}, ${verts[1].y.toFixed(2)})</b></div><div class="result-line"><span>Vertex (top-right, Max+R1, X1)</span><b>(${verts[3].x.toFixed(2)}, ${verts[3].y.toFixed(2)})</b></div><div class="result-line"><span>Vertex (top-left, load blinder)</span><b>(${verts[4].x.toFixed(2)}, ${verts[4].y.toFixed(2)})</b></div>`;
  } else {
    const fwd = {x:R1, y:X1};
    const revAngRad = Math.atan2(X1,R1) + Math.PI;
    const revMag = Rev > 0 ? Rev : 0;
    const revPt = {x:revMag*Math.cos(revAngRad), y:revMag*Math.sin(revAngRad)};
    const center = dpRotate({x:(fwd.x+revPt.x)/2, y:(fwd.y+revPt.y)/2}, tiltRad);
    const radius = Math.sqrt((fwd.x-revPt.x)**2 + (fwd.y-revPt.y)**2)/2;
    const circlePts = [];
    for (let a=0; a<=360; a+=4){ const rad=a*Math.PI/180; circlePts.push({x:center.x+radius*Math.cos(rad), y:center.y+radius*Math.sin(rad)}); }
    datasets.push({ label:`${loop==='phph'?'Ph-Ph':'Ph-E'} Mho Zone`, data:circlePts, borderColor:'#4fd88a', backgroundColor:'rgba(79,216,138,0.10)', fill:true, borderWidth:2, pointRadius:0, showLine:true, parsing:false });
    const keyPts = [dpRotate(fwd,tiltRad), dpRotate(revPt,tiltRad)];
    datasets.push({ label:'Mho key points', data:keyPts, borderColor:'#4fd88a', backgroundColor:'#4fd88a', pointRadius:4, showLine:false, type:'scatter', parsing:false, showLabels:showLabels });
    boundsX.push(center.x-radius, center.x+radius); boundsY.push(center.y-radius, center.y+radius);
    resultsHtml += `<div class="result-line"><span>Circle centre</span><b>(${center.x.toFixed(2)}, ${center.y.toFixed(2)}) Ω</b></div><div class="result-line"><span>Circle radius (diameter/2)</span><b>${radius.toFixed(2)} Ω</b></div>`;
  }

  const spanMaxX = Math.max(...boundsX.map(Math.abs), 1);
  const spanMaxY = Math.max(...boundsY.map(Math.abs), 1);
  const padX = Math.max(spanMaxX, spanMaxY) * 1.35;
  const minX = Math.min(...boundsX) - padX*0.15, maxX = Math.max(...boundsX) + padX*0.15;
  const minY = Math.min(...boundsY) - padX*0.15, maxY = Math.max(...boundsY) + padX*0.15;

  datasets.push({ label:'R axis', data:[{x:minX,y:0},{x:maxX,y:0}], borderColor:'#2a3654', borderWidth:1, pointRadius:0, showLine:true, fill:false, parsing:false });
  datasets.push({ label:'X axis', data:[{x:0,y:minY},{x:0,y:maxY}], borderColor:'#2a3654', borderWidth:1, pointRadius:0, showLine:true, fill:false, parsing:false });
  datasets.push({ label:'Origin', data:[{x:0,y:0}], borderColor:'#e7ecf7', backgroundColor:'#e7ecf7', pointRadius:4, showLine:false, type:'scatter', parsing:false, showLabels:showLabels });

  if (showBlinders){
    const spanLen = Math.max(spanMaxX, spanMaxY) * 1.3;
    const rightBlinder = [ dpRotate({x:0,y:0}, tiltRad), dpRotate({x:spanLen*Math.cos(-maxAngRad), y:spanLen*Math.sin(-maxAngRad)}, tiltRad) ];
    const leftBlinder = [ dpRotate({x:0,y:0}, tiltRad), dpRotate({x:spanLen*Math.cos(minAngRad), y:spanLen*Math.sin(minAngRad)}, tiltRad) ];
    datasets.push({ label:'Right load blinder (Max Phase Angle)', data:rightBlinder, borderColor:'#ffb74f', borderDash:[6,4], borderWidth:1.5, pointRadius:0, showLine:true, fill:false, parsing:false });
    datasets.push({ label:'Left load blinder (Min Phase Angle)', data:leftBlinder, borderColor:'#c792ea', borderDash:[6,4], borderWidth:1.5, pointRadius:0, showLine:true, fill:false, parsing:false });
  }

  const ctx = document.getElementById('dpCanvas');
  if (distChart) distChart.destroy();
  distChart = safeChart(ctx, { type:'line', data:{datasets}, options:{ responsive:true, parsing:false, aspectRatio:1.1, scales:{ x:{type:'linear', min:minX, max:maxX, title:{display:true,text:'R (Ω secondary)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#1c2740'}}, y:{type:'linear', min:minY, max:maxY, title:{display:true,text:'X (Ω secondary)',color:'#9fb0cf'}, ticks:{color:'#9fb0cf'}, grid:{color:'#1c2740'}} }, plugins:{legend:{labels:{color:'#e7ecf7', font:{size:10}, filter: (item) => !['R axis','X axis','Origin','Mho key points'].includes(item.text)}}} } });
  document.getElementById('dpResults').innerHTML = resultsHtml;
}

// ===================== Current Imbalance (46) =====================
function renderCurrentImbalance(container){
  container.innerHTML = `
    <h2>Current Imbalance (46) Calculator <span class="std-badge">Motor Protection</span></h2>
    <p class="tool-desc">Phase current unbalance for motor protection, compared against alarm and trip levels. Imbalance is the largest deviation of any phase from the average current — expressed as % of FLC when the load is below FLC, and % of the average current at or above FLC.</p>
    <div class="grid">
      <div class="card">
        <div class="compact-form">
          <div class="field"><label>Ia (A, primary)</label><input id="ciIa" type="number" value="222.5" step="0.1"></div>
          <div class="field"><label>Ib (A, primary)</label><input id="ciIb" type="number" value="168" step="0.1"></div>
          <div class="field"><label>Ic (A, primary)</label><input id="ciIc" type="number" value="168" step="0.1"></div>
          <div class="field"><label>Full load current, FLC (A)</label><input id="ciFlc" type="number" value="140" step="0.1"></div>
          <div class="field"><label>CT primary (A)</label><input id="ciCtPri" type="number" value="250" step="1"></div>
          <div class="field"><label>CT secondary (A)</label><input id="ciCtSec" type="number" value="1" step="0.1"></div>
          <div class="field"><label>Alarm level (%)</label><input id="ciAlarmPct" type="number" value="15" step="0.1"></div>
          <div class="field"><label>Alarm delay (s)</label><input id="ciAlarmTime" type="number" value="5" step="0.1"></div>
          <div class="field"><label>Trip level (%)</label><input id="ciTripPct" type="number" value="20" step="0.1"></div>
          <div class="field"><label>Trip delay (s)</label><input id="ciTripTime" type="number" value="10" step="0.1"></div>
        </div>
        <div class="results" id="ciResults" style="margin-top:16px;"></div>
      </div>
      <div class="card"><table class="ref-table" id="ciTable"></table></div>
    </div>
  `;
  ['ciIa','ciIb','ciIc','ciFlc','ciCtPri','ciCtSec','ciAlarmPct','ciAlarmTime','ciTripPct','ciTripTime'].forEach(id => { const el=document.getElementById(id); el.addEventListener('input', calcCurrentImbalance); el.addEventListener('change', calcCurrentImbalance); });
  calcCurrentImbalance();
  renderFormulaBlock(container, 'Reference formulas', [
    String.raw`I_{av} = \dfrac{I_a+I_b+I_c}{3}, \quad I_m = \max(|I_{max}-I_{av}|,\ |I_{min}-I_{av}|)`,
    String.raw`\%\text{unbalance} = \begin{cases}100\,I_m/\text{FLC} & I_{av} < \text{FLC}\\ 100\,I_m/I_{av} & I_{av}\geq\text{FLC}\end{cases}`
  ]);
}
function calcCurrentImbalance(){
  const ia = safeNum(document.getElementById('ciIa').value); const ib = safeNum(document.getElementById('ciIb').value); const ic = safeNum(document.getElementById('ciIc').value);
  const flc = safeNum(document.getElementById('ciFlc').value, 140); const ctPri = safeNum(document.getElementById('ciCtPri').value, 1); const ctSec = safeNum(document.getElementById('ciCtSec').value, 1);
  const alarmPct = safeNum(document.getElementById('ciAlarmPct').value, 15); const tripPct = safeNum(document.getElementById('ciTripPct').value, 20);
  const alarmTime = safeNum(document.getElementById('ciAlarmTime').value, 5); const tripTime = safeNum(document.getElementById('ciTripTime').value, 10);
  const ctr = ctSec > 0 ? ctPri/ctSec : 0;
  const phases = [ia, ib, ic]; const iav = (ia+ib+ic)/3; const imax = Math.max(...phases); const imin = Math.min(...phases);
  const im = Math.max(Math.abs(imax-iav), Math.abs(imin-iav));
  const pctFlc = flc > 0 ? 100*im/flc : NaN; const pctIav = iav > 0 ? 100*im/iav : NaN;
  const basis = iav >= flc ? 'average current' : 'FLC'; const pct = iav >= flc ? pctIav : pctFlc;
  let flagClass = 'flag-good', flagText = '✓ NORMAL';
  if (pct >= tripPct){ flagClass='flag-warn'; flagText='⚡ TRIP'; }
  else if (pct >= alarmPct){ flagClass='flag-warn'; flagText='⚠ ALARM'; }
  let warnHtml = '';
  if (alarmPct > tripPct) warnHtml += `<div class="result-flag flag-warn">⚠ Alarm level is above the trip level.</div>`;
  if (iav === 0) warnHtml += `<div class="result-flag flag-warn">⚠ Average current is zero; % of average is undefined.</div>`;
  document.getElementById('ciResults').innerHTML = `
    <div class="result-line"><span>Applied unbalance (based on ${basis})</span><b>${isNaN(pct)?'—':pct.toFixed(2)+'%'}</b></div>
    <div class="result-line"><span>Alarm / trip levels</span><b>${alarmPct}% for ${alarmTime}s / ${tripPct}% for ${tripTime}s</b></div>
    <div class="result-line"><span>Unbalance as % of FLC</span><b>${isNaN(pctFlc)?'—':pctFlc.toFixed(2)+'%'}</b></div>
    <div class="result-line"><span>Unbalance as % of average current</span><b>${isNaN(pctIav)?'—':pctIav.toFixed(2)+'%'}</b></div>
    <div class="result-line"><span>Maximum deviation from average (Im)</span><b>${im.toFixed(2)} A</b></div>
    <div class="result-flag ${flagClass}">${flagText}</div>
    ${warnHtml}
  `;
  document.getElementById('ciTable').innerHTML = `<thead><tr><th></th><th>Primary (A)</th><th>Secondary (A)</th></tr></thead><tbody>
    <tr><td>Ia</td><td>${ia.toFixed(1)}</td><td>${(ctr>0?ia/ctr:0).toFixed(4)}</td></tr>
    <tr><td>Ib</td><td>${ib.toFixed(1)}</td><td>${(ctr>0?ib/ctr:0).toFixed(4)}</td></tr>
    <tr><td>Ic</td><td>${ic.toFixed(1)}</td><td>${(ctr>0?ic/ctr:0).toFixed(4)}</td></tr>
    <tr><td>Average</td><td>${iav.toFixed(1)}</td><td>${(ctr>0?iav/ctr:0).toFixed(4)}</td></tr>
    <tr><td>FLC</td><td>${flc.toFixed(1)}</td><td>${(ctr>0?flc/ctr:0).toFixed(4)}</td></tr>
    <tr><td>CT ratio</td><td colspan="2">${ctr.toFixed(1)} : 1</td></tr>
  </tbody>`;
}

// ===================== SEL-787 Differential Pickup =====================
// SEL-787 WnCTC compensation matrices, row 1 only (the Phase-A / I1WnC element), from the SEL-787
// instruction manual "Complete List of Compensation Matrices (m = 1 to 12)": I1WnC = (a.IA + b.IB + c.IC) / div.
// m=0 is the identity matrix (no compensation).
const SEL787_CTC = {
  0:  {a:1,  b:0,  c:0,  div:1},
  1:  {a:1,  b:-1, c:0,  div:Math.sqrt(3)},
  2:  {a:1,  b:-2, c:1,  div:3},
  3:  {a:0,  b:-1, c:1,  div:Math.sqrt(3)},
  4:  {a:-1, b:-1, c:2,  div:3},
  5:  {a:-1, b:0,  c:1,  div:Math.sqrt(3)},
  6:  {a:-2, b:1,  c:1,  div:3},
  7:  {a:-1, b:1,  c:0,  div:Math.sqrt(3)},
  8:  {a:-1, b:2,  c:-1, div:3},
  9:  {a:0,  b:1,  c:-1, div:Math.sqrt(3)},
  10: {a:1,  b:1,  c:-2, div:3},
  11: {a:1,  b:0,  c:-1, div:Math.sqrt(3)},
  12: {a:2,  b:-1, c:-1, div:3},
};
function renderDiffPickup787(container){
  const ctcOptions = Array.from({length:13}, (_,i)=>`<option value="${i}" ${i===12?'selected':''}>${i}</option>`).join('');
  const ctcOptionsW2 = Array.from({length:13}, (_,i)=>`<option value="${i}" ${i===11?'selected':''}>${i}</option>`).join('');
  container.innerHTML = `
    <h2>SEL-787 Differential Pickup <span class="std-badge">CT-Compensated Test Values</span></h2>
    <p class="tool-desc">O87P pickup in secondary amps (Ph-Ph and Ph-E) with CT compensation, plus values to inject at the relay for a differential pickup test. Uses the full SEL-787 WnCTC compensation matrix (row 1, the Phase-A element) for every code 0–12, not a simplified per-code multiplier.</p>
    <div class="grid">
      <div class="card">
        <div class="compact-form">
          <div class="field"><label>Rating (MVA)</label><input id="dp7Mva" type="number" value="15" step="0.1"></div>
          <div class="field"><label>O87P (xTAP)</label><input id="dp7O87p" type="number" value="0.3" step="0.01"></div>
          <div class="field"><label>HV winding voltage, L-L (V)</label><input id="dp7Vp" type="number" value="11000" step="1"></div>
          <div class="field"><label>LV winding voltage, L-L (V)</label><input id="dp7Vs" type="number" value="3450" step="1"></div>
          <div class="field"><label>HV CT ratio (:1)</label><input id="dp7CtrHv" type="number" value="1000" step="1"></div>
          <div class="field"><label>LV CT ratio (:1)</label><input id="dp7CtrLv" type="number" value="3000" step="1"></div>
          <div class="field"><label>W1CTC (HV CT compensation)</label><select id="dp7W1ctc">${ctcOptions}</select></div>
          <div class="field"><label>W2CTC (LV CT compensation)</label><select id="dp7W2ctc">${ctcOptionsW2}</select></div>
        </div>
        <hr style="border-color:var(--border);margin:14px 0;">
        <p class="tool-desc" style="margin-bottom:8px;">Return current magnitude on the other two phases, for the Injection test (entered as a positive magnitude — applied internally at 180°, i.e. as a negative value, per SEL test convention).</p>
        <div class="compact-form">
          <div class="field"><label>HV: Ib return (mA)</label><input id="dp7HvIb" type="number" value="100" step="1" min="0"></div>
          <div class="field"><label>HV: Ic return (mA)</label><input id="dp7HvIc" type="number" value="100" step="1" min="0"></div>
          <div class="field"><label>LV: Ib return (mA)</label><input id="dp7LvIb" type="number" value="0" step="1" min="0"></div>
          <div class="field"><label>LV: Ic return (mA)</label><input id="dp7LvIc" type="number" value="100" step="1" min="0"></div>
        </div>
        <div class="results" id="dp7Results"></div>
      </div>
      <div class="card">
        <table class="ref-table" id="dp7HvTable" style="margin-bottom:14px;"></table>
        <table class="ref-table" id="dp7LvTable"></table>
      </div>
    </div>
    <div class="card" style="margin-top:16px;"><div class="results centered" id="dp7Injection"></div></div>
  `;
  ['dp7Mva','dp7O87p','dp7Vp','dp7Vs','dp7CtrHv','dp7CtrLv','dp7W1ctc','dp7W2ctc','dp7HvIb','dp7HvIc','dp7LvIb','dp7LvIc'].forEach(id => { const el=document.getElementById(id); el.addEventListener('input', calcDiffPickup787); el.addEventListener('change', calcDiffPickup787); });
  calcDiffPickup787();
  renderFormulaBlock(container, 'Reference formulas', [
    String.raw`I = \dfrac{\text{MVA}\times10^6}{\sqrt3\,V}, \quad \text{Ph-Ph pickup} = \dfrac{O87P\cdot I}{\text{CT ratio}}`,
    String.raw`I_{1,WnC} = \dfrac{a\cdot I_A + b\cdot I_B + c\cdot I_C}{\text{div}} \quad \text{(row 1 of the WnCTC compensation matrix)}`
  ]);
}
function calcDiffPickup787(){
  const mva = safeNum(document.getElementById('dp7Mva').value, 15); const o87p = safeNum(document.getElementById('dp7O87p').value, 0.3);
  const vp = safeNum(document.getElementById('dp7Vp').value, 11000); const vs = safeNum(document.getElementById('dp7Vs').value, 3450);
  const ctrHv = safeNum(document.getElementById('dp7CtrHv').value, 1000); const ctrLv = safeNum(document.getElementById('dp7CtrLv').value, 3000);
  const w1ctc = Math.round(safeNum(document.getElementById('dp7W1ctc').value, 12)); const w2ctc = Math.round(safeNum(document.getElementById('dp7W2ctc').value, 11));
  const hvIb = safeNum(document.getElementById('dp7HvIb').value, 100); const hvIc = safeNum(document.getElementById('dp7HvIc').value, 100);
  const lvIb = safeNum(document.getElementById('dp7LvIb').value, 0); const lvIc = safeNum(document.getElementById('dp7LvIc').value, 100);
  const SQRT3 = Math.sqrt(3);
  const ip = (mva*1e6)/(SQRT3*vp); const is = (mva*1e6)/(SQRT3*vs);
  const m1 = SEL787_CTC[w1ctc], m2 = SEL787_CTC[w2ctc];
  const hvLL = o87p*ip/ctrHv; const lvLL = o87p*is/ctrLv;
  const hvLLmA = hvLL*1000, lvLLmA = lvLL*1000;

  // Ph-E (pure single-phase-to-ground, other two phases = 0): I1 = a.IA/div = base -> IA = base.div/a.
  // Ph-E is undefined (N/A) when a=0 (WnCTC = 3 or 9): the Phase-A element doesn't respond to IA at all.
  const hvLE = m1.a !== 0 ? hvLL*m1.div/Math.abs(m1.a) : NaN;
  const lvLE = m2.a !== 0 ? lvLL*m2.div/Math.abs(m2.a) : NaN;

  // Injection test: IB, IC applied at 180 deg (i.e. as -hvIb, -hvIc), solve a.IA + b.(-hvIb) + c.(-hvIc) = base.div for IA.
  const deltaIa = m1.a !== 0 ? (hvLLmA*m1.div + m1.b*hvIb + m1.c*hvIc)/m1.a : NaN;
  const starIa = m2.a !== 0 ? (lvLLmA*m2.div + m2.b*lvIb + m2.c*lvIc)/m2.a : NaN;

  let warnHtml = '';
  if (m1.a === 0) warnHtml += `<div class="result-flag flag-warn">⚠ W1CTC = ${w1ctc}: the Phase-A element does not depend on IA at all for this code — a Phase-A-only injection can never trip it. Test via Ib or Ic instead, or use the general matrix directly.</div>`;
  if (m2.a === 0) warnHtml += `<div class="result-flag flag-warn">⚠ W2CTC = ${w2ctc}: the Phase-A element does not depend on IA at all for this code — a Phase-A-only injection can never trip it. Test via Ib or Ic instead, or use the general matrix directly.</div>`;
  document.getElementById('dp7Results').innerHTML = `
    <div class="result-line"><span>HV winding rated current (Ip)</span><b>${ip.toFixed(2)} A</b></div>
    <div class="result-line"><span>LV winding rated current (Is)</span><b>${is.toFixed(2)} A</b></div>
    <div class="result-line"><span>W1CTC row-1 matrix (I1 = a·IA + b·IB + c·IC)</span><b>a=${m1.a}, b=${m1.b}, c=${m1.c}, div=${m1.div.toFixed(4)}</b></div>
    <div class="result-line"><span>W2CTC row-1 matrix (I1 = a·IA + b·IB + c·IC)</span><b>a=${m2.a}, b=${m2.b}, c=${m2.c}, div=${m2.div.toFixed(4)}</b></div>
    ${warnHtml}
    <div class="note">Ph-E pickup values in the tables are for a <b>pure</b> single-phase-to-ground injection (other two phases at zero) — the more realistic representation of an actual earth fault. The Injection section further down instead computes the Phase A current needed to trip with a fixed return current on the other two phases (entered above, applied at 180°), a common bench-test convention that trips at a different current than the pure single-phase case. A negative injection result means the polarity needs to be reversed (inject at 180° instead of 0°) to reach trip.</div>
  `;
  function sideTable(title, ll, le, llTol, leTol){
    const leCell = isNaN(le) ? ['N/A','N/A','N/A','N/A'] : [le.toFixed(4), (le*1000).toFixed(1), ((le-leTol)*1000).toFixed(1), ((le+leTol)*1000).toFixed(1)];
    return `<thead><tr><th colspan="5">${title}</th></tr><tr><th></th><th>Pickup (A)</th><th>Pickup (mA)</th><th>-5% (mA)</th><th>+5% (mA)</th></tr></thead><tbody>
      <tr><td>Ph-Ph</td><td>${ll.toFixed(4)}</td><td>${(ll*1000).toFixed(1)}</td><td>${((ll-llTol)*1000).toFixed(1)}</td><td>${((ll+llTol)*1000).toFixed(1)}</td></tr>
      <tr><td>Ph-E</td><td>${leCell[0]}</td><td>${leCell[1]}</td><td>${leCell[2]}</td><td>${leCell[3]}</td></tr>
    </tbody>`;
  }
  document.getElementById('dp7HvTable').innerHTML = sideTable('HV side pickup (secondary)', hvLL, hvLE, hvLL*0.05, isNaN(hvLE)?0:hvLE*0.05);
  document.getElementById('dp7LvTable').innerHTML = sideTable('LV side pickup (secondary)', lvLL, lvLE, lvLL*0.05, isNaN(lvLE)?0:lvLE*0.05);
  document.getElementById('dp7Injection').innerHTML = `
    <div class="result-line"><span>HV side: Ph-Ph pickup</span><b>${hvLLmA.toFixed(1)} mA</b></div>
    <div class="result-line"><span>HV side: Ia pickup (inject at 0°)</span><b>${isNaN(deltaIa)?'N/A':deltaIa.toFixed(1)+' mA'}</b></div>
    <div class="result-line"><span>LV side: Ph-Ph pickup</span><b>${lvLLmA.toFixed(1)} mA</b></div>
    <div class="result-line"><span>LV side: Ia pickup (inject at 0°)</span><b>${isNaN(starIa)?'N/A':starIa.toFixed(1)+' mA'}</b></div>
  `;
}

// ===================== Differential Stability Check =====================
function renderDiffStability(container){
  container.innerHTML = `
    <h2>Differential Stability Check <span class="std-badge">CT Injection Test</span></h2>
    <p class="tool-desc">Compare injected secondary current (×CT ratio) with the relay's primary-referred reading on each winding, and get a pass/fail against a tolerance. Use this during commissioning to confirm CT polarity, ratio and relay scaling before an in-service differential element is trusted.</p>
    <div class="grid">
      <div class="card">
        <div class="compact-form">
          <div class="field"><label>Winding 1 CT ratio (:1)</label><input id="dsCtrP" type="number" value="500" step="1"></div>
          <div class="field"><label>Winding 2 CT ratio (:1)</label><input id="dsCtrS" type="number" value="1500" step="1"></div>
          <div class="field"><label>Tolerance (%)</label><input id="dsTol" type="number" value="1.5" step="0.1"></div>
        </div>
        <hr style="border-color:var(--border);margin:14px 0;">
        <p class="tool-desc" style="margin-bottom:8px;">Winding 1 (per phase)</p>
        <div class="compact-form">
          <div class="field"><label>Reading L1 (A primary)</label><input id="dsRp0" type="number" value="687" step="0.1"></div>
          <div class="field"><label>Injected L1 (A secondary)</label><input id="dsIp0" type="number" value="1.37" step="0.01"></div>
          <div class="field"><label>Reading L2 (A primary)</label><input id="dsRp1" type="number" value="686.7" step="0.1"></div>
          <div class="field"><label>Injected L2 (A secondary)</label><input id="dsIp1" type="number" value="1.37" step="0.01"></div>
          <div class="field"><label>Reading L3 (A primary)</label><input id="dsRp2" type="number" value="685.7" step="0.1"></div>
          <div class="field"><label>Injected L3 (A secondary)</label><input id="dsIp2" type="number" value="1.37" step="0.01"></div>
        </div>
        <p class="tool-desc" style="margin:12px 0 8px;">Winding 2 (per phase)</p>
        <div class="compact-form">
          <div class="field"><label>Reading L1 (A primary)</label><input id="dsRs0" type="number" value="2103.3" step="0.1"></div>
          <div class="field"><label>Injected L1 (A secondary)</label><input id="dsIs0" type="number" value="1.4" step="0.01"></div>
          <div class="field"><label>Reading L2 (A primary)</label><input id="dsRs1" type="number" value="2099.4" step="0.1"></div>
          <div class="field"><label>Injected L2 (A secondary)</label><input id="dsIs1" type="number" value="1.4" step="0.01"></div>
          <div class="field"><label>Reading L3 (A primary)</label><input id="dsRs2" type="number" value="2099.4" step="0.1"></div>
          <div class="field"><label>Injected L3 (A secondary)</label><input id="dsIs2" type="number" value="1.4" step="0.01"></div>
        </div>
      </div>
      <div class="card">
        <div class="results centered" id="dsOverall"></div>
        <table class="ref-table" id="dsTable" style="margin-top:14px;"></table>
      </div>
    </div>
  `;
  ['dsCtrP','dsCtrS','dsTol','dsRp0','dsIp0','dsRp1','dsIp1','dsRp2','dsIp2','dsRs0','dsIs0','dsRs1','dsIs1','dsRs2','dsIs2'].forEach(id => { document.getElementById(id).addEventListener('input', calcDiffStability); });
  calcDiffStability();
  renderFormulaBlock(container, 'Reference formulas', [
    String.raw`\text{Expected} = \text{Injected}\times\text{CT ratio}, \quad \text{Error \%} = \dfrac{\text{Reading}-\text{Expected}}{\text{Expected}}\times100`
  ]);
}
function dsCheck(reading, injected, ratio, tol){
  const expected = injected*ratio;
  let errPct;
  if (expected === 0) errPct = reading === 0 ? 0 : Infinity;
  else errPct = 100*(reading-expected)/expected;
  return { reading, injected, expected, errPct, pass: Math.abs(errPct) <= tol };
}
function calcDiffStability(){
  const ctrP = safeNum(document.getElementById('dsCtrP').value, 500); const ctrS = safeNum(document.getElementById('dsCtrS').value, 1500); const tol = safeNum(document.getElementById('dsTol').value, 1.5);
  const readP = [0,1,2].map(i => safeNum(document.getElementById(`dsRp${i}`).value)); const injP = [0,1,2].map(i => safeNum(document.getElementById(`dsIp${i}`).value));
  const readS = [0,1,2].map(i => safeNum(document.getElementById(`dsRs${i}`).value)); const injS = [0,1,2].map(i => safeNum(document.getElementById(`dsIs${i}`).value));
  const p = [0,1,2].map(i => dsCheck(readP[i], injP[i], ctrP, tol)); const s = [0,1,2].map(i => dsCheck(readS[i], injS[i], ctrS, tol));
  const pass = p.concat(s).every(r => r.pass);
  document.getElementById('dsOverall').innerHTML = `<div class="result-line"><span>Overall result</span><b style="color:${pass?'var(--good)':'var(--warn)'};">${pass?'✓ PASS':'⚡ FAIL'}</b></div>` + (tol<=0 ? `<div class="result-flag flag-warn">⚠ Tolerance must be greater than zero.</div>` : '');
  function rows(label, list){ return list.map((c,i) => `<tr><td>${label} L${i+1}</td><td>${c.injected.toFixed(3)}</td><td>${c.expected.toFixed(1)}</td><td>${c.reading.toFixed(1)}</td><td>${isFinite(c.errPct)?c.errPct.toFixed(2):'∞'}</td><td class="${c.pass?'flag-good':'flag-warn'}">${c.pass?'PASS':'FAIL'}</td></tr>`).join(''); }
  document.getElementById('dsTable').innerHTML = `<thead><tr><th>Phase</th><th>Injected (A)</th><th>Expected</th><th>Reading</th><th>Error %</th><th>Result</th></tr></thead><tbody>${rows('W1',p)}${rows('W2',s)}</tbody>`;
}

// ===================== Underpower (32) =====================
function upCurrentFor(kw, vtPri, pf, ctr){ return (kw*1000)/(Math.sqrt(3)*vtPri*pf)/ctr; }
function upSettingTable(kw, vtPri, pf, ctr, flc){
  return [90,95,100,105,110].map(pct => { const p = kw*pct/100; const i = upCurrentFor(p, vtPri, pf, ctr); return { pct, kw:p, iSec:i, iPri:i*ctr, pctFlc: flc>0 ? 100*i*ctr/flc : NaN }; });
}
function renderUnderpower(container){
  container.innerHTML = `
    <h2>Underpower (32) Test Current <span class="std-badge">Motor Protection</span></h2>
    <p class="tool-desc">Secondary current to inject for a kW setting, and the kW represented by a given (possibly unbalanced) secondary current. Assumes rated voltage is applied and current is in phase with voltage for pf = 1.</p>
    <div class="grid">
      <div class="card">
        <div class="compact-form">
          <div class="field"><label>VT primary, L-L (V)</label><input id="upVtPri" type="number" value="3300" step="1"></div>
          <div class="field"><label>VT secondary, L-L (V)</label><input id="upVtSec" type="number" value="110" step="0.1"></div>
          <div class="field"><label>CT ratio (:1)</label><input id="upCtr" type="number" value="100" step="1"></div>
          <div class="field"><label>Full load current (A)</label><input id="upFlc" type="number" value="140" step="0.1"></div>
          <div class="field"><label>Power factor for the test</label><input id="upPf" type="number" value="1" step="0.01" min="0" max="1"></div>
          <div class="field"><label>Pickup setting (kW)</label><input id="upPickupKw" type="number" value="80" step="1"></div>
          <div class="field"><label>Trip setting (kW)</label><input id="upTripKw" type="number" value="100" step="1"></div>
        </div>
        <hr style="border-color:var(--border);margin:14px 0;">
        <p class="tool-desc" style="margin-bottom:8px;">Check a current (secondary A, balanced or not)</p>
        <div class="compact-form">
          <div class="field"><label>Ia (A sec)</label><input id="upIa" type="number" value="0.139" step="0.001"></div>
          <div class="field"><label>Ib (A sec)</label><input id="upIb" type="number" value="0.139" step="0.001"></div>
          <div class="field"><label>Ic (A sec)</label><input id="upIc" type="number" value="0.139" step="0.001"></div>
        </div>
        <div class="results" id="upResults" style="margin-top:14px;"></div>
      </div>
      <div class="card">
        <table class="ref-table" id="upPickupTable" style="margin-bottom:14px;"></table>
        <table class="ref-table" id="upTripTable"></table>
      </div>
    </div>
  `;
  ['upVtPri','upVtSec','upCtr','upFlc','upPf','upPickupKw','upTripKw','upIa','upIb','upIc'].forEach(id => { document.getElementById(id).addEventListener('input', calcUnderpower); });
  calcUnderpower();
  renderFormulaBlock(container, 'Reference formulas', [
    String.raw`P = \sum V_{LN,pri}\cdot I_{pri}\cdot pf \; / \;1000`,
    String.raw`I_{sec} = \dfrac{P\times1000}{\sqrt3\,V_{LL,pri}\cdot pf}\;/\;\text{CT ratio}`
  ]);
}
function calcUnderpower(){
  const vtPri = safeNum(document.getElementById('upVtPri').value, 3300); const vtSec = safeNum(document.getElementById('upVtSec').value, 110);
  const ctr = safeNum(document.getElementById('upCtr').value, 100); const flc = safeNum(document.getElementById('upFlc').value, 140);
  const pf = safeNum(document.getElementById('upPf').value, 1); const pickupKw = safeNum(document.getElementById('upPickupKw').value, 80); const tripKw = safeNum(document.getElementById('upTripKw').value, 100);
  const ia = safeNum(document.getElementById('upIa').value); const ib = safeNum(document.getElementById('upIb').value); const ic = safeNum(document.getElementById('upIc').value);
  const SQRT3 = Math.sqrt(3);
  const vLNpri = vtPri/SQRT3; const vLNsec = vtSec/SQRT3; const vtRatio = vtSec>0 ? vtPri/vtSec : 0;
  const iPri = [ia,ib,ic].map(i => i*ctr); const kw = iPri.reduce((sum,i) => sum + vLNpri*i*pf, 0)/1000;
  let warnHtml = ''; if (pf <= 0 || pf > 1) warnHtml += `<div class="result-flag flag-warn">⚠ Power factor should be between 0 and 1.</div>`;
  const pickupISec = upCurrentFor(pickupKw, vtPri, pf, ctr); const tripISec = upCurrentFor(tripKw, vtPri, pf, ctr);
  document.getElementById('upResults').innerHTML = `
    <div class="result-line"><span>Pickup setting (${pickupKw} kW): current to inject</span><b>${pickupISec.toFixed(4)} A sec</b></div>
    <div class="result-line"><span>Trip setting (${tripKw} kW): current to inject</span><b>${tripISec.toFixed(4)} A sec</b></div>
    <div class="result-line"><span>Voltage to apply (L-N secondary)</span><b>${vLNsec.toFixed(3)} V</b></div>
    <div class="result-line"><span>VT ratio</span><b>${vtRatio.toFixed(2)} : 1</b></div>
    <div class="result-line"><span>Power for the entered current</span><b>${kw.toFixed(2)} kW</b></div>
    <div class="result-line"><span>Versus pickup setting</span><b>${kw < pickupKw ? 'BELOW' : 'ABOVE'}</b></div>
    <div class="result-line"><span>Versus trip setting</span><b>${kw < tripKw ? 'BELOW' : 'ABOVE'}</b></div>
    ${warnHtml}
  `;
  function table(name, kwSetting){
    const rows = upSettingTable(kwSetting, vtPri, pf, ctr, flc);
    return `<thead><tr><th colspan="5">${name} (${kwSetting} kW): test points</th></tr><tr><th>% of setting</th><th>kW</th><th>I sec (A)</th><th>I pri (A)</th><th>% FLC</th></tr></thead><tbody>${rows.map(t => `<tr><td>${t.pct}%</td><td>${t.kw.toFixed(2)}</td><td>${t.iSec.toFixed(4)}</td><td>${t.iPri.toFixed(2)}</td><td>${isNaN(t.pctFlc)?'—':t.pctFlc.toFixed(1)}</td></tr>`).join('')}</tbody>`;
  }
  document.getElementById('upPickupTable').innerHTML = table('Pickup', pickupKw);
  document.getElementById('upTripTable').innerHTML = table('Trip', tripKw);
}

// ===================== Volts/Hz Overexcitation (24) =====================
function vhzParseList(text){ return String(text).split(/[\s,;]+/).filter(Boolean).map(Number).filter(n => isFinite(n) && n > 0); }
function renderVoltsHz(container){
  container.innerHTML = `
    <h2>Volts/Hz Overexcitation (24) <span class="std-badge">Generator Protection</span></h2>
    <p class="tool-desc">Pickup V/Hz for each trip stage and the voltage to apply at each test frequency. Enter the nominal voltage on the same basis (L-N or L-L) as the relay setting.</p>
    <div class="grid">
      <div class="card">
        <div class="compact-form">
          <div class="field"><label>Nominal voltage at relay (V)</label><input id="vhzVnom" type="number" value="63.51" step="0.01"></div>
          <div class="field"><label>Nominal frequency (Hz)</label><input id="vhzFnom" type="number" value="50" step="0.1"></div>
          <div class="field"><label>Trip setting 1 (pu)</label><input id="vhzTrip1" type="number" value="1.18" step="0.001"></div>
          <div class="field"><label>Trip setting 2 (pu)</label><input id="vhzTrip2" type="number" value="1.1" step="0.001"></div>
          <div class="field"><label>Test frequency (Hz)</label><input id="vhzFset" type="number" value="48.48" step="0.01"></div>
        </div>
        <div class="field"><label>Sweep frequencies (comma separated)</label><input id="vhzFreqList" type="text" value="45, 46, 47, 48, 48.48, 49, 50"></div>
        <div class="results" id="vhzResults"></div>
      </div>
      <div class="card"><table class="ref-table" id="vhzSweepTable"></table></div>
    </div>
  `;
  ['vhzVnom','vhzFnom','vhzTrip1','vhzTrip2','vhzFset','vhzFreqList'].forEach(id => { document.getElementById(id).addEventListener('input', calcVoltsHz); });
  calcVoltsHz();
  renderFormulaBlock(container, 'Reference formulas', [
    String.raw`\text{Nominal V/Hz} = \dfrac{V_{nom}}{f_{nom}}, \quad \text{Pickup V/Hz} = \text{setting(pu)}\times\text{Nominal V/Hz}`,
    String.raw`V_{apply} = f_{test}\times\text{Pickup V/Hz}`
  ]);
}
function calcVoltsHz(){
  const vnom = safeNum(document.getElementById('vhzVnom').value, 63.51); const fnom = safeNum(document.getElementById('vhzFnom').value, 50);
  const trip1 = safeNum(document.getElementById('vhzTrip1').value, 1.18); const trip2 = safeNum(document.getElementById('vhzTrip2').value, 1.1);
  const fset = safeNum(document.getElementById('vhzFset').value, 48.48); const freqListRaw = document.getElementById('vhzFreqList').value;
  const ratio = fnom > 0 ? vnom/fnom : 0; const t1 = trip1*ratio, t2 = trip2*ratio;
  const freqs = vhzParseList(freqListRaw);
  let warnHtml = ''; if (trip2 > trip1) warnHtml += `<div class="result-flag flag-warn">⚠ Trip 2 is above Trip 1; normally the higher setting is the faster stage.</div>`;
  if (freqListRaw && !freqs.length) warnHtml += `<div class="result-flag flag-warn">⚠ No valid frequencies found in the sweep list.</div>`;
  document.getElementById('vhzResults').innerHTML = `
    <div class="result-line"><span>Trip 1: voltage to apply at ${fset} Hz</span><b>${(fset*t1).toFixed(3)} V</b></div>
    <div class="result-line"><span>Trip 2: voltage to apply at ${fset} Hz</span><b>${(fset*t2).toFixed(3)} V</b></div>
    <div class="result-line"><span>Nominal V/Hz</span><b>${ratio.toFixed(4)} V/Hz</b></div>
    <div class="result-line"><span>Trip 1 pickup V/Hz</span><b>${t1.toFixed(4)} V/Hz</b></div>
    <div class="result-line"><span>Trip 2 pickup V/Hz</span><b>${t2.toFixed(4)} V/Hz</b></div>
    ${warnHtml}
  `;
  const sweep = freqs.map(f => ({ f, v1: f*t1, v2: f*t2, pct1: vnom>0?100*f*t1/vnom:0, pct2: vnom>0?100*f*t2/vnom:0 }));
  document.getElementById('vhzSweepTable').innerHTML = sweep.length ? `<thead><tr><th>Frequency (Hz)</th><th>Trip 1 (V)</th><th>% nominal</th><th>Trip 2 (V)</th><th>% nominal</th></tr></thead><tbody>${sweep.map(s => `<tr><td>${s.f}</td><td>${s.v1.toFixed(3)}</td><td>${s.pct1.toFixed(1)}</td><td>${s.v2.toFixed(3)}</td><td>${s.pct2.toFixed(1)}</td></tr>`).join('')}</tbody>` : '';
}

// ===================== Arc Flash & Standards Library =====================
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

// ===================== App shell =====================
function initApp(){
  const sideNav = document.getElementById('sideNav'); const app = document.getElementById('app'); const topbarTitle = document.getElementById('topbarTitle');
  sideNav.innerHTML = TOOL_GROUPS.map(g => `<div class="side-group"><div class="side-group-label">${g.label}</div>${g.tools.map(t => `<button type="button" class="side-link" data-tool="${t.id}">${t.label}</button>`).join('')}</div>`).join('');
  app.innerHTML = TOOLS.map(t => `<section class="tool-panel" id="panel-${t.id}"></section>`).join('');
  const renderers = { tcc: renderTCC, symcomp: renderSymComp, ctsat: renderCTSat, diff87: renderDiff87, fault: renderFault, txfmr: renderTxfmr, diffpickup787: renderDiffPickup787, diffstability: renderDiffStability, currentimbalance: renderCurrentImbalance, underpower: renderUnderpower, lof: renderLossOfField, voltshz: renderVoltsHz, distprot: renderDistProt, arcflash: renderArcFlash, references: renderReferences };
  function activate(id){
    document.querySelectorAll('.side-link').forEach(b => b.classList.toggle('active', b.dataset.tool===id));
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.toggle('active', p.id===`panel-${id}`));
    const panel = document.getElementById(`panel-${id}`);
    if (!panel.dataset.rendered){ renderers[id](panel); attachSaveLoadUI(panel, id); panel.dataset.rendered = '1'; }
    const toolMeta = TOOLS.find(t => t.id === id); if (toolMeta) topbarTitle.textContent = toolMeta.label;
    if (window.innerWidth <= 850){ document.getElementById('sidebar').classList.remove('mobile-open'); }
  }
  sideNav.querySelectorAll('.side-link').forEach(b => b.addEventListener('click', () => activate(b.dataset.tool)));
  const sidebar = document.getElementById('sidebar'); const toggleBtn = document.getElementById('sidebarToggle');
  toggleBtn.addEventListener('click', () => { if (window.innerWidth <= 850){ sidebar.classList.toggle('mobile-open'); } else { sidebar.classList.toggle('collapsed'); } });
  activate(TOOLS[0].id);
}
document.addEventListener('DOMContentLoaded', initApp);
