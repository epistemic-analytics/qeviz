import { Line } from "../objects/PlottedObject";
import { NodeEdge, TaperedEdge, EdgeArrow } from "../objects/Edges";
import { Color, WeightedColor } from "../objects/Color";
import { Drawable } from "./Drawable";
import { QEArray, QEElement } from "./QELayer";
import { QEGraphElement } from "./QEGraph";

export class QELine extends Drawable implements QEElement {
  __name__: string = "unnamed-line";
  // Optional second element for the direction-indicator chevron on directed edges.
  private _arrow_el: SVGPathElement | null = null;
  // Invisible wide companion line giving thin undirected edges a clickable/
  // hoverable hit target for the qe-edge-* interaction events.
  private _hit_el: SVGLineElement | null = null;

  /** Stamp edge identity onto an element so <qe-graph> delegation can resolve
   *  qe-edge-* events. No-op for non-edges (e.g. axis lines). */
  private _stampEdge(el: SVGElement): void {
    const meta = (this.__data__ as any).meta ?? {};
    if (!meta.isMeanEdge) return;
    el.setAttribute('data-edge-source', String(meta.source ?? ''));
    el.setAttribute('data-edge-target', String(meta.target ?? ''));
    el.setAttribute('data-edge-weight', String(meta.weight ?? 0));
    el.setAttribute('data-edge-directed', meta.isDirected ? 'true' : 'false');
    if (meta.isSelf) el.setAttribute('data-edge-self', 'true');
    if (meta.group != null) el.setAttribute('data-edge-group', String(meta.group));
    if (meta.unit  != null) el.setAttribute('data-edge-unit',  String(meta.unit));
  }

  constructor(
    public __data__: Line,
    public parent: SVGElement,
    public graph: QEGraphElement,
    public __children__: QEArray = new QEArray(),
  ) {
    super(__data__, parent, graph, __children__);

    this.svg_element = this.create();
  }

  create() {
    if (this.__data__ instanceof NodeEdge) {
      // Self-connection: filled circle inside the node, sized by weight.
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill',   this.__data__.color.toString());
      path.setAttribute('stroke', 'none');
      this.svg_element = path;
      return path;
    }

    if (this.__data__ instanceof TaperedEdge) {
      // Directed edges render as filled triangles via TaperedEdge.path.
      // A second SVG path is reserved for the direction-indicator chevron;
      // it is populated lazily in update() once meta.isDirected is known.
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill',   this.__data__.color.toString());
      path.setAttribute('stroke', 'none');
      this.svg_element = path;
      return path;
    }

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1',   this.__data__.from.x.toString());
    line.setAttribute('y1',   this.__data__.from.y.toString());
    line.setAttribute('x2',   this.__data__.to.x.toString());
    line.setAttribute('y2',   this.__data__.to.y.toString());
    line.setAttribute('stroke-width', this.get_size().toString());
    line.setAttribute('stroke', this.__data__.color.toString());

    this.svg_element = line;
    return line;
  }

  update() {
    if (!this.svg_element) {
      this.create();
    }
    if (!this.svg_element.parentElement) {
      this.parent.appendChild(this.svg_element);
    }

    const extent = (this.graph.__data__ as any).extremes?.x_max ?? 1;
    const meta   = (this.__data__ as any).meta ?? {};

    if (meta.isMeanEdge) {
      this._stampEdge(this.svg_element);
      const weight  = typeof meta.weight    === 'number' ? meta.weight    : 0;
      const maxW    = typeof meta.maxWeight === 'number' ? meta.maxWeight : 1;
      const opacity = typeof meta.opacity   === 'number' ? meta.opacity   : Math.min(1, weight / (maxW || 1));
      // Target ≈ multiplier×5 in plotly-px to match rENA (ena.plot.network
      // default: multiplier=5, width = raw_weight × 5).  For a ±2.66-extent
      // coordinate space rendered at ~460px, 1 data-unit ≈ 86px, so
      // rENA's max stroke (0.47 × 5 ≈ 2.4px) ≈ 0.028 data units.
      // Factor 0.011 × extent(2.66) × 1.0 ≈ 0.029 → ~2.5px at 86px/unit.
      const sw      = (extent > 0 ? extent : 1) * 0.011 * (weight / (maxW || 1));

      // Build a WeightedColor from the stored base color + normalized weight so
      // that toString() produces hsla(h, s*w%, l%, w) — matching the Web ENA
      // convention of scaling both saturation and alpha together with weight.
      const baseColor = (this.__data__ as any)._color || new Color('#000000');
      const edgeColor = new WeightedColor(baseColor, opacity).toString();

      if (this.__data__ instanceof NodeEdge) {
        // Recompute display radius here using the live extent (extremes.x_max).
        // The weight stored at creation time is a placeholder (0) because
        // extremes are not yet computed when the edge objects are first built.
        const nodeSize = typeof meta.nodeSize === 'number' ? meta.nodeSize : 2;
        const nodeR    = extent * 0.006 * nodeSize;
        // Inner dot diameter = nodeR × 0.55 × opacity so the outer dark ring
        // (nodeR − inner_r ≈ 0.45 × nodeR) is clearly visible.
        (this.__data__ as NodeEdge).weight = 2 * nodeR * 0.55 * opacity;
        (this.svg_element as SVGPathElement).setAttribute('d', (this.__data__ as NodeEdge).path);
        this.svg_element.setAttribute('fill',   edgeColor);
        this.svg_element.setAttribute('stroke', 'none');
      } else if (this.__data__ instanceof TaperedEdge) {
        // TaperedEdge.path uses .weight as the total base width.  Scale it up
        // (≈4·sw) so the wide end is visibly thicker than an undirected line.
        (this.__data__ as TaperedEdge).weight = sw * 4;
        (this.svg_element as SVGPathElement).setAttribute('d', (this.__data__ as TaperedEdge).path);
        this.svg_element.setAttribute('fill',   edgeColor);
        this.svg_element.setAttribute('stroke', 'none');

        // ── Direction-indicator chevron ──────────────────────────────────────
        // For directed mean edges, overlay an EdgeArrow chevron filled with a
        // more-opaque/saturated version of the edge colour.  Rendered over the
        // semi-transparent triangle body, the fully-opaque fill reads as a
        // visibly darker notch that indicates the direction without introducing
        // a foreign colour.
        if (meta.isDirected) {
          try {
            const arrow = new EdgeArrow(this.__data__ as any);
            const arrowPath = arrow.path;
            // Discard degenerate paths that contain NaN or Infinity (geometry
            // collapsed — zero-length edge, parallel lines, etc.).
            if (arrowPath && !arrowPath.includes('NaN') && !arrowPath.includes('Infinity')) {
              if (!this._arrow_el) {
                this._arrow_el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                this._arrow_el.setAttribute('stroke', 'none');
              }
              if (!this._arrow_el.parentElement) {
                this.parent.appendChild(this._arrow_el);
              }
              this._arrow_el.setAttribute('d', arrowPath);
              // Fully opaque base colour — rendered on top of the semi-transparent
              // triangle it produces a clearly darker same-hue chevron shape.
              const arrowColor = baseColor.toString();
              this._arrow_el.setAttribute('fill', arrowColor);
            }
          } catch (_) {
            // EdgeArrow geometry degenerates for very short or zero-weight edges —
            // silently skip rather than crashing the render loop.
          }
        }
      } else {
        // Regular undirected edge
        const x1 = this.__data__.from.x, y1 = this.__data__.from.y;
        const x2 = this.__data__.to.x,   y2 = this.__data__.to.y;
        (this.svg_element as SVGLineElement).setAttribute('x1', x1.toString());
        (this.svg_element as SVGLineElement).setAttribute('y1', y1.toString());
        (this.svg_element as SVGLineElement).setAttribute('x2', x2.toString());
        (this.svg_element as SVGLineElement).setAttribute('y2', y2.toString());
        this.svg_element.setAttribute('stroke-width', sw.toString());
        this.svg_element.setAttribute('stroke',       edgeColor);
        this.svg_element.setAttribute('pointer-events', 'stroke');
        this.svg_element.removeAttribute('marker-end');

        // Transparent wide hit target so thin edges are clickable/hoverable.
        // Sized to a comfortable minimum regardless of the visible stroke width.
        if (!this._hit_el) {
          this._hit_el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          this._hit_el.setAttribute('stroke', 'transparent');
          this._hit_el.setAttribute('stroke-linecap', 'round');
          this._hit_el.setAttribute('pointer-events', 'stroke');
        }
        if (!this._hit_el.parentElement) this.parent.appendChild(this._hit_el);
        this._hit_el.setAttribute('x1', x1.toString());
        this._hit_el.setAttribute('y1', y1.toString());
        this._hit_el.setAttribute('x2', x2.toString());
        this._hit_el.setAttribute('y2', y2.toString());
        this._hit_el.setAttribute('stroke-width', Math.max(sw, extent * 0.03).toString());
        this._stampEdge(this._hit_el);
      }
    } else {
      // Thin axis lines: ~0.4% of coordinate extent
      (this.svg_element as SVGLineElement).setAttribute('x1', this.__data__.from.x.toString());
      (this.svg_element as SVGLineElement).setAttribute('y1', this.__data__.from.y.toString());
      (this.svg_element as SVGLineElement).setAttribute('x2', this.__data__.to.x.toString());
      (this.svg_element as SVGLineElement).setAttribute('y2', this.__data__.to.y.toString());
      const sw = (extent > 0 ? extent : 1) * 0.004 * this.get_size();
      this.svg_element.setAttribute('stroke-width',   sw.toString());
      this.svg_element.setAttribute('stroke-opacity', '1');
      this.svg_element.setAttribute('stroke',         this.__data__.color.toString());
    }
  }

  draw() {
    if (this._hit_el) this.parent?.appendChild(this._hit_el);
    this.parent?.appendChild(this.svg_element);
    if (this._arrow_el) {
      this.parent?.appendChild(this._arrow_el);
    }
  }
}
