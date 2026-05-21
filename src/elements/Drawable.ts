import { PlottedObject } from "../objects/PlottedObject";
import { ENAArray, } from "./ENALayer";
import { ENASvgElement } from "./ENASvg";

export abstract class Drawable {
  abstract create(): SVGElement;
  
  svg_element: SVGElement;

  constructor(
      public __data__: PlottedObject, 
      public parent: SVGElement, 
      public graph: ENASvgElement,
      public __children__: ENAArray = new ENAArray()
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
