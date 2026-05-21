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
    const meta = (this.__data__ as any).meta ?? {};

    if (meta.isSelfConnection) {
      // Self-connections are rendered as a small circular arc (SVG <path>)
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', this.__data__.color.toString());
      if (meta.isDirected) {
        const c = (this.__data__.color?.toString() ?? '').replace('#', '');
        path.setAttribute('marker-end', `url(#qe-arrow-${c})`);
      }
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
    if (meta.isDirected) {
      const c = (this.__data__.color?.toString() ?? '').replace('#', '');
      line.setAttribute('marker-end', `url(#qe-arrow-${c})`);
    }

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

      if (meta.isSelfConnection) {
        // Draw a small circle arc offset from the node (upper-left quadrant).
        // R is proportional to stroke width so larger weights yield larger loops.
        const R  = Math.max(sw * 2.5, (extent > 0 ? extent : 1) * 0.04);
        const x  = meta.selfX ?? this.__data__.from.x;
        const y  = meta.selfY ?? this.__data__.from.y;
        const R2 = R * 2;
        // Two back-to-back arcs draw a closed circle: tangent point at (x − 2R, y) → (x, y)
        const d = `M ${x - R},${y} a ${R},${R} 0 1,0 ${R2},0 a ${R},${R} 0 1,0 -${R2},0`;
        (this.svg_element as SVGPathElement).setAttribute('d', d);
        this.svg_element.setAttribute('stroke-width',   (sw * 0.6).toString());
        this.svg_element.setAttribute('stroke-opacity', opacity.toString());
        if (meta.isDirected) {
          const colorId = strokeColor.replace('#', '');
          this.svg_element.setAttribute('marker-end', `url(#qe-arrow-${colorId})`);
        }
      } else {
        // Regular directed or undirected edge
        (this.svg_element as SVGLineElement).setAttribute('x1', this.__data__.from.x.toString());
        (this.svg_element as SVGLineElement).setAttribute('y1', this.__data__.from.y.toString());
        (this.svg_element as SVGLineElement).setAttribute('x2', this.__data__.to.x.toString());
        (this.svg_element as SVGLineElement).setAttribute('y2', this.__data__.to.y.toString());
        this.svg_element.setAttribute('stroke-width',   sw.toString());
        this.svg_element.setAttribute('stroke-opacity', opacity.toString());
        if (meta.isDirected) {
          const colorId = strokeColor.replace('#', '');
          this.svg_element.setAttribute('marker-end', `url(#qe-arrow-${colorId})`);
        } else {
          this.svg_element.removeAttribute('marker-end');
        }
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
    }
    this.svg_element.setAttribute('stroke', strokeColor);
  }

  draw() {
    this.parent?.appendChild(this.svg_element);
  }
}