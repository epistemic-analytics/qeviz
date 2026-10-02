
class Extremes {
  x_max: number;
  y_max: number;
  // _point_max?: Point;
  // _node_max?: Point;

  /** Centre of the view; (0, 0) — the ENA origin — unless centred on the content */
  cx: number;
  cy: number;

  constructor(x: number, y: number, cx: number = 0, cy: number = 0) { //, n?: Point, p?: Point) {
    this.x_max = x;
    this.y_max = y;
    this.cx = cx;
    this.cy = cy;
    // this._point_max = p;
    // this._node_max = n;
  }
  as_viewBox(p: number = 1.2): string {
    let x = this.x_max * p;
    let y = this.y_max * p;
    return (`${this.cx - x} ${this.cy - y} ${x * 2} ${y * 2}`);
  }

  // get point_max(): Point {
  //   return this._point_max || { x: 1, y: 1 };
  // }
  // get node_max(): Point {
  //   return this._node_max || { x: 1, y: 1 };
  // }

  get height(): number {
    return this.y_max * 2;
  } 
  get width(): number {
    return this.x_max * 2;
  }
  get top(): number {
    return this.y_max * -1;
  }
  get bottom(): number {
    return this.y_max;
  }
  get left(): number {
    return this.x_max * -1;
  }
  get right(): number {
    return this.x_max;
  }
}

export { Extremes };