/*
 * Shared UI for every calculator page: header, form builder, results renderer, SVG plots.
 * No dependencies, works from file:// and any static host.
 *
 * A page calls TK.mount(config):
 *   id, title, subtitle, source
 *   inputs   : [ {group:'Title'} | {id,label,unit,value,min,max,step,hint,type,options,showIf} | {type:'grid',...} ]
 *   presets  : [ {name, values:{id:value}} ]
 *   calc(v)  : returns { warnings:[], sections:[...] }
 *   notes    : [ 'text', ... ]           formulas: [ {label, text} ]
 *
 * A section is one of:
 *   { title, rows:[{label, value, unit, dp, status, hint, strong}] }
 *   { title, table:{ head:[...], rows:[[...]], dp:[...] } }
 *   { title, plot:{ series, xlabel, ylabel, equal } }
 *   { title, note:'text' }
 */
(function (root) {
  'use strict';
  var TK = root.TK = root.TK || {};
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------------- helpers ---------------- */
  TK.fmt = function (n, dp) {
    if (typeof n === 'string') return n;
    if (n === null || n === undefined || (typeof n === 'number' && isNaN(n))) return '—';
    if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
    var d = dp === undefined ? 3 : dp;
    var x = Number(n.toFixed(d));
    if (x === 0) x = 0; // drop negative zero
    return x.toFixed(d);
  };

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function s(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) { if (a[k] !== undefined && a[k] !== null) el.setAttribute(k, a[k]); });
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  }
  TK.h = h;

  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { /* storage unavailable: work without it */ }
    return null;
  }

  /* ---------------- header ---------------- */
  function buildHeader(base, trail) {
    var head = h('header', { class: 'site-header' },
      h('div', { class: 'wrap' },
        h('a', { class: 'brand', href: base + 'index.html', html: 'Protection <span>Toolkit</span>' }),
        h('nav', null, h('a', { href: base + 'index.html' }, 'All calculators'))));
    document.body.insertBefore(head, document.body.firstChild);
  }

  /* ---------------- plots ---------------- */
  function niceStep(range, target) {
    var raw = range / target, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var f = raw / mag;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag;
  }
  function ticks(min, max, target) {
    var step = niceStep(max - min, target), out = [];
    for (var v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    var dp = Math.max(0, -Math.floor(Math.log(step) / Math.LN10 + 1e-9));
    return { values: out, dp: Math.min(dp, 6) };
  }

  /* spec: { series:[{name, pts:[[x,y]..], color, dash, fill, markers, width}], xlabel, ylabel, equal, height } */
  TK.plot = function (spec) {
    var W = 680, padL = 58, padR = 18, padT = 14, padB = 46;
    var iw = W - padL - padR;
    var xs = [], ys = [];
    spec.series.forEach(function (sr) { sr.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    (spec.include || []).forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
    var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys);
    if (xmax - xmin < 1e-9) { xmax += 1; xmin -= 1; }
    if (ymax - ymin < 1e-9) { ymax += 1; ymin -= 1; }
    var px = (xmax - xmin) * 0.05, py = (ymax - ymin) * 0.06;
    xmin -= px; xmax += px; ymin -= py; ymax += py;

    var ih;
    if (spec.equal) {
      ih = Math.max(240, Math.min(460, iw * (ymax - ymin) / (xmax - xmin)));
      var scale = Math.min(iw / (xmax - xmin), ih / (ymax - ymin));
      var cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
      xmin = cx - iw / scale / 2; xmax = cx + iw / scale / 2;
      ymin = cy - ih / scale / 2; ymax = cy + ih / scale / 2;
    } else ih = spec.height || 340;

    var H = ih + padT + padB;
    function X(v) { return padL + (v - xmin) / (xmax - xmin) * iw; }
    function Y(v) { return padT + ih - (v - ymin) / (ymax - ymin) * ih; }

    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': spec.title || 'Plot' });
    var grid = s('g', { 'class': 'grid' }), labels = s('g');
    var tx = ticks(xmin, xmax, 7), ty = ticks(ymin, ymax, spec.equal ? 7 : 6);
    tx.values.forEach(function (v) {
      grid.appendChild(s('line', { x1: X(v), x2: X(v), y1: padT, y2: padT + ih }));
      var t = s('text', { x: X(v), y: padT + ih + 15, 'text-anchor': 'middle' }); t.textContent = TK.fmt(v, tx.dp); labels.appendChild(t);
    });
    ty.values.forEach(function (v) {
      grid.appendChild(s('line', { x1: padL, x2: padL + iw, y1: Y(v), y2: Y(v) }));
      var t = s('text', { x: padL - 7, y: Y(v) + 4, 'text-anchor': 'end' }); t.textContent = TK.fmt(v, ty.dp); labels.appendChild(t);
    });
    svg.appendChild(grid);

    var axis = s('g', { 'class': 'axis' });
    if (xmin < 0 && xmax > 0) axis.appendChild(s('line', { x1: X(0), x2: X(0), y1: padT, y2: padT + ih }));
    if (ymin < 0 && ymax > 0) axis.appendChild(s('line', { x1: padL, x2: padL + iw, y1: Y(0), y2: Y(0) }));
    axis.appendChild(s('line', { x1: padL, x2: padL + iw, y1: padT + ih, y2: padT + ih }));
    axis.appendChild(s('line', { x1: padL, x2: padL, y1: padT, y2: padT + ih }));
    svg.appendChild(axis);
    svg.appendChild(labels);

    var clip = 'clip' + Math.random().toString(36).slice(2, 8);
    svg.appendChild(s('clipPath', { id: clip }, s('rect', { x: padL, y: padT, width: iw, height: ih })));
    var data = s('g', { 'clip-path': 'url(#' + clip + ')' });
    var legend = h('div', { class: 'legend' });

    spec.series.forEach(function (sr, i) {
      var color = 'var(--c' + ((i % 6) + 1) + ')';
      if (sr.color) color = sr.color;
      var d = sr.pts.map(function (p, k) { return (k ? 'L' : 'M') + X(p[0]).toFixed(2) + ' ' + Y(p[1]).toFixed(2); }).join(' ');
      if (sr.fill) data.appendChild(s('path', { d: d + ' Z', style: 'fill:' + color + ';fill-opacity:.12;stroke:none' }));
      data.appendChild(s('path', {
        d: d, style: 'fill:none;stroke:' + color + ';stroke-width:' + (sr.width || 2.2) + ';stroke-linejoin:round' + (sr.dash ? ';stroke-dasharray:' + sr.dash : '')
      }));
      if (sr.markers) sr.pts.forEach(function (p) {
        var c = s('circle', { cx: X(p[0]), cy: Y(p[1]), r: 3.6, style: 'fill:' + color });
        var t = s('title'); t.textContent = '(' + TK.fmt(p[0], 3) + ', ' + TK.fmt(p[1], 3) + ')'; c.appendChild(t);
        data.appendChild(c);
      });
      legend.appendChild(h('span', null, h('i', { style: 'border-color:' + color + (sr.dash ? ';border-top-style:dashed' : '') }), sr.name));
    });
    svg.appendChild(data);

    if (spec.xlabel) { var xt = s('text', { x: padL + iw / 2, y: H - 6, 'text-anchor': 'middle', 'class': 'axis-title' }); xt.textContent = spec.xlabel; svg.appendChild(xt); }
    if (spec.ylabel) { var yt = s('text', { x: 14, y: padT + ih / 2, 'text-anchor': 'middle', 'class': 'axis-title', transform: 'rotate(-90 14 ' + (padT + ih / 2) + ')' }); yt.textContent = spec.ylabel; svg.appendChild(yt); }

    return h('div', { class: 'plot' }, svg, legend);
  };

  /* ---------------- results ---------------- */
  function statusPill(status, text) { return h('span', { class: 'pill ' + status }, text); }

  function renderRow(r) {
    var v;
    if (r.status && typeof r.value === 'string') v = h('span', { class: 'val' }, statusPill(r.status, r.value));
    else v = h('span', { class: 'val' }, TK.fmt(r.value, r.dp), r.unit ? h('span', { class: 'u' }, r.unit) : null,
      r.status ? [' ', statusPill(r.status, r.statusText || r.status.toUpperCase())] : null);
    var lbl = h('span', { class: 'lbl' }, r.label, r.hint ? h('small', null, r.hint) : null);
    return h('div', { class: 'rrow' + (r.strong ? ' strong' : '') }, lbl, v);
  }

  function renderCell(c, dp, tag) {
    var status = null, v = c;
    if (c && typeof c === 'object') { status = c.status; v = c.v; dp = c.dp !== undefined ? c.dp : dp; }
    var td = h(tag || 'td');
    if (status && typeof v === 'string') td.appendChild(statusPill(status, v));
    else td.textContent = TK.fmt(v, dp === undefined ? 3 : dp);
    return td;
  }

  function renderSection(sec) {
    var p = h('section', { class: 'panel' });
    if (sec.title) p.appendChild(h('h2', null, sec.title));
    if (sec.rows) p.appendChild(h('div', { class: 'result-rows' }, sec.rows.map(renderRow)));
    if (sec.table) {
      var t = sec.table;
      var thead = h('thead', null, h('tr', null, t.head.map(function (x) { return h('th', null, x); })));
      var tbody = h('tbody', null, t.rows.map(function (row) {
        return h('tr', null, row.map(function (c, i) { return renderCell(c, t.dp ? t.dp[i] : 3); }));
      }));
      p.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, thead, tbody)));
    }
    if (sec.plot) p.appendChild(TK.plot(sec.plot));
    if (sec.note) p.appendChild(h('p', { class: 'note-text' }, sec.note));
    return p;
  }

  function resultsAsText(title, out) {
    var lines = [title, ''];
    (out.sections || []).forEach(function (sec) {
      if (sec.title) lines.push('# ' + sec.title);
      (sec.rows || []).forEach(function (r) { lines.push(r.label + ': ' + TK.fmt(r.value, r.dp) + (r.unit ? ' ' + r.unit : '')); });
      if (sec.table) {
        lines.push(sec.table.head.join('\t'));
        sec.table.rows.forEach(function (row) {
          lines.push(row.map(function (c, i) { var v = c && typeof c === 'object' ? c.v : c; return TK.fmt(v, sec.table.dp ? sec.table.dp[i] : 3); }).join('\t'));
        });
      }
      lines.push('');
    });
    return lines.join('\n');
  }

  /* ---------------- mount ---------------- */
  TK.mount = function (cfg) {
    var base = document.body.getAttribute('data-base') || '';
    buildHeader(base);
    var app = document.getElementById('app');
    var key = 'tk:' + cfg.id;

    // flatten input definitions
    var fields = [];
    cfg.inputs.forEach(function (f) {
      if (f.type === 'grid') f.rows.forEach(function (r) { r.cells.forEach(function (c) { fields.push(c); }); });
      else if (f.id) fields.push(f);
    });
    var byId = {}; fields.forEach(function (f) { byId[f.id] = f; });
    var els = {};

    function defaults() { var d = {}; fields.forEach(function (f) { d[f.id] = f.value; }); return d; }
    function setValues(vals) {
      Object.keys(vals).forEach(function (id) { if (els[id]) els[id].value = vals[id]; });
    }
    function visible(f, raw) {
      if (!f.showIf) return true;
      var cur = raw[f.showIf.id];
      return f.showIf.eq !== undefined ? String(cur) === String(f.showIf.eq) : String(cur) !== String(f.showIf.ne);
    }
    function rawValues() { var o = {}; fields.forEach(function (f) { o[f.id] = els[f.id].value; }); return o; }

    /* --- inputs panel --- */
    var form = h('form', { onsubmit: function (e) { e.preventDefault(); }, autocomplete: 'off' });
    var wrappers = {};

    function makeControl(f, compact) {
      var input;
      if (f.type === 'select') {
        input = h('select', { id: 'in-' + f.id }, f.options.map(function (o) { return h('option', { value: o.value }, o.label); }));
      } else if (f.type === 'text') {
        input = h('input', { id: 'in-' + f.id, type: 'text', inputmode: 'decimal' });
      } else {
        input = h('input', { id: 'in-' + f.id, type: 'text', inputmode: 'decimal', spellcheck: 'false' });
      }
      input.value = f.value;
      input.addEventListener('input', run);
      input.addEventListener('change', run);
      els[f.id] = input;
      return input;
    }

    cfg.inputs.forEach(function (f) {
      if (f.group) { form.appendChild(h('div', { class: 'group-title' }, f.group)); return; }
      if (f.type === 'grid') {
        var tbl = h('table', { class: 'grid-in' },
          f.title ? h('caption', null, f.title) : null,
          h('thead', null, h('tr', null, [h('th')].concat(f.cols.map(function (c) { return h('th', null, c); })))),
          h('tbody', null, f.rows.map(function (r) {
            return h('tr', null, [h('td', null, r.label)].concat(r.cells.map(function (c) {
              var inp = makeControl(c, true); inp.setAttribute('aria-label', r.label + ' ' + (c.label || ''));
              return h('td', null, inp);
            })));
          })));
        form.appendChild(tbl);
        return;
      }
      var input = makeControl(f);
      var ctl = h('div', { class: 'control' }, input, f.unit ? h('span', { class: 'unit' }, f.unit) : null);
      var w = h('div', { class: 'field' },
        h('label', { 'for': 'in-' + f.id }, f.label), ctl,
        f.hint ? h('span', { class: 'hint' }, f.hint) : null,
        h('div', { class: 'err', hidden: true }));
      wrappers[f.id] = w;
      form.appendChild(w);
    });

    var presetSel = null;
    var head = h('div', { class: 'panel-head' }, h('h2', null, 'Inputs'));
    if (cfg.presets && cfg.presets.length) {
      presetSel = h('select', { class: 'preset', 'aria-label': 'Load example values' },
        [h('option', { value: '' }, 'Load example…')].concat(cfg.presets.map(function (p, i) { return h('option', { value: i }, p.name); })));
      presetSel.addEventListener('change', function () {
        if (presetSel.value === '') return;
        setValues(cfg.presets[+presetSel.value].values); presetSel.value = ''; run();
      });
      head.appendChild(presetSel);
    }
    head.appendChild(h('button', { type: 'button', onclick: function () { setValues(defaults()); store(key, null); run(); } }, 'Reset'));
    var inputs = h('section', { class: 'panel inputs' }, head, form);

    var results = h('div', { class: 'results', 'aria-live': 'polite' });
    var copyBtn = h('button', { type: 'button' }, 'Copy results');
    var lastOut = null;
    copyBtn.addEventListener('click', function () {
      if (!lastOut) return;
      var text = resultsAsText(cfg.title, lastOut);
      var done = function () { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy results'; }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    });

    var titleBlock = h('div', { class: 'page-title' },
      h('div', { class: 'crumbs' }, h('a', { href: base + 'index.html' }, 'Calculators'), ' / ', cfg.title),
      h('h1', null, cfg.title),
      cfg.subtitle ? h('p', null, cfg.subtitle) : null);

    app.appendChild(titleBlock);
    app.appendChild(h('div', { class: 'calc' }, inputs, results));

    if (cfg.formulas || cfg.notes) {
      var notes = h('section', { class: 'panel notes' }, h('h2', null, 'Method and notes'));
      if (cfg.formulas) notes.appendChild(h('ul', { class: 'formulas' }, cfg.formulas.map(function (f) {
        return h('li', null, h('span', { class: 'lbl' }, f.label), h('span', { class: 'formula' }, f.text));
      })));
      if (cfg.notes) notes.appendChild(h('ul', null, cfg.notes.map(function (n) { return h('li', { html: n }); })));
      if (cfg.source) notes.appendChild(h('p', { class: 'note-text', style: 'margin-top:10px' }, 'Based on spreadsheet: ' + cfg.source));
      app.appendChild(notes);
    }

    /* --- run --- */
    function run() {
      var raw = rawValues(), vals = {}, bad = 0;
      fields.forEach(function (f) {
        var el = els[f.id], w = wrappers[f.id];
        var show = visible(f, raw);
        if (w) w.hidden = !show;
        var msg = '';
        var v;
        if (f.type === 'select') v = Number(raw[f.id]) === Number(raw[f.id]) && raw[f.id] !== '' && f.numeric !== false ? Number(raw[f.id]) : raw[f.id];
        else if (f.type === 'text') v = raw[f.id];
        else {
          v = Number(String(raw[f.id]).replace(/,/g, '').trim());
          if (String(raw[f.id]).trim() === '' || isNaN(v)) msg = 'Enter a number';
          else if (f.min !== undefined && v < f.min) msg = 'Must be at least ' + f.min;
          else if (f.minExclusive !== undefined && v <= f.minExclusive) msg = 'Must be greater than ' + f.minExclusive;
          else if (f.max !== undefined && v > f.max) msg = 'Must be at most ' + f.max;
        }
        if (msg && show) {
          bad++; el.setAttribute('aria-invalid', 'true');
          if (w) { var e = w.querySelector('.err'); e.textContent = msg; e.hidden = false; }
        } else {
          el.removeAttribute('aria-invalid');
          if (w) w.querySelector('.err').hidden = true;
        }
        vals[f.id] = v;
      });
      store(key, raw);

      results.textContent = '';
      if (bad) {
        lastOut = null;
        results.appendChild(h('div', { class: 'banner warn' }, 'Fix the highlighted inputs to see results.'));
        return;
      }
      var out;
      try { out = cfg.calc(vals); }
      catch (err) { lastOut = null; results.appendChild(h('div', { class: 'banner fail' }, 'Calculation error: ' + err.message)); return; }
      lastOut = out;
      (out.warnings || []).forEach(function (w) { results.appendChild(h('div', { class: 'banner warn' }, w)); });
      (out.sections || []).forEach(function (sec, i) {
        var node = renderSection(sec);
        if (i === 0) {
          var hd = node.querySelector('h2');
          var bar = h('div', { class: 'panel-head' }, hd || h('h2', null, 'Results'), copyBtn);
          node.insertBefore(bar, node.firstChild);
        }
        results.appendChild(node);
      });
    }

    var saved = store(key);
    if (saved) setValues(saved);
    run();
  };
})(typeof self !== 'undefined' ? self : this);
