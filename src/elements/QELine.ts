import { Line } from "../objects/PlottedObject";
import { NodeEdge, TaperedEdge, EdgeArrow } from "../objects/Edges";
import { Color, WeightedColor } from "../objects/Color";
import { Drawable } from "./Drawable";
import { QEArray, QEElement } from "./QELayer";
import { QEGraphElement } from "./QEGraph";
import { CHEVRON_DARKEN, CHEVRON_HALO_PX, EDGE_WIDTH_PER_EXTENT, TAPERED_OUTLINE_PX } from "../objects/Sizing";

/** Composite an rgba() colour over white, returning an opaque rgb(). */
function flattenOnWhite(col: string): string {
  const m = /rgba?\(([^)]+)\)/.exec(col);
  if (!m) return col;
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  const f = (c: number) => Math.round(255 + (c - 255) * a);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Scale an rgba()/rgb() colour's RGB channels by `k` (alpha unchanged). */
function darkenRgba(col: string, k: number): string {
  const m = /rgba?\(([^)]+)\)/.exec(col);
  if (!m) return col;
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return `rgba(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)},${a})`;
}

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
    // Optional fields are cleared when absent: the element outlives renders.
    const opt = (name: string, v: any) =>
      v != null && v !== false ? el.setAttribute(name, v === true ? 'true' : String(v)) : el.removeAttribute(name);
    opt('data-edge-self',  !!meta.isSelf);
    opt('data-edge-group', meta.group);
    opt('data-edge-unit',  meta.unit);
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

  /** Self and directed edges draw as a <path>, everything else as a <line>. */
  private get drawsPath(): boolean {
    return this.__data__ instanceof NodeEdge || this.__data__ instanceof TaperedEdge;
  }

  update() {
    if (!this.svg_element) {
      this.create();
    }
    // The layer rebinds __data__ on every render. If the edge changed kind
    // (undirected <line> ↔ directed / self <path>), the old element cannot
    // draw the new geometry and would stay where it was: rebuild it.
    if ((this.svg_element.tagName.toLowerCase() === 'path') !== this.drawsPath) {
      const old = this.svg_element;
      this.create();
      if (old.parentElement) old.replaceWith(this.svg_element);
    }
    if (this.drawsPath) { this._hit_el?.remove(); this._hit_el = null; }
    if (!this.svg_element.parentElement) {
      this.parent.appendChild(this.svg_element);
    }

    const extent = (this.graph.__data__ as any).extremes?.x_max ?? 1;
    const meta   = (this.__data__ as any).meta ?? {};
    // Only directed tapered edges carry a chevron; drop one left from before.
    let keepArrow = false;

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
      // Width = weight × the plot's shared width-per-weight (objects/Sizing.ts);
      // the fallback keeps edges visible if an edge arrives without one.
      const ext     = extent > 0 ? extent : 1;
      // <qe-edges fixed-size>: the zoom group scales everything by the zoom
      // level, so dividing thickness by it keeps the zoom-1 on-screen width
      // (strokes, triangle bases and so their chevrons, self dots, hit
      // lines). Positions, and so the triangles' apex split, still zoom.
      const zoomDiv = meta.fixedSize ? ((this.graph as any).zoom_level || 1) : 1;
      const sw      = (typeof meta.widthFrac === 'number'
        ? ext * meta.widthFrac * weight
        : ext * EDGE_WIDTH_PER_EXTENT * (weight / (maxW || 1))) / zoomDiv;

      // Build a WeightedColor from the stored base color + normalized weight so
      // that toString() produces hsla(h, s*w%, l%, w) — matching the Web ENA
      // convention of scaling both saturation and alpha together with weight.
      const baseColor = (this.__data__ as any)._color || new Color('#000000');
      // Saturation and opacity come from the graph's colour ramps
      // (<qe-edges color-scale>); older edges carry only opacity.
      const saturation = typeof meta.saturation === 'number' ? meta.saturation : opacity;
      const edgeColor = new WeightedColor(baseColor, saturation, opacity).toString();

      if (this.__data__ instanceof NodeEdge) {
        // Diameter = the self weight's width (same width-per-weight as edges
        // and nodes), matching ona. The node's diameter includes this self
        // weight, so the dot always fits inside it. Computed here because the
        // live extent is not known when the edge objects are built.
        // <qe-edges self-size>: a fraction of the node's radius instead (sigma
        // draws ONA self-connections at half the node); the weight then only
        // sets the colour.
        const frac = typeof meta.selfSize === 'number' && meta.selfSize > 0 ? meta.selfSize : null;
        const nodeR = frac != null ? (this.graph as any)._nodeRadius?.(String(meta.source)) : null;
        (this.__data__ as NodeEdge).weight = typeof nodeR === 'number' ? 2 * frac! * nodeR : sw;
        (this.svg_element as SVGPathElement).setAttribute('d', (this.__data__ as NodeEdge).path);
        this.svg_element.setAttribute('fill',   edgeColor);
        this.svg_element.setAttribute('stroke', 'none');
      } else if (this.__data__ instanceof TaperedEdge) {
        // TaperedEdge.path uses .weight as the total base width (the wide end,
        // at the target node); node sizes sum these base widths.
        (this.__data__ as TaperedEdge).weight = sw;
        (this.svg_element as SVGPathElement).setAttribute('d', (this.__data__ as TaperedEdge).path);
        this.svg_element.setAttribute('fill',   edgeColor);
        // Hairline outline (constant on-screen width, same weighted colour as
        // the fill). A long, thin triangle tapers below a pixel for most of its
        // length; the outline keeps the whole connection legible without
        // changing its width or colour encoding (ona draws a similar halo).
        this.svg_element.setAttribute('stroke', edgeColor);
        this.svg_element.setAttribute('stroke-width', String(TAPERED_OUTLINE_PX));
        this.svg_element.setAttribute('vector-effect', 'non-scaling-stroke');
        this.svg_element.setAttribute('stroke-linejoin', 'round');

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
              // As ona draws arrows: the edge's weighted colour flattened onto
              // white ("fake alpha", so it is opaque and weak edges still get
              // lighter chevrons), then darkened — plus ona's optional white
              // halo, at a constant on-screen width, so it stands out from the
              // triangle it sits on.
              this._arrow_el.setAttribute('fill', darkenRgba(flattenOnWhite(edgeColor), CHEVRON_DARKEN));
              this._arrow_el.setAttribute('stroke', '#ffffff');
              this._arrow_el.setAttribute('stroke-width', String(CHEVRON_HALO_PX));
              this._arrow_el.setAttribute('vector-effect', 'non-scaling-stroke');
              this._arrow_el.setAttribute('stroke-linejoin', 'round');
              keepArrow = true;
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
        this._hit_el.setAttribute('stroke-width', Math.max(sw, extent * 0.03 / zoomDiv).toString());
        this._stampEdge(this._hit_el);
      }
    } else {
      // Thin axis lines: ~0.4% of coordinate extent
      (this.svg_element as SVGLineElement).setAttribute('x1', this.__data__.from.x.toString());
      (this.svg_element as SVGLineElement).setAttribute('y1', this.__data__.from.y.toString());
      (this.svg_element as SVGLineElement).setAttribute('x2', this.__data__.to.x.toString());
      (this.svg_element as SVGLineElement).setAttribute('y2', this.__data__.to.y.toString());
      // <qe-axes fixed-size>: axis lines keep their zoom-1 width on screen.
      const k  = (this.graph as any)._axesFixedSize && String(this.__data__.ID).startsWith('axis-')
        ? ((this.graph as any).zoom_level || 1) : 1;
      const sw = (extent > 0 ? extent : 1) * 0.004 * this.get_size() / k;
      this.svg_element.setAttribute('stroke-width',   sw.toString());
      this.svg_element.setAttribute('stroke-opacity', '1');
      this.svg_element.setAttribute('stroke',         this.__data__.color.toString());
    }

    if (!keepArrow && this._arrow_el) { this._arrow_el.remove(); this._arrow_el = null; }
  }

  /** Take the edge off the plot, with its hit target and chevron. */
  remove(): void {
    this.svg_element?.remove();
    this._hit_el?.remove();
    this._arrow_el?.remove();
  }

  draw() {
    if (this._hit_el) this.parent?.appendChild(this._hit_el);
    this.parent?.appendChild(this.svg_element);
    if (this._arrow_el) {
      this.parent?.appendChild(this._arrow_el);
    }
  }
}
