import { PlottedObject } from "../objects/PlottedObject";
import { Drawable } from "./Drawable";
import { QEArray, QEElement } from "./QELayer";
import { QEGraphElement } from "./QEGraph";
import { POINT_RADIUS_PER_EXTENT } from "../objects/Sizing";

export class QEPoint extends Drawable implements QEElement {
  __name__: string = "unnamed-point";

  constructor(
    public __data__: PlottedObject,
    public parent: SVGElement,
    public graph: QEGraphElement,
    public __children__: QEArray = new QEArray(),
  ) {
    super(__data__, parent, graph, __children__);

    this.svg_element = this.create();
  }

  get x() {
    return this.__data__.dimensions[this.graph.__data__.options.GRAPH.dimensions[0]];
  }
  get y() {
    return this.__data__.dimensions[this.graph.__data__.options.GRAPH.dimensions[1]];
  }

  get isSquare(): boolean {
    return (this.__data__ as any).shape === 'rect';
  }

  /** "circle" (default) | "rect" | "triangle" | "diamond". */
  get shapeKind(): 'circle' | 'rect' | 'triangle' | 'diamond' {
    const s = (this.__data__ as any).shape;
    return s === 'rect' || s === 'square' ? 'rect'
         : s === 'triangle' || s === 'diamond' ? s : 'circle';
  }

  /** SVG tag for the current shape. */
  private get tag(): string {
    const k = this.shapeKind;
    return k === 'circle' ? 'circle' : k === 'rect' ? 'rect' : 'path';
  }

  /** Position / size the element for its shape (r = half-size). */
  private setGeometry(el: SVGElement, r: number): void {
    const x = this.x, y = this.y;
    switch (this.shapeKind) {
      case 'rect':
        el.setAttribute('x', (x - r).toString()); el.setAttribute('y', (y - r).toString());
        el.setAttribute('width', (r * 2).toString()); el.setAttribute('height', (r * 2).toString());
        break;
      case 'triangle': {
        // Equilateral, pointing up (SVG y-down), centred on the point.
        const h = r * 1.15;
        el.setAttribute('d', `M${x} ${y - h} L${x + h * 0.866} ${y + h * 0.5} L${x - h * 0.866} ${y + h * 0.5}Z`);
        break;
      }
      case 'diamond':
        el.setAttribute('d', `M${x} ${y - r * 1.2} L${x + r} ${y} L${x} ${y + r * 1.2} L${x - r} ${y}Z`);
        break;
      default:
        el.setAttribute('cx', x.toString()); el.setAttribute('cy', y.toString());
        el.setAttribute('r', r.toString());
    }
  }

  /** Half-side length for squares / radius for circles, in SVG user units.
   *  Factor 0.006 keeps code-node diameters in the same visual range as rENA
   *  (≈ 1–2 % of the coordinate half-extent for a typical ENA network).
   */
  computeRadius(): number {
    const r = this.baseRadius();
    // Optional ceiling (user units): group means are capped to their CI box so
    // a tight interval is never hidden under the marker.
    const cap = (this.__data__ as any).meta?.maxRadius;
    return typeof cap === 'number' && cap > 0 ? Math.min(r, cap) : r;
  }

  private baseRadius(): number {
    const extent = (this.graph.__data__.extremes.x_max) || 1;
    const sizeScale = (this.__data__ as any).meta?.sizeScale ?? 1;
    // Fixed-on-screen mode (webENA size decoupling): keep a constant pixel size
    // regardless of data extent / container size / wheel-zoom, by converting a
    // target px into user units via the current px-per-unit and zoom. Otherwise
    // size scales with the coordinate space (default — nodes/edges do the same).
    if ((this.__data__ as any).meta?.fixedSize) {
      const rect = (this.graph.svg_element as SVGSVGElement)?.getBoundingClientRect?.();
      const zoom = (this.graph as any).zoom_level || 1;
      const pxPerUnit = rect && rect.width > 0 ? rect.width / (2 * extent) : 1;
      const targetPx = this.__data__.size * 2 * sizeScale;   // size 2.5 → 5px radius
      return (targetPx / pxPerUnit) / zoom;
    }
    return extent * POINT_RADIUS_PER_EXTENT * this.__data__.size * sizeScale;
  }

  /** Optional halo stroke (e.g. white outline on unit points to separate
   *  overlapping dots in dense clusters). Width scales with the dot so it holds
   *  up at any zoom. No-op unless the object requests it via meta.stroke. */
  private applyStroke(el: SVGElement): void {
    const stroke = (this.__data__ as any).meta?.stroke;
    if (!stroke) return;
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', (this.computeRadius() * 0.22).toString());
  }

  create() {
    const el = document.createElementNS('http://www.w3.org/2000/svg', this.tag) as SVGElement;

    el.setAttribute('data-point-id', this.__data__.ID);
    // Identity for <qe-graph> delegation → qe-node-* interaction events.
    const meta = (this.__data__ as any).meta ?? {};
    if (meta.kind)  el.setAttribute('data-kind', meta.kind);
    if (meta.name != null)  el.setAttribute('data-name',  String(meta.name));
    if (meta.group != null) el.setAttribute('data-group', String(meta.group));
    if (meta.unit != null)  el.setAttribute('data-unit',  String(meta.unit));
    el.setAttribute('fill', this.__data__.color.toString());
    this.applyStroke(el);

    this.setGeometry(el, this.computeRadius());

    this.svg_element = el;

    el.addEventListener('click', () => {
      // Note: do NOT stopPropagation — the click must bubble to <qe-graph>'s
      // delegation so it can emit the public qe-node-click event.
      this.__data__.active = !this.__data__.active;
      this.update();

      const pointEvent = new CustomEvent('point-clicked', {
        detail: { pointData: this.__data__ },
        bubbles: true, composed: true
      });
      this.svg_element.dispatchEvent(pointEvent);
    });

    el.addEventListener('mouseover', () => {
      // Do not stopPropagation — the parent SVG uses mouseover delegation
      // to show AUTO-mode labels.  The fill is already set; this handler is
      // retained as a hook for future hover-highlight logic.
    });

    return el;
  }

  update() {
    if (!this.svg_element) {
      (this.parent as any).__data__.__children__.push(this.create());
    }
    if (!this.svg_element.parentElement) {
      this.parent.appendChild(this.svg_element);
    }

    this.svg_element.setAttribute('fill', this.__data__.color.toString());
    this.applyStroke(this.svg_element);
    this.setGeometry(this.svg_element, this.computeRadius());
  }

  draw() {
    this.parent?.appendChild(this.svg_element);
  }
}
