import { PlottedObject } from "../objects/PlottedObject";
import { QEArray, } from "./QELayer";
import { QEGraphElement } from "./QEGraph";

export abstract class Drawable {
  abstract create(): SVGElement;
  
  svg_element: SVGElement;

  constructor(
      public __data__: PlottedObject, 
      public parent: SVGElement, 
      public graph: QEGraphElement,
      public __children__: QEArray = new QEArray()
    ) {
      this.svg_element = this.create();
    }

  get_size() {
    return this.__data__.size;
  }

  draw() {
    this.parent?.appendChild(this.svg_element);
  }

  update(elem: SVGElement, animate = true) {
    // this.update(elem);
  }

  animateSVGAttribute(elem: SVGElement, attr: string, to: number) {
    const from = parseFloat(elem.getAttribute(attr) || '0');
    if (from === to) return;

    const duration = 5000;
    const start = performance.now();
    function animate(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const value = from + (to - from) * t;
      elem.setAttribute(attr, value.toString());
      if (t < 1) requestAnimationFrame(animate);
      else elem.setAttribute(attr, to.toString());
    }
    requestAnimationFrame(animate);
  }
}
