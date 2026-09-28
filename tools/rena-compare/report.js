// tools/rena-compare/report.js — inlined into index.html by harness.R.
//
// rENA and adapter checks arrive precomputed from R (window.QEC). The qeviz
// render checks run here: each qeviz iframe posts what it drew, and check()
// mirrors qec_check() in harness.R.
(function () {
  const Q = window.QEC;
  const TOL = Q.tol;

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
    }

    if (truth.edges) {
      const hueA = hue(Q.colors[net.group]);
      const hueB = net.compare ? hue(Q.colors[net.compare]) : null;
      const drawn = new Map(got.edges.map(e => {
        const s = hueB == null || hueDist(hue(e.color), hueA) <= hueDist(hue(e.color), hueB) ? 1 : -1;
        return [key(e.a, e.b), { ...e, w: s * e.w }];
      }));
      const pairs = truth.edges.map(t => [t, drawn.get(key(t.a, t.b))]);
      const missing = pairs.filter(([, g]) => !g).length;
      const extra = [...drawn.keys()].filter(k => !truth.edges.some(t => key(t.a, t.b) === k)).length;
      const det = [missing && `${missing} missing`, extra && `${extra} unexpected`].filter(Boolean).join('; ');
      out.push(row('edge weights (signed)',
        missing ? null : maxAbs(pairs.map(([t, g]) => t.w - g.w)), TOL, det));
      if (!missing && truth.edges.some(t => t.w < 0)) {
        const flips = pairs.filter(([t, g]) => Math.sign(t.w) !== Math.sign(g.w)).length;
        out.push(row('subtraction edge colour/sign', flips, 0,
          `${flips} of ${pairs.length} edges on the wrong side`));
      }
      if (!missing) {
        const mt = Math.max(...pairs.map(([t]) => Math.abs(t.w)));
        const mg = Math.max(...pairs.map(([, g]) => g.width));
        out.push(row('edge width ∝ |weight|',
          maxAbs(pairs.map(([t, g]) => Math.abs(t.w) / mt - g.width / mg)), 0.02,
          'relative widths (encoding, not data)', 'warn'));
      }
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
        out.push(row('95% CI box bounds',
          noCI ? null : maxAbs(ms.flatMap(([t, g]) => b.map(k => t[k] - g[k]))),
          TOL, noCI ? 'CI box not drawn' : ''));
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

    if (truth.points) {
      const ps = truth.points.map(t => [t, got.points.find(p => p.id === t.id)]);
      const missing = ps.filter(([, g]) => !g).length;
      const r = row('unit point positions',
        missing ? null : maxAbs(ps.flatMap(([t, g]) => [t.x - g.x, t.y - g.y])),
        TOL, `${truth.points.length} expected, ${got.points.length} drawn`);
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

  const results = {};   // view -> { rena, adapter, qeviz }
  function tally() {
    const all = Object.values(results).flatMap(r => ['rena', 'adapter', 'qeviz']
      .flatMap(k => (r[k] || []).map(x => ({ ...x, renderer: k }))));
    const by = k => ['PASS', 'WARN', 'FAIL'].map(s => all.filter(x => x.renderer === k && x.status === s).length);
    const waiting = Q.views.filter(v => !results[v.name].qeviz).length;
    document.getElementById('summary').innerHTML = [
      ['rENA render', 'rena'], ['qeviz adapter', 'adapter'], ['qeviz render', 'qeviz'],
    ].map(([label, k]) => {
      const [p, w, f] = by(k);
      const pending = k === 'qeviz' && waiting > 0;
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
  Q.views.forEach(v => {
    results[v.name] = { rena: v.rena, adapter: v.adapter, qeviz: null };
    const sec = document.createElement('section');
    sec.innerHTML = `
      <h2>${esc(v.title)}</h2>
      <div class="cols">
        <div class="col"><h3>rENA <span class="tag">plotly</span></h3>
          <iframe src="panels/rena_${v.name}.html" class="frame"></iframe>
          ${codeBlock(v.code.rena)}
          <div class="checks" id="c-rena-${v.name}"></div></div>
        <div class="col"><h3>qeviz <span class="tag">web component</span></h3>
          <iframe src="panels/qe_${v.name}.html" class="frame"></iframe>
          ${codeBlock(v.code.qe, Q.qe_note)}
          <div class="checks" id="c-qe-${v.name}"></div>
          <details><summary>adapter (qe_extract ModelData) checks</summary>
            <div class="checks" id="c-ad-${v.name}"></div></details></div>
      </div>`;
    main.appendChild(sec);
    renderChecks(sec.querySelector(`#c-rena-${v.name}`), v.rena);
    renderChecks(sec.querySelector(`#c-ad-${v.name}`), v.adapter);
    renderChecks(sec.querySelector(`#c-qe-${v.name}`), null, 'Waiting for qeviz to render…');
  });

  function accept(m) {
    if (!m || m.type !== 'qec-result' || !results[m.view] || results[m.view].qeviz) return;
    const v = Q.views.find(x => x.name === m.view);
    const el = document.getElementById(`c-qe-${m.view}`);
    try {
      results[m.view].qeviz = m.data ? check(v.truth, m.data, v.network)
                                     : [row('render', null, 0, m.error)];
    } catch (err) {
      results[m.view].qeviz = [row('check', null, 0, String(err))];
    }
    renderChecks(el, results[m.view].qeviz);
    window.__QEC_QEVIZ__ = results;
    tally();
  }

  // Two delivery paths: postMessage (works from file://, where iframes are
  // cross-origin) and polling the iframe's __QEC_RESULT__ (same-origin http),
  // which also catches results posted before this page was listening.
  window.addEventListener('message', ev => accept(ev.data));
  const poll = setInterval(() => {
    document.querySelectorAll('iframe[src*="/qe_"], iframe[src^="panels/qe_"]').forEach(f => {
      try { accept(f.contentWindow.__QEC_RESULT__); } catch (_) { /* cross-origin */ }
    });
    if (Q.views.every(v => results[v.name].qeviz)) clearInterval(poll);
  }, 250);

  document.getElementById('meta').textContent =
    `${Q.label} · rENA ${Q.versions.rENA} · qeviz ${Q.versions.qeviz} · tolerance ${Q.tol} · ${Q.generated}`;
  tally();
})();
