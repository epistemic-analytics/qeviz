import { Line } from "../objects/PlottedObject";
import { Drawable } from "./Drawable";
import { EnaGraphElement } from "./QEGraphLegacy";
import { QEArray, QEElement } from "./QELayer";

export class QELine extends Drawable implements QEElement {
  __name__: string = "unnamed-line";

  constructor(
    public __data__: Line, 
    public parent: SVGElement, 
    public graph: EnaGraphElement,
    public __children__: QEArray = new QEArray(),
  ) {
    super(__data__, parent, graph, __children__);

    this.svg_element = this.create();
  }

  create() {
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
    if(!this.svg_element) {
      (this.parent as any).__data__.__children__.push(this.create());
    }
    if(!this.svg_element.parentElement) {
      this.parent.appendChild(this.svg_element);
    }

    this.svg_element.setAttribute('x1',   this.__data__.from.x.toString());
    this.svg_element.setAttribute('y1',   this.__data__.from.y.toString());
    this.svg_element.setAttribute('x2',   this.__data__.to.x.toString());
    this.svg_element.setAttribute('y2',   this.__data__.to.y.toString());

    const extent = (this.graph.__data__ as any).extremes?.x_max ?? 1;
    const meta   = (this.__data__ as any).meta ?? {};

    if (meta.isMeanEdge) {
      // Weight-proportional stroke for mean network edges
      const weight  = typeof meta.weight  === 'number' ? meta.weight  : 0;
      const maxW    = typeof meta.maxWeight === 'number' ? meta.maxWeight : 1;
      const opacity = typeof meta.opacity === 'number' ? meta.opacity : Math.min(1, weight / (maxW || 1));
      const sw = (extent > 0 ? extent : 1) * 0.04 * (weight / (maxW || 1));
      this.svg_element.setAttribute('stroke-width',   sw.toString());
      this.svg_element.setAttribute('stroke-opacity', opacity.toString());
    } else {
      // Thin axis lines: ~0.4% of coordinate extent
      const sw = (extent > 0 ? extent : 1) * 0.004 * this.get_size();
      this.svg_element.setAttribute('stroke-width',   sw.toString());
      this.svg_element.setAttribute('stroke-opacity', '1');
    }
    this.svg_element.setAttribute('stroke', this.__data__.color.toString());
  }

  draw() {
    this.parent?.appendChild(this.svg_element);
  }
}