import { Tools } from "../utils/Tools";
import { Point, ConfidenceInterval, PlottedObjectOptions, DimensionVector, DimensionType } from "./PlottedObject";

export class Mean extends Point {
  private _points: Map<string, Point> = new Map();
  private _confidence: ConfidenceInterval;

  constructor(dimensions: DimensionVector, o: any) {
    super({ ...o, dimensions });
    this.visible = true;
    o.points.forEach((p: Point) => {
      this._points.set(p.ID, p);
    });

    // this.meta = o.meta || { ID: this.ID };
    this.size = o.size; //?? (typeof graph === "number" ? 0 : graph.options.POINT.size);
    this._confidence = new ConfidenceInterval(this);
  }

  set size(s: number) {
    this._size = s;
    // let effect = zoom_level; // Not used
  }
  get size(): number {
    return this._size;
  }
  get confidence(): ConfidenceInterval {
    return this._confidence;
  }
  get points(): Map<string, Point> {
    return this._points;
  }

  get x(): number {
    return Tools.Mathematics.mean([...this._points.values()].map(p => p.x));
  }
  get y(): number {
    return Tools.Mathematics.mean([...this._points.values()].map(p => p.y));
  }
  set x(x_: number) { this._x = x_; }
  set y(y_: number) { this._y = y_; }

  get transform() {
    return this._transform;
  }
}

export class Node extends Point {
  edges: Map<any, any> = new Map();

  get size(): number {
    return 2;
    // if (this.edges && this.edges.size) {
    //   let s = [...this.edges.values()].reduce((v, e) => {
    //     return v + ((Math.abs(e.weight) * 1 || 0) * e.visible);
    //   }, 0);
    //   return s * this.scale_size;
    // } else {
    //   return this._size;
    // }
  }
  set size(s: number) {
    this._size = s;
  }

  constructor(dimensions: DimensionType, o: PlottedObjectOptions) { // graph?: any) {
    super({ ...o, dimensions });

    this.active = false;
    this.visible = false;
    this.color = o.color;
    this.scale_size = 0.1;
  }
}
