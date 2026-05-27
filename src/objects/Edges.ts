import { PlottedObject, Line, PlottedObjectOptions } from './PlottedObject.js';
import { Node } from './Points.js';
import { Color, WeightedColor } from './Color.js';
import { Tools } from '../utils/Tools.js';
import { DataFrameRow } from '../types/DataFrame.js';

// Placeholder for zoom level, should be defined in the context of the application
const zoom_level = 1;

export class Edge extends Line {
  declare from: Node;
  declare to: Node;
  _totalweight: number = 0;
  _weight: number;
  declare _color: WeightedColor;

  constructor(data: DataFrameRow | any, from: Node, to: Node, weight: number = 0) {
    super(data, from, to);
    this._weight = weight;
  }

  get base_color(): Color { return this._color };
  get color(): WeightedColor {
    const base = this._color || new Color("#000000");
    return new WeightedColor(base, Math.abs(this.weight));
  }
  set color(c: Color) { this._color = c as any; }

  base_weight() { return this._weight };
  get weight() {
    // let w = Array.isArray(this.#weight) ? this.#weight.reduce( (a, b) => a - b, 0) : this.#weight;
    let w = Array.isArray(this._weight) ? (this._weight[0] - this._weight[1]) : this._weight;
    return w; // * this.graph.options.EDGE.multiplier
  }
  set weight(w) {
    this._weight = w;
  }

  get totalweight(): number {
    return this.weight;
  }
  set totalweight(w: number) {
    this._totalweight = w;
  }
}

export class SubtractedEdges extends Edge {
  edge_one: Edge;
  edge_two: Edge;

  #weight: number;
  #color: WeightedColor;

  constructor(e1: Edge, e2: Edge) {
    super(e1, e1.from, e1.to);

    this.edge_one = e1;
    this.edge_two = e2;

    this.#weight = this.edge_one.weight - this.edge_two.weight;

    let
      color_type_fn: new (color: Color | string, weight: number) => WeightedColor = this.edge_one.color.constructor as any,
      color: string = this.edge_one.color.base
      ;
    if (this.weight > 0) {
      color = this.edge_one.color.base;
    }
    else {
      color = this.edge_two.color.base;
    }

    this.#color = new color_type_fn(color, this.#weight);
  }

  get weight() {
    return this.#weight;
  }
  set weight(w) {
    this.#weight = w;
  }

  get color() {
    return this.#color;
  }
  set color(c) {
    this.#color = c;
  }
}

export class MeanEdge extends Edge {
  edges: Set<Edge> = new Set<Edge>();

  constructor(o: any) {
    super(o, o.from, o.to);

    this.visible = true;
    // this.meta = o.meta || { ID: this.ID };
  }

  // get weight() { return __.math.mean([...this.edges.values()].map( e => e.weight )) * this.graph.options.EDGE.multiplier; }
  get weight() {
    let wt = Tools.Mathematics.mean([...this.edges.values()].map((e: Edge) => e.weight)) * 1;
    return wt;
  }
  set weight(w) { this._weight = w; }

  get path() {
    return `M${this.from.x} ${this.from.y} L${this.to.x} ${this.to.y}z`;
  }

  get totalweight() {
    return Array.from(this.edges).reduce((acc, edge) => acc + edge.totalweight, 0);
  }
}

export class EdgeArrow extends PlottedObject {
  #edge;

  constructor(edge: PlottedObjectOptions) {
    super(edge.dimensions || [], edge);
    this.#edge = edge;
  }

  get edge() {
    return this.#edge;
  }

  get path(): string {
    /**
     *
     *                        mid_int0    nock_int0
     *                  --------------*-----*-------------- <- edge of arrow from midpoint to base_pt0
     *                               /     /
     *                              /     /
     *                             /     /
     *                            /     /
     *                           /     /
     *                          /     /
     * <-- edge node   head--> *     *     * <-- nock         ---> edge midpoint this way ---->
     *                          \    ^-mid |
     *                           \   | \   |
     *                            \  |  \  | <---- showing line from nock to edge used to find
     *                             \ |   \ |       intersection with edge
     *                              \|    \|
     *                 --------------*-----*-------------- <- edge of arrow from midpoint to base_pt1
     *                    mid_int1---^     ^----nock_int1
     *
     */
    let _this = this.#edge;
    let
      _mid = _this.from_point, //(_this.weighted_midpoint || _this.midpoint),
      // head = __.geom.line.point_along([_mid, [_this.to.x, _this.to.y]], 0.5),
      // nock = __.geom.line.point_along([_mid, [_this.to.x, _this.to.y]], 0.4),
      head = Tools.Geometry.Line.point_along([[_this.to.x, _this.to.y], _mid], 0.7),
      nock = Tools.Geometry.Line.point_along([[_this.to.x, _this.to.y], _mid], 0.85),
      mid = Tools.Geometry.Line.midpoint(head, nock),
      rot_mid = Tools.Geometry.Line.rotate(_this.line, mid),
      rot_nock = Tools.Geometry.Line.rotate(_this.line, nock),
      mid_int0 = Tools.Geometry.Line.intersection([_mid, _this.base_pts[0]], rot_mid),
      mid_int1 = Tools.Geometry.Line.intersection([_mid, _this.base_pts[1]], rot_mid),
      nock_int0 = Tools.Geometry.Line.intersection([_mid, _this.base_pts[0]], rot_nock),
      nock_int1 = Tools.Geometry.Line.intersection([_mid, _this.base_pts[1]], rot_nock)
      ;
    let p = `M${head.join(' ')} ${mid_int0.join(' ')} ${nock_int0.join(' ')}  ${mid.join(' ')} ${nock_int1.join(' ')}  ${mid_int1.join(' ')}z`
    return p;
  }
}

export enum EdgeDirection {
  FROM = 'from',
  TO = 'to'
}

export class TaperedEdge extends Edge {
  // base_pts = [];
  _path: string = '';
  // Arrowheads are off by default — the tapered triangle shape already
  // communicates direction.  Enabling #with_arrow currently throws because
  // EdgeArrow.constructor passes the edge as the lone super() arg.
  #with_arrow = false;
  #arrow;

  _directions: EdgeDirection[] = [EdgeDirection.FROM, EdgeDirection.TO];
  towards: EdgeDirection = EdgeDirection.TO;

  constructor(data: any, from: Node, to: Node) {
    super(data, from, to);

    if (this.#with_arrow === true) {
      this.#arrow = new EdgeArrow(this);
    }
  }

  get path(): string {
    return `M${this.from.x} ${this.from.y} L${this.base_pts[0].join(' ')} L${this.base_pts[1].join(' ')}z`;
  }
  static calculate_base_points(edg: TaperedEdge): [[number, number], [number, number]] {
    // Find the two endpoints of the tapered edge based on its `towards` direction.
    const top: EdgeDirection = edg.towards;
    const base: EdgeDirection = edg._directions.find(d => d !== edg.towards) as EdgeDirection;

    const bx = edg[base].x, by = edg[base].y;
    const tx = edg[top].x,  ty = edg[top].y;
    const dx = tx - bx, dy = ty - by;
    const L  = Math.hypot(dx, dy);

    // Degenerate: zero-length edge or unset weight — collapse to a point at `top`.
    const wt = (edg.weight ?? 0) * zoom_level;
    if (L === 0 || !isFinite(wt) || wt === 0) {
      return [[tx, ty], [tx, ty]];
    }

    // Unit perpendicular to the edge direction; offset both sides by wt/2.
    // Pure vector math here avoids the slope-intercept form used by
    // Tools.Geometry, which produces NaN for vertical edges and ill-conditioned
    // values for horizontal ones.
    const px = -dy / L, py = dx / L;
    const halfW = wt / 2;
    return [
      [tx + px * halfW, ty + py * halfW],
      [tx - px * halfW, ty - py * halfW],
    ];
  }
  get base_pts() {
    return TaperedEdge.calculate_base_points(this);
  }
  get arrow() {
    return this.#arrow;
  }
  get with_arrow() {
    return this.#with_arrow;
  }
  get from_point() {
    return [this.from.x, this.from.y];
  }
}

export class TaperedMidpointEdge extends TaperedEdge {
  constructor(data: any, from: Node, to: Node) {
    super(data, from, to);
  }

  get path(): string {
    return `M${this.midpoint[0]} ${this.midpoint[1]} L${this.base_pts[0].join(' ')} L${this.base_pts[1].join(' ')}z`;
  }
  get from_point(): [number, number] {
    return this.midpoint;
  }
}

export class TaperedWeightedMidpointEdge extends TaperedEdge {
  // Preserve the original data weight so that QELine.update()'s
  // `edge.weight = sw * 4` (which sets _weight for display sizing) doesn't
  // corrupt the midpoint calculation.
  private _dataWeight: number = 0;

  constructor(data: any, from: Node, to: Node) {
    super(data, from, to);
    this._totalweight = data.totalweight ?? 0;
    this._dataWeight  = data.weight ?? this._weight;
  }

  get weighted_midpoint(): [number, number] {
    return Tools.Geometry.Line.interpolate(this.line)(1 - (this._dataWeight / this._totalweight));
  }

  get base_pts(): [[number, number], [number, number]] {
    return TaperedEdge.calculate_base_points(this);
  }

  static build_path(edg: TaperedWeightedMidpointEdge | MeanTaperedWeightedMidpointEdge): string {
    if (edg._totalweight > 0) {
      let p = `M${edg.weighted_midpoint[0]} ${edg.weighted_midpoint[1]} L${edg.base_pts[0].join(' ')} L${edg.base_pts[1].join(' ')}z`;

      return p
    }
    else {
      console.error("TaperedWeightedMidpointEdge: No totalweight, returning empty path");
      return '';
    }
  }
  get path(): string {
    return TaperedWeightedMidpointEdge.build_path(this);
  }

  get from_point() {
    return this.weighted_midpoint;
  }
}

export class MeanNodeEdge extends MeanEdge {
  constructor(o: any) {
    super(o);
  }
  get path() {
    return NodeEdge.build_path(this.weight, [...this.edges.values()][0].to)
  }
  get weight() {
    return Tools.Mathematics.mean([...this.edges.values()].map(e => e.weight)) * 1;
  }
  set weight(w) { this._weight = w; }
}

export class MeanTaperedEdge extends MeanEdge {
  #with_arrow = true;
  #arrow;

  constructor(o: PlottedObjectOptions) {
    super(o);

    if (this.#with_arrow === true) {
      this.#arrow = new EdgeArrow(this);
    }
  }

  get with_arrow() {
    return this.#with_arrow;
  }
  get arrow() {
    return this.#arrow;
  }
  get from_point() {
    return [this.from.x, this.from.y];
  }
}

export class MeanTaperedMidpointEdge extends MeanTaperedEdge {
  constructor(o: PlottedObjectOptions) {
    super(o);
  }

  get base_pts(): [[number, number], [number, number]] {
    const
      top = EdgeDirection.TO,
      base = EdgeDirection.FROM
      ;

    let
      edge_line: [[number, number], [number, number]] = [[this[base].x, this[base].y], [this[top].x, this[top].y]],
      perp_line = Tools.Geometry.Line.rotate2(edge_line, edge_line[1], 90),
      ints = Tools.Geometry.Line.intersect_circle(perp_line, edge_line[1], this.weight / 2)
      ;

    return ints;
  }
  get path(): string {
    return `M${this.midpoint[0]} ${this.midpoint[1]} L${this.base_pts[0].join(' ')} L${this.base_pts[1].join(' ')}z`;
  }
  get weight(): number {
    return Tools.Mathematics.mean([...this.edges.values()].map(e => e.weight)) * 1;
  }
  set weight(w) { this._weight = w; }
}

export class MeanTaperedWeightedMidpointEdge extends MeanTaperedEdge {
  constructor(o: PlottedObjectOptions) {
    super(o);
  }

  get totalweight(): number {
    // debugger;
    // console.error("THIS NEEDS THE MEAN WEIGHT OF ITS COUNTERPART (FROM -> TO -- TO --> FROM)")
    // or does the mean of the edges.totalweight equal to the same?
    return Tools.Mathematics.mean([...this.edges.values()].map(e => e.totalweight));
  }

  get weighted_midpoint() {
    // console.log("Weighted: ", this.weight, this.totalweight)
    return Tools.Geometry.Line.interpolate(this.line)(1 - (this.weight / this.totalweight))
  }

  get base_pts() {
    const
      top = EdgeDirection.TO,   //this.#directions[this.#directions.findIndex( d => d === this.towards )],
      base = EdgeDirection.FROM //this.#directions[this.#directions.findIndex( d => d !== this.towards )]
      ;

    let
      edge_line: [[number, number], [number, number]] = [[this[base].x, this[base].y], [this[top].x, this[top].y]],
      perp_line = Tools.Geometry.Line.rotate2(edge_line, edge_line[1], 90),
      ints = Tools.Geometry.Line.intersect_circle(perp_line, edge_line[1], this.weight / 2)
      ;

    return ints;
  }

  get path() {
    let p = TaperedWeightedMidpointEdge.build_path(this)
    // console.log("Static p: ", p);
    return p;
  }
  get weight() {
    return Tools.Mathematics.mean([...this.edges.values()].map(e => e.weight)) * 1;
  }
  set weight(w) { this._weight = w; }
}

export class NodeEdge extends Edge {

  constructor(data: any, from: Node, to: Node) {
    super(data, from, to);
  }

  static build_path(weight: number, to: Node) {
    let
      R = weight / 2,
      CX = to.x - R,
      R2 = R * 2,
      p = `M ${CX}, ${to.y} a ${R},${R} 0 1,0 ${R2},0 a ${R},${R} 0 1,0 -${R2},0`
      ;

    return p;
  }

  get path() {
    let wt = this.weight * zoom_level; //this.graph.get_graphs()[0].object.SIZE_EFFECT;
    return NodeEdge.build_path(wt, this.to);
  }
}
