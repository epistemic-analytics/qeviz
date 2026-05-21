import { DimensionVector, PlottedObject } from "./PlottedObject";

export class AxisPoint extends PlottedObject {

  constructor(dimensions: DimensionVector, o: any) {
    super(dimensions, o);

    this.visible = true;

    this.size = o.size;
  }

  set size(s: number) {
    this._size = s;
  }
  get size(): number {
    return this._size;
  }

  get x(): number {
    return this._x;
  }
  get y(): number {
    return this._y;
  }
  set x(x_: number) { this._x = x_; }
  set y(y_: number) { this._y = y_; }

  get transform() {
    return this._transform;
  }
}