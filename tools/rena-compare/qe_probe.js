// tools/rena-compare/qe_probe.js
//
// Injected into each qeviz panel by harness.R. Once the graph has rendered,
// reads back what qeviz actually drew — in model space (y un-flipped) — and
// posts it to the parent report page, which checks it against the truth.
//
// Sources: the public read APIs (getNodes, getPoints), the rendered SVG
// (edge lines, CI rects), and the points layer for group means (no public
// accessor for means yet).
(function () {
  const VIEW = window.__QEC_VIEW__;

  function collect(g) {
    // Hidden nodes (<qe-nodes show="auto"> with no network) stay in the layer
    // to anchor the extent; report only what is actually drawn.
    const nodeLayer = g.__children__.search('__children__', 'nodes');
    const nodesHidden = nodeLayer && nodeLayer.svg_element &&
                        nodeLayer.svg_element.style.display === 'none';
    const nodes = nodesHidden ? []
      : g.getNodes().map(n => {
          const el = g.svg_element.querySelector(`circle[data-point-id="${CSS.escape(n.id)}"]`);
          // Label text actually drawn for this node (falls back to the name
          // the read API reports if no label element is found).
          const drawn = [...g.svg_element.querySelectorAll('text')].find(t => t.textContent === n.name);
          return { code: n.id, x: n.x, y: -n.y, d: el ? 2 * +el.getAttribute('r') : null,
                   label: drawn ? drawn.textContent : null };
        });
    const points = g.getPoints().map(p => ({ id: p.id, group: p.group, x: p.x, y: -p.y }));

    const layer = g.__children__.search('__children__', 'points');
    const means = layer
      ? [...layer.__data__.objects.values()]
          .filter(o => o.meta && o.meta.kind === 'mean')
          .map(o => ({ group: o.meta.group, x: o.x, y: -o.y }))
      : [];

    // Drawn mean-marker half-side (model units), for the marker-vs-CI check.
    means.forEach(m => {
      const el = g.svg_element.querySelector(`rect[data-point-id="mean-${CSS.escape(m.group)}"]`);
      if (el) m.marker_half = +el.getAttribute('width') / 2;
    });

    // SVG rect: x = x_lo, y = -y_hi, width/height in model units.
    const rectBounds = (r) => {
      const x = +r.getAttribute('x'), y = +r.getAttribute('y');
      const w = +r.getAttribute('width'), h = +r.getAttribute('height');
      return { lo: x, hi: x + w, ylo: -(y + h), yhi: -y };
    };
    g.svg_element.querySelectorAll('rect[data-ci-group]').forEach(r => {
      const m = means.find(mm => mm.group === r.getAttribute('data-ci-group'));
      if (!m) return;
      const b = rectBounds(r);
      Object.assign(m, { x_lo: b.lo, x_hi: b.hi, y_lo: b.ylo, y_hi: b.yhi, ci_kind: 'box' });
    });
    // Crosshairs: "M x0 my L x1 my M mx y0 L mx y1".
    g.svg_element.querySelectorAll('path[data-ci-group]').forEach(pth => {
      const m = means.find(mm => mm.group === pth.getAttribute('data-ci-group'));
      const n = ((pth.getAttribute('d') || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
      if (!m || n.length < 8) return;
      Object.assign(m, { x_lo: Math.min(n[0], n[2]), x_hi: Math.max(n[0], n[2]),
                         y_lo: -Math.max(n[5], n[7]), y_hi: -Math.min(n[5], n[7]), ci_kind: 'crosshairs' });
    });
    g.svg_element.querySelectorAll('rect[data-outlier-group]').forEach(r => {
      const m = means.find(mm => mm.group === r.getAttribute('data-outlier-group'));
      if (!m) return;
      const b = rectBounds(r);
      Object.assign(m, { o_x_lo: b.lo, o_x_hi: b.hi, o_y_lo: b.ylo, o_y_hi: b.yhi });
    });

    // Sign comes from each edge's *base* group colour. The rendered stroke fades
    // saturation with weight, so a near-zero difference renders almost grey and
    // its hue no longer says which group it belongs to.
    const edgeLayer = g.__children__.search('__children__', 'edges');
    const baseColor = new Map();
    if (edgeLayer) [...edgeLayer.__data__.objects.values()].forEach(o => {
      const m = o.meta || {};
      if (m.source != null) baseColor.set(`${m.source}|${m.target}`, String(o.base_color ?? o.color));
    });

    // Visible edge strokes (skip the transparent hit-target twins).
    const edges = [...g.svg_element.querySelectorAll('line[data-edge-source]')]
      .filter(l => l.getAttribute('stroke') !== 'transparent')
      .map(l => {
        const a = l.getAttribute('data-edge-source'), b = l.getAttribute('data-edge-target');
        return {
          a, b,
          w: +l.getAttribute('data-edge-weight'),   // |w|; sign resolved from colour
          color: baseColor.get(`${a}|${b}`) ?? l.getAttribute('stroke'),
          width: +l.getAttribute('stroke-width'),
        };
      });

    // Directed (ONA) edges: tapered paths "M apex L base1 L base2 z". The wide
    // end is attributed to whichever node it geometrically sits on (b), and a
    // is the other endpoint — so the check tests the drawing, not attributes.
    const num = d => (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
    const allNodes = g.getNodes();
    const nearestNode = (x, y) => allNodes.reduce((best, n) => {
      const d = Math.hypot(n.x - x, n.y - y);
      return d < best.d ? { id: n.id, d } : best;
    }, { id: null, d: Infinity }).id;
    const self = [];
    [...g.svg_element.querySelectorAll('path[data-edge-source]')]
      .filter(pth => pth.getAttribute('fill') !== 'transparent')
      .forEach(pth => {
        const src = pth.getAttribute('data-edge-source'), tgt = pth.getAttribute('data-edge-target');
        const n = num(pth.getAttribute('d') || '');
        if (pth.getAttribute('data-edge-self') === 'true') {
          // NodeEdge: "M cx,y a R,R 0 1,0 2R,0 …" → diameter 2R
          if (n.length >= 3) self.push({ code: tgt, d: 2 * n[2], w: +pth.getAttribute('data-edge-weight') });
          return;
        }
        if (n.length < 6) return;
        const b = nearestNode((n[2] + n[4]) / 2, (n[3] + n[5]) / 2);
        edges.push({
          a: b === tgt ? src : tgt, b,
          w: +pth.getAttribute('data-edge-weight'),
          color: baseColor.get(`${src}|${tgt}`) ?? pth.getAttribute('fill'),
          width: Math.hypot(n[2] - n[4], n[3] - n[5]),
          directed: true,
        });
      });

    // Plot half-width in model units: edge-width is a fraction of the plot
    // width, so widths are compared across plots in plot-width units.
    const extent = g.__data__?.extremes?.x_max ?? null;
    return { nodes, points, means, edges, self, extent };
  }

  function ready(g) {
    return g && g.getNodes().length > 0 && g.svg_element;
  }

  const t0 = performance.now();
  (function poll() {
    const g = window.QEViz && QEViz.getGraphs()[0];
    if (!ready(g) && performance.now() - t0 < 8000) return setTimeout(poll, 100);
    // Let edge/CI DOM updates flush after the layer render. A timer rather than
    // requestAnimationFrame, which never fires in hidden/background tabs.
    setTimeout(() => {
      let msg;
      try {
        msg = { type: 'qec-result', view: VIEW, data: g ? collect(g) : null,
                error: g ? null : 'qe-graph never rendered' };
      } catch (err) {
        msg = { type: 'qec-result', view: VIEW, data: null, error: String(err) };
      }
      window.__QEC_RESULT__ = msg;
      if (window.parent !== window) window.parent.postMessage(msg, '*');
    }, 150);
  })();
})();
