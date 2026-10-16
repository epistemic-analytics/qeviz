export class Transform {
  private _values: number[] = [1, 0, 0, 1, 0, 0];
  private _keys: string[] = ["a", "b", "c", "d", "e", "f"];

  get values() {
    return this._values;
  }
  set values(vals: number[]) {
    if (vals && vals.length === 6) {
      this._values = vals;
    }
  }
  get keys() {
    return this._keys;
  }
  set keys(vals: string[]) {
    if (vals && vals.length === 6) {
      this._keys = vals;
    }
  }

  constructor(vals: number[] | null = null) {
    if (vals) {
      this.values = vals;
    }
  }

  toString() {
    let matrix_str = this.keys.map((k, i) => this.values[i]).join(" ")
      ;

    return `matrix(${matrix_str})`;
  }

  toMatrix() {
    return Object.fromEntries(this._keys.map((k, i) => [k, this._values[i]]));
  }

  toArray() {
    return this._values;
  }

  /** Set one matrix entry. Any finite number is accepted (0 resets a pan);
   *  NaN / ±Infinity are ignored so a bad input can't blank the plot. */
  set(wh: string, val: number) {
    const i = this._keys.indexOf(wh);
    if (i >= 0 && Number.isFinite(val)) this._values[i] = val;
  }
  get(wh: string) {
    return this._values[this._keys.findIndex(k => k === wh)];
  }

  scale(a: number, d: number = a) {
    this.a = a;
    this.d = d;
  }

  zoom(z: number) {
    this.a = z;
    this.d = z;
  }

  pan(x: number, y: number) {
    this.e = this.e + x;
    this.f = this.f + y;
  }

  set a(x: number) { this.set("a", x); }
  set b(x: number) { this.set("b", x); }
  set c(x: number) { this.set("c", x); }
  set d(x: number) { this.set("d", x); }
  set e(x: number) { this.set("e", x); }
  set f(x: number) { this.set("f", x); }

  get a() { return this.get("a"); }
  get b() { return this.get("b"); }
  get c() { return this.get("c"); }
  get d() { return this.get("d"); }
  get e() { return this.get("e"); }
  get f() { return this.get("f"); }
}