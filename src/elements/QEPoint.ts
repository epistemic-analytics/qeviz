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
    const r = this.dataRadius();
    // <qe-nodes fixed-size>: keep the zoom-1 on-screen size. The zoom group
    // scales everything by the zoom level, so divide by it.
    return (this.__data__ as any).meta?.zoomFixed ? r / ((this.graph as any).zoom_level || 1) : r;
  }

  private dataRadius(): number {
    const extent = (this.graph.__data__.extremes.x_max) || 1;
    const sizeScale = (this.__data__ as any).meta?.sizeScale ?? 1;
    // Host-set diameter in CSS px at zoom 1 (the nodes frame's `size`
    // column), converted at the current width like label-font-size; it then
    // zooms with the plot, as the computed size does.
    const sizePx = (this.__data__ as any).meta?.sizePx;
    if (typeof sizePx === 'number' && sizePx > 0) {
      const rect = (this.graph.svg_element as SVGSVGElement)?.getBoundingClientRect?.();
      const unitsPerPx = rect && rect.width > 0 ? (2 * extent) / rect.width : extent * 0.004;
      return (sizePx / 2) * unitsPerPx;
    }
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

  /** Identity for <qe-graph> delegation → qe-node-* interaction events.
   *  Re-applied on update(), since the element outlives renders. */
  private stampIdentity(el: SVGElement): void {
    el.setAttribute('data-point-id', this.__data__.ID);
    const meta = (this.__data__ as any).meta ?? {};
    const opt = (name: string, v: any) => v != null && v !== '' ? el.setAttribute(name, String(v)) : el.removeAttribute(name);
    opt('data-kind',  meta.kind);
    opt('data-name',  meta.name);
    opt('data-group', meta.group);
    opt('data-unit',  meta.unit);
  }

  create() {
    const el = document.createElementNS('http://www.w3.org/2000/svg', this.tag) as SVGElement;

    this.stampIdentity(el);
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
    // The layer rebinds __data__ on every render. A shape change that needs
    // another element (circle ↔ rect ↔ path) would otherwise leave the old
    // element at its old position: rebuild it in place.
    if (this.svg_element.tagName.toLowerCase() !== this.tag) {
      const old = this.svg_element;
      this.create();
      if (old.parentElement) old.replaceWith(this.svg_element);
    }
    if (!this.svg_element.parentElement) {
      this.parent.appendChild(this.svg_element);
    }

    this.stampIdentity(this.svg_element);
    this.svg_element.setAttribute('fill', this.__data__.color.toString());
    this.applyStroke(this.svg_element);
    this.setGeometry(this.svg_element, this.computeRadius());
  }

  draw() {
    this.parent?.appendChild(this.svg_element);
  }
}
