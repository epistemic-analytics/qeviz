import { Tools } from "../utils/Tools";
import { Graph } from "../objects/Graph";
import { Layer, LayerLike } from "../objects/Layers";
import { PlottedObject } from "../objects/PlottedObject";
import { QELine } from "./QELine";
import { QEPoint } from "./QEPoint";
import { QEGraphElement } from "./QEGraph";


const { ArrayTools } = Tools;
export class QEArray extends Array<any> {
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

export interface QEElement {
  svg_element: SVGElement;
  graph: QEGraphElement;
  parent: SVGElement | null;
  __name__: string;
  __data__: Graph | PlottedObject | LayerLike;
  __children__: QEArray;
  draw(): void;
  update(): void;
}

const
  QEElementConstructors: Record<string, new (d: any, p: SVGElement, g: QEGraphElement) => QEElement> =
    {
      "AxisPoint": QEPoint,
      "AxisLine": QELine,
      "Point": QEPoint,
      "Line": QELine,
      "Edge": QELine,
      "TaperedEdge": QELine,
      "NodeEdge": QELine,
    }
;

export class QELayer implements QEElement {
  static tagName = 'g';

  svg_element: SVGElement;  
  __name__: string;

  constructor(
    public __data__: Layer, 
    public parent: SVGElement, 
    public graph: QEGraphElement,
    public __children__: QEArray = new QEArray(),
  ) {
    this.__name__ = __data__.name || "unnamed-layer";

    __data__.__state__.addListener(`layer_updated`, "live", ({ key, newValue, oldValue } : any) => {
      const childId = (child: QEElement) => (child.__data__ as PlottedObject)?.ID;

      const removing = this.__children__.filter((child: QEElement) =>
        !newValue.objects.has(childId(child))
      );
      const updating = this.__children__.filter((child: QEElement) =>
        newValue.objects.has(childId(child))
      );
      const adding = [...newValue.objects.values()].filter((obj: PlottedObject) =>
        !this.__children__.some((child: QEElement) => childId(child) === obj.ID)
      );

      adding.forEach((obj: PlottedObject) => {
        const obj_name = obj.constructor.name;
        const ena_element: QEElement = new QEElementConstructors[obj_name](obj, this.svg_element, this.graph);
        this.__children__.push(ena_element);
      });

      updating.forEach((child: QEElement) => {
        // Pull the *new* PlottedObject from the updated layer data so that any
        // changed properties (e.g. weight, color, meta flags) are picked up by
        // the child's update() call.
        const newData = newValue.objects.get(childId(child)) as PlottedObject;
        if (newData) (child as any).__data__ = newData;
        child.update();
      });

      removing.forEach((child: QEElement) => {
        if (child.svg_element.parentElement) {
          child.svg_element.parentElement.removeChild(child.svg_element);
        }
        const idx = this.__children__.indexOf(child);
        if (idx >= 0) this.__children__.splice(idx, 1);
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
    this.svg_element = document.createElementNS("http://www.w3.org/2000/svg", QELayer.tagName);
    this.svg_element.setAttribute('data-layer-name', layer.name);
    this.svg_element.setAttribute('data-layer-id',   layer.ID);

    (this.svg_element as any).__data__ = layer;

    this.svg_element.classList.add('ena-layer');

    if(this.__data__.layers && this.__data__.layers.length > 0) {
      this.__data__.layers.forEach((sublayer: LayerLike) => {
        const layer_g: QELayer = new QELayer(sublayer as any, this.svg_element, this.graph);
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
      this.__children__.forEach((child: QEElement) => {
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

    this.__children__.forEach((child: QEElement) => {
      child.draw();
    });
  }

  add(child: QEElement) {
    this.__children__.push(child);
  }
}