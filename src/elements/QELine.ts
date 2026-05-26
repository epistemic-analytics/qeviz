import { Line } from "../objects/PlottedObject";
import { NodeEdge, TaperedEdge } from "../objects/Edges";
import { Drawable } from "./Drawable";
import { QEArray, QEElement } from "./QELayer";
import { QEGraphElement } from "./QEGraph";

export class QELine extends Drawable implements QEElement {
  __name__: string = "unnamed-line";

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
      // Directed edges render as filled triangles via TaperedEdge.path —
      // the taper itself shows direction, so no arrow marker is needed.
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

    const extent      = (this.graph.__data__ as any).extremes?.x_max ?? 1;
    const meta        = (this.__data__ as any).meta ?? {};
    const strokeColor = this.__data__.color.toString();

    if (meta.isMeanEdge) {
      const weight  = typeof meta.weight    === 'number' ? meta.weight    : 0;
      const maxW    = typeof meta.maxWeight === 'number' ? meta.maxWeight : 1;
      const opacity = typeof meta.opacity   === 'number' ? meta.opacity   : Math.min(1, weight / (maxW || 1));
      const sw      = (extent > 0 ? extent : 1) * 0.04 * (weight / (maxW || 1));

      if (this.__data__ instanceof NodeEdge) {
        // Self-connection rendered via NodeEdge.path — a filled circle at the
        // node's position.  NodeEdge.weight (set by QEGraph to encode the dot
        // diameter relative to host node radius) is the authoritative size
        // here — don't overwrite it with the line-stroke scale `sw`.
        (this.svg_element as SVGPathElement).setAttribute('d', (this.__data__ as NodeEdge).path);
        this.svg_element.setAttribute('fill',         strokeColor);
        this.svg_element.setAttribute('fill-opacity', opacity.toString());
        this.svg_element.setAttribute('stroke',       'none');
      } else if (this.__data__ instanceof TaperedEdge) {
        // TaperedEdge.path uses .weight as the total base width.  Scale it up
        // (≈4·sw) so the wide end is visibly thicker than an undirected line
        // of the same weight — the rENA convention shows clearly tapered
        // triangles, not "lines that happen to be slightly wider at one end".
        (this.__data__ as TaperedEdge).weight = sw * 4;
        (this.svg_element as SVGPathElement).setAttribute('d', (this.__data__ as TaperedEdge).path);
        this.svg_element.setAttribute('fill',         strokeColor);
        this.svg_element.setAttribute('fill-opacity', opacity.toString());
        this.svg_element.setAttribute('stroke',       'none');
      } else {
        // Regular undirected edge
        (this.svg_element as SVGLineElement).setAttribute('x1', this.__data__.from.x.toString());
        (this.svg_element as SVGLineElement).setAttribute('y1', this.__data__.from.y.toString());
        (this.svg_element as SVGLineElement).setAttribute('x2', this.__data__.to.x.toString());
        (this.svg_element as SVGLineElement).setAttribute('y2', this.__data__.to.y.toString());
        this.svg_element.setAttribute('stroke-width',   sw.toString());
        this.svg_element.setAttribute('stroke-opacity', opacity.toString());
        this.svg_element.setAttribute('stroke',         strokeColor);
        this.svg_element.removeAttribute('marker-end');
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
      this.svg_element.setAttribute('stroke',         strokeColor);
    }
  }

  draw() {
    this.parent?.appendChild(this.svg_element);
  }
}