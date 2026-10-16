import { Transform } from "./Transform.js";
import { Tools } from "../utils/Tools.js";
const { ArrayTools } = Tools;
import { Graph } from "./Graph.js";
import { PlottedObject } from "./PlottedObject.js";
import { EventBus as StateManager } from "../types/EventBus.js";
import { dbg } from "../utils/debug.js";

export type LayerLike = {
  name?: string;
  layers?: LayerArray;
  [key: string]: any;
};

export class LayerArray extends Array<LayerLike> {
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
  
  recurse(
    key: string,
    callback: (layer: LayerLike, parent?: LayerLike | null, depth?: number) => any, 
    parent: LayerLike | null = null, 
    depth: number = 0
  ): any {
    let results: any[] = new LayerArray();
    for (const layer of this) {
      let result = callback(layer, parent, depth);
      
      if (layer[key] && Array.isArray(layer[key])) {
        let r = new LayerArray(...layer[key]).recurse(key, callback, layer, depth + 1);
        if (r !== undefined) {
          results.push(...r);
        }
      }

      results.push(result);
    }
    dbg("Recurse results: ", results);
    return results;
  }
}

export class Layer {
  __state__: StateManager = new StateManager();

  name: string;
  ID: string;
  scale_x: number = 1;
  scale_y: number = 1;
  tabindex?: number;
  _transform: Transform;
  scale_objects: boolean = true;
  layers: LayerArray = new LayerArray();
  objects: Map<string, PlottedObject> = new Map();
  parent?: Layer | Graph;
  visible: boolean = true;

  constructor(ID: string, o: any, parent?: Graph | Layer) {
    this.ID = ID;
    this.name = o.name || `layer-${ID}`;
    this.tabindex = o.tabindex;
    this.parent = parent;
    this._transform = new Transform();

    parent?.__state__.addListener("graph_updated", "live", ({ key, newValue, oldValue }) => {
      // console.log(`Graph updated, updating layer: ${this.name}`);
    });
    
    parent?.__state__.addListener(`graph_updated_${this.name}`, "live", ({ key, newValue, oldValue }) => {
      // console.log(`Graph updated, updating layer: ${this.name}, Key: ${key}`, "New Value: ", newValue, "Old Value: ", oldValue);
      this.objects = newValue;
      this.__state__.setVariable(`layer_updated`, this );
    });
  }

  get transform(): Transform {
    return this._transform;
  }
  set transform(t: Transform) {
    this._transform = t;
  }
}