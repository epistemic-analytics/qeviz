import { Tools } from "../utils/Tools";
import { Graph } from "../objects/Graph";
import { Layer, LayerLike } from "../objects/Layers";
import { PlottedObject } from "../objects/PlottedObject";
import { EnaGraphElement } from "./ENAgraph";
import { ENALine } from "./ENALine";
import { ENAPoint } from "./ENAPoint";
import { ENASvgElement } from "./ENASvg";


const { ArrayTools } = Tools;
export class ENAArray extends Array<LayerLike> {
  constructor(...args: any[]) {
    super(...args);
  }

  search(key: string, name: string): LayerLike | undefined {
    let found: LayerLike | undefined;

    function fn(a: LayerLike): LayerLike | undefined {
      return a.name === name ? a : undefined;
    }

    function recurse(obj: any, i?: number, parent: any = null): LayerLike | undefined {
      if (ArrayTools.isArray(obj)) {
        for (const [i, o] of obj.entries()) {
          found = recurse(o, i, parent);
          if (found) {
            return found;
          }
        }
      } else {
        found = fn(obj);
        if (!found) {
          if (obj && ArrayTools.isArray(obj[key])) {
            for (const [i, o] of obj[key].entries()) {
              found = recurse(o, i, obj);
              if (found) {
                return found;
              }
            }
          }
        } else {
          return found;
        }
      }
      return found;
    }

    return recurse(this);
  }

  flatten(): LayerLike[] {
    return this.reduce<LayerLike[]>((a, l: LayerLike) => {
      a.push(l);
      if (l.layers && Array.isArray(l.layers)) {
        a.push(...l.layers);
      }
      return a;
    }, []);
  }
}

export interface ENAElement {
  svg_element: SVGElement;
  graph: ENASvg;
  parent: SVGElement | null;
  __name__: string;
  __data__: Graph | PlottedObject | LayerLike;
  __children__: ENAArray;
  draw(): void;
  update(): void;
}

const
  ENAElementConstructors: 
    { 
      [key: string]: new (
        __data__: PlottedObject,
        parent: SVGElement, 
        graph: ENASvgElement
      ) => ENAElement 
    } =
    {
      "AxisPoint": ENAPoint,
      "AxisLine": ENALine,
      "Point": ENAPoint,
      "Line": ENALine,
      "Edge": ENALine
    }
;

export class ENALayer implements ENAElement {
  static tagName = 'g';

  svg_element: SVGElement;  
  __name__: string;

  constructor(
    public __data__: Layer, 
    public parent: SVGElement, 
    public graph: ENASvgElement,
    public __children__: ENAArray = new ENAArray(),
  ) {
    this.__name__ = __data__.name || "unnamed-layer";

    __data__.__state__.addListener(`layer_updated`, "live", ({ key, newValue, oldValue } : any) => {
      let 
        removing = this.__children__.filter((child: ENAElement) => {
          if(child.__data__ && newValue.objects.has(child.__data__.ID)) {
            return false;
          }
          else {
            return true;
          }
        }),
        updating = this.__children__.filter((child: ENAElement) => {
          if(child.__data__ && newValue.objects.has(child.__data__.ID)) {
            return true;
          }
          else {
            return false;
          }
        }),
        adding = [...newValue.objects.values()].filter( (obj: PlottedObject) => {
          if(this.__children__.some((child: ENAElement) => child.__data__ && child.__data__.ID === obj.ID)) {
            return false;
          }
          else {
            return true;
          }
        })
      ;
      
      adding.forEach( ( obj: PlottedObject) => {
        let 
          obj_name = obj.constructor.name,
          ena_element: ENAElement = new ENAElementConstructors[obj_name](obj, this.svg_element, this.graph)
        ;
        this.__children__.push(ena_element);
      });

      updating.forEach( ( obj: PlottedObject) => {
        let child = this.__children__.find((child: ENAElement) => child.__data__ && child.__data__.ID === obj.__data__.ID);
        if(child) {
          child.__data__ = obj.__data__;
          child.update();
        }
      });

      removing.forEach( ( child: ENAElement) => {
        if(child.svg_element.parentElement) {
          child.svg_element.parentElement.removeChild(child.svg_element);
        }
        this.__children__ = this.__children__.filter((c: ENAElement) => c !== child);
      });

      this.update();
    });

    this.svg_element = this.create();
  }

  get name() {
    return this.__name__;
  }

  create(): SVGElement {
    if(!this.__data__) {
      throw new Error("Layer is null");
    }
    let layer: Layer = this.__data__ as Layer;
    this.svg_element = document.createElementNS("http://www.w3.org/2000/svg", ENALayer.tagName);
    this.svg_element.setAttribute('data-layer-name', layer.name);
    this.svg_element.setAttribute('data-layer-id',   layer.ID);

    (this.svg_element as any).__data__ = layer;

    this.svg_element.classList.add('ena-layer');

    if(this.__data__.layers && this.__data__.layers.length > 0) {
      this.__data__.layers.forEach((sublayer: LayerLike) => {
        let 
          layer_g: ENALayer = new ENALayer(sublayer, this.svg_element, this.graph)
        ;
        this.__children__.push(layer_g);
      });
    }

    return this.svg_element;
  }

  update() {
    if(!this.__data__) {
      throw new Error("Layer is null");
    }

    if(this.__data__.visible) {
      // Update layer properties here
      if(this.parent.nodeName.toLowerCase() === "svg") {
        // Compute the transform string based on the size of the parent SVG elemet.  
        // -- a circle with radius 1 should be scaled to the size of the parent SVG element, 
        //    so that as the graph is zoomed in and out, the circle scales with it.
        // this.svg_element.style.transform = `scale(${this.parent.clientWidth / 100}, ${this.parent.clientHeight / 100})`;
      }

      // Update sublayers
      this.__children__.forEach((child: ENAElement) => {
        child.update();
      });

      if(this.__data__.scale_objects === true) {
        if(this.__name__ === "points") {
          // this.svg_element.setAttribute('transform', `
          //   scale(${this.graph.__data__.scale_x}, ${this.graph.__data__.scale_y})
          // `);
        }
      }
      else {
        // this.svg_element.setAttribute('transform', `scale(${this.graph.x_mirror()}, ${this.graph.y_mirror()})`);  
      }
    }
  }

  draw(): void {
    this.parent?.appendChild(this.svg_element);

    this.__children__.forEach((child: ENAElement) => {
      child.draw();
    });
  }

  add(child: ENAElement) {
    this.__children__.push(child);
  }
}