// tools/rena-compare/report.js — inlined into index.html by harness.R.
//
// Reference-renderer (rENA or ona) and adapter checks arrive precomputed from
// R (window.QEC). The qeviz
// render checks run here: each qeviz iframe posts what it drew, and check()
// mirrors qec_check() in harness.R.
(function () {
  const Q = window.QEC;
  const TOL = Q.tol;
  const REF = Q.reference || { label: 'rENA', tag: 'plotly' };

  const row = (check, delta, tol, detail = '', level = 'fail') => ({
    check, max_delta: delta, tol, detail,
    status: delta == null || Number.isNaN(delta) ? 'FAIL'
          : delta <= tol ? 'PASS' : level === 'warn' ? 'WARN' : 'FAIL',
  });
  const key = (a, b) => (a <= b ? `${a}|${b}` : `${b}|${a}`);
  const maxAbs = arr => arr.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

  function hue(col) {
    let r, g, b;
    const m = /rgba?\(([^)]+)\)/.exec(col || '');
    if (m) [r, g, b] = m[1].split(',').map(Number);
    else {
      const h = (col || '').replace('#', '');
      [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    }
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    let h2 = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return ((h2 / 6) + 1) % 1;
  }
  const hueDist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 1 - d); };

  function check(truth, got, net) {
    const out = [];
    if (!truth.nodes_drawn) {
      out.push(row('no code nodes without a network', got.nodes.length, 0,
        `${got.nodes.length} drawn`));
    } else {
      const nodes = truth.nodes.map(t => [t, got.nodes.find(n => n.code === t.code)]);
      const missingN = nodes.filter(([, g]) => !g).map(([t]) => t.code);
      out.push(row('node positions',
        missingN.length ? null : maxAbs(nodes.flatMap(([t, g]) => [t.x - g.x, t.y - g.y])),
        TOL, missingN.length ? 'missing: ' + missingN.join(', ') : ''));
      if (!missingN.length && truth.nodes.some(t => t.label != null)) {
        const wrong = nodes.filter(([t, g]) => (t.label ?? t.code) !== g.label).length;
        out.push(row('node label text', wrong, 0, `${wrong} of ${nodes.length} labels differ`));
      }
    }

    if (truth.edges) {
      // Directed: match source → target (the node the wide end sits on).
      const k2 = truth.directed ? (a, b) => `${a} -> ${b}` : key;
      // Positive / negative colours resolved in R (explicit `colors`, else the
      // group palette).
      const hueA = hue(net.colors[0]);
      const hueB = net.colors.length > 1 ? hue(net.colors[1]) : null;
      const drawn = new Map(got.edges.map(e => {
        const s = hueB == null || hueDist(hue(e.color), hueA) <= hueDist(hue(e.color), hueB) ? 1 : -1;
        return [k2(e.a, e.b), { ...e, w: s * e.w }];
      }));
      const pairs = truth.edges.map(t => [t, drawn.get(k2(t.a, t.b))]);
      const missing = pairs.filter(([, g]) => !g).length;
      const extra = [...drawn.keys()].filter(k => !truth.edges.some(t => k2(t.a, t.b) === k)).length;
      const det = [missing && `${missing} missing`, extra && `${extra} unexpected`].filter(Boolean).join('; ');
      out.push(row(truth.directed ? 'directed edge weights (signed)' : 'edge weights (signed)',
        missing ? null : maxAbs(pairs.map(([t, g]) => t.w - g.w)), TOL, det));
      if (!missing && truth.edges.some(t => t.w < 0)) {
        const flips = pairs.filter(([t, g]) => Math.sign(t.w) !== Math.sign(g.w)).length;
        out.push(row('subtraction edge colour/sign', flips, 0,
          `${flips} of ${pairs.length} edges on the wrong side`));
      }
      if (!missing && truth.directed && got.nodes.length && got.nodes.every(n => n.d != null)) {
        // Directed: diameter ∝ Σ |w| of edges directed AT the node + its
        // self-connection, at the plot's own width-per-weight.
        const ks = got.edges.map(e => e.width / Math.abs(e.w)).sort((a, b) => a - b);
        const k = ks[Math.floor(ks.length / 2)];
        const selfW = c => Math.abs((truth.self || []).find(s => s.code === c)?.w ?? 0);
        const conn = got.nodes.map(n => [n, got.edges.filter(e => e.b === n.code)
            .reduce((a, e) => a + Math.abs(e.w), 0) + selfW(n.code)]).filter(([, w]) => w > 0);
        const ratios = conn.map(([n, w]) => n.d / (k * w));
        out.push(row('node diameter = Σ incoming edge widths + self',
          maxAbs(ratios.map(r => r - 1)), 1e-3,
          `diameter ÷ (incoming + self) = ${Math.min(...ratios).toFixed(3)} – ${Math.max(...ratios).toFixed(3)}`));
      } else if (!missing && got.nodes.length && got.nodes.every(n => n.d != null)) {
        // Node diameter must equal the summed drawn widths of its edges.
        const sw = n => got.edges.filter(e => e.a === n.code || e.b === n.code)
                                 .reduce((a, e) => a + e.width, 0);
        const conn = got.nodes.map(n => [n, sw(n)]).filter(([, s]) => s > 0);
        const top = Math.max(...conn.map(([, s]) => s));
        const ratios = conn.map(([n, s]) => n.d / s);
        out.push(row('node diameter = Σ edge widths',
          Math.max(...conn.map(([n, s]) => Math.abs(n.d - s))) / top, 1e-6,
          `diameter ÷ Σ widths = ${Math.min(...ratios).toFixed(2)} – ${Math.max(...ratios).toFixed(2)}`));
      }
      if (!missing) {
        const mt = Math.max(...pairs.map(([t]) => Math.abs(t.w)));
        const mg = Math.max(...pairs.map(([, g]) => g.width));
        out.push(row('edge width ∝ |weight|',
          maxAbs(pairs.map(([t, g]) => Math.abs(t.w) / mt - g.width / mg)), 0.02,
          'relative widths (encoding, not data)', 'warn'));
      }
    }

    if (truth.self && got.self && got.self.length) {
      // Self-connection glyph should grow with the self weight alone.
      const r = got.self.map(s => s.d / Math.abs((truth.self.find(t => t.code === s.code) || {}).w));
      const med = [...r].sort((a, b) => a - b)[Math.floor(r.length / 2)];
      out.push(row('self-connection size ∝ self weight', maxAbs(r.map(x => x / med - 1)), 0.02,
        `size ÷ weight varies ${(Math.min(...r) / med).toFixed(2)} – ${(Math.max(...r) / med).toFixed(2)} × median`, 'warn'));
    }

    if (truth.means) {
      const ms = truth.means.map(t => [t, got.means.find(m => m.group === t.group)]);
      const missing = ms.some(([, g]) => !g);
      out.push(row('group mean positions',
        missing ? null : maxAbs(ms.flatMap(([t, g]) => [t.x - g.x, t.y - g.y])),
        TOL, missing ? 'group mean missing' : ''));
      if (!missing && truth.ci === false) {
        const drawn = ms.filter(([, g]) => g.x_lo != null).length;
        out.push(row('no CI box when intervals off', drawn, 0, `${drawn} box(es) drawn`));
      } else if (!missing) {
        const b = ['x_lo', 'x_hi', 'y_lo', 'y_hi'];
        const noCI = ms.some(([, g]) => g.x_lo == null);
        out.push(row('95% CI bounds',
          noCI ? null : maxAbs(ms.flatMap(([t, g]) => b.map(k => t[k] - g[k]))),
          TOL, noCI ? 'CI not drawn' : (ms[0][1].ci_kind || '')));
        if (!noCI && ms.every(([, g]) => g.marker_half != null)) {
          // Encoding: marker half-side ≤ 0.5 × the CI box's shorter half-side
          // (MEAN_MAX_FRACTION_OF_INTERVAL in QEGraph.ts).
          const ratio = Math.max(...ms.map(([, g]) =>
            g.marker_half / Math.min((g.x_hi - g.x_lo) / 2, (g.y_hi - g.y_lo) / 2)));
          out.push(row('mean marker fits inside CI', Math.max(0, ratio - 0.5), 1e-6,
            `marker half-side = ${ratio.toFixed(2)} × CI half-side (max 0.50)`, 'warn'));
        }
      }
    }

    if (truth.means && truth.outlier) {
      const ms = truth.means.map(t => [t, got.means.find(m => m.group === t.group)]);
      const ob = ['o_x_lo', 'o_x_hi', 'o_y_lo', 'o_y_hi'];
      const missing = ms.some(([, g]) => !g || g.o_x_lo == null);
      out.push(row('outlier interval (Q1 − 1.5·IQR … Q3 + 1.5·IQR)',
        missing ? null : maxAbs(ms.flatMap(([t, g]) => ob.map(k => t[k] - g[k]))),
        TOL, missing ? 'outlier interval not drawn' : ''));
    }

    if (truth.range != null) {
      out.push(row('axis range (±)', got.range == null ? null : Math.abs(got.range - truth.range) / truth.range,
        1e-6, `expected ±${truth.range.toFixed(4)}, drawn ±${(got.range ?? NaN).toFixed(4)}`));
    }
    if (truth.title != null) {
      out.push(row('title text', got.title === truth.title ? 0 : 1, 0, got.title ?? 'none'));
    }
    if (truth.font) {
      out.push(row('label font size (px)', got.font ? Math.abs(got.font.size - truth.font.size) : null, 0.5,
        `expected ${truth.font.size} px, drawn ${got.font ? got.font.size.toFixed(2) : 'none'}`));
      out.push(row('label font family', got.font && got.font.family === truth.font.family ? 0 : 1, 0,
        got.font ? got.font.family : 'none'));
    }
    if (truth.mean_colors) {
      const exp = Object.entries(truth.mean_colors);
      const wrong = exp.filter(([g, c]) => (got.means.find(m => m.group === g)?.color || '').toUpperCase()
                                           !== String(c).toUpperCase()).length;
      out.push(row('group mean colours', wrong, 0, `${wrong} of ${exp.length} differ`));
    }

    if (truth.points) {
      // By unit id when the drawn ids overlap the truth's; otherwise (the rENA
      // backend fed plain matrices numbers points 1..n) nearest neighbour.
      const byId = truth.points.some(t => got.points.some(p => p.id === t.id));
      const near = t => got.points.reduce((b, p) => {
        const d = Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y));
        return d < b.d ? { p, d } : b; }, { p: null, d: Infinity }).p;
      const ps = truth.points.map(t => [t, byId ? got.points.find(p => p.id === t.id) : near(t)]);
      const missing = ps.filter(([, g]) => !g).length;
      const r = row('unit point positions',
        missing ? null : maxAbs(ps.flatMap(([t, g]) => [t.x - g.x, t.y - g.y])),
        TOL, `${truth.points.length} expected, ${got.points.length} drawn${byId ? '' : ' (matched by position)'}`);
      if (truth.points.length !== got.points.length) r.status = 'FAIL';
      out.push(r);
    }
    return out;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  const fmt = v => v == null || Number.isNaN(v) ? '—'
    : v === 0 ? '0' : Math.abs(v) < 1e-3 ? v.toExponential(1) : v.toFixed(4);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function renderChecks(el, rows, pending) {
    if (pending) { el.innerHTML = `<p class="pending">${esc(pending)}</p>`; return; }
    el.innerHTML = `<table><thead><tr><th>Check</th><th>Status</th><th>max Δ</th><th>Detail</th></tr></thead><tbody>${
      rows.map(r => `<tr><td>${esc(r.check)}</td><td><span class="st st-${r.status.toLowerCase()}">${r.status}</span></td>` +
                    `<td class="num">${fmt(r.max_delta)}</td><td class="det">${esc(r.detail)}</td></tr>`).join('')
    }</tbody></table>`;
  }

  const BE = !!Q.backend;  // third column: rENA code on ena.plot(backend = "qeviz")
  const results = {};   // view -> { rena, adapter, qeviz, be, be_adapter }
  const qeK = {};       // view -> qeviz thickness per unit weight
  const beK = {};       // view -> backend thickness per unit weight

  function renderScale() {
    const nets = Q.views.filter(v => v.rena_k != null);
    if (!nets.length) { document.getElementById('scale').remove(); return; }
    const waiting = nets.filter(v => qeK[v.name] == null || (BE && beK[v.name] == null)).length;
    const rel = (k, ref) => (k == null || ref == null ? null : k / ref);
    const refR = nets[0].rena_k, refQ = qeK[nets[0].name], refB = beK[nets[0].name];
    const status = r => r == null ? '' : Math.abs(r - 1) <= 1e-3 ? 'PASS' : 'FAIL';
    const cell = r => r == null ? '<td class="num">—</td><td></td>'
      : `<td class="num">${r.toFixed(3)}</td><td><span class="st st-${status(r).toLowerCase()}">${status(r)}</span></td>`;
    document.getElementById('scale-table').innerHTML =
      `<table><thead><tr><th>Plot</th><th>${esc(REF.label)}</th><th></th>` +
      (BE ? `<th>${esc(REF.label)} → qeviz</th><th></th>` : '') + `<th>qeviz</th><th></th></tr></thead><tbody>${
        nets.map(v => `<tr><td>${esc(v.title)}</td>${cell(rel(v.rena_k, refR))}` +
          (BE ? cell(rel(beK[v.name], refB)) : '') + `${cell(rel(qeK[v.name], refQ))}</tr>`).join('')
      }</tbody></table>` + (waiting ? `<p class="pending">${waiting} qeviz plot(s) rendering…</p>` : '');
    window.__QEC_SCALE__ = { rena: nets.map(v => rel(v.rena_k, refR)), qeviz: nets.map(v => rel(qeK[v.name], refQ)),
                             backend: BE ? nets.map(v => rel(beK[v.name], refB)) : null };
  }
  function tally() {
    const all = Object.values(results).flatMap(r => ['rena', 'adapter', 'qeviz', 'be', 'be_adapter']
      .flatMap(k => (r[k] || []).map(x => ({ ...x, renderer: k }))));
    const by = k => ['PASS', 'WARN', 'FAIL'].map(s => all.filter(x => x.renderer === k && x.status === s).length);
    const waitingFor = k => Q.views.filter(v => !results[v.name][k]).length;
    document.getElementById('summary').innerHTML = [
      [`${REF.label} render`, 'rena'],
      ...(BE ? [[`${REF.label} → qeviz render`, 'be'], [`${REF.label} → qeviz model data`, 'be_adapter']] : []),
      ['qeviz render', 'qeviz'], ['qeviz model data', 'adapter'],
    ].map(([label, k]) => {
      const [p, w, f] = by(k);
      const waiting = (k === 'qeviz' || k === 'be') ? waitingFor(k) : 0;
      const pending = waiting > 0;
      const state = pending ? `<span class="pending">${waiting} view(s) rendering…</span>` : '';
      const head = f ? `${f} fail` : pending ? 'pending' : w ? `pass · ${w} warn` : 'all pass';
      return `<div class="tile ${f ? 'bad' : pending ? '' : w ? 'warn' : 'ok'}"><div class="tl">${label}</div>` +
             `<div class="tv">${head}</div>` +
             `<div class="ts">${p} pass · ${w} warn · ${f} fail ${state}</div></div>`;
    }).join('');
  }

  // Code shown here is the exact text harness.R eval()'d to build each plot.
  function codeBlock(code, note) {
    return `<details class="code" open><summary>Code</summary>` +
           `<pre><code>${esc(code)}</code></pre>` +
           (note ? `<p class="codenote">${esc(note)}</p>` : '') + `</details>`;
  }

  if (Q.setup_code) {
    document.getElementById('setup').innerHTML =
      `<h2>Model</h2><p class="codenote">Run once; <code>set</code> is shared by every plot below.</p>` +
      `<pre><code>${esc(Q.setup_code)}</code></pre>`;
  } else {
    document.getElementById('setup').remove();
  }

  const main = document.getElementById('views');
  const warnList = ws => ws && ws.length
    ? `<details class="warns" open><summary>${ws.length} backend warning(s)</summary><ul>${
        ws.map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : '';
  Q.views.forEach(v => {
    results[v.name] = { rena: v.rena, adapter: v.adapter, qeviz: null,
                        be: null, be_adapter: BE ? v.be_adapter : null };
    const sec = document.createElement('section');
    sec.innerHTML = `
      <h2>${esc(v.title)}</h2>
      <div class="cols${BE ? ' cols3' : ''}">
        <div class="col"><h3>${esc(REF.label)} <span class="tag">${esc(REF.tag)}</span></h3>
          <iframe src="panels/ref_${v.name}.html" class="frame"></iframe>
          ${codeBlock(v.code.rena)}
          <div class="checks" id="c-rena-${v.name}"></div></div>
        ${BE ? `<div class="col"><h3>${esc(REF.label)} → qeviz <span class="tag">backend = "qeviz"</span></h3>
          <iframe src="panels/be_${v.name}.html" class="frame"></iframe>
          ${codeBlock(v.code.be, 'The same code with only the backend changed.')}
          ${warnList(v.be_warnings)}
          <div class="checks" id="c-be-${v.name}"></div>
          <details><summary>model data checks</summary>
            <div class="checks" id="c-bead-${v.name}"></div></details></div>` : ''}
        <div class="col"><h3>qeviz <span class="tag">direct API</span></h3>
          <iframe src="panels/qe_${v.name}.html" class="frame"></iframe>
          ${codeBlock(v.code.qe, Q.qe_note)}
          <div class="checks" id="c-qe-${v.name}"></div>
          <details><summary>model data (qe_extract) checks</summary>
            <div class="checks" id="c-ad-${v.name}"></div></details></div>
      </div>`;
    main.appendChild(sec);
    renderChecks(sec.querySelector(`#c-rena-${v.name}`), v.rena);
    renderChecks(sec.querySelector(`#c-ad-${v.name}`), v.adapter);
    renderChecks(sec.querySelector(`#c-qe-${v.name}`), null, 'Waiting for qeviz to render…');
    if (BE) {
      renderChecks(sec.querySelector(`#c-bead-${v.name}`), v.be_adapter);
      renderChecks(sec.querySelector(`#c-be-${v.name}`), null, 'Waiting for qeviz to render…');
    }
  });

  function accept(m) {
    if (!m || m.type !== 'qec-result') return;
    // Backend panels report as "be:<view>".
    const isBE = String(m.view).startsWith('be:');
    const name = isBE ? m.view.slice(3) : m.view;
    const slot = isBE ? 'be' : 'qeviz';
    if (!results[name] || results[name][slot]) return;
    const v = Q.views.find(x => x.name === name);
    const el = document.getElementById(`${isBE ? 'c-be' : 'c-qe'}-${name}`);
    try {
      results[name][slot] = m.data ? check(v.truth, m.data, v.network)
                                   : [row('render', null, 0, m.error)];
    } catch (err) {
      results[name][slot] = [row('check', null, 0, String(err))];
    }
    renderChecks(el, results[name][slot]);
    if (m.data && m.data.edges.length) {
      // Width per unit weight as a fraction of the plot width (2 × extent):
      // what <qe-graph edge-width> fixes. Plots whose layouts differ (e.g.
      // moved nodes) have different extents but must match on screen.
      const perW = m.data.edges.reduce((a, e) => a + e.width, 0) /
                   m.data.edges.reduce((a, e) => a + Math.abs(e.w), 0);
      (isBE ? beK : qeK)[name] = m.data.extent ? perW / (2 * m.data.extent) : perW;
    }
    window.__QEC_QEVIZ__ = results;
    renderScale();
    tally();
  }

  // Two delivery paths: postMessage (works from file://, where iframes are
  // cross-origin) and polling the iframe's __QEC_RESULT__ (same-origin http),
  // which also catches results posted before this page was listening.
  window.addEventListener('message', ev => accept(ev.data));
  const poll = setInterval(() => {
    document.querySelectorAll('iframe[src^="panels/qe_"], iframe[src^="panels/be_"]').forEach(f => {
      try { accept(f.contentWindow.__QEC_RESULT__); } catch (_) { /* cross-origin */ }
    });
    if (Q.views.every(v => results[v.name].qeviz && (!BE || results[v.name].be))) clearInterval(poll);
  }, 250);

  renderScale();
  document.getElementById('meta').textContent =
    `${Q.label} · ${REF.label} ${Q.versions.ref} · qeviz ${Q.versions.qeviz} · tolerance ${Q.tol} · ${Q.generated}`;
  document.title = `${REF.label} vs qeviz accuracy`;
  document.querySelector('h1').textContent = `${REF.label} vs qeviz — plot accuracy`;
  tally();
})();
