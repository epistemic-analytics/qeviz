import { Transform } from './Transform';
import { Color } from './Color';
import { Edge } from './Edges';
import { DataFrameRow } from '../types/DataFrame';

export type DimensionType = DimensionVector | DataFrameRow | number[];

export interface DimensionVectorInterface extends Array<number> {

  [index: number]: number;
  flipped: boolean;
  flip(): DimensionVector;
  get names(): string[];
  get(wh: string | number): number | undefined;
}
export class DimensionVector extends Array<number> implements DimensionVectorInterface {
  #flipped: boolean = false;
  #names: string[] | undefined;

  constructor(...args: number[]) {
    super(arguments.length);
    for (let i = 0; i < args.length; i++) {
      this[i] = args[i];
    }
    this.#flipped = false;
  }

  static fromArray(arr: DataFrameRow): DimensionVector {
    const vec = new DimensionVector();
    arr.forEach((v, i) => {
      vec.push(v);
    });
    vec.#names = arr.names;

    return vec;
  }

  flip(): DimensionVector {
    this.#flipped = !this.#flipped;
    for (let i = 0; i < this.length; i++) {
      this[i] = -this[i];
    }
    return this;
  }

  get(wh: string | number): number | undefined {
    if (typeof wh === 'number') {
      return this[wh];
    } else if (this.#names && this.#names.includes(wh)) {
      return this[this.#names.indexOf(wh)];
    } else {
      return undefined;
    }
  }

  get flipped(): boolean {
    return this.#flipped;
  }

  get names(): string[] {
    if (this.#names) {
      return this.#names;
    } else {
      return this.map((_, i) => `V${i + 1}`);
    }
  }
}

export interface PlottedObjectOptions {
  ID: string;
  dimensions?: DimensionVector;
  x?: number | number[];
  y?: number | number[];
  size: number | 0;
  color: Color;
  highlight: Color | null;
  shape?: any;
  active: boolean;
  meta: any;

  [key: string]: any;
}

export class PlottedObject implements PlottedObjectOptions {
  private readonly _original: PlottedObjectOptions;
  private readonly _dimensions: DimensionVector;

  ID: string;
  scale_x: number = 1;
  scale_y: number = 1;
  scale_size: number = 0.05;
  active: boolean = false;
  visible: boolean = false;
  highlighting: boolean = false;
  meta: any = {};
  
  _transform: Transform;
  _x: any = 0;
  _y: any = 0;
  _color: Color;
  _highlight: Color;
  _highlight_default: Color = new Color('#000000');
  _size: number = 0;

  shape?: any;

  // graph: Graph;
  parent: any;

  get dimensions(): DimensionVector {
    return this._dimensions;
  }

  get color(): Color {
    return (
      // This was expecting hightight to be an object with a color property
      // but now it is just a Color object, so we can simplify this.
      (this.highlighting && this._highlight) ? this._highlight : this._color
    );
  }
  set color(c: Color) {
    this._color = c;
  }
  get highlight(): Color {
    return this._highlight || this._highlight_default;
  }
  set highlight(h: Color) {
    this._highlight = h;
  }

  get size(): number {
    return this._size;
  }
  set size(s: number) {
    this._size = s;
  }

  get original(): PlottedObjectOptions {
    return this._original;
  }

  get x() {
    return this._x; // * this.graph.x_mirror();
  }
  get y() {
    return this._y; // * this.graph.y_mirror();
  }
  set x(x_: any) { this._x = x_; }
  set y(y_: any) { this._y = y_; }
  dimension(wh: string | number): number | undefined {
    return this._dimensions.get(wh);
  }

  get transform() { return this._transform; }
  set transform(t: any) { this._transform = t; }

  constructor(dimensions: DimensionType, o: PlottedObjectOptions) {
    this.ID = o.ID;
    // this.graph = graph;
    this._transform = new Transform();

    // If dimensions is already a DimensionVector, use it directly
    if (dimensions instanceof DimensionVector) {
      this._dimensions = dimensions;
    }
    else if (dimensions instanceof DataFrameRow) {
      // If dimensions is a DataFrameRow, convert it to a DimensionVector
      this._dimensions = DimensionVector.fromArray(dimensions);
    }

    // If dimensions is an array, convert it to a DimensionVector
    else if (Array.isArray(dimensions)) {
      this._dimensions = new DimensionVector(...dimensions);
    }

    // Else is a warning and fallback to a default DimensionVector
    else {
      console.warn("Invalid dimensions provided, using default DimensionVector(0, 0)");
      this._dimensions = new DimensionVector(0, 0);
    }

    // make a copy of the object to avoid mutating the original
    let data: PlottedObjectOptions = { ...o };

    // keep the original data for reference
    this._original = { ...data };

    this.ID = data.ID;
    this.x = data.x || this._dimensions[0];
    this.y = data.y || this._dimensions[1];
    this._size = data.size || 1;
    this._color = data.color || new Color('#000000');
    this.active = data.active || false;
    this.shape = data.shape || null;
    this.meta = data.meta || {};

    this._highlight = this._highlight_default;
    if (data.highlight) {
      this._highlight = data.highlight;
    }
    // else if (graph && graph.options && graph.options[this.constructor.name.toUpperCase()]) {
    //   this._highlight = graph.options[this.constructor.name.toUpperCase()].highlight;
    // }
  }
}

export interface LineOptions extends PlottedObjectOptions {
  x1: number | string;
  y1: number | string;
  x2: number | string;
  y2: number | string;
  width?: number;
  color: Color;
  shape: string | null;
  [key: string]: any;
}

export class Line extends PlottedObject {
  from: Point;
  to: Point;
  width?: number;
  _color!: Color;
  shape!: string;

  // constructor(x: LineOptions) {
  //   super([], x);
  //   // const data = Object.assign({}, x);
  //   const { x1, y1, x2, y2, width, color, shape } = x;

  //   // console.log("Line constructor data:", data);
  //   // console.warn(" this was using `meta` but it is deprecated now - should be using `original` instead");
  //   // this.meta = Object.keys(data)
  //   //   .filter(k => ['ID', 'x1', 'y1', 'x2', 'y2', 'size', 'color'].indexOf(k) < 0)
  //   //   .reduce((n: any, k: string) => { n[k] = data[k]; return n; }, {});

  //   this.x1 = parseFloat(x1 as string);
  //   this.y1 = parseFloat(y1 as string);
  //   this.x2 = parseFloat(x2 as string);
  //   this.y2 = parseFloat(y2 as string);
  //   this.width = width;
  //   this._color = color || new Color('#000000');
  //   this.shape = shape || 'line';
  // }

  constructor(data: DataFrameRow | any, from: Point, to: Point) {
    // let
    //   // dimensions: DimensionType = data.classes.map( (c: string, i: number) => c === "ena.co.occurrence" ? data[i] : -1).filter(a => a !== -1),
    //   // meta: any = data.classes.map( (c: string, i: number) => c === "ena.metadata" ? [data.names[i], data[i]] : null).filter(a => a !== null).reduce((n: any, c: any) => { n[c[0]] = c[1]; return n; }, {}),
    //   // ID: string = data.rowName || `point-${Math.random().toString(36).substring(2, 9)}`
    // ;

    super([], {} as any);

    this.from = from;
    this.to = to;
  }

  get line(): [[number, number], [number, number]] {
    return [[this.from.x, this.from.y], [this.to.x, this.to.y]];
  }
  get midpoint(): [number, number] {
    return [
      (this.from.x + this.to.x) / 2,
      (this.from.y + this.to.y) / 2
    ];
  }
  get length(): number {
    return Math.sqrt(
      Math.pow(this.to.x - this.from.x, 2) +
      Math.pow(this.to.y - this.from.y, 2)
    );
  }
  get color(): Color { return this._color; }
  set color(c: Color) { this._color = c; }
}

export interface PointOptions extends PlottedObjectOptions {
  shape?: string;
  label?: string;
  [key: string]: any;
}

export class Point extends PlottedObject {
  static SHAPES = { CIRCLE: 'circle', SQUARE: 'rect' };

  private _label: Label | undefined;
  edges: Map<any, Edge> = new Map();
  shape: string = Point.SHAPES.CIRCLE;

  // constructor(dimensions: DimensionType, o: PointOptions) { //, graph?: any) {
  //   super(dimensions, o);
  //   this.active = o.active || false;
  //   this.visible = o.visible || false;
  //   this.size = o.size || 1;
  //   this.color = o.color || new Color('#000000');
  //   this.shape = o.shape ? o.shape : "circle";
  //   this.scale_size = 2;
  //   this._x = dimensions[0];
  //   this._y = dimensions[1];
  //   this.label = new Label(this.ID, this);
  // }
  constructor(data: DataFrameRow | any) {
    let
      dimensions: DimensionType | undefined, // = data.classes.map( (c, i) => (c === "ena.co.occurrence" || c === "ena.dimension") ? data[i] : -1).filter(a => a !== -1),
      meta: any, // = data.classes.map( (c, i) => c === "ena.metadata" ? [data.names[i], data[i]] : null).filter(a => a !== null).reduce((n: any, c: any) => { n[c[0]] = c[1]; return n; }, {}),
      ID: string // = data.rowName || `point-${Math.random().toString(36).substring(2, 9)}`
    ;

    if(data) {
      if(data instanceof DataFrameRow) {
        dimensions = data.classes?.map( (c, i) => (c === "ena.co.occurrence" || c === "ena.dimension") ? data[i] : -1).filter(a => a !== -1);
        meta = data.classes?.map( (c, i) => c === "ena.metadata" ? [data.names[i], data[i]] : null).filter(a => a !== null).reduce((n: any, c: any) => { n[c[0]] = c[1]; return n; }, {});
        ID = data.rowName || `point-${Math.random().toString(36).substring(2, 9)}`;
      }
      else if(typeof data === "object") {
        dimensions = data.dimensions || [];
        meta = data.meta || {};
        ID = data.ID || `point-${Math.random().toString(36).substring(2, 9)}`;
      }
      else {
        console.warn("Invalid data provided for Point, using default values");
        dimensions = [];
        meta = {};
        ID = `point-${Math.random().toString(36).substring(2, 9)}`;
      }
    }
    else {
      dimensions = [];
      meta = {};
      ID = `point-${Math.random().toString(36).substring(2, 9)}`;
    }

    super(dimensions ?? [], { meta, ID } as any);
  }

  set label(l: Label | undefined) {
    this._label = l;
  }
  get label(): Label | undefined {
    return this._label;
  }
  get x(): number {
    // const dims = this.graph.options.GRAPH.dimensions;
    // const _ = this.meta[dims[0]];
    // const mult = 1;
    // return parseFloat(_) * mult;
    return this._x;
  }
  get y(): number {
    // const dims = this.graph.options.GRAPH.dimensions;
    // const _ = this.meta[dims[1]];
    // const mult = 1;
    // return parseFloat(_) * mult;
    return this._y;
  }
  set x(x_: number) { this._x = parseFloat(x_ as any); }
  set y(y_: number) { this._y = parseFloat(y_ as any); }
}

export class ConfidenceInterval extends PlottedObject {
  width?: number;
  z: number = 1.959964;
  // meta: any;

  private _mean: any;

  constructor(mean: any) {
    super(mean.dimensions, mean);
    this.ID = "mean_ci_" + mean.ID;
    this._mean = mean;
  }

  get line(): [[number, number], [number, number]] {
    // x1, y1, x2, y2 should be defined on mean or this
    return [
      [this._mean.x1, this._mean.y1],
      [this._mean.x2, this._mean.y2]
    ];
  }
  get variance(): [number, number] {
    const points = [...this._mean.points.values()];
    return [
      points.length > 1 ? points.map(p => Math.pow(p.x - this._mean.x, 2)).reduce((a, b) => a + b, 0) / (points.length - 1) : 0,
      points.length > 1 ? points.map(p => Math.pow(p.y - this._mean.y, 2)).reduce((a, b) => a + b, 0) / (points.length - 1) : 0
    ];
  }
  get std(): [number, number] {
    return this.variance.map(Math.sqrt) as [number, number];
  }
  get value(): [number, number] {
    const pointsSize = this._mean.points.size;
    return this.std.map(s => this.z * (s / Math.sqrt(pointsSize))) as [number, number];
  }
  get length(): number {
    const [a, b] = this.line;
    return Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2));
  }

  get path(): string {
    const x_ = this._mean.x;
    const y_ = this._mean.y;
    const v = this.value;
    const x = v[0];
    const y = v[1];
    const xl = x_ - x;
    const xr = x_ + x;
    const yt = y_ - y;
    const yb = y_ + y;
    return `M${xl},${yt} ${xr},${yt} ${xr},${yb} ${xl},${yb}z`;
  }
}

export class Label extends PlottedObject {
  object: PlottedObject;
  _visible: boolean = false;
  text: string;
  offset: number = 0;
  dragging?: boolean;

  constructor(txt: string, object: PlottedObject) {
    // super(object.ID);
    super(object.dimensions, object);
    this.text = txt;
    this.ID = object.ID;
    this.object = object;
    this.x = this.dimensions[0]; //object.x;
    this.y = this.dimensions[1]; //object.y;
    this.offset = object.size || 0;
    this.size = this.offset / 4;
    this.visible = false;

    this._transform.set("e", 1);  // this.object.size * this.graph.SIZE_EFFECT * 2);
    this._transform.set("f", 1);  // this.object.size * this.graph.SIZE_EFFECT * 2);
  }

  get x(): number {
    return parseFloat(this._x);
  }
  get y(): number {
    return parseFloat(this._y);
  }
  set x(x_: number) { this._x = x_; }
  set y(y_: number) { this._y = y_; }

  get transform(): Transform {
    console.warn("transform is disabled - need updated reference for the graph options")
    // if (
    //   !this.dragging &&
    //   this.graph.options[this.object.constructor.name.toUpperCase()].labelposition === Label.POSITION.OBJECT
    // ) {
    //   const s = this.object.size;
    //   const effect = 1; // this.graph.object.SIZE_EFFECT
    //   this._transform.set("e", s * effect / 2 / this._transform.a);
    //   this._transform.set("f", s * effect / 2 / this._transform.a);
    // } else if (
    //   !this.dragging &&
    //   this.graph.options[this.object.constructor.name.toUpperCase()].labelposition === Label.POSITION.STATIC
    // ) {
    //   const eVal = this.graph.extremes[this.graph.options.LABEL.position[1] as keyof typeof this.graph.extremes];
    //   const fVal = this.graph.extremes[this.graph.options.LABEL.position[0] as keyof typeof this.graph.extremes];
    //   this._transform.set("e", typeof eVal === "number" ? eVal : 0);
    //   this._transform.set("f", typeof fVal === "number" ? fVal : 0);
    // }
    return this._transform;
  }
  set transform(t: Transform) { this._transform = t; }

  static DISPLAY_TYPES = { OFF: 0, AUTO: 1, CLICK: 2, ON: 3 };
  static HIGHLIGHT = { OFF: 0, ON: 2 };
  static POSITION = { OBJECT: 1, STATIC: 2, CONTAINER: 3, CUSTOM: 4 };
}
