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
      : g.getNodes().map(n => ({ code: n.id, x: n.x, y: -n.y }));
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
    g.svg_element.querySelectorAll('rect[data-ci-group]').forEach(r => {
      const m = means.find(mm => mm.group === r.getAttribute('data-ci-group'));
      if (!m) return;
      const x = +r.getAttribute('x'), y = +r.getAttribute('y');
      const w = +r.getAttribute('width'), h = +r.getAttribute('height');
      Object.assign(m, { x_lo: x, x_hi: x + w, y_lo: -(y + h), y_hi: -y });
    });

    // Visible edge strokes (skip the transparent hit-target twins).
    const edges = [...g.svg_element.querySelectorAll('line[data-edge-source]')]
      .filter(l => l.getAttribute('stroke') !== 'transparent')
      .map(l => ({
        a: l.getAttribute('data-edge-source'),
        b: l.getAttribute('data-edge-target'),
        w: +l.getAttribute('data-edge-weight'),   // |w|; sign resolved from colour
        color: l.getAttribute('stroke'),
        width: +l.getAttribute('stroke-width'),
      }));

    return { nodes, points, means, edges };
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
