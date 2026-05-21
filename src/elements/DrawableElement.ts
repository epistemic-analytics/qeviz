import { Graph } from "../objects/Graph";
import { Layer } from "../objects/Layers";
import { PlottedObject } from "../objects/PlottedObject";

export abstract class DrawableElement extends HTMLElement {
  
  static style: string = `
    :host {
      max-width: 100%;
      display: block;
    }
    .wrapper {
      height: 100%;
      display: flex;
      justify-content: center;
    }
  `;

  element: Element | null = null;
  object: PlottedObject | Graph | Layer | null = null;

  get wrapper() {
    const
      element = this,
      shadow = element.shadowRoot,
      wrapper = shadow?.querySelector(".wrapper")
    ;
    return wrapper;
  }

  constructor() {
    super();

    const
      element = this,
      shadow = element.attachShadow({ mode: 'open' }),
      style = document.createElement('style'),
      wrapper = document.createElement('div')
    ;

    style.textContent = (this.constructor as any).style;
    shadow.appendChild(style);

    wrapper.setAttribute('class', 'wrapper');
    shadow.appendChild(wrapper);
  }
}