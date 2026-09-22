import { PlottedObject } from "../objects/PlottedObject";
import { Drawable } from "./Drawable";
import { QEArray, QEElement } from "./QELayer";
import { QEGraphElement } from "./QEGraph";

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

  /** Half-side length for squares / radius for circles, in SVG user units.
   *  Factor 0.006 keeps code-node diameters in the same visual range as rENA
   *  (≈ 1–2 % of the coordinate half-extent for a typical ENA network).
   */
  computeRadius(): number {
    const extent = this.graph.__data__.extremes.x_max;
    return (extent > 0 ? extent : 1) * 0.006 * this.__data__.size;
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
    const tag = this.isSquare ? 'rect' : 'circle';
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag) as SVGElement;

    el.setAttribute('data-point-id', this.__data__.ID);
    // Identity for <qe-graph> delegation → qe-node-* interaction events.
    const meta = (this.__data__ as any).meta ?? {};
    if (meta.kind)  el.setAttribute('data-kind', meta.kind);
    if (meta.name != null)  el.setAttribute('data-name',  String(meta.name));
    if (meta.group != null) el.setAttribute('data-group', String(meta.group));
    if (meta.unit != null)  el.setAttribute('data-unit',  String(meta.unit));
    el.setAttribute('fill', this.__data__.color.toString());
    this.applyStroke(el);

    const r = this.computeRadius();
    if (this.isSquare) {
      el.setAttribute('x',      (this.x - r).toString());
      el.setAttribute('y',      (this.y - r).toString());
      el.setAttribute('width',  (r * 2).toString());
      el.setAttribute('height', (r * 2).toString());
    } else {
      el.setAttribute('cx', this.x.toString());
      el.setAttribute('cy', this.y.toString());
      el.setAttribute('r',  r.toString());
    }

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

    const r = this.computeRadius();
    this.svg_element.setAttribute('fill', this.__data__.color.toString());
    this.applyStroke(this.svg_element);

    if (this.isSquare) {
      this.svg_element.setAttribute('x',      (this.x - r).toString());
      this.svg_element.setAttribute('y',      (this.y - r).toString());
      this.svg_element.setAttribute('width',  (r * 2).toString());
      this.svg_element.setAttribute('height', (r * 2).toString());
    } else {
      this.svg_element.setAttribute('cx', this.x.toString());
      this.svg_element.setAttribute('cy', this.y.toString());
      this.svg_element.setAttribute('r',  r.toString());
    }
  }

  draw() {
    this.parent?.appendChild(this.svg_element);
  }
}
