
type Offset = { x: number; y: number };
type Size = { width: number; height: number };

class DomViewBox {
  #viewBox: string;
  #width: number;
  #height: number;
  #offset_x: number = 0;
  #offset_y: number = 0;

  constructor(width: number, height: number, offset_x: number = 0, offset_y: number = 0) {
    this.#offset_x = offset_x;
    this.#offset_y = offset_y;
    this.#width = width;
    this.#height = height;
    this.#viewBox = `${offset_x} ${offset_y} ${width} ${height}`;
  }

  get viewBox(): string {
    return this.#viewBox;
  }
  set viewBox(v: string) {
    this.#viewBox = v;
  }
  get width(): number {
    return this.#width;
  }
  set width(w: number) {
    this.#width = w;
    this.#viewBox = `${this.offset_x} ${this.offset_y} ${w} ${this.#height}`;
  }
  get height(): number {
    return this.#height;
  }
  set height(h: number) {
    this.#height = h;
    this.#viewBox = `${this.offset_x} ${this.offset_y} ${this.#width} ${h}`;
  }

  get offset_x(): number {
    return this.#offset_x;
  }
  set offset_x(x: number) {
    this.#offset_x = x;
    this.#viewBox = `${x} ${this.offset_y} ${this.#width} ${this.#height}`;
  }
  get offset_y(): number {
    return this.#offset_y;
  }
  set offset_y(y: number) {
    this.#offset_y = y;
    this.#viewBox = `${this.offset_x} ${y} ${this.#width} ${this.#height}`;
  }
  get offset(): Offset {
    return { x: this.#offset_x, y: this.#offset_y };
  }
  set offset(o: Offset) {
    this.#offset_x = o.x;
    this.#offset_y = o.y;
    this.#viewBox = `${o.x} ${o.y} ${this.#width} ${this.#height}`;
  }

  get size(): Size {
    return { width: this.#width, height: this.#height };
  }
  set size(s: Size) {
    this.#width = s.width;
    this.#height = s.height;
    this.#viewBox = `${this.offset_x} ${this.offset_y} ${s.width} ${s.height}`;
  }
  get aspect(): number {
    return this.#width / this.#height;
  }
  set aspect(a: number) {
    this.#width = this.#height * a;
    this.#viewBox = `${this.offset_x} ${this.offset_y} ${this.#width} ${this.#height}`;
  }
  get ratio(): number {
    return this.#height / this.#width;
  }
  set ratio(r: number) {
    this.#height = this.#width * r;
    this.#viewBox = `${this.offset_x} ${this.offset_y} ${this.#width} ${this.#height}`;
  }
  get viewBoxString(): string {
    return this.#viewBox;
  }

  toString(): string {
    return this.viewBoxString;
  }
}
