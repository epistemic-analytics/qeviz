(function(global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.QEViz = {}));
})(this, (function(exports2) {
  "use strict";var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);

  var _rowNumber, _rowName, _names, _parent, _classes, _name, _type, _rowNames, _parent2, _names2, _rowNames2, _classes2, _flipped, _names3, _edge, _with_arrow, _arrow;
  const _DataFrameRow = class _DataFrameRow extends Array {
    constructor(names, values, rowName, parent, index) {
      super(...values);
      __privateAdd(this, _rowNumber);
      __privateAdd(this, _rowName);
      __privateAdd(this, _names);
      __privateAdd(this, _parent);
      __privateAdd(this, _classes);
      __privateSet(this, _names, names);
      __privateSet(this, _rowName, rowName);
      __privateSet(this, _parent, parent);
      __privateSet(this, _classes, parent == null ? void 0 : parent.classes);
      __privateSet(this, _rowNumber, index);
    }
    get parent() {
      return __privateGet(this, _parent);
    }
    get names() {
      return __privateGet(this, _names);
    }
    get rowName() {
      return __privateGet(this, _rowName);
    }
    get types() {
      if (!__privateGet(this, _parent)) throw new Error("No parent DataFrame attached to this row.");
      return __privateGet(this, _parent).types;
    }
    get classes() {
      return __privateGet(this, _classes);
    }
    get rowNumber() {
      return __privateGet(this, _rowNumber);
    }
    col(wh) {
      if (!__privateGet(this, _parent)) throw new Error("No parent DataFrame attached to this row.");
      return __privateGet(this, _parent).col(wh);
    }
    cols(...wh) {
      if (!__privateGet(this, _parent)) throw new Error("No parent DataFrame attached to this row.");
      return __privateGet(this, _parent).cols(...wh);
    }
    filter(predicate) {
      console.error("DataFrameRow does not currently support filtering.");
    }
  };
  _rowNumber = new WeakMap();
  _rowName = new WeakMap();
  _names = new WeakMap();
  _parent = new WeakMap();
  _classes = new WeakMap();
  __name(_DataFrameRow, "DataFrameRow");
  let DataFrameRow = _DataFrameRow;
  var DataFrameColumnType = /* @__PURE__ */ ((DataFrameColumnType2) => {
    DataFrameColumnType2["Character"] = "character";
    DataFrameColumnType2["Double"] = "double";
    DataFrameColumnType2["Logical"] = "logical";
    DataFrameColumnType2["Integer"] = "integer";
    return DataFrameColumnType2;
  })(DataFrameColumnType || {});
  const _DataFrameColumn = class _DataFrameColumn extends Array {
    constructor(name, column, rowNames, parent) {
      super(column.length);
      __privateAdd(this, _name);
      __privateAdd(this, _type);
      __privateAdd(this, _rowNames);
      __privateAdd(this, _parent2);
      for (let i = 0; i < column.length; i++) {
        this[i] = column[i];
      }
      __privateSet(this, _name, name);
      if (column.type !== void 0) {
        __privateSet(this, _type, column.type);
      } else {
        if (column.every((v) => typeof v === "string" || v === null || v === void 0)) {
          __privateSet(this, _type, "character");
        } else if (column.every((v) => Number.isInteger(v) || v === null || v === void 0)) {
          if (column.every((v) => v === 0 || v === 1 || v === null || v === void 0)) {
            __privateSet(this, _type, "logical");
          } else {
            __privateSet(this, _type, "integer");
          }
        } else if (column.every((v) => typeof v === "number" || v === null || v === void 0)) {
          __privateSet(this, _type, "double");
        } else if (column.every((v) => typeof v === "boolean" || v === null || v === void 0)) {
          __privateSet(this, _type, "logical");
        } else {
          __privateSet(this, _type, "character");
        }
      }
      __privateSet(this, _parent2, parent);
      if (rowNames && rowNames.length !== this.length) {
        throw new Error("Row names length must match the number of rows in the DataFrameColumn.");
      }
      if (rowNames && rowNames.length > 0) {
        __privateSet(this, _rowNames, rowNames);
      } else {
        __privateSet(this, _rowNames, void 0);
      }
    }
    get name() {
      return __privateGet(this, _name);
    }
    get type() {
      return __privateGet(this, _type);
    }
    get rowNames() {
      return __privateGet(this, _rowNames);
    }
    row(wh) {
      if (!__privateGet(this, _parent2)) throw new Error("No parent DataFrame attached to this column.");
      return __privateGet(this, _parent2).row(wh);
    }
    rows(...wh) {
      if (!__privateGet(this, _parent2)) throw new Error("No parent DataFrame attached to this column.");
      return __privateGet(this, _parent2).rows(...wh);
    }
  };
  _name = new WeakMap();
  _type = new WeakMap();
  _rowNames = new WeakMap();
  _parent2 = new WeakMap();
  __name(_DataFrameColumn, "DataFrameColumn");
  let DataFrameColumn = _DataFrameColumn;
  const _DataFrame = class _DataFrame extends Array {
    constructor(names, colValues, rowNames, classes) {
      if (!names || !colValues) {
        colValues = [];
        names = [];
      }
      if (colValues.map((c) => c.length).every((l) => l === names.length)) {
        const transposed = [];
        for (let i = 0; i < names.length; i++) {
          const col = [];
          for (let j = 0; j < colValues.length; j++) {
            col.push(colValues[j][i]);
          }
          transposed.push(col);
        }
        colValues = transposed;
      }
      super(colValues.length);
      __privateAdd(this, _names2);
      __privateAdd(this, _rowNames2);
      __privateAdd(this, _classes2);
      colValues.forEach((col, index) => {
        if (col instanceof DataFrameColumn) {
          this[index] = col;
        } else {
          this[index] = new DataFrameColumn(names[index], col, rowNames, this);
        }
      });
      __privateSet(this, _names2, names);
      if (rowNames && this[0] && rowNames.length !== this[0].length) {
        throw new Error("Row names length must match the number of rows in the DataFrame.");
      }
      if (rowNames && rowNames.length > 0) {
        __privateSet(this, _rowNames2, rowNames);
      }
      if (classes && classes.length !== this.length) {
        throw new Error("Classes length must match the number of columns in the DataFrame.");
      }
      if (classes && classes.length > 0) {
        __privateSet(this, _classes2, classes);
      }
    }
    get classes() {
      return __privateGet(this, _classes2);
    }
    getColumnByName(name) {
      const idx = __privateGet(this, _names2).indexOf(name);
      return idx >= 0 ? this[idx] : void 0;
    }
    getRowByIndex(index) {
      if (this && this.length === 0) {
        console.warn("DataFrame is empty, cannot get row by index", index);
        return new DataFrameRow(__privateGet(this, _names2), [], void 0, this, index);
      }
      const result_vals = [];
      for (let col of this) {
        let v = col[index];
        result_vals.push(v);
      }
      return new DataFrameRow(__privateGet(this, _names2), result_vals, __privateGet(this, _rowNames2) ? __privateGet(this, _rowNames2)[index] : void 0, this, index);
    }
    getRowByName(name) {
      if (!__privateGet(this, _rowNames2)) return void 0;
      const index = __privateGet(this, _rowNames2).indexOf(name);
      if (index === -1) return void 0;
      return this.getRowByIndex(index);
    }
    get types() {
      return this.map((col) => col.type);
    }
    type(wh) {
      var _a;
      if (typeof wh === "number") {
        return (_a = this[wh]) == null ? void 0 : _a.type;
      } else if (typeof wh === "string") {
        const col = this.getColumnByName(wh);
        return col ? col.type : void 0;
      }
      return void 0;
    }
    // row(wh: string | number): DataFrameRow | undefined {
    row(wh) {
      if (typeof wh === "number") {
        return this.getRowByIndex(wh);
      } else if (typeof wh === "string") {
        return this.getRowByName(wh);
      }
      return void 0;
    }
    // rows(...wh: (string | number)[]): DataFrame {
    rows(...wh) {
      let selectors, selectedRows = [], selectedRowNames = [];
      if (wh.length === 0) {
        if (!this[0] || this.length === 0) {
          return [];
        }
        const numRows = this[0].length;
        selectedRows = Array.from({ length: numRows }, (_, i) => this.getRowByIndex(i));
        selectedRowNames = __privateGet(this, _rowNames2);
      } else {
        if (wh.length === 1 && Array.isArray(wh[0])) {
          selectors = wh[0];
        } else {
          selectors = wh;
        }
        selectedRows = selectors.map((item, i) => {
          let r = this.row(item);
          if (__privateGet(this, _rowNames2) && r) {
            selectedRowNames == null ? void 0 : selectedRowNames.push(__privateGet(this, _rowNames2)[i]);
          }
          return r;
        }).filter((row) => row !== void 0);
      }
      return selectedRows;
    }
    col(wh) {
      if (typeof wh === "number") {
        return this[wh];
      } else if (typeof wh === "string") {
        return this.getColumnByName(wh);
      }
      return void 0;
    }
    cols(...wh) {
      let selectors, selectedCols, selectedNames = [];
      if (wh.length === 0) {
        selectedCols = this.slice();
        selectedNames = __privateGet(this, _names2);
      } else {
        if (wh.length === 1 && Array.isArray(wh[0])) {
          selectors = wh[0];
        } else {
          selectors = wh;
        }
        selectedCols = selectors.map((item) => this.col(item)).filter((col) => col !== void 0);
        selectedNames = selectedCols.map((col) => col.name);
      }
      return new _DataFrame(selectedNames, selectedCols, __privateGet(this, _rowNames2));
    }
    subset(rows, cols) {
      const selectedCols = cols && cols.length > 0 ? this.cols(...cols) : this.slice();
      return new _DataFrame(
        selectedCols.map((col) => col.name),
        selectedCols.map((col) => col.values),
        __privateGet(this, _rowNames2)
      );
    }
    get names() {
      return __privateGet(this, _names2);
    }
    get rowNames() {
      return __privateGet(this, _rowNames2);
    }
    get nrow() {
      return this[0] ? this[0].length : 0;
    }
    get ncol() {
      return this.length;
    }
  };
  _names2 = new WeakMap();
  _rowNames2 = new WeakMap();
  _classes2 = new WeakMap();
  __name(_DataFrame, "DataFrame");
  let DataFrame = _DataFrame;
  const _Model = class _Model {
    constructor(o = {}) {
      this.unit_id_col = "id";
      this.node_id_col = "id";
      this.group_col = null;
      this.directed = false;
      this._points = o.points ?? new DataFrame();
      this._nodes = o.nodes ?? new DataFrame();
      this._edges = o.edges ?? new DataFrame();
      this._dimensions = o.dimensions ?? [];
      this._confidence = void 0;
      this._outlier = void 0;
      this._groups = void 0;
    }
    get updated() {
      return this._updated;
    }
    set updated(v) {
      this._updated = v;
    }
    get points() {
      return this._points;
    }
    set points(v) {
      this._points = v;
    }
    get nodes() {
      return this._nodes;
    }
    set nodes(v) {
      this._nodes = v;
    }
    get edges() {
      return this._edges;
    }
    set edges(v) {
      this._edges = v;
    }
    get confidence() {
      return this._confidence;
    }
    set confidence(v) {
      this._confidence = v;
    }
    get outlier() {
      return this._outlier;
    }
    set outlier(v) {
      this._outlier = v;
    }
    get groups() {
      return this._groups;
    }
    set groups(v) {
      this._groups = v;
    }
    get trajectories() {
      return this._trajectories;
    }
    set trajectories(v) {
      this._trajectories = v;
    }
    get dimensions() {
      return this._dimensions;
    }
    set dimensions(v) {
      this._dimensions = v;
    }
    get params() {
      return this._params;
    }
    set params(v) {
      this._params = v;
    }
    point(id) {
      return this._points.row(id);
    }
    setByKey(key, value) {
      this[key] = value;
    }
  };
  __name(_Model, "Model");
  let Model = _Model;
  const DEBUG = globalThis.__QEVIZ_DEBUG__ === true;
  function dbg(...args) {
    if (DEBUG) console.log(...args);
  }
  __name(dbg, "dbg");
  const vizENA = {
    get: /* @__PURE__ */ __name((n) => {
      const elements = [...document.querySelectorAll("qe-graph")];
      if (typeof n === "number" && n >= 0) {
        return elements[n];
      }
      return elements;
    }, "get")
  };
  const _QEVisualElement = class _QEVisualElement extends HTMLElement {
    constructor() {
      super();
      this._isVisible = true;
      this.output = "";
      this._updated = "";
      this._active_points = [];
      this._points = /* @__PURE__ */ new Map();
      this._edges = /* @__PURE__ */ new Map();
      this._labels = /* @__PURE__ */ new Map();
      this._model = new Model();
      const shadow = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = _QEVisualElement.styles;
      shadow.appendChild(style);
      this._outputElement = document.createElement("div");
      shadow.appendChild(this._outputElement);
    }
    static get observedAttributes() {
      return ["updated"];
    }
    /** Public accessor so ena-graph (and external code) can read the model. */
    get model() {
      return this._model;
    }
    get updated() {
      return this._updated;
    }
    set updated(val) {
      this._updated = val;
      this.setAttribute("updated", val);
      this.dispatchEvent(new CustomEvent("model-updated", {
        detail: this._model,
        bubbles: true,
        composed: true
      }));
    }
    get points() {
      return this._points;
    }
    set points(pts) {
      this._points.clear();
      if (pts instanceof Map) {
        this._points = pts;
      } else if (Array.isArray(pts)) {
        pts.forEach((p) => this._points.set(p.ID, p));
      }
    }
    get active_points() {
      return Array.from(this._active_points.values());
    }
    get edges() {
      return this._edges;
    }
    set edges(edges) {
      this._edges.clear();
      if (edges instanceof Map) {
        this._edges = edges;
      } else if (Array.isArray(edges)) {
        this._edges = /* @__PURE__ */ new Map();
        edges.forEach((e) => this._edges.set(e.ID, e));
      }
    }
    get labels() {
      return this._labels;
    }
    connectedCallback() {
      dbg("QEVisualElement connected");
      this.render();
    }
    /**
     * Accept pre-fetched ENA model data and update the visualization.
     * Call this directly when data is available from any source —
     * rENA R package, Python package, or static JSON.
     */
    setModelData(data) {
      var _a, _b, _c, _d;
      const frameKeys = ["nodes", "edges", "points", "groups", "confidence", "outlier", "trajectories"];
      frameKeys.forEach((name) => {
        var _a2;
        const raw = data[name];
        if (!((_a2 = raw == null ? void 0 : raw.data) == null ? void 0 : _a2.length)) return;
        const rows = raw.data, types = raw.types || {}, colNames = Object.keys(rows[0]), colValues = rows.map((v) => Object.values(v)), classes = colNames.map((col) => types[col] ?? "character");
        let idCol;
        if (name === "nodes") {
          idCol = data.node_id_col ?? colNames.find((c) => (types[c] ?? "character") === "character");
        } else if (name === "edges" || name === "points" || name === "trajectories") {
          idCol = data.id_col ?? colNames.find((c) => (types[c] ?? "character") === "character");
        } else {
          idCol = data.group_col ?? colNames.find((c) => (types[c] ?? "character") === "character");
        }
        const removalCol = idCol ? colNames.indexOf(idCol) : 0;
        const rowNames = colValues.map((v) => String(v[removalCol]));
        this._model.setByKey(name, new DataFrame(colNames, colValues, rowNames, classes));
      });
      if (data.updated !== void 0) this._model.setByKey("updated", data.updated);
      if (data.directed !== void 0) this._model.directed = data.directed;
      const nodesDF = this._model.nodes;
      this._model.node_id_col = data.node_id_col ?? ((_a = nodesDF == null ? void 0 : nodesDF.names) == null ? void 0 : _a.find((n) => {
        var _a2;
        return ((_a2 = nodesDF.col(n)) == null ? void 0 : _a2.type) === "character";
      })) ?? "id";
      const pointsDF = this._model.points;
      this._model.unit_id_col = data.id_col ?? ((_b = pointsDF == null ? void 0 : pointsDF.names) == null ? void 0 : _b.find((n) => {
        var _a2;
        return ((_a2 = pointsDF.col(n)) == null ? void 0 : _a2.type) === "character";
      })) ?? "id";
      const unitId = this._model.unit_id_col;
      this._model.group_col = data.group_col ?? ((_c = pointsDF == null ? void 0 : pointsDF.names) == null ? void 0 : _c.find((n) => {
        var _a2;
        return n !== unitId && ((_a2 = pointsDF.col(n)) == null ? void 0 : _a2.type) === "character";
      })) ?? null;
      if ((_d = nodesDF == null ? void 0 : nodesDF.names) == null ? void 0 : _d.length) {
        const nodeId = this._model.node_id_col;
        const xColOvr = data.x_col;
        const yColOvr = data.y_col;
        if (xColOvr && yColOvr) {
          this._model.dimensions = [xColOvr, yColOvr];
        } else {
          const numCols = nodesDF.names.filter((n) => {
            if (n === nodeId) return false;
            const col = nodesDF.col(n);
            return col && col.type !== "character" && col.type !== "logical";
          });
          if (numCols.length >= 2) {
            this._model.dimensions = [xColOvr ?? numCols[0], yColOvr ?? numCols[1]];
          }
        }
      }
      this.updated = this._model.updated !== void 0 ? String(this._model.updated) : String(Date.now());
      dbg("Model updated via setModelData:", this.updated);
      this.render();
    }
    /**
     * Base implementation is a no-op. Subclasses (e.g. RQEVisualElement) override
     * this to fetch data from a backend and call setModelData().
     */
    async calculate() {
    }
    render() {
      var _a;
      if (!this._isVisible) {
        this.classList.add("hidden");
      } else {
        this.classList.remove("hidden");
      }
      if (((_a = this._model) == null ? void 0 : _a.updated) !== void 0 && this._model.updated !== null) {
        this._outputElement.innerHTML = `${this.output}<slot></slot>`;
      } else {
        this._outputElement.innerHTML = "Define the model on the left.";
      }
    }
  };
  __name(_QEVisualElement, "QEVisualElement");
  _QEVisualElement.tagName = "qe-visual";
  _QEVisualElement.styles = `
    :host { display: block; width: 100%; }
    :host(.hidden) { display: none !important; }
    /* The output wrapper and the slotted graph fill the host so the plot
       stretches to its container instead of collapsing to intrinsic size. */
    div { display: block; width: 100%; height: 100%; }
    ::slotted(qe-graph) { display: block; width: 100%; height: 100%; }
  `;
  let QEVisualElement = _QEVisualElement;
  customElements.define(QEVisualElement.tagName, QEVisualElement);
  const _Color = class _Color {
    constructor(base) {
      this.base = typeof base === "string" ? base : base.base;
      return new Proxy(this, {
        get(target, prop) {
          if (typeof prop === "string" && /^[0-2]$/.test(prop)) {
            const { r, g, b } = _Color.parseColor(target.base);
            return [r, g, b][Number(prop)];
          }
          return target[prop];
        }
      });
    }
    toString() {
      return this.base;
    }
    setBase(base) {
      this.base = base;
    }
    static parseColor(color) {
      if (color.startsWith("#")) {
        const bigint = parseInt(color.slice(1), 16);
        return {
          r: bigint >> 16 & 255,
          g: bigint >> 8 & 255,
          b: bigint & 255
        };
      }
      throw new Error("Unsupported color format");
    }
    static rgb(r, g, b) {
      return `rgb(${r}, ${g}, ${b})`;
    }
  };
  __name(_Color, "Color");
  let Color = _Color;
  const _WeightedColor = class _WeightedColor extends Color {
    constructor(base, weight) {
      super(base);
      this.weight = weight;
    }
    // Parse hex → HSV (h in [0, 360), s/v in [0, 1]).
    static toHSV(hex) {
      const { r, g, b } = Color.parseColor(hex);
      const rn = r / 255, gn = g / 255, bn = b / 255;
      const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
      const d = max - min;
      const v = max;
      const s = max === 0 ? 0 : d / max;
      let h = 0;
      if (d > 0) {
        switch (max) {
          case rn:
            h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
            break;
          case gn:
            h = ((bn - rn) / d + 2) / 6;
            break;
          default:
            h = ((rn - gn) / d + 4) / 6;
        }
      }
      return { h: h * 360, s, v };
    }
    // Convert HSV + alpha → rgba() CSS string.
    static hsvToRgba(h, s, v, a) {
      const c = v * s;
      const x = c * (1 - Math.abs(h / 60 % 2 - 1));
      const m = v - c;
      let r = 0, g = 0, b = 0;
      if (h < 60) {
        r = c;
        g = x;
        b = 0;
      } else if (h < 120) {
        r = x;
        g = c;
        b = 0;
      } else if (h < 180) {
        r = 0;
        g = c;
        b = x;
      } else if (h < 240) {
        r = 0;
        g = x;
        b = c;
      } else if (h < 300) {
        r = x;
        g = 0;
        b = c;
      } else {
        r = c;
        g = 0;
        b = x;
      }
      return `rgba(${Math.round((r + m) * 255)},${Math.round((g + m) * 255)},${Math.round((b + m) * 255)},${a.toFixed(4)})`;
    }
    // Returns rgba(...) matching rENA's edge-color convention (ena.plot.network):
    //   • hue and value (brightness) are preserved from the base color
    //   • HSV saturation is set to |weight| directly (0 = grey, 1 = fully vivid)
    //   • alpha is also set to |weight|
    //
    // rENA converts the input color to HSV, replaces the S component with the
    // normalized edge weight, and additionally sets plotly element opacity to the
    // same value.  Working in HSV (not HSL) is essential: palette colors like
    // #EE6677 have HSL lightness ≈ 67%, so 100% HSL saturation still looks
    // washed-out, whereas HSV value ≈ 0.93 gives the expected vivid output.
    toString() {
      const { h, v } = _WeightedColor.toHSV(this.base);
      const w = Math.min(1, Math.abs(this.weight));
      return _WeightedColor.hsvToRgba(h, w, v, w);
    }
  };
  __name(_WeightedColor, "WeightedColor");
  let WeightedColor = _WeightedColor;
  const _Transform = class _Transform {
    constructor(vals = null) {
      this._values = [1, 0, 0, 1, 0, 0];
      this._keys = ["a", "b", "c", "d", "e", "f"];
      if (vals) {
        this.values = vals;
      }
    }
    get values() {
      return this._values;
    }
    set values(vals) {
      if (vals && vals.length === 6) {
        this._values = vals;
      }
    }
    get keys() {
      return this._keys;
    }
    set keys(vals) {
      if (vals && vals.length === 6) {
        this._keys = vals;
      }
    }
    toString() {
      let matrix_str = this.keys.map((k, i) => this.values[i]).join(" ");
      return `matrix(${matrix_str})`;
    }
    toMatrix() {
      return Object.fromEntries(this._keys.map((k, i) => [k, this._values[i]]));
    }
    toArray() {
      return this._values;
    }
    set(wh, val) {
      if (val !== 75e-4 && val !== 0) {
        this._values[this._keys.findIndex((k) => k === wh)] = val;
      }
    }
    get(wh) {
      return this._values[this._keys.findIndex((k) => k === wh)];
    }
    scale(a, d = a) {
      this.a = a;
      this.d = d;
    }
    zoom(z) {
      this.a = z;
      this.d = z;
    }
    pan(x, y) {
      this.e = this.e + x;
      this.f = this.f + y;
    }
    set a(x) {
      this.set("a", x);
    }
    set b(x) {
      this.set("b", x);
    }
    set c(x) {
      this.set("c", x);
    }
    set d(x) {
      this.set("d", x);
    }
    set e(x) {
      this.set("e", x);
    }
    set f(x) {
      this.set("f", x);
    }
    get a() {
      return this.get("a");
    }
    get b() {
      return this.get("b");
    }
    get c() {
      return this.get("c");
    }
    get d() {
      return this.get("d");
    }
    get e() {
      return this.get("e");
    }
    get f() {
      return this.get("f");
    }
  };
  __name(_Transform, "Transform");
  let Transform = _Transform;
  var Tools;
  ((Tools2) => {
    ((Matrix2) => {
      function matrixString(matrix) {
        const matrixStr = ["a", "b", "c", "d", "e", "f"].map((l) => matrix[l]).join(" ");
        return `matrix(${matrixStr})`;
      }
      __name(matrixString, "matrixString");
      Matrix2.matrixString = matrixString;
    })(Tools2.Matrix || (Tools2.Matrix = {}));
    ((Geometry2) => {
      ((Point2) => {
        function translate(point, angle, distance) {
          const r = Angle.toRad(angle);
          return [point[0] + distance * Math.cos(r), point[1] + distance * Math.sin(r)];
        }
        __name(translate, "translate");
        Point2.translate = translate;
        function rotate(point, angle, origin) {
          const r = Angle.toRad(angle);
          function rotatePoint(p, a) {
            return [
              p[0] * Math.cos(a) - p[1] * Math.sin(a),
              p[0] * Math.sin(a) + p[1] * Math.cos(a)
            ];
          }
          __name(rotatePoint, "rotatePoint");
          if (!origin || origin[0] === 0 && origin[1] === 0) {
            return rotatePoint(point, r);
          } else {
            const p0 = point.map((c, i) => c - origin[i]);
            const rotated = rotatePoint(p0, r);
            return rotated.map((c, i) => c + origin[i]);
          }
        }
        __name(rotate, "rotate");
        Point2.rotate = rotate;
      })(Geometry2.Point || (Geometry2.Point = {}));
      ((Line2) => {
        function slope(p1, p2) {
          return (p2[1] - p1[1]) / (p2[0] - p1[0]);
        }
        __name(slope, "slope");
        Line2.slope = slope;
        function intercept(p1, p2) {
          const m = slope(p1, p2);
          return p1[1] - m * p1[0];
        }
        __name(intercept, "intercept");
        Line2.intercept = intercept;
        function slopeIntercept(p1, p2) {
          return {
            slope: slope(p1, p2),
            intercept: intercept(p1, p2)
          };
        }
        __name(slopeIntercept, "slopeIntercept");
        Line2.slopeIntercept = slopeIntercept;
        function point_along(line, distance = 0) {
          const ratio = distance;
          const Xt = (1 - ratio) * line[0][0] + ratio * line[1][0];
          const Yt = (1 - ratio) * line[0][1] + ratio * line[1][1];
          return [Xt, Yt];
        }
        __name(point_along, "point_along");
        Line2.point_along = point_along;
        function midpoint(p1, p2, w = 0.5) {
          if (Array.isArray(p1[0])) {
            p2 = p1[1];
            p1 = p1[0];
          }
          return [0, 1].map((i) => (parseFloat(p1[i]) + parseFloat(p2[i])) * w);
        }
        __name(midpoint, "midpoint");
        Line2.midpoint = midpoint;
        function length(p1, p2) {
          if (Array.isArray(p1[0])) {
            p2 = p1[1];
            p1 = p1[0];
          }
          return Math.sqrt(
            [0, 1].map((i) => Math.pow(p2[i] - p1[i], 2)).reduce((a, b) => a + b, 0)
          );
        }
        __name(length, "length");
        Line2.length = length;
        function rotate(line, by = [0, 0]) {
          const translated = [
            line[1][0] - by[0],
            line[1][1] - by[1]
          ];
          const rotated = [
            -translated[1],
            translated[0]
          ];
          const rotated_reflection = [
            -rotated[0],
            -rotated[1]
          ];
          const untranslated = [
            rotated[0] + by[0],
            rotated[1] + by[1]
          ];
          const untranslated2 = [
            rotated_reflection[0] + by[0],
            rotated_reflection[1] + by[1]
          ];
          return [untranslated, untranslated2];
        }
        __name(rotate, "rotate");
        Line2.rotate = rotate;
        function rotate2(line, fixed, angle = 90) {
          const m = Tools2.Geometry.Line.slope(line[0], line[1]);
          const n = Tools2.Geometry.Line.intercept(line[0], line[1]);
          const P = [0, n];
          const Q = [1, m + n];
          line = [P, Q];
          const xx = [line[0][0], line[1][0]];
          const yy = [line[0][1], line[1][1]];
          const x_fixed = fixed[0];
          const y_fixed = fixed[1];
          const angle_rad = -2 * Math.PI * angle / 360;
          const xx_new = xx.map(
            (x, i) => (x - x_fixed) * Math.cos(angle_rad) - (yy[i] - y_fixed) * Math.sin(angle_rad) + x_fixed
          );
          const yy_new = yy.map(
            (y, i) => (xx[i] - x_fixed) * Math.sin(angle_rad) - (y - y_fixed) * Math.cos(angle_rad) + y_fixed
          );
          const object_new = [
            [xx_new[0], yy_new[0]],
            [xx_new[1], yy_new[1]]
          ];
          return object_new;
        }
        __name(rotate2, "rotate2");
        Line2.rotate2 = rotate2;
        function intersection(lineA, lineB) {
          const [[x1, y1], [x2, y2]] = lineA, [[x3, y3], [x4, y4]] = lineB, D = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4), num1 = (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4), num2 = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4);
          return [num1 / D, num2 / D];
        }
        __name(intersection, "intersection");
        Line2.intersection = intersection;
        function intersect_circle(line, circle_xy, circle_r) {
          let { slope: m, intercept: n } = Tools2.Geometry.Line.slopeIntercept(line[0], line[1]);
          let a = 1 + Math.pow(m, 2), b = 2 * m * n - 2 * circle_xy[1] * m - 2 * circle_xy[0], c = Math.pow(circle_xy[0], 2) + Math.pow(n, 2) + Math.pow(circle_xy[1], 2) - 2 * circle_xy[1] * n - Math.pow(circle_r, 2), int = [[Infinity, Infinity], [Infinity, Infinity]];
          if (Math.sqrt(Math.pow(b, 2) - 4 * a * c) >= 0) {
            let x1 = (-b + Math.sqrt(Math.pow(b, 2) - 4 * a * c)) / (2 * a), x2 = (-b - Math.sqrt(Math.pow(b, 2) - 4 * a * c)) / (2 * a), y1 = m * x1 + n, y2 = m * x2 + n;
            int = [[x1, y1], [x2, y2]];
          } else {
            console.error("The line and the circumference do not intersect");
          }
          return int;
        }
        __name(intersect_circle, "intersect_circle");
        Line2.intersect_circle = intersect_circle;
        function interpolate(line) {
          return (t) => t === 0 ? line[0] : t === 1 ? line[1] : Tools2.Geometry.Point.translate(line[0], Tools2.Geometry.Angle.line(line), Tools2.Geometry.Line.length(line) * t);
        }
        __name(interpolate, "interpolate");
        Line2.interpolate = interpolate;
      })(Geometry2.Line || (Geometry2.Line = {}));
      let Angle;
      ((Angle2) => {
        function toRad(angle) {
          return angle / 180 * Math.PI;
        }
        __name(toRad, "toRad");
        Angle2.toRad = toRad;
        function toDeg(angle) {
          return angle * 180 / Math.PI;
        }
        __name(toDeg, "toDeg");
        Angle2.toDeg = toDeg;
        function line(line2) {
          if (line2.length !== 2 || !Array.isArray(line2[0]) || !Array.isArray(line2[1]) || line2[0].length !== 2 || line2[1].length !== 2) {
            throw new Error("Invalid line format. Expected [[x1, y1], [x2, y2]].");
          }
          return Tools2.Geometry.Angle.toDeg(
            Math.atan2(line2[1][1] - line2[0][1], line2[1][0] - line2[0][0])
          );
        }
        __name(line, "line");
        Angle2.line = line;
      })(Angle = Geometry2.Angle || (Geometry2.Angle = {}));
    })(Tools2.Geometry || (Tools2.Geometry = {}));
    ((ArrayTools2) => {
      function unique(arr) {
        return [...new Set(arr)];
      }
      __name(unique, "unique");
      ArrayTools2.unique = unique;
      function divide(a, b) {
        if (Array.isArray(a)) {
          if (Array.isArray(b)) {
            if (a.length !== b.length) throw new Error("Arrays must be of equal length");
            return a.map((val, i) => val / b[i]);
          }
          return a.map((val) => val / b);
        }
        return a / b;
      }
      __name(divide, "divide");
      ArrayTools2.divide = divide;
      function isArray(obj) {
        return typeof Array.isArray === "function" ? Array.isArray(obj) : obj && typeof obj === "object" && obj.constructor.name === "Array";
      }
      __name(isArray, "isArray");
      ArrayTools2.isArray = isArray;
    })(Tools2.ArrayTools || (Tools2.ArrayTools = {}));
    ((Mathematics2) => {
      function sum(arr) {
        return arr.reduce((a, b) => a + b, 0);
      }
      __name(sum, "sum");
      Mathematics2.sum = sum;
      function mean(arr) {
        return sum(arr) / arr.length;
      }
      __name(mean, "mean");
      Mathematics2.mean = mean;
      function round(value, decimals) {
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
      }
      __name(round, "round");
      Mathematics2.round = round;
    })(Tools2.Mathematics || (Tools2.Mathematics = {}));
    ((Events2) => {
      function createEvent(name, element, data) {
        return new CustomEvent(name, {
          bubbles: true,
          cancelable: true,
          detail: {
            element,
            data: data || (element ? element.__data__ : void 0)
          }
        });
      }
      __name(createEvent, "createEvent");
      Events2.createEvent = createEvent;
    })(Tools2.Events || (Tools2.Events = {}));
    ((Hash2) => {
      function parts() {
        return location.hash.replace(/#/, "").split(/\//).filter((a) => a).map((a) => a.split(/:/));
      }
      __name(parts, "parts");
      Hash2.parts = parts;
      function exists(key) {
        return parts().flat().findIndex((a) => a === key) >= 0;
      }
      __name(exists, "exists");
      Hash2.exists = exists;
    })(Tools2.Hash || (Tools2.Hash = {}));
    ((Objects2) => {
      function proxy(obj, handler2, deep = false) {
        if (!deep) {
          return new Proxy(obj, handler2);
        } else {
          if (typeof obj !== "object" || obj === null) {
            return obj;
          }
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              obj[key] = proxy(obj[key], handler2, deep);
            }
          }
          return new Proxy(obj, handler2);
        }
      }
      __name(proxy, "proxy");
      Objects2.proxy = proxy;
      Objects2.handler = {
        set(target, property, value) {
          target[property] = value;
          window.dispatchEvent(
            Tools2.Events.createEvent("settingUpdate", window, { target, property, value })
          );
          return true;
        },
        get(target, property) {
          return target[property];
        }
      };
      function get(obj, key) {
        const parts = key.split(".");
        let current = obj;
        for (const part of parts) {
          if (current && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, part)) {
            current = current[part];
          } else {
            return void 0;
          }
        }
        return current;
      }
      __name(get, "get");
      Objects2.get = get;
      function set(obj, key, value) {
        const parts = key.split(".");
        let current = obj;
        let i;
        for (i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (current && typeof current === "object") {
            if (!Object.prototype.hasOwnProperty.call(current, part)) {
              current[part] = {};
            }
            current = current[part];
          } else {
            return false;
          }
        }
        if (current && typeof current === "object") {
          current[parts[i]] = value;
          return true;
        } else {
          return false;
        }
      }
      __name(set, "set");
      Objects2.set = set;
    })(Tools2.Objects || (Tools2.Objects = {}));
    ((URL2) => {
      function parse(location2 = window.location) {
        return Object.fromEntries(new URLSearchParams(location2.search));
      }
      __name(parse, "parse");
      URL2.parse = parse;
      ((Query2) => {
        function parse2(location2 = window.location.search) {
          return Object.fromEntries(
            location2.replace(/^\?/, "").split(/&/).map((i) => i.split(/=/))
          );
        }
        __name(parse2, "parse2");
        Query2.parse = parse2;
        function keys(location2 = window.location.search) {
          return location2.replace(/^\?/, "").split(/&/).map((i) => i.split(/=/)[0]);
        }
        __name(keys, "keys");
        Query2.keys = keys;
        function has(key, location2 = window.location.search) {
          return keys(location2).findIndex((i) => i === key) >= 0;
        }
        __name(has, "has");
        Query2.has = has;
      })(URL2.Query || (URL2.Query = {}));
    })(Tools2.URL || (Tools2.URL = {}));
  })(Tools || (Tools = {}));
  const _EventBus = class _EventBus {
    constructor() {
      this._state = /* @__PURE__ */ new Map();
      this.listeners = /* @__PURE__ */ new Map();
    }
    get state() {
      return this._state;
    }
    hasVariable(key) {
      return this._state.has(key);
    }
    getVariable(key) {
      return this._state.get(key);
    }
    setVariable(key, value, options) {
      const oldValue = this._state.get(key);
      this._state.set(key, value);
      if (!(options == null ? void 0 : options.lazy)) {
        this.notifyListeners(key, value, oldValue);
      }
    }
    addListener(key, type, listener) {
      if (!this.listeners.has(key)) this.listeners.set(key, /* @__PURE__ */ new Map());
      const typeMap = this.listeners.get(key);
      if (!typeMap.has(type)) typeMap.set(type, /* @__PURE__ */ new Set());
      typeMap.get(type).add(listener);
    }
    removeListener(key, type, listener) {
      var _a, _b;
      (_b = (_a = this.listeners.get(key)) == null ? void 0 : _a.get(type)) == null ? void 0 : _b.delete(listener);
    }
    getListeners(key, type) {
      var _a;
      return Array.from(((_a = this.listeners.get(key)) == null ? void 0 : _a.get(type)) ?? []);
    }
    notifyListeners(key, newValue, oldValue) {
      const typeMap = this.listeners.get(key);
      if (!typeMap) return;
      for (const set of typeMap.values()) {
        set.forEach((listener) => {
          if (typeof listener === "function") {
            listener({ key, newValue, oldValue });
          } else if (typeof listener.calculate === "function") {
            listener.calculate.call(listener, { key, newValue, oldValue });
          }
        });
      }
    }
  };
  __name(_EventBus, "EventBus");
  let EventBus = _EventBus;
  const { ArrayTools: ArrayTools$1 } = Tools;
  const _LayerArray = class _LayerArray extends Array {
    constructor(...args) {
      super(...args);
    }
    search(key, name) {
      let found;
      function fn(a) {
        return a.name === name ? a : void 0;
      }
      __name(fn, "fn");
      function recurse(obj, i, parent = null) {
        if (ArrayTools$1.isArray(obj)) {
          for (const [i2, o] of obj.entries()) {
            found = recurse(o, i2, parent);
            if (found) {
              return found;
            }
          }
        } else {
          found = fn(obj);
          if (!found) {
            if (obj && ArrayTools$1.isArray(obj[key])) {
              for (const [i2, o] of obj[key].entries()) {
                found = recurse(o, i2, obj);
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
      __name(recurse, "recurse");
      return recurse(this);
    }
    flatten() {
      return this.reduce((a, l) => {
        a.push(l);
        if (l.layers && Array.isArray(l.layers)) {
          a.push(...l.layers);
        }
        return a;
      }, []);
    }
    recurse(key, callback, parent = null, depth = 0) {
      let results = new _LayerArray();
      for (const layer of this) {
        let result = callback(layer, parent, depth);
        if (layer[key] && Array.isArray(layer[key])) {
          let r = new _LayerArray(...layer[key]).recurse(key, callback, layer, depth + 1);
          if (r !== void 0) {
            results.push(...r);
          }
        }
        results.push(result);
      }
      console.log("Recurse results: ", results);
      return results;
    }
  };
  __name(_LayerArray, "LayerArray");
  let LayerArray = _LayerArray;
  const _Layer = class _Layer {
    constructor(ID, o, parent) {
      this.__state__ = new EventBus();
      this.scale_x = 1;
      this.scale_y = 1;
      this.scale_objects = true;
      this.layers = new LayerArray();
      this.objects = /* @__PURE__ */ new Map();
      this.visible = true;
      this.ID = ID;
      this.name = o.name || `layer-${ID}`;
      this.tabindex = o.tabindex;
      this.parent = parent;
      this._transform = new Transform();
      parent == null ? void 0 : parent.__state__.addListener("graph_updated", "live", ({ key, newValue, oldValue }) => {
      });
      parent == null ? void 0 : parent.__state__.addListener(`graph_updated_${this.name}`, "live", ({ key, newValue, oldValue }) => {
        this.objects = newValue;
        this.__state__.setVariable(`layer_updated`, this);
      });
    }
    get transform() {
      return this._transform;
    }
    set transform(t) {
      this._transform = t;
    }
  };
  __name(_Layer, "Layer");
  let Layer = _Layer;
  const _DimensionVector = class _DimensionVector extends Array {
    constructor(...args) {
      super(arguments.length);
      __privateAdd(this, _flipped, false);
      __privateAdd(this, _names3);
      for (let i = 0; i < args.length; i++) {
        this[i] = args[i];
      }
      __privateSet(this, _flipped, false);
    }
    static fromArray(arr) {
      const vec = new _DimensionVector();
      arr.forEach((v, i) => {
        vec.push(v);
      });
      __privateSet(vec, _names3, arr.names);
      return vec;
    }
    flip() {
      __privateSet(this, _flipped, !__privateGet(this, _flipped));
      for (let i = 0; i < this.length; i++) {
        this[i] = -this[i];
      }
      return this;
    }
    get(wh) {
      if (typeof wh === "number") {
        return this[wh];
      } else if (__privateGet(this, _names3) && __privateGet(this, _names3).includes(wh)) {
        return this[__privateGet(this, _names3).indexOf(wh)];
      } else {
        return void 0;
      }
    }
    get flipped() {
      return __privateGet(this, _flipped);
    }
    get names() {
      if (__privateGet(this, _names3)) {
        return __privateGet(this, _names3);
      } else {
        return this.map((_, i) => `V${i + 1}`);
      }
    }
  };
  _flipped = new WeakMap();
  _names3 = new WeakMap();
  __name(_DimensionVector, "DimensionVector");
  let DimensionVector = _DimensionVector;
  const _PlottedObject = class _PlottedObject {
    constructor(dimensions, o) {
      this.scale_x = 1;
      this.scale_y = 1;
      this.scale_size = 0.05;
      this.active = false;
      this.visible = false;
      this.highlighting = false;
      this.meta = {};
      this._x = 0;
      this._y = 0;
      this._highlight_default = new Color("#000000");
      this._size = 0;
      this.ID = o.ID;
      this._transform = new Transform();
      if (dimensions instanceof DimensionVector) {
        this._dimensions = dimensions;
      } else if (dimensions instanceof DataFrameRow) {
        this._dimensions = DimensionVector.fromArray(dimensions);
      } else if (Array.isArray(dimensions)) {
        this._dimensions = new DimensionVector(...dimensions);
      } else {
        console.warn("Invalid dimensions provided, using default DimensionVector(0, 0)");
        this._dimensions = new DimensionVector(0, 0);
      }
      let data = { ...o };
      this._original = { ...data };
      this.ID = data.ID;
      this.x = data.x || this._dimensions[0];
      this.y = data.y || this._dimensions[1];
      this._size = data.size || 1;
      this._color = data.color || new Color("#000000");
      this.active = data.active || false;
      this.shape = data.shape || null;
      this.meta = data.meta || {};
      this._highlight = this._highlight_default;
      if (data.highlight) {
        this._highlight = data.highlight;
      }
    }
    get dimensions() {
      return this._dimensions;
    }
    get color() {
      return (
        // This was expecting hightight to be an object with a color property
        // but now it is just a Color object, so we can simplify this.
        this.highlighting && this._highlight ? this._highlight : this._color
      );
    }
    set color(c) {
      this._color = c;
    }
    get highlight() {
      return this._highlight || this._highlight_default;
    }
    set highlight(h) {
      this._highlight = h;
    }
    get size() {
      return this._size;
    }
    set size(s) {
      this._size = s;
    }
    get original() {
      return this._original;
    }
    get x() {
      return this._x;
    }
    get y() {
      return this._y;
    }
    set x(x_) {
      this._x = x_;
    }
    set y(y_) {
      this._y = y_;
    }
    dimension(wh) {
      return this._dimensions.get(wh);
    }
    get transform() {
      return this._transform;
    }
    set transform(t) {
      this._transform = t;
    }
  };
  __name(_PlottedObject, "PlottedObject");
  let PlottedObject = _PlottedObject;
  const _Line = class _Line extends PlottedObject {
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
    constructor(data, from, to) {
      super([], {});
      this.from = from;
      this.to = to;
    }
    get line() {
      return [[this.from.x, this.from.y], [this.to.x, this.to.y]];
    }
    get midpoint() {
      return [
        (this.from.x + this.to.x) / 2,
        (this.from.y + this.to.y) / 2
      ];
    }
    get length() {
      return Math.sqrt(
        Math.pow(this.to.x - this.from.x, 2) + Math.pow(this.to.y - this.from.y, 2)
      );
    }
    get color() {
      return this._color;
    }
    set color(c) {
      this._color = c;
    }
  };
  __name(_Line, "Line");
  let Line = _Line;
  const _Point = class _Point extends PlottedObject {
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
    constructor(data) {
      var _a, _b;
      let dimensions, meta, ID;
      if (data) {
        if (data instanceof DataFrameRow) {
          dimensions = (_a = data.classes) == null ? void 0 : _a.map((c, i) => c === "ena.co.occurrence" || c === "ena.dimension" ? data[i] : -1).filter((a) => a !== -1);
          meta = (_b = data.classes) == null ? void 0 : _b.map((c, i) => c === "ena.metadata" ? [data.names[i], data[i]] : null).filter((a) => a !== null).reduce((n, c) => {
            n[c[0]] = c[1];
            return n;
          }, {});
          ID = data.rowName || `point-${Math.random().toString(36).substring(2, 9)}`;
        } else if (typeof data === "object") {
          dimensions = data.dimensions || [];
          meta = data.meta || {};
          ID = data.ID || `point-${Math.random().toString(36).substring(2, 9)}`;
        } else {
          console.warn("Invalid data provided for Point, using default values");
          dimensions = [];
          meta = {};
          ID = `point-${Math.random().toString(36).substring(2, 9)}`;
        }
      } else {
        dimensions = [];
        meta = {};
        ID = `point-${Math.random().toString(36).substring(2, 9)}`;
      }
      super(dimensions ?? [], { meta, ID });
      this.edges = /* @__PURE__ */ new Map();
      this.shape = _Point.SHAPES.CIRCLE;
    }
    set label(l) {
      this._label = l;
    }
    get label() {
      return this._label;
    }
    get x() {
      return this._x;
    }
    get y() {
      return this._y;
    }
    set x(x_) {
      this._x = parseFloat(x_);
    }
    set y(y_) {
      this._y = parseFloat(y_);
    }
  };
  __name(_Point, "Point");
  _Point.SHAPES = { CIRCLE: "circle", SQUARE: "rect" };
  let Point = _Point;
  const _Label = class _Label extends PlottedObject {
    constructor(txt, object) {
      super(object.dimensions, object);
      this._visible = false;
      this.offset = 0;
      this.text = txt;
      this.ID = object.ID;
      this.object = object;
      this.x = this.dimensions[0];
      this.y = this.dimensions[1];
      this.offset = object.size || 0;
      this.size = this.offset / 4;
      this.visible = false;
      this._transform.set("e", 1);
      this._transform.set("f", 1);
    }
    get x() {
      return parseFloat(this._x);
    }
    get y() {
      return parseFloat(this._y);
    }
    set x(x_) {
      this._x = x_;
    }
    set y(y_) {
      this._y = y_;
    }
    get transform() {
      console.warn("transform is disabled - need updated reference for the graph options");
      return this._transform;
    }
    set transform(t) {
      this._transform = t;
    }
  };
  __name(_Label, "Label");
  _Label.DISPLAY_TYPES = { OFF: 0, AUTO: 1, CLICK: 2, ON: 3 };
  _Label.HIGHLIGHT = { OFF: 0, ON: 2 };
  _Label.POSITION = { OBJECT: 1, STATIC: 2, CONTAINER: 3, CUSTOM: 4 };
  let Label = _Label;
  const _Extremes = class _Extremes {
    // _point_max?: Point;
    // _node_max?: Point;
    constructor(x, y) {
      this.x_max = x;
      this.y_max = y;
    }
    as_viewBox(p = 1.2) {
      let x = this.x_max * p;
      let y = this.y_max * p;
      return `${x * -1} ${y * -1} ${x * 2} ${y * 2}`;
    }
    // get point_max(): Point {
    //   return this._point_max || { x: 1, y: 1 };
    // }
    // get node_max(): Point {
    //   return this._node_max || { x: 1, y: 1 };
    // }
    get height() {
      return this.y_max * 2;
    }
    get width() {
      return this.x_max * 2;
    }
    get top() {
      return this.y_max * -1;
    }
    get bottom() {
      return this.y_max;
    }
    get left() {
      return this.x_max * -1;
    }
    get right() {
      return this.x_max;
    }
  };
  __name(_Extremes, "Extremes");
  let Extremes = _Extremes;
  const _AxisPoint = class _AxisPoint extends PlottedObject {
    constructor(dimensions, o) {
      super(dimensions, o);
      this.visible = true;
      this.size = o.size;
    }
    set size(s) {
      this._size = s;
    }
    get size() {
      return this._size;
    }
    get x() {
      return this._x;
    }
    get y() {
      return this._y;
    }
    set x(x_) {
      this._x = x_;
    }
    set y(y_) {
      this._y = y_;
    }
    get transform() {
      return this._transform;
    }
  };
  __name(_AxisPoint, "AxisPoint");
  let AxisPoint = _AxisPoint;
  let DefaultGraphOptions = {
    GRAPH: {
      ratio: 1,
      x_max: 1,
      y_max: 1,
      selector: "body",
      width: 1,
      height: 1,
      axes: true,
      SIZE_EFFECT: 1,
      dimensions: [0, 1]
    },
    NODE: {
      size: 1,
      highlight: {
        color: "yellow",
        labels: Label.DISPLAY_TYPES.ON
      },
      labels: Label.DISPLAY_TYPES.ON,
      labelposition: Label.POSITION.OBJECT
    },
    POINT: {
      active: 2,
      size: 0.05,
      color: "#000",
      shape: Point.SHAPES.CIRCLE,
      labels: Label.DISPLAY_TYPES.AUTO,
      labelposition: Label.POSITION.OBJECT
    },
    MEAN: {
      shape: Point.SHAPES.SQUARE,
      labels: Label.DISPLAY_TYPES.AUTO
    },
    LABEL: {
      highlight: Label.HIGHLIGHT.OFF,
      position: ["top", "left"],
      container: "#label-container"
    },
    EDGE: {
      multiplier: 1
    }
  };
  const _Graph = class _Graph {
    constructor(options = { ...DefaultGraphOptions }) {
      this.__state__ = new EventBus();
      this.name = "unnamed-graph";
      this.origin = void 0;
      this.points = /* @__PURE__ */ new Map();
      this.nodes = /* @__PURE__ */ new Map();
      this.edges = /* @__PURE__ */ new Map();
      this.trajectories = /* @__PURE__ */ new Map();
      this.labels = /* @__PURE__ */ new Map();
      this.transform = new Transform();
      this.scale_x = 1;
      this.scale_y = 1;
      this.SIZE_EFFECT = 1;
      this._mirror_y = true;
      this._mirror_x = false;
      this._layers = new LayerArray(
        { name: "graph", tabindex: 0, layers: [
          {
            name: "axes",
            layers: [
              {
                name: "axis_lines",
                tabindex: 0,
                layers: [],
                objects: []
              },
              {
                name: "axis_labels",
                tabindex: 0,
                layers: [],
                objects: []
              },
              {
                name: "axis_points",
                tabindex: 0,
                layers: [],
                objects: [
                  this.origin
                ]
              }
            ]
          },
          {
            name: "network",
            layers: [
              { name: "edges", layers: [], tabindex: 0 },
              { name: "nodes", layers: [], tabindex: 0 },
              { name: "edgenodes", layers: [], tabindex: 0 }
            ]
          },
          { name: "trajectories", layers: [], tabindex: 0 },
          { name: "points", layers: [], tabindex: 0 },
          { name: "labels", layers: [], tabindex: 0 }
        ] }
      );
      this.options = options;
      this.origin = new AxisPoint(
        new DimensionVector(0, 0),
        {
          ID: "origin",
          x: 0,
          y: 0,
          size: 0,
          meta: {},
          graph: this,
          color: new Color("#FFFFFF"),
          highlight: new Color("#FFFFFF"),
          active: false
        }
      );
      let layer_id = 1;
      function buildLayerTree(layerData, parent, graph) {
        const new_layer = new Layer(`${layer_id}`, layerData, graph);
        layer_id += 1;
        new_layer.parent = parent || void 0;
        if (layerData.layers && Array.isArray(layerData.layers)) {
          new_layer.layers = new LayerArray(...layerData.layers.map((child) => buildLayerTree(child, new_layer, graph)));
        }
        return new_layer;
      }
      __name(buildLayerTree, "buildLayerTree");
      this.layers = new LayerArray(...this._layers.map((l) => buildLayerTree(l, null, this)));
      let axisPointLayer = this.layers.search("layers", "axis_points");
      if (axisPointLayer) {
        axisPointLayer.objects.set(this.origin.ID, this.origin);
      }
      let axisLineLayer = this.layers.search("layers", "axis_lines");
      if (axisLineLayer) {
        let extremes = this.extremes || new Extremes(1, 1);
        let axis_x = new Line(
          {},
          new Point({ ID: "axis-x-start", dimensions: [-extremes.x_max, 0], classes: ["ena.dimension", "ena.dimension"] }),
          new Point({ ID: "axis-x-end", dimensions: [extremes.x_max, 0], classes: ["ena.dimension", "ena.dimension"] })
        );
        axis_x.ID = "axis-x";
        axisLineLayer.objects.set(axis_x.ID, axis_x);
        let axis_y = new Line(
          {},
          new Point({ ID: "axis-y-start", dimensions: [0, -extremes.y_max], classes: ["ena.dimension", "ena.dimension"] }),
          new Point({ ID: "axis-y-end", dimensions: [0, extremes.y_max], classes: ["ena.dimension", "ena.dimension"] })
        );
        axis_y.ID = "axis-y";
        axisLineLayer.objects.set(axis_y.ID, axis_y);
        console.log("Added axis lines to layer: ", axisLineLayer);
      }
      this.extremes = new Extremes(options.GRAPH.x_max, options.GRAPH.y_max);
    }
    set extremes(e) {
      this._extremes = e;
    }
    get extremes() {
      return this._extremes;
    }
    get mirror_x() {
      return this._mirror_x;
    }
    set mirror_x(m) {
      this._mirror_x = m;
    }
    get mirror_y() {
      return this._mirror_y;
    }
    set mirror_y(m) {
      this._mirror_y = m;
    }
    x_mirror() {
      return this.mirror_x ? -1 : 1;
    }
    y_mirror() {
      return this.mirror_y ? -1 : 1;
    }
    add_point(p) {
      const point = new Point(p);
      this.points.set(point.ID, point);
    }
    add_points(ps) {
      let g_ = this;
      ps.rows().forEach((p) => {
        g_.add_point(p);
      });
    }
    add_nodes(ns) {
      let g_ = this;
      ns.forEach((new_node) => {
        new_node.label = new Label(new_node.ID, new_node);
        g_.labels.set(new_node.label.ID, new_node.label);
        g_.nodes.set(new_node.ID, new_node);
        const nodesLayer = g_.layers.search("layers", "nodes");
        if (nodesLayer) {
          nodesLayer.objects.push(new_node);
        }
      });
      g_.update_extremes();
    }
    add_edge(e, from, to) {
      let g_ = this;
      g_.edges.set(e.ID, e);
      this.add_nodes([from || e.from, to || e.to]);
      return e;
    }
    add_edges(es) {
      let added = es.map((e) => this.add_edge(e));
      const edgesLayer = this.layers.search("layers", "edges");
      if (edgesLayer) {
        edgesLayer.objects.push(...added);
      }
      return added;
    }
    update_extremes() {
      const search_layers = [
        this.layers.search("layers", "points"),
        this.layers.search("layers", "nodes")
      ].filter((l) => l !== void 0);
      if (search_layers.length === 0) {
        this.extremes = new Extremes(1, 1);
      } else {
        const content_max = Math.max(
          ...search_layers.map((l) => Math.max(
            ...[...l.objects.values()].map((o) => Math.max(Math.abs(o.x), Math.abs(o.y)))
          )).filter((a) => Math.abs(a) !== Infinity)
        );
        const found_max = (Number.isFinite(content_max) && content_max > 0 ? content_max : 1) * 1.3;
        this.extremes = new Extremes(found_max, found_max);
      }
    }
    base_point_size(scale = 8) {
      let minDim = Math.min(this.extremes.x_max, this.extremes.y_max);
      let n = this.points.size + this.nodes.size;
      return Math.min(1, minDim / (Math.sqrt(n) * scale));
    }
  };
  __name(_Graph, "Graph");
  let Graph = _Graph;
  const _DrawableElement = class _DrawableElement extends HTMLElement {
    constructor() {
      super();
      this.element = null;
      this.object = null;
      const element = this, shadow = element.attachShadow({ mode: "open" }), style = document.createElement("style"), wrapper = document.createElement("div");
      style.textContent = this.constructor.style;
      shadow.appendChild(style);
      wrapper.setAttribute("class", "wrapper");
      shadow.appendChild(wrapper);
    }
    get wrapper() {
      const element = this, shadow = element.shadowRoot, wrapper = shadow == null ? void 0 : shadow.querySelector(".wrapper");
      return wrapper;
    }
  };
  __name(_DrawableElement, "DrawableElement");
  _DrawableElement.style = `
    :host {
      max-width: 100%;
      display: block;
    }
    .wrapper {
      height: 100%;
      display: flex;
      justify-content: center;
    }
  `;
  let DrawableElement = _DrawableElement;
  const TRAJECTORY_ZERO_EPS = 1e-8;
  function nearOriginFilter(pts, eps = TRAJECTORY_ZERO_EPS) {
    return pts.filter((p) => Math.abs(p.x) > eps || Math.abs(p.y) > eps);
  }
  __name(nearOriginFilter, "nearOriginFilter");
  function normalizedT(n) {
    if (n <= 0) return [];
    if (n === 1) return [0];
    const t = new Array(n);
    for (let i = 0; i < n; i++) t[i] = i / (n - 1);
    return t;
  }
  __name(normalizedT, "normalizedT");
  function design(t, degree) {
    return t.map((ti) => {
      const row = new Array(degree + 1);
      let p = 1;
      for (let k = 0; k <= degree; k++) {
        row[k] = p;
        p *= ti;
      }
      return row;
    });
  }
  __name(design, "design");
  function qr(A) {
    const n = A.length;
    const m = A[0].length;
    const Q = A.map((row) => row.slice());
    const R = Array.from({ length: m }, () => new Array(m).fill(0));
    for (let j = 0; j < m; j++) {
      let norm = 0;
      for (let i = 0; i < n; i++) norm += Q[i][j] * Q[i][j];
      norm = Math.sqrt(norm);
      R[j][j] = norm;
      if (norm > 1e-300) {
        for (let i = 0; i < n; i++) Q[i][j] /= norm;
      }
      for (let k = j + 1; k < m; k++) {
        let dot = 0;
        for (let i = 0; i < n; i++) dot += Q[i][j] * Q[i][k];
        R[j][k] = dot;
        for (let i = 0; i < n; i++) Q[i][k] -= dot * Q[i][j];
      }
    }
    return { Q, R };
  }
  __name(qr, "qr");
  function qtY(Q, y) {
    const n = Q.length;
    const m = Q[0].length;
    const out = new Array(m).fill(0);
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += Q[i][j] * y[i];
      out[j] = s;
    }
    return out;
  }
  __name(qtY, "qtY");
  function backSolve(R, b) {
    const m = b.length;
    const c = new Array(m).fill(0);
    for (let i = m - 1; i >= 0; i--) {
      let s = b[i];
      for (let j = i + 1; j < m; j++) s -= R[i][j] * c[j];
      c[i] = Math.abs(R[i][i]) > 1e-12 ? s / R[i][i] : 0;
    }
    return c;
  }
  __name(backSolve, "backSolve");
  function leverages(Q) {
    return Q.map((row) => {
      let s = 0;
      for (let j = 0; j < row.length; j++) s += row[j] * row[j];
      return s;
    });
  }
  __name(leverages, "leverages");
  function fitCoeffs(t, y, degree) {
    const X = design(t, degree);
    const { Q, R } = qr(X);
    return backSolve(R, qtY(Q, y));
  }
  __name(fitCoeffs, "fitCoeffs");
  function evalPoly(coeffs, t) {
    let v = 0;
    let p = 1;
    for (let k = 0; k < coeffs.length; k++) {
      v += coeffs[k] * p;
      p *= t;
    }
    return v;
  }
  __name(evalPoly, "evalPoly");
  function loocv2d(t, x, y, degree) {
    const X = design(t, degree);
    const { Q, R } = qr(X);
    const h = leverages(Q);
    const cx = backSolve(R, qtY(Q, x));
    const cy = backSolve(R, qtY(Q, y));
    let press = 0;
    for (let i = 0; i < t.length; i++) {
      const denom = 1 - h[i];
      if (denom <= 0) return Infinity;
      const ex = x[i] - evalPoly(cx, t[i]);
      const ey = y[i] - evalPoly(cy, t[i]);
      press += (ex / denom) ** 2 + (ey / denom) ** 2;
    }
    return press;
  }
  __name(loocv2d, "loocv2d");
  function selectDegree(fitPts, maxDegree, mode) {
    const n = fitPts.length;
    const cap = Math.min(Math.max(1, Math.floor(maxDegree)), Math.max(1, n - 1));
    if (mode === "fixed" || n < 3) return cap;
    const t = normalizedT(n);
    const x = fitPts.map((p) => p.x);
    const y = fitPts.map((p) => p.y);
    let best = 1;
    let bestVal = Infinity;
    for (let deg = 1; deg <= cap; deg++) {
      const v = loocv2d(t, x, y, deg);
      if (v < bestVal) {
        bestVal = v;
        best = deg;
      }
    }
    return best;
  }
  __name(selectDegree, "selectDegree");
  function fitTrajectory(activePts, opts) {
    const fitPts = nearOriginFilter(activePts);
    if (fitPts.length < 3) return null;
    const selBasis = opts.selectionSet ? nearOriginFilter(opts.selectionSet) : fitPts;
    const basis = selBasis.length >= 3 ? selBasis : fitPts;
    let degree = selectDegree(basis, opts.maxDegree, opts.degreeSelection);
    degree = Math.min(degree, Math.max(1, fitPts.length - 1));
    const t = normalizedT(fitPts.length);
    const coeffsX = fitCoeffs(t, fitPts.map((p) => p.x), degree);
    const coeffsY = fitCoeffs(t, fitPts.map((p) => p.y), degree);
    return { degree, coeffsX, coeffsY };
  }
  __name(fitTrajectory, "fitTrajectory");
  function sampleCurve(fit, steps = 100) {
    const out = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      out.push({ x: evalPoly(fit.coeffsX, t), y: evalPoly(fit.coeffsY, t) });
    }
    return out;
  }
  __name(sampleCurve, "sampleCurve");
  const TRAJECTORY_CURVE_STEPS = 100;
  const _Trajectory = class _Trajectory extends PlottedObject {
    constructor(options = {}) {
      const defaultColor = options.color instanceof Color ? options.color : new Color(typeof options.color === "string" ? options.color : "#000000");
      super([], {
        ID: options.ID || `traj-${Math.random().toString(36).substring(2, 9)}`,
        size: options.size || 1,
        color: defaultColor,
        highlight: null,
        active: options.active || false,
        meta: options.meta || {},
        ...options
      });
      this._typeName = "Trajectory";
      this.trajPoints = [];
      this.smooth = "none";
      this.maxDegree = 3;
      this.degreeSelection = "loocv_2d";
      this.selectedDegree = -1;
      this.polyCoeffsX = [];
      this.polyCoeffsY = [];
      this.currentTime = Infinity;
      this.showPoints = true;
      this.showTips = true;
      this.lineStyle = "uniform";
      this.strokeWidth = 2;
      this.strokeWidthRange = [1, 6];
      this.opacityRange = [0.3, 1];
      this.smooth = options.smooth || "none";
      this.maxDegree = options.maxDegree !== void 0 ? options.maxDegree : 3;
      this.degreeSelection = options.degreeSelection || "loocv_2d";
      this.polyCoeffsX = options.polyCoeffsX || [];
      this.polyCoeffsY = options.polyCoeffsY || [];
      this.currentTime = options.currentTime !== void 0 ? options.currentTime : Infinity;
      this.showPoints = options.showPoints !== void 0 ? options.showPoints : true;
      this.showTips = options.showTips !== void 0 ? options.showTips : true;
      this.lineStyle = options.lineStyle || "uniform";
      this.strokeWidth = options.strokeWidth || 2;
      this.strokeWidthRange = options.strokeWidthRange || [1, 6];
      this.opacityRange = options.opacityRange || [0.3, 1];
      if (options.points && Array.isArray(options.points)) {
        this.trajPoints = options.points.map((p) => {
          if (p instanceof Point) return p;
          const pt = new Point({ dimensions: [p.x, p.y], meta: { time: p.time, label: p.label } });
          pt.x = p.x;
          pt.y = p.y;
          return pt;
        });
      }
    }
    get activePoints() {
      if (this.currentTime === Infinity) {
        return this.trajPoints;
      }
      return this.trajPoints.filter((p) => {
        const t = p.meta && typeof p.meta.time === "number" ? p.meta.time : 0;
        return t <= this.currentTime;
      });
    }
    get path() {
      return this.pathPoints.reduce((acc, pt, idx) => {
        return idx === 0 ? `M${pt.x},${pt.y}` : `${acc} L${pt.x},${pt.y}`;
      }, "");
    }
    get pathPoints() {
      const pts = this.activePoints;
      if (pts.length < 2) return [];
      if (this.smooth === "poly") {
        if (this.polyCoeffsX.length > 0 && this.polyCoeffsY.length > 0) {
          return sampleCurve(
            { degree: this.polyCoeffsX.length - 1, coeffsX: this.polyCoeffsX, coeffsY: this.polyCoeffsY },
            TRAJECTORY_CURVE_STEPS
          );
        }
        const fit = fitTrajectory(
          pts.map((p) => ({ x: p.x, y: p.y })),
          {
            maxDegree: this.maxDegree,
            degreeSelection: this.degreeSelection,
            selectionSet: this.trajPoints.map((p) => ({ x: p.x, y: p.y }))
          }
        );
        if (fit) {
          this.selectedDegree = fit.degree;
          return sampleCurve(fit, TRAJECTORY_CURVE_STEPS);
        }
      }
      return pts.map((pt) => ({ x: pt.x, y: pt.y }));
    }
  };
  __name(_Trajectory, "Trajectory");
  let Trajectory = _Trajectory;
  const zoom_level = 1;
  const _Edge = class _Edge extends Line {
    constructor(data, from, to, weight = 0) {
      super(data, from, to);
      this._totalweight = 0;
      this._weight = weight;
    }
    get base_color() {
      return this._color;
    }
    get color() {
      const base = this._color || new Color("#000000");
      return new WeightedColor(base, Math.abs(this.weight));
    }
    set color(c) {
      this._color = c;
    }
    base_weight() {
      return this._weight;
    }
    get weight() {
      let w = Array.isArray(this._weight) ? this._weight[0] - this._weight[1] : this._weight;
      return w;
    }
    set weight(w) {
      this._weight = w;
    }
    get totalweight() {
      return this.weight;
    }
    set totalweight(w) {
      this._totalweight = w;
    }
  };
  __name(_Edge, "Edge");
  let Edge = _Edge;
  const _EdgeArrow = class _EdgeArrow extends PlottedObject {
    constructor(edge) {
      super(edge.dimensions || [], edge);
      __privateAdd(this, _edge);
      __privateSet(this, _edge, edge);
    }
    get edge() {
      return __privateGet(this, _edge);
    }
    get path() {
      let _this = __privateGet(this, _edge);
      let _mid = _this.from_point, head = Tools.Geometry.Line.point_along([[_this.to.x, _this.to.y], _mid], 0.2), nock = Tools.Geometry.Line.point_along([[_this.to.x, _this.to.y], _mid], 0.35), mid = Tools.Geometry.Line.midpoint(head, nock), rot_mid = Tools.Geometry.Line.rotate(_this.line, mid), rot_nock = Tools.Geometry.Line.rotate(_this.line, nock), mid_int0 = Tools.Geometry.Line.intersection([_mid, _this.base_pts[0]], rot_mid), mid_int1 = Tools.Geometry.Line.intersection([_mid, _this.base_pts[1]], rot_mid), nock_int0 = Tools.Geometry.Line.intersection([_mid, _this.base_pts[0]], rot_nock), nock_int1 = Tools.Geometry.Line.intersection([_mid, _this.base_pts[1]], rot_nock);
      let p = `M${head.join(" ")} ${mid_int0.join(" ")} ${nock_int0.join(" ")}  ${mid.join(" ")} ${nock_int1.join(" ")}  ${mid_int1.join(" ")}z`;
      return p;
    }
  };
  _edge = new WeakMap();
  __name(_EdgeArrow, "EdgeArrow");
  let EdgeArrow = _EdgeArrow;
  const _TaperedEdge = class _TaperedEdge extends Edge {
    constructor(data, from, to) {
      super(data, from, to);
      __privateAdd(this, _with_arrow);
      __privateAdd(this, _arrow);
      this._path = "";
      __privateSet(this, _with_arrow, false);
      this._directions = [
        "from",
        "to"
        /* TO */
      ];
      this.towards = "to";
      if (__privateGet(this, _with_arrow) === true) {
        __privateSet(this, _arrow, new EdgeArrow(this));
      }
    }
    get path() {
      return `M${this.from.x} ${this.from.y} L${this.base_pts[0].join(" ")} L${this.base_pts[1].join(" ")}z`;
    }
    static calculate_base_points(edg) {
      const top = edg.towards;
      const base = edg._directions.find((d) => d !== edg.towards);
      const bx = edg[base].x, by = edg[base].y;
      const tx = edg[top].x, ty = edg[top].y;
      const dx = tx - bx, dy = ty - by;
      const L = Math.hypot(dx, dy);
      const wt = (edg.weight ?? 0) * zoom_level;
      if (L === 0 || !isFinite(wt) || wt === 0) {
        return [[tx, ty], [tx, ty]];
      }
      const px = -dy / L, py = dx / L;
      const halfW = wt / 2;
      return [
        [tx + px * halfW, ty + py * halfW],
        [tx - px * halfW, ty - py * halfW]
      ];
    }
    get base_pts() {
      return _TaperedEdge.calculate_base_points(this);
    }
    get arrow() {
      return __privateGet(this, _arrow);
    }
    get with_arrow() {
      return __privateGet(this, _with_arrow);
    }
    get from_point() {
      return [this.from.x, this.from.y];
    }
  };
  _with_arrow = new WeakMap();
  _arrow = new WeakMap();
  __name(_TaperedEdge, "TaperedEdge");
  let TaperedEdge = _TaperedEdge;
  const _TaperedWeightedMidpointEdge = class _TaperedWeightedMidpointEdge extends TaperedEdge {
    constructor(data, from, to) {
      super(data, from, to);
      this._dataWeight = 0;
      this._totalweight = data.totalweight ?? 0;
      this._dataWeight = data.weight ?? this._weight;
    }
    get weighted_midpoint() {
      return Tools.Geometry.Line.interpolate(this.line)(1 - this._dataWeight / this._totalweight);
    }
    get base_pts() {
      return TaperedEdge.calculate_base_points(this);
    }
    static build_path(edg) {
      if (edg._totalweight > 0) {
        let p = `M${edg.weighted_midpoint[0]} ${edg.weighted_midpoint[1]} L${edg.base_pts[0].join(" ")} L${edg.base_pts[1].join(" ")}z`;
        return p;
      } else {
        console.error("TaperedWeightedMidpointEdge: No totalweight, returning empty path");
        return "";
      }
    }
    get path() {
      return _TaperedWeightedMidpointEdge.build_path(this);
    }
    get from_point() {
      return this.weighted_midpoint;
    }
  };
  __name(_TaperedWeightedMidpointEdge, "TaperedWeightedMidpointEdge");
  let TaperedWeightedMidpointEdge = _TaperedWeightedMidpointEdge;
  const _NodeEdge = class _NodeEdge extends Edge {
    constructor(data, from, to) {
      super(data, from, to);
    }
    static build_path(weight, to) {
      let R = weight / 2, CX = to.x - R, R2 = R * 2, p = `M ${CX}, ${to.y} a ${R},${R} 0 1,0 ${R2},0 a ${R},${R} 0 1,0 -${R2},0`;
      return p;
    }
    get path() {
      let wt = this.weight * zoom_level;
      return _NodeEdge.build_path(wt, this.to);
    }
  };
  __name(_NodeEdge, "NodeEdge");
  let NodeEdge = _NodeEdge;
  const _Drawable = class _Drawable {
    constructor(__data__, parent, graph, __children__ = new QEArray()) {
      this.__data__ = __data__;
      this.parent = parent;
      this.graph = graph;
      this.__children__ = __children__;
      this.svg_element = this.create();
    }
    get_size() {
      return this.__data__.size;
    }
    draw() {
      var _a;
      (_a = this.parent) == null ? void 0 : _a.appendChild(this.svg_element);
    }
    update(elem, animate = true) {
    }
    animateSVGAttribute(elem, attr, to) {
      const from = parseFloat(elem.getAttribute(attr) || "0");
      if (from === to) return;
      const duration = 5e3;
      const start = performance.now();
      function animate(now) {
        const t = Math.min(1, (now - start) / duration);
        const value = from + (to - from) * t;
        elem.setAttribute(attr, value.toString());
        if (t < 1) requestAnimationFrame(animate);
        else elem.setAttribute(attr, to.toString());
      }
      __name(animate, "animate");
      requestAnimationFrame(animate);
    }
  };
  __name(_Drawable, "Drawable");
  let Drawable = _Drawable;
  const _QELine = class _QELine extends Drawable {
    constructor(__data__, parent, graph, __children__ = new QEArray()) {
      super(__data__, parent, graph, __children__);
      this.__data__ = __data__;
      this.parent = parent;
      this.graph = graph;
      this.__children__ = __children__;
      this.__name__ = "unnamed-line";
      this._arrow_el = null;
      this._hit_el = null;
      this.svg_element = this.create();
    }
    /** Stamp edge identity onto an element so <qe-graph> delegation can resolve
     *  qe-edge-* events. No-op for non-edges (e.g. axis lines). */
    _stampEdge(el) {
      const meta = this.__data__.meta ?? {};
      if (!meta.isMeanEdge) return;
      el.setAttribute("data-edge-source", String(meta.source ?? ""));
      el.setAttribute("data-edge-target", String(meta.target ?? ""));
      el.setAttribute("data-edge-weight", String(meta.weight ?? 0));
      el.setAttribute("data-edge-directed", meta.isDirected ? "true" : "false");
      if (meta.isSelf) el.setAttribute("data-edge-self", "true");
      if (meta.group != null) el.setAttribute("data-edge-group", String(meta.group));
      if (meta.unit != null) el.setAttribute("data-edge-unit", String(meta.unit));
    }
    create() {
      if (this.__data__ instanceof NodeEdge) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("fill", this.__data__.color.toString());
        path.setAttribute("stroke", "none");
        this.svg_element = path;
        return path;
      }
      if (this.__data__ instanceof TaperedEdge) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("fill", this.__data__.color.toString());
        path.setAttribute("stroke", "none");
        this.svg_element = path;
        return path;
      }
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", this.__data__.from.x.toString());
      line.setAttribute("y1", this.__data__.from.y.toString());
      line.setAttribute("x2", this.__data__.to.x.toString());
      line.setAttribute("y2", this.__data__.to.y.toString());
      line.setAttribute("stroke-width", this.get_size().toString());
      line.setAttribute("stroke", this.__data__.color.toString());
      this.svg_element = line;
      return line;
    }
    update() {
      var _a;
      if (!this.svg_element) {
        this.create();
      }
      if (!this.svg_element.parentElement) {
        this.parent.appendChild(this.svg_element);
      }
      const extent = ((_a = this.graph.__data__.extremes) == null ? void 0 : _a.x_max) ?? 1;
      const meta = this.__data__.meta ?? {};
      if (meta.isMeanEdge) {
        this._stampEdge(this.svg_element);
        const weight = typeof meta.weight === "number" ? meta.weight : 0;
        const maxW = typeof meta.maxWeight === "number" ? meta.maxWeight : 1;
        const opacity = typeof meta.opacity === "number" ? meta.opacity : Math.min(1, weight / (maxW || 1));
        const sw = (extent > 0 ? extent : 1) * 0.011 * (weight / (maxW || 1));
        const baseColor = this.__data__._color || new Color("#000000");
        const edgeColor = new WeightedColor(baseColor, opacity).toString();
        if (this.__data__ instanceof NodeEdge) {
          const nodeSize = typeof meta.nodeSize === "number" ? meta.nodeSize : 2;
          const nodeR = extent * 6e-3 * nodeSize;
          this.__data__.weight = 2 * nodeR * 0.55 * opacity;
          this.svg_element.setAttribute("d", this.__data__.path);
          this.svg_element.setAttribute("fill", edgeColor);
          this.svg_element.setAttribute("stroke", "none");
        } else if (this.__data__ instanceof TaperedEdge) {
          this.__data__.weight = sw * 4;
          this.svg_element.setAttribute("d", this.__data__.path);
          this.svg_element.setAttribute("fill", edgeColor);
          this.svg_element.setAttribute("stroke", "none");
          if (meta.isDirected) {
            try {
              const arrow = new EdgeArrow(this.__data__);
              const arrowPath = arrow.path;
              if (arrowPath && !arrowPath.includes("NaN") && !arrowPath.includes("Infinity")) {
                if (!this._arrow_el) {
                  this._arrow_el = document.createElementNS("http://www.w3.org/2000/svg", "path");
                  this._arrow_el.setAttribute("stroke", "none");
                }
                if (!this._arrow_el.parentElement) {
                  this.parent.appendChild(this._arrow_el);
                }
                this._arrow_el.setAttribute("d", arrowPath);
                const arrowColor = baseColor.toString();
                this._arrow_el.setAttribute("fill", arrowColor);
              }
            } catch (_) {
            }
          }
        } else {
          const x1 = this.__data__.from.x, y1 = this.__data__.from.y;
          const x2 = this.__data__.to.x, y2 = this.__data__.to.y;
          this.svg_element.setAttribute("x1", x1.toString());
          this.svg_element.setAttribute("y1", y1.toString());
          this.svg_element.setAttribute("x2", x2.toString());
          this.svg_element.setAttribute("y2", y2.toString());
          this.svg_element.setAttribute("stroke-width", sw.toString());
          this.svg_element.setAttribute("stroke", edgeColor);
          this.svg_element.setAttribute("pointer-events", "stroke");
          this.svg_element.removeAttribute("marker-end");
          if (!this._hit_el) {
            this._hit_el = document.createElementNS("http://www.w3.org/2000/svg", "line");
            this._hit_el.setAttribute("stroke", "transparent");
            this._hit_el.setAttribute("stroke-linecap", "round");
            this._hit_el.setAttribute("pointer-events", "stroke");
          }
          if (!this._hit_el.parentElement) this.parent.appendChild(this._hit_el);
          this._hit_el.setAttribute("x1", x1.toString());
          this._hit_el.setAttribute("y1", y1.toString());
          this._hit_el.setAttribute("x2", x2.toString());
          this._hit_el.setAttribute("y2", y2.toString());
          this._hit_el.setAttribute("stroke-width", Math.max(sw, extent * 0.03).toString());
          this._stampEdge(this._hit_el);
        }
      } else {
        this.svg_element.setAttribute("x1", this.__data__.from.x.toString());
        this.svg_element.setAttribute("y1", this.__data__.from.y.toString());
        this.svg_element.setAttribute("x2", this.__data__.to.x.toString());
        this.svg_element.setAttribute("y2", this.__data__.to.y.toString());
        const sw = (extent > 0 ? extent : 1) * 4e-3 * this.get_size();
        this.svg_element.setAttribute("stroke-width", sw.toString());
        this.svg_element.setAttribute("stroke-opacity", "1");
        this.svg_element.setAttribute("stroke", this.__data__.color.toString());
      }
    }
    draw() {
      var _a, _b, _c;
      if (this._hit_el) (_a = this.parent) == null ? void 0 : _a.appendChild(this._hit_el);
      (_b = this.parent) == null ? void 0 : _b.appendChild(this.svg_element);
      if (this._arrow_el) {
        (_c = this.parent) == null ? void 0 : _c.appendChild(this._arrow_el);
      }
    }
  };
  __name(_QELine, "QELine");
  let QELine = _QELine;
  const _QEPoint = class _QEPoint extends Drawable {
    constructor(__data__, parent, graph, __children__ = new QEArray()) {
      super(__data__, parent, graph, __children__);
      this.__data__ = __data__;
      this.parent = parent;
      this.graph = graph;
      this.__children__ = __children__;
      this.__name__ = "unnamed-point";
      this.svg_element = this.create();
    }
    get x() {
      return this.__data__.dimensions[this.graph.__data__.options.GRAPH.dimensions[0]];
    }
    get y() {
      return this.__data__.dimensions[this.graph.__data__.options.GRAPH.dimensions[1]];
    }
    get isSquare() {
      return this.__data__.shape === "rect";
    }
    /** Half-side length for squares / radius for circles, in SVG user units.
     *  Factor 0.006 keeps code-node diameters in the same visual range as rENA
     *  (≈ 1–2 % of the coordinate half-extent for a typical ENA network).
     */
    computeRadius() {
      var _a;
      const r = this.baseRadius();
      const cap = (_a = this.__data__.meta) == null ? void 0 : _a.maxRadius;
      return typeof cap === "number" && cap > 0 ? Math.min(r, cap) : r;
    }
    baseRadius() {
      var _a, _b, _c, _d;
      const extent = this.graph.__data__.extremes.x_max || 1;
      const sizeScale = ((_a = this.__data__.meta) == null ? void 0 : _a.sizeScale) ?? 1;
      if ((_b = this.__data__.meta) == null ? void 0 : _b.fixedSize) {
        const rect = (_d = (_c = this.graph.svg_element) == null ? void 0 : _c.getBoundingClientRect) == null ? void 0 : _d.call(_c);
        const zoom = this.graph.zoom_level || 1;
        const pxPerUnit = rect && rect.width > 0 ? rect.width / (2 * extent) : 1;
        const targetPx = this.__data__.size * 2 * sizeScale;
        return targetPx / pxPerUnit / zoom;
      }
      return extent * 6e-3 * this.__data__.size * sizeScale;
    }
    /** Optional halo stroke (e.g. white outline on unit points to separate
     *  overlapping dots in dense clusters). Width scales with the dot so it holds
     *  up at any zoom. No-op unless the object requests it via meta.stroke. */
    applyStroke(el) {
      var _a;
      const stroke = (_a = this.__data__.meta) == null ? void 0 : _a.stroke;
      if (!stroke) return;
      el.setAttribute("stroke", stroke);
      el.setAttribute("stroke-width", (this.computeRadius() * 0.22).toString());
    }
    create() {
      const tag = this.isSquare ? "rect" : "circle";
      const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
      el.setAttribute("data-point-id", this.__data__.ID);
      const meta = this.__data__.meta ?? {};
      if (meta.kind) el.setAttribute("data-kind", meta.kind);
      if (meta.name != null) el.setAttribute("data-name", String(meta.name));
      if (meta.group != null) el.setAttribute("data-group", String(meta.group));
      if (meta.unit != null) el.setAttribute("data-unit", String(meta.unit));
      el.setAttribute("fill", this.__data__.color.toString());
      this.applyStroke(el);
      const r = this.computeRadius();
      if (this.isSquare) {
        el.setAttribute("x", (this.x - r).toString());
        el.setAttribute("y", (this.y - r).toString());
        el.setAttribute("width", (r * 2).toString());
        el.setAttribute("height", (r * 2).toString());
      } else {
        el.setAttribute("cx", this.x.toString());
        el.setAttribute("cy", this.y.toString());
        el.setAttribute("r", r.toString());
      }
      this.svg_element = el;
      el.addEventListener("click", () => {
        this.__data__.active = !this.__data__.active;
        this.update();
        const pointEvent = new CustomEvent("point-clicked", {
          detail: { pointData: this.__data__ },
          bubbles: true,
          composed: true
        });
        this.svg_element.dispatchEvent(pointEvent);
      });
      el.addEventListener("mouseover", () => {
      });
      return el;
    }
    update() {
      if (!this.svg_element) {
        this.parent.__data__.__children__.push(this.create());
      }
      if (!this.svg_element.parentElement) {
        this.parent.appendChild(this.svg_element);
      }
      const r = this.computeRadius();
      this.svg_element.setAttribute("fill", this.__data__.color.toString());
      this.applyStroke(this.svg_element);
      if (this.isSquare) {
        this.svg_element.setAttribute("x", (this.x - r).toString());
        this.svg_element.setAttribute("y", (this.y - r).toString());
        this.svg_element.setAttribute("width", (r * 2).toString());
        this.svg_element.setAttribute("height", (r * 2).toString());
      } else {
        this.svg_element.setAttribute("cx", this.x.toString());
        this.svg_element.setAttribute("cy", this.y.toString());
        this.svg_element.setAttribute("r", r.toString());
      }
    }
    draw() {
      var _a;
      (_a = this.parent) == null ? void 0 : _a.appendChild(this.svg_element);
    }
  };
  __name(_QEPoint, "QEPoint");
  let QEPoint = _QEPoint;
  const _QETrajectory = class _QETrajectory extends Drawable {
    constructor(__data__, parent, graph, __children__ = new QEArray()) {
      super(__data__, parent, graph, __children__);
      this.__data__ = __data__;
      this.parent = parent;
      this.graph = graph;
      this.__children__ = __children__;
      this.__name__ = "trajectory";
      this._path_el = null;
      this._segments_group = null;
      this._tip_el = null;
      this._points_group = null;
      this.svg_element = this.create();
    }
    // Trajectory styling is specified in display pixels, while SVG paths use
    // graph coordinates. Convert at render time so marks stay legible at any scale.
    graphUnitsForPixels(pixels) {
      var _a;
      const extent = this.graph.__data__.extremes.x_max || 1;
      const width = ((_a = this.graph.svg_element) == null ? void 0 : _a.getBoundingClientRect().width) || 0;
      return width > 0 ? pixels * (2 * extent / width) : pixels * extent * 6e-3;
    }
    create() {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "qe-trajectory-group");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", this.__data__.color.toString());
      path.setAttribute("stroke-width", this.graphUnitsForPixels(this.__data__.strokeWidth).toString());
      group.appendChild(path);
      this._path_el = path;
      const segmentsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      segmentsGroup.setAttribute("class", "qe-trajectory-segments");
      group.appendChild(segmentsGroup);
      this._segments_group = segmentsGroup;
      const pointsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      pointsGroup.setAttribute("class", "qe-trajectory-points");
      group.appendChild(pointsGroup);
      this._points_group = pointsGroup;
      if (this.__data__.showTips) {
        const tip = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        tip.setAttribute("fill", this.__data__.color.toString());
        tip.setAttribute("r", this.graphUnitsForPixels(4).toString());
        tip.setAttribute("stroke", "#ffffff");
        tip.setAttribute("stroke-width", this.graphUnitsForPixels(1.5).toString());
        group.appendChild(tip);
        this._tip_el = tip;
      }
      this.svg_element = group;
      return group;
    }
    update() {
      if (!this.svg_element) {
        this.create();
      }
      if (!this.svg_element.parentElement) {
        this.parent.appendChild(this.svg_element);
      }
      const dStr = this.__data__.path;
      if (this._path_el) {
        this._path_el.setAttribute("d", dStr);
        this._path_el.setAttribute("stroke", this.__data__.color.toString());
        this._path_el.setAttribute("stroke-width", this.graphUnitsForPixels(this.__data__.strokeWidth).toString());
        this._path_el.style.display = this.__data__.lineStyle === "tapered" ? "none" : "block";
      }
      if (this._segments_group) {
        this._segments_group.innerHTML = "";
        if (this.__data__.lineStyle === "tapered") {
          const pathPts = this.__data__.pathPoints;
          const nSegments = pathPts.length - 1;
          const [minWidth, maxWidth] = this.__data__.strokeWidthRange;
          const [minOpacity, maxOpacity] = this.__data__.opacityRange;
          for (let i = 0; i < nSegments; i++) {
            const start = pathPts[i];
            const end = pathPts[i + 1];
            const progress = nSegments <= 1 ? 1 : i / (nSegments - 1);
            const width = minWidth + (maxWidth - minWidth) * progress;
            const opacity = minOpacity + (maxOpacity - minOpacity) * progress;
            const segment = document.createElementNS("http://www.w3.org/2000/svg", "path");
            segment.setAttribute("d", `M${start.x},${start.y} L${end.x},${end.y}`);
            segment.setAttribute("fill", "none");
            segment.setAttribute("stroke", this.__data__.color.toString());
            segment.setAttribute("stroke-linecap", "round");
            segment.setAttribute("stroke-linejoin", "round");
            segment.setAttribute("stroke-width", this.graphUnitsForPixels(width).toString());
            segment.setAttribute("opacity", opacity.toString());
            this._segments_group.appendChild(segment);
          }
          this._segments_group.style.display = "block";
        } else {
          this._segments_group.style.display = "none";
        }
      }
      const pts = this.__data__.activePoints;
      if (this._points_group) {
        if (this.__data__.showPoints && pts.length > 0) {
          this._points_group.innerHTML = "";
          pts.forEach((pt) => {
            var _a;
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", pt.x.toString());
            dot.setAttribute("cy", pt.y.toString());
            dot.setAttribute("r", this.graphUnitsForPixels(2.5).toString());
            dot.setAttribute("fill", this.__data__.color.toString());
            dot.setAttribute("opacity", "0.7");
            (_a = this._points_group) == null ? void 0 : _a.appendChild(dot);
          });
          this._points_group.style.display = "block";
        } else {
          this._points_group.style.display = "none";
        }
      }
      if (this._tip_el && this.__data__.showTips) {
        if (pts.length > 0) {
          const lastPt = pts[pts.length - 1];
          this._tip_el.setAttribute("cx", lastPt.x.toString());
          this._tip_el.setAttribute("cy", lastPt.y.toString());
          this._tip_el.setAttribute("fill", this.__data__.color.toString());
          this._tip_el.setAttribute("r", this.graphUnitsForPixels(4).toString());
          this._tip_el.setAttribute("stroke-width", this.graphUnitsForPixels(1.5).toString());
          this._tip_el.style.display = "block";
        } else {
          this._tip_el.style.display = "none";
        }
      }
    }
    draw() {
      if (this.svg_element && !this.svg_element.parentElement) {
        this.parent.appendChild(this.svg_element);
      }
      this.update();
    }
  };
  __name(_QETrajectory, "QETrajectory");
  let QETrajectory = _QETrajectory;
  const { ArrayTools } = Tools;
  const _QEArray = class _QEArray extends Array {
    constructor(...args) {
      super(...args);
    }
    search(key, name) {
      let found;
      function fn(a) {
        return a.name === name ? a : void 0;
      }
      __name(fn, "fn");
      function recurse(obj, i, parent = null) {
        if (ArrayTools.isArray(obj)) {
          for (const [i2, o] of obj.entries()) {
            found = recurse(o, i2, parent);
            if (found) {
              return found;
            }
          }
        } else {
          found = fn(obj);
          if (!found) {
            if (obj && ArrayTools.isArray(obj[key])) {
              for (const [i2, o] of obj[key].entries()) {
                found = recurse(o, i2, obj);
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
      __name(recurse, "recurse");
      return recurse(this);
    }
    flatten() {
      return this.reduce((a, l) => {
        a.push(l);
        if (l.layers && Array.isArray(l.layers)) {
          a.push(...l.layers);
        }
        return a;
      }, []);
    }
  };
  __name(_QEArray, "QEArray");
  let QEArray = _QEArray;
  const QEElementConstructors = {
    "AxisPoint": QEPoint,
    "AxisLine": QELine,
    "Point": QEPoint,
    "Line": QELine,
    "Edge": QELine,
    "TaperedEdge": QELine,
    "TaperedWeightedMidpointEdge": QELine,
    "NodeEdge": QELine,
    "Trajectory": QETrajectory
  };
  const _QELayer = class _QELayer {
    constructor(__data__, parent, graph, __children__ = new QEArray()) {
      this.__data__ = __data__;
      this.parent = parent;
      this.graph = graph;
      this.__children__ = __children__;
      this.__name__ = __data__.name || "unnamed-layer";
      __data__.__state__.addListener(`layer_updated`, "live", ({ key, newValue, oldValue }) => {
        const childId = /* @__PURE__ */ __name((child) => {
          var _a;
          return (_a = child.__data__) == null ? void 0 : _a.ID;
        }, "childId");
        const removing = this.__children__.filter(
          (child) => !newValue.objects.has(childId(child))
        );
        const updating = this.__children__.filter(
          (child) => newValue.objects.has(childId(child))
        );
        const adding = [...newValue.objects.values()].filter(
          (obj) => !this.__children__.some((child) => childId(child) === obj.ID)
        );
        adding.forEach((obj) => {
          const obj_name = obj._typeName || obj.constructor.name;
          let constructor = QEElementConstructors[obj_name];
          if (!constructor) {
            if (obj instanceof Trajectory) constructor = QETrajectory;
            else if (obj instanceof Point) constructor = QEPoint;
            else constructor = QELine;
          }
          const ena_element = new constructor(obj, this.svg_element, this.graph);
          this.__children__.push(ena_element);
        });
        updating.forEach((child) => {
          const newData = newValue.objects.get(childId(child));
          if (newData) child.__data__ = newData;
          child.update();
        });
        removing.forEach((child) => {
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
    create() {
      if (!this.__data__) {
        throw new Error("Layer is null");
      }
      let layer = this.__data__;
      this.svg_element = document.createElementNS("http://www.w3.org/2000/svg", _QELayer.tagName);
      this.svg_element.setAttribute("data-layer-name", layer.name);
      this.svg_element.setAttribute("data-layer-id", layer.ID);
      this.svg_element.__data__ = layer;
      this.svg_element.classList.add("ena-layer");
      if (this.__data__.layers && this.__data__.layers.length > 0) {
        this.__data__.layers.forEach((sublayer) => {
          const layer_g = new _QELayer(sublayer, this.svg_element, this.graph);
          this.__children__.push(layer_g);
        });
      }
      return this.svg_element;
    }
    update() {
      if (!this.__data__) {
        throw new Error("Layer is null");
      }
      if (this.__data__.visible) {
        if (this.parent.nodeName.toLowerCase() === "svg") ;
        this.__children__.forEach((child) => {
          child.update();
        });
        if (this.__data__.scale_objects === true) {
          if (this.__name__ === "points") ;
        }
      }
    }
    draw() {
      var _a;
      (_a = this.parent) == null ? void 0 : _a.appendChild(this.svg_element);
      this.__children__.forEach((child) => {
        child.draw();
      });
    }
    add(child) {
      this.__children__.push(child);
    }
  };
  __name(_QELayer, "QELayer");
  _QELayer.tagName = "g";
  let QELayer = _QELayer;
  const _QELabel = class _QELabel {
    constructor(text, point, parent, graph, displayMode = Label.DISPLAY_TYPES.ON, position = Label.POSITION.OBJECT, customX, customY) {
      this.text = text;
      this.point = point;
      this.parent = parent;
      this.graph = graph;
      this.displayMode = displayMode;
      this.position = position;
      this.customX = customX;
      this.customY = customY;
      this._visible = false;
      this._offsetX = 0;
      this._offsetY = 0;
      this.pinned = false;
      this.svg_element = this._create();
      if (displayMode === Label.DISPLAY_TYPES.ON) {
        this._visible = true;
        this.svg_element.setAttribute("display", "block");
      } else {
        this._visible = false;
        this.svg_element.setAttribute("display", "none");
      }
    }
    _create() {
      const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
      el.textContent = this.text;
      el.setAttribute("data-label-for", this.point.ID);
      el.setAttribute("pointer-events", "auto");
      el.style.cursor = "grab";
      this._attachDrag(el);
      this.parent.appendChild(el);
      return el;
    }
    /** Drag to reposition; pins the label open and emits qe-label-move on drop. */
    _attachDrag(el) {
      el.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const svg = el.ownerSVGElement;
        if (!svg) return;
        const toUser = /* @__PURE__ */ __name((cx, cy) => {
          const p = svg.createSVGPoint();
          p.x = cx;
          p.y = cy;
          const m = svg.getScreenCTM();
          return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
        }, "toUser");
        const start = toUser(ev.clientX, ev.clientY);
        const baseX = this._offsetX, baseY = this._offsetY;
        el.style.cursor = "grabbing";
        const onMove = /* @__PURE__ */ __name((e) => {
          const p = toUser(e.clientX, e.clientY);
          this._offsetX = baseX + (p.x - start.x);
          this._offsetY = baseY + (p.y - start.y);
          this.pinned = true;
          this._visible = true;
          this.svg_element.setAttribute("display", "block");
          this.update();
        }, "onMove");
        const onUp = /* @__PURE__ */ __name(() => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          el.style.cursor = "grab";
          this.graph.dispatchEvent(new CustomEvent("qe-label-move", {
            detail: { id: this.point.ID, transform: { x: this._offsetX, y: this._offsetY } },
            bubbles: true,
            composed: true
          }));
        }, "onUp");
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    }
    /**
     * Recompute position and font-size from current graph extents.
     * No-ops when the label is hidden (AUTO/CLICK modes while not hovered/clicked).
     */
    update() {
      var _a;
      if (!this._visible) return;
      const extent = this.graph.__data__.extremes.x_max;
      if (extent <= 0) return;
      const fontSize = extent * 0.06;
      const offset = fontSize * 1.2;
      let x, y, anchor;
      switch (this.position) {
        case Label.POSITION.STATIC: {
          x = this.point.x;
          y = this.point.y - offset * 0.3;
          anchor = "middle";
          break;
        }
        case Label.POSITION.CONTAINER: {
          const px = this.point.x;
          const py = this.point.y;
          const dist = Math.sqrt(px * px + py * py) || 1;
          const scale = extent * 0.93 / dist;
          x = px * scale;
          y = py * scale - offset * 0.3;
          anchor = px >= 0 ? "start" : "end";
          break;
        }
        case Label.POSITION.CUSTOM: {
          if (this.customX != null && this.customY != null) {
            x = this.customX;
            y = this.customY;
            anchor = "start";
            break;
          }
        }
        default:
        case Label.POSITION.OBJECT: {
          const dx = this.point.x >= 0 ? offset : -offset;
          anchor = this.point.x >= 0 ? "start" : "end";
          x = this.point.x + dx;
          y = this.point.y - offset * 0.4;
          break;
        }
      }
      this.svg_element.setAttribute("x", x.toString());
      this.svg_element.setAttribute("y", y.toString());
      if (this._offsetX || this._offsetY) {
        this.svg_element.setAttribute("transform", `translate(${this._offsetX}, ${this._offsetY})`);
      }
      this.svg_element.setAttribute("font-size", fontSize.toString());
      this.svg_element.setAttribute("font-family", "system-ui, sans-serif");
      this.svg_element.setAttribute("font-weight", "500");
      this.svg_element.setAttribute("text-anchor", anchor);
      this.svg_element.setAttribute("fill", ((_a = this.point.color) == null ? void 0 : _a.toString()) ?? "#333333");
    }
    /** Make the label visible and position it immediately. */
    show() {
      this._visible = true;
      this.svg_element.setAttribute("display", "block");
      this.update();
    }
    hide() {
      if (this.pinned) return;
      this._visible = false;
      this.svg_element.setAttribute("display", "none");
    }
    toggle() {
      this._visible ? this.hide() : this.show();
    }
    get visible() {
      return this._visible;
    }
    remove() {
      this.svg_element.remove();
    }
  };
  __name(_QELabel, "QELabel");
  let QELabel = _QELabel;
  const _QENodesElement = class _QENodesElement extends HTMLElement {
  };
  __name(_QENodesElement, "QENodesElement");
  _QENodesElement.tagName = "qe-nodes";
  let QENodesElement = _QENodesElement;
  const _QEMeansElement = class _QEMeansElement extends HTMLElement {
  };
  __name(_QEMeansElement, "QEMeansElement");
  _QEMeansElement.tagName = "qe-means";
  let QEMeansElement = _QEMeansElement;
  const _QEPointsElement = class _QEPointsElement extends HTMLElement {
  };
  __name(_QEPointsElement, "QEPointsElement");
  _QEPointsElement.tagName = "qe-points";
  let QEPointsElement = _QEPointsElement;
  const _QEEdgesElement = class _QEEdgesElement extends HTMLElement {
  };
  __name(_QEEdgesElement, "QEEdgesElement");
  _QEEdgesElement.tagName = "qe-edges";
  let QEEdgesElement = _QEEdgesElement;
  const _QETrajectoriesElement = class _QETrajectoriesElement extends HTMLElement {
  };
  __name(_QETrajectoriesElement, "QETrajectoriesElement");
  _QETrajectoriesElement.tagName = "qe-trajectories";
  let QETrajectoriesElement = _QETrajectoriesElement;
  const _QEAxesElement = class _QEAxesElement extends HTMLElement {
  };
  __name(_QEAxesElement, "QEAxesElement");
  _QEAxesElement.tagName = "qe-axes";
  let QEAxesElement = _QEAxesElement;
  customElements.define(QENodesElement.tagName, QENodesElement);
  customElements.define(QEMeansElement.tagName, QEMeansElement);
  customElements.define(QEPointsElement.tagName, QEPointsElement);
  customElements.define(QEEdgesElement.tagName, QEEdgesElement);
  customElements.define(QETrajectoriesElement.tagName, QETrajectoriesElement);
  customElements.define(QEAxesElement.tagName, QEAxesElement);
  const GROUP_PALETTE = [
    "#4477AA",
    "#EE6677",
    "#228833",
    "#CCBB44",
    "#66CCEE",
    "#AA3377",
    "#BBBBBB",
    "#000000"
  ];
  function parseEdgePair(colName, codes) {
    for (const c of codes) {
      if (colName === `${c}.${c}`) return [c, c];
    }
    for (const c1 of codes) {
      if (colName.startsWith(c1 + ".")) {
        const c2 = colName.slice(c1.length + 1);
        if (codes.includes(c2)) return [c1, c2];
      }
    }
    return null;
  }
  __name(parseEdgePair, "parseEdgePair");
  function computeCIRect(varX, varY, n, pointScale) {
    const df = Math.max(1, n - 1);
    const t95 = df >= 120 ? 1.96 : df >= 60 ? 2 : df >= 30 ? 2.042 : df >= 20 ? 2.086 : df >= 10 ? 2.228 : df >= 5 ? 2.571 : 4.303;
    const seX = Math.sqrt(Math.max(0, varX) / n) * pointScale;
    const seY = Math.sqrt(Math.max(0, varY) / n) * pointScale;
    return { halfW: t95 * seX, halfH: t95 * seY };
  }
  __name(computeCIRect, "computeCIRect");
  const MEAN_MAX_FRACTION_OF_INTERVAL = 0.5;
  function capMeanToInterval(meanPt, halfW, halfH) {
    if (!meanPt) return;
    const half = Math.min(Math.abs(halfW), Math.abs(halfH));
    if (!(half > 0)) return;
    meanPt.meta = { ...meanPt.meta ?? {}, maxRadius: half * MEAN_MAX_FRACTION_OF_INTERVAL };
  }
  __name(capMeanToInterval, "capMeanToInterval");
  function readIntervalBounds(row, dim0, dim1) {
    const get = /* @__PURE__ */ __name((col) => {
      const i = row.names.indexOf(col);
      return i >= 0 ? Number(row[i]) : void 0;
    }, "get");
    const xLow = get(`${dim0}.low`) ?? get(`${dim0}_low`);
    const xHigh = get(`${dim0}.high`) ?? get(`${dim0}_high`);
    const yLow = get(`${dim1}.low`) ?? get(`${dim1}_low`);
    const yHigh = get(`${dim1}.high`) ?? get(`${dim1}_high`);
    if (xLow == null || xHigh == null || yLow == null || yHigh == null) return null;
    return { x_low: xLow, x_high: xHigh, y_low: yLow, y_high: yHigh };
  }
  __name(readIntervalBounds, "readIntervalBounds");
  function parseLabelMode(attr, defaultMode) {
    switch (attr == null ? void 0 : attr.toLowerCase()) {
      case "on":
        return 3;
      case "off":
        return 0;
      case "click":
        return 2;
      case "auto":
        return 1;
      default:
        return defaultMode;
    }
  }
  __name(parseLabelMode, "parseLabelMode");
  const _QEGraphElement = class _QEGraphElement extends DrawableElement {
    constructor() {
      super();
      this.zoom_level = 1;
      this.__children__ = new QEArray();
      this._hasModel = false;
      this._renderPending = false;
      this._childObserver = null;
      this._ciRects = /* @__PURE__ */ new Map();
      this._outlierRects = /* @__PURE__ */ new Map();
      this._labelsGroup = null;
      this._nodeLabels = /* @__PURE__ */ new Map();
      this._meanLabels = /* @__PURE__ */ new Map();
      this._pointLabels = /* @__PURE__ */ new Map();
      this._showAxes = false;
      this._axisXText = null;
      this._axisYText = null;
      this._axisLabelEls = /* @__PURE__ */ new Map();
      this._animateMs = 0;
      this._tweenRaf = null;
      this._highlight = { edges: /* @__PURE__ */ new Set(), nodes: /* @__PURE__ */ new Set() };
      this._highlightGroup = null;
      this._tooltipEl = null;
      this.graph = this;
      this.parent = null;
      this.__data__ = new Graph(DefaultGraphOptions);
      this.__name__ = this.__data__.name || "unnamed-graph";
      this.svg_element = this.create();
      console.log("Created ena-graph svg element: ", this.svg_element);
      document.addEventListener("model-updated", (e) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
        if (this._vizena && e.target !== this._vizena) return;
        const model = e.detail;
        if (!model) return;
        this._animateMs = this.hasAttribute("animate") ? parseInt(this.getAttribute("animate") || "", 10) || 300 : 0;
        const tweenFrom = this._animateMs > 0 && this._hasModel ? this._captureTween() : null;
        this._hasModel = true;
        const dims = model.dimensions;
        const unitIdCol = model.unit_id_col;
        const nodeIdCol = model.node_id_col;
        const groupColName = model.group_col;
        const config = this._readLayerConfig();
        this._showAxes = config.showAxes;
        this._axisXText = config.axisXLabel === null ? null : config.axisXLabel || String((dims == null ? void 0 : dims[0]) ?? "x");
        this._axisYText = config.axisYLabel === null ? null : config.axisYLabel || String((dims == null ? void 0 : dims[1]) ?? "y");
        const groupColorMap = {};
        if (groupColName && ((_a = model.points) == null ? void 0 : _a.names)) {
          const groupCol = model.points.col(groupColName);
          if (groupCol) {
            const uniqueGroups = [...new Set([...groupCol].map(String))];
            uniqueGroups.forEach((g, i) => {
              groupColorMap[g] = GROUP_PALETTE[i % GROUP_PALETTE.length];
            });
          }
        } else if (((_b = model.groups) == null ? void 0 : _b.rows) && model.groups.rows().length > 0) {
          model.groups.rows().forEach((row, i) => {
            const g = row.rowName ?? String(row[0]);
            if (!groupColorMap[g]) groupColorMap[g] = GROUP_PALETTE[i % GROUP_PALETTE.length];
          });
        }
        const _allGroupNames_ = Object.keys(groupColorMap);
        const activeMeanGroups = config.activeMeanGroups && config.activeMeanGroups.trim() ? new Set(
          config.activeMeanGroups.split(",").map((s) => s.trim()).filter((g) => groupColorMap[g])
          // silently drop names not in model
        ) : new Set(_allGroupNames_);
        const scalePointsEnabled = config.scalePoints;
        const getExtent = /* @__PURE__ */ __name((rows) => {
          let max = 0;
          rows.forEach((row) => {
            const xIdx = row.names.indexOf(dims[0]);
            const yIdx = dims.length > 1 ? row.names.indexOf(dims[1]) : -1;
            if (xIdx >= 0) max = Math.max(max, Math.abs(Number(row[xIdx])));
            if (yIdx >= 0) max = Math.max(max, Math.abs(Number(row[yIdx])));
          });
          return max;
        }, "getExtent");
        const maxNodeExtent = ((_c = model.nodes) == null ? void 0 : _c.rows) ? getExtent(model.nodes.rows()) : 0;
        const maxPointExtent = ((_d = model.points) == null ? void 0 : _d.rows) ? getExtent(model.points.rows()) : 0;
        const maxTrajExtent = ((_e = model.trajectories) == null ? void 0 : _e.rows) ? getExtent(model.trajectories.rows()) : 0;
        const effectivePointExtent = maxPointExtent > 0 ? maxPointExtent : maxTrajExtent;
        const pointScale = scalePointsEnabled && effectivePointExtent > 0 && maxNodeExtent > 0 ? maxNodeExtent / effectivePointExtent : 1;
        const labelNodes = config.labelNodes;
        const labelMeans = config.labelMeans;
        const labelPoints = config.labelPoints;
        const labelSvg = this._labelsGroup;
        const rowToPoint = /* @__PURE__ */ __name((row, idCol, colorStr, scale = 1) => {
          const idIdx = row.names.indexOf(idCol);
          const xIdx = row.names.indexOf(dims[0]);
          const yIdx = dims.length > 1 ? row.names.indexOf(dims[1]) : -1;
          const pt = new Point({
            ID: idIdx >= 0 ? String(row[idIdx]) : row.rowName || `pt-${Math.random().toString(36).slice(2)}`,
            dimensions: [
              xIdx >= 0 ? Number(row[xIdx]) * scale : 0,
              yIdx >= 0 ? -Number(row[yIdx]) * scale : 0
              // negate Y: SVG y-down vs ENA y-up
            ],
            meta: {}
          });
          if (colorStr) pt.color = new Color(colorStr);
          return pt;
        }, "rowToPoint");
        const groupSums = {};
        const showUnitPoints = config.showPoints;
        if ((_f = model.points) == null ? void 0 : _f.rows) {
          const pointsLayer = this.__children__.search("__children__", "points");
          if (pointsLayer) {
            model.points.rows().forEach((row) => {
              const groupColIdx = groupColName ? row.names.indexOf(groupColName) : -1;
              const group = groupColIdx >= 0 ? String(row[groupColIdx]) : null;
              const colorStr = group ? groupColorMap[group] ?? "#888888" : "#888888";
              if (showUnitPoints) {
                const pt = rowToPoint(row, unitIdCol, colorStr, pointScale);
                pt.size = config.pointSize ?? 2.5;
                pt.meta = {
                  ...pt.meta ?? {},
                  stroke: "#ffffff",
                  kind: "point",
                  name: pt.ID,
                  group: group ?? void 0,
                  unit: pt.ID,
                  fixedSize: config.pointFixedSize
                };
                this.__data__.points.set(pt.ID, pt);
                pointsLayer.__data__.objects.set(pt.ID, pt);
              }
              if (group) {
                const xIdx = row.names.indexOf(dims[0]);
                const yIdx = dims.length > 1 ? row.names.indexOf(dims[1]) : -1;
                if (!groupSums[group]) groupSums[group] = { x: 0, y: 0, x2: 0, y2: 0, xy: 0, n: 0, color: colorStr };
                const rx = xIdx >= 0 ? Number(row[xIdx]) : 0;
                const ry = yIdx >= 0 ? Number(row[yIdx]) : 0;
                groupSums[group].x += rx;
                groupSums[group].y += ry;
                groupSums[group].x2 += rx * rx;
                groupSums[group].y2 += ry * ry;
                groupSums[group].xy += rx * ry;
                groupSums[group].n += 1;
              }
            });
            const hasGroupsFrame = !!(((_g = model.groups) == null ? void 0 : _g.rows) && model.groups.rows().length > 0);
            const activeGroupRows = config.showMeans && hasGroupsFrame ? model.groups.rows().filter((r) => {
              const g = r.rowName ?? String(r[0]);
              return activeMeanGroups.size === 0 || activeMeanGroups.has(g);
            }) : [];
            if (config.showMeans) {
              const pointsLayerSvg = pointsLayer.svg_element;
              const sw = (maxNodeExtent > 0 ? maxNodeExtent : 1) * 8e-3;
              if (hasGroupsFrame) {
                const activeNames = new Set(activeGroupRows.map((r) => r.rowName ?? String(r[0])));
                this._ciRects.forEach((el, g) => {
                  if (!activeNames.has(g)) {
                    el.remove();
                    this._ciRects.delete(g);
                  }
                });
                this._outlierRects.forEach((el, g) => {
                  if (!activeNames.has(g)) {
                    el.remove();
                    this._outlierRects.delete(g);
                  }
                });
                activeGroupRows.forEach((row) => {
                  const group = row.rowName ?? String(row[0]);
                  const color = groupColorMap[group] ?? "#888888";
                  const xIdx = row.names.indexOf(dims[0]);
                  const yIdx = dims.length > 1 ? row.names.indexOf(dims[1]) : -1;
                  const mx = xIdx >= 0 ? Number(row[xIdx]) * pointScale : 0;
                  const my = yIdx >= 0 ? -Number(row[yIdx]) * pointScale : 0;
                  const meanPt = new Point({
                    ID: `mean-${group}`,
                    dimensions: [mx, my],
                    meta: { kind: "mean", name: group, group, fixedSize: config.meanFixedSize }
                  });
                  meanPt.color = new Color(color);
                  meanPt.size = 4;
                  meanPt.shape = "rect";
                  this.__data__.points.set(meanPt.ID, meanPt);
                  pointsLayer.__data__.objects.set(meanPt.ID, meanPt);
                  const bounds = config.showCI ? readIntervalBounds(row, dims[0], dims[1]) : null;
                  if (!bounds) {
                    const stale = this._ciRects.get(group);
                    if (stale) {
                      stale.remove();
                      this._ciRects.delete(group);
                    }
                  } else {
                    const rect_x = bounds.x_low * pointScale;
                    const rect_y = -bounds.y_high * pointScale;
                    const rect_width = (bounds.x_high - bounds.x_low) * pointScale;
                    const rect_height = (bounds.y_high - bounds.y_low) * pointScale;
                    capMeanToInterval(meanPt, rect_width / 2, rect_height / 2);
                    let el = this._ciRects.get(group);
                    if (!el) {
                      el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                      el.setAttribute("data-ci-group", group);
                      this._ciRects.set(group, el);
                    }
                    el.setAttribute("x", rect_x.toString());
                    el.setAttribute("y", rect_y.toString());
                    el.setAttribute("width", rect_width.toString());
                    el.setAttribute("height", rect_height.toString());
                    el.setAttribute("fill", "none");
                    el.setAttribute("stroke", color);
                    el.setAttribute("stroke-width", sw.toString());
                    el.setAttribute("stroke-opacity", "0.8");
                    el.setAttribute("stroke-dasharray", `${sw * 4} ${sw * 3}`);
                    if (pointsLayerSvg && !el.parentElement) {
                      pointsLayerSvg.insertBefore(el, pointsLayerSvg.firstChild);
                    }
                  }
                });
              } else {
                Object.entries(groupSums).forEach(([group, { x, y, n, color }]) => {
                  const meanPt = new Point({
                    ID: `mean-${group}`,
                    dimensions: [x / n * pointScale, -(y / n) * pointScale],
                    meta: { kind: "mean", name: group, group, fixedSize: config.meanFixedSize }
                  });
                  meanPt.color = new Color(color);
                  meanPt.size = 4;
                  meanPt.shape = "rect";
                  this.__data__.points.set(meanPt.ID, meanPt);
                  pointsLayer.__data__.objects.set(meanPt.ID, meanPt);
                });
                const showCI = config.showCI;
                if (showCI) {
                  this._ciRects.forEach((el, g) => {
                    if (!groupSums[g]) {
                      el.remove();
                      this._ciRects.delete(g);
                    }
                  });
                  if ((_h = model.confidence) == null ? void 0 : _h.rows) {
                    model.confidence.rows().forEach((row) => {
                      const groupIdx = row.names.indexOf(groupColName ?? "group");
                      const group = groupIdx >= 0 ? String(row[groupIdx]) : row.rowName ?? null;
                      if (!group) return;
                      const color = groupColorMap[group] ?? "#888888";
                      const bounds = readIntervalBounds(row, dims[0], dims[1]);
                      if (!bounds) return;
                      const rect_x = bounds.x_low * pointScale;
                      const rect_y = -bounds.y_high * pointScale;
                      const rect_width = (bounds.x_high - bounds.x_low) * pointScale;
                      const rect_height = (bounds.y_high - bounds.y_low) * pointScale;
                      capMeanToInterval(
                        this.__data__.points.get(`mean-${group}`),
                        rect_width / 2,
                        rect_height / 2
                      );
                      let el = this._ciRects.get(group);
                      if (!el) {
                        el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        el.setAttribute("data-ci-group", group);
                        this._ciRects.set(group, el);
                      }
                      el.setAttribute("x", rect_x.toString());
                      el.setAttribute("y", rect_y.toString());
                      el.setAttribute("width", rect_width.toString());
                      el.setAttribute("height", rect_height.toString());
                      el.setAttribute("fill", "none");
                      el.setAttribute("stroke", color);
                      el.setAttribute("stroke-width", sw.toString());
                      el.setAttribute("stroke-opacity", "0.8");
                      el.setAttribute("stroke-dasharray", `${sw * 4} ${sw * 3}`);
                      if (pointsLayerSvg && !el.parentElement) {
                        pointsLayerSvg.insertBefore(el, pointsLayerSvg.firstChild);
                      }
                    });
                  } else {
                    Object.entries(groupSums).forEach(([group, { x, y, x2, y2, n, color }]) => {
                      if (n < 2) return;
                      const μx = x / n, μy = y / n;
                      const rawVarX = x2 / n - μx * μx;
                      const rawVarY = y2 / n - μy * μy;
                      const { halfW, halfH } = computeCIRect(rawVarX, rawVarY, n, pointScale);
                      const cx = μx * pointScale, cy = -μy * pointScale;
                      capMeanToInterval(
                        this.__data__.points.get(`mean-${group}`),
                        halfW,
                        halfH
                      );
                      let el = this._ciRects.get(group);
                      if (!el) {
                        el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        el.setAttribute("data-ci-group", group);
                        this._ciRects.set(group, el);
                      }
                      el.setAttribute("x", (cx - halfW).toString());
                      el.setAttribute("y", (cy - halfH).toString());
                      el.setAttribute("width", (halfW * 2).toString());
                      el.setAttribute("height", (halfH * 2).toString());
                      el.setAttribute("fill", "none");
                      el.setAttribute("stroke", color);
                      el.setAttribute("stroke-width", sw.toString());
                      el.setAttribute("stroke-opacity", "0.8");
                      el.setAttribute("stroke-dasharray", `${sw * 4} ${sw * 3}`);
                      if (pointsLayerSvg && !el.parentElement) {
                        pointsLayerSvg.insertBefore(el, pointsLayerSvg.firstChild);
                      }
                    });
                  }
                }
                if ((_i = model.outlier) == null ? void 0 : _i.rows) {
                  this._outlierRects.forEach((el, g) => {
                    if (!groupColorMap[g]) {
                      el.remove();
                      this._outlierRects.delete(g);
                    }
                  });
                  model.outlier.rows().forEach((row) => {
                    const groupIdx = row.names.indexOf(groupColName ?? "group");
                    const group = groupIdx >= 0 ? String(row[groupIdx]) : row.rowName ?? null;
                    if (!group) return;
                    const color = groupColorMap[group] ?? "#888888";
                    const bounds = readIntervalBounds(row, dims[0], dims[1]);
                    if (!bounds) return;
                    const rect_x = bounds.x_low * pointScale;
                    const rect_y = -bounds.y_high * pointScale;
                    const rect_width = (bounds.x_high - bounds.x_low) * pointScale;
                    const rect_height = (bounds.y_high - bounds.y_low) * pointScale;
                    let el = this._outlierRects.get(group);
                    if (!el) {
                      el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                      el.setAttribute("data-outlier-group", group);
                      this._outlierRects.set(group, el);
                    }
                    el.setAttribute("x", rect_x.toString());
                    el.setAttribute("y", rect_y.toString());
                    el.setAttribute("width", rect_width.toString());
                    el.setAttribute("height", rect_height.toString());
                    el.setAttribute("fill", "none");
                    el.setAttribute("stroke", color);
                    el.setAttribute("stroke-width", sw.toString());
                    el.setAttribute("stroke-opacity", "0.5");
                    el.setAttribute("stroke-dasharray", `${sw * 2} ${sw * 2}`);
                    if (pointsLayerSvg && !el.parentElement) {
                      pointsLayerSvg.insertBefore(el, pointsLayerSvg.firstChild);
                    }
                  });
                }
              }
            }
            if (labelSvg) {
              this._pointLabels.forEach((lbl, id) => {
                if (!pointsLayer.__data__.objects.get(id)) {
                  lbl.remove();
                  this._pointLabels.delete(id);
                }
              });
              this._meanLabels.forEach((lbl, id) => {
                if (!pointsLayer.__data__.objects.get(`mean-${id}`)) {
                  lbl.remove();
                  this._meanLabels.delete(id);
                }
              });
              if (labelPoints !== 0) {
                model.points.rows().forEach((row) => {
                  const qIdx = row.names.indexOf(unitIdCol);
                  const unitId = qIdx >= 0 ? String(row[qIdx]) : null;
                  if (!unitId) return;
                  const pt = pointsLayer.__data__.objects.get(unitId);
                  if (!pt) return;
                  const displayText = unitId;
                  let lbl = this._pointLabels.get(unitId);
                  if (!lbl) {
                    lbl = new QELabel(displayText, pt, labelSvg, this, labelPoints);
                    this._pointLabels.set(unitId, lbl);
                  } else {
                    labelPoints === Label.DISPLAY_TYPES.ON ? lbl.show() : lbl.hide();
                  }
                });
              }
              if (labelMeans !== 0) {
                const meanGroupNames = hasGroupsFrame ? activeGroupRows.map((r) => r.rowName ?? String(r[0])) : Object.keys(groupSums);
                meanGroupNames.forEach((group) => {
                  const meanId = `mean-${group}`;
                  const pt = pointsLayer.__data__.objects.get(meanId);
                  if (!pt) return;
                  let lbl = this._meanLabels.get(group);
                  if (!lbl) {
                    lbl = new QELabel(group, pt, labelSvg, this, labelMeans);
                    this._meanLabels.set(group, lbl);
                  } else {
                    labelMeans === Label.DISPLAY_TYPES.ON ? lbl.show() : lbl.hide();
                  }
                });
              }
            }
            pointsLayer.__data__.__state__.setVariable("layer_updated", pointsLayer.__data__);
          }
        }
        const trajectoriesLayer = this.__children__.search("__children__", "trajectories");
        const trajectoriesEnabled = config.showTrajectories;
        if (trajectoriesEnabled && trajectoriesLayer) {
          trajectoriesLayer.__data__.objects.clear();
          this.__data__.trajectories.clear();
          const trajSource = ((_j = model.trajectories) == null ? void 0 : _j.rows) ? model.trajectories : model.points;
          if (trajSource == null ? void 0 : trajSource.rows) {
            const unitRows = {};
            const selectedUnits = config.trajectoryUnits ? config.trajectoryUnits.split(",").map((s) => s.trim()) : null;
            trajSource.rows().forEach((row) => {
              const uIdx = row.names.indexOf(unitIdCol) >= 0 ? row.names.indexOf(unitIdCol) : row.names.indexOf("unit") >= 0 ? row.names.indexOf("unit") : row.names.indexOf("ENA_UNIT") >= 0 ? row.names.indexOf("ENA_UNIT") : -1;
              const unit = uIdx >= 0 ? String(row[uIdx]) : row.rowName || "unit-1";
              if (selectedUnits && !selectedUnits.includes(unit)) return;
              const xIdx = row.names.indexOf(dims[0]);
              const yIdx = dims.length > 1 ? row.names.indexOf(dims[1]) : -1;
              const tIdx = row.names.indexOf("time") >= 0 ? row.names.indexOf("time") : row.names.indexOf("ActivityNumber") >= 0 ? row.names.indexOf("ActivityNumber") : row.names.indexOf("RowID") >= 0 ? row.names.indexOf("RowID") : -1;
              const time = tIdx >= 0 ? Number(row[tIdx]) : unitRows[unit] ? unitRows[unit].length + 1 : 1;
              if (xIdx >= 0 && yIdx >= 0) {
                if (!unitRows[unit]) unitRows[unit] = [];
                unitRows[unit].push({
                  x: Number(row[xIdx]) * pointScale,
                  y: -Number(row[yIdx]) * pointScale,
                  time
                });
              }
            });
            const unitKeys = Object.keys(unitRows);
            unitKeys.forEach((unitKey, uIdx) => {
              const rawPts = unitRows[unitKey];
              if (rawPts.length === 0) return;
              const colorStr = GROUP_PALETTE[uIdx % GROUP_PALETTE.length];
              const trajObj = new Trajectory({
                ID: `traj-${unitKey}`,
                unitId: unitKey,
                color: new Color(colorStr),
                lineStyle: config.trajectoryLineStyle,
                strokeWidth: config.trajectoryStrokeWidth,
                strokeWidthRange: config.trajectoryStrokeWidthRange,
                opacityRange: config.trajectoryOpacityRange,
                smooth: config.trajectorySmooth,
                maxDegree: config.trajectoryMaxDegree,
                degreeSelection: config.trajectoryDegreeSelection,
                currentTime: config.trajectoryPlayhead ?? Infinity,
                showPoints: config.trajectoryShowPoints,
                showTips: config.trajectoryShowTips,
                points: rawPts.map((p) => ({ x: p.x, y: p.y, time: p.time }))
              });
              this.__data__.trajectories.set(unitKey, trajObj);
              trajectoriesLayer.__data__.objects.set(trajObj.ID, trajObj);
            });
          }
          trajectoriesLayer.__data__.__state__.setVariable("layer_updated", trajectoriesLayer.__data__);
        }
        const networkLayer = this.__children__.search("__children__", "network");
        const edgeLayer = networkLayer == null ? void 0 : networkLayer.__children__.search("__children__", "edges");
        const nodeLayer = networkLayer == null ? void 0 : networkLayer.__children__.search("__children__", "nodes");
        const edgenodeLayer = networkLayer == null ? void 0 : networkLayer.__children__.search("__children__", "edgenodes");
        const edgesEnabled = config.showEdges;
        if (((_k = model.nodes) == null ? void 0 : _k.rows) && nodeLayer) {
          model.nodes.rows().forEach((row) => {
            const pt = rowToPoint(row, nodeIdCol, "#444444");
            pt.size = 2;
            pt.meta = { ...pt.meta ?? {}, kind: "node", name: pt.ID };
            nodeLayer.__data__.objects.set(pt.ID, pt);
          });
          if (edgesEnabled && edgeLayer && ((_l = model.edges) == null ? void 0 : _l.rows)) {
            const unitGroupMap = {};
            if (groupColName && ((_m = model.points) == null ? void 0 : _m.rows)) {
              model.points.rows().forEach((row) => {
                const qIdx = row.names.indexOf(unitIdCol);
                const gIdx = row.names.indexOf(groupColName);
                if (qIdx >= 0 && gIdx >= 0) unitGroupMap[String(row[qIdx])] = String(row[gIdx]);
              });
            }
            const codeNames = model.nodes.rows().map((r) => {
              const idx = r.names.indexOf(nodeIdCol);
              return idx >= 0 ? String(r[idx]) : "";
            }).filter(Boolean);
            const edgePairs = [];
            (model.edges.names ?? []).forEach((col) => {
              const pair = parseEdgePair(col, codeNames);
              if (pair) edgePairs.push({ col, pair });
            });
            const getUnitEdges = /* @__PURE__ */ __name((unitId) => {
              const result = {};
              model.edges.rows().forEach((row) => {
                const qIdx = row.names.indexOf(unitIdCol);
                if (qIdx < 0 || String(row[qIdx]) !== unitId) return;
                edgePairs.forEach(({ col }) => {
                  const colIdx = row.names.indexOf(col);
                  if (colIdx >= 0) result[col] = Number(row[colIdx]) || 0;
                });
              });
              return result;
            }, "getUnitEdges");
            const getGroupEdges = /* @__PURE__ */ __name((groupName) => {
              const sums = {};
              let count = 0;
              model.edges.rows().forEach((row) => {
                const qIdx = row.names.indexOf(unitIdCol);
                const unitId = qIdx >= 0 ? String(row[qIdx]) : null;
                const gColIdx = groupColName ? row.names.indexOf(groupColName) : -1;
                const group = gColIdx >= 0 ? String(row[gColIdx]) : unitId ? unitGroupMap[unitId] : null;
                if (group !== groupName) return;
                count++;
                edgePairs.forEach(({ col }) => {
                  const colIdx = row.names.indexOf(col);
                  if (colIdx >= 0) {
                    const v = Number(row[colIdx]);
                    if (!isNaN(v)) sums[col] = (sums[col] ?? 0) + v;
                  }
                });
              });
              if (count === 0) return {};
              const result = {};
              edgePairs.forEach(({ col }) => {
                result[col] = (sums[col] ?? 0) / count;
              });
              return result;
            }, "getGroupEdges");
            const resolve = /* @__PURE__ */ __name((id) => {
              if (groupColorMap[id]) {
                return { weights: getGroupEdges(id), color: groupColorMap[id], label: id };
              }
              const groupOfUnit = unitGroupMap[id] ?? null;
              const color = groupOfUnit ? groupColorMap[groupOfUnit] ?? "#888888" : "#888888";
              return { weights: getUnitEdges(id), color, label: id };
            }, "resolve");
            const unitAttr = config.edgeUnit;
            const groupAttr = config.edgeGroup;
            const compareAttr = config.edgeCompare;
            const alsoAttr = config.edgeAlso;
            const primaryId = unitAttr ?? groupAttr ?? null;
            const primary = primaryId ? resolve(primaryId) : null;
            const secondaryId = compareAttr ?? alsoAttr ?? null;
            const secondary = secondaryId ? resolve(secondaryId) : null;
            const isSubtract = !!compareAttr;
            const isOverlay = !!alsoAttr;
            const drawEdges = [];
            if (primary && (isSubtract || isOverlay) && secondary) {
              if (isSubtract) {
                edgePairs.forEach(({ col, pair }) => {
                  const diff = (primary.weights[col] ?? 0) - (secondary.weights[col] ?? 0);
                  if (Math.abs(diff) < 1e-6) return;
                  drawEdges.push({ col, pair, weight: Math.abs(diff), color: diff > 0 ? primary.color : secondary.color });
                });
              } else {
                edgePairs.forEach(({ col, pair }) => {
                  const wA = primary.weights[col] ?? 0;
                  const wB = secondary.weights[col] ?? 0;
                  if (wA > 0) drawEdges.push({ col: col + "-a", pair, weight: wA, color: primary.color });
                  if (wB > 0) drawEdges.push({ col: col + "-b", pair, weight: wB, color: secondary.color });
                });
              }
            } else if (primary) {
              edgePairs.forEach(({ col, pair }) => {
                const w = primary.weights[col] ?? 0;
                if (w > 0) drawEdges.push({ col, pair, weight: w, color: primary.color });
              });
            }
            const isDirected = !!model.directed;
            const nonSelfWeights = drawEdges.filter((e2) => e2.pair[0] !== e2.pair[1]).map((e2) => e2.weight);
            const maxEdgeWeight = nonSelfWeights.length > 0 ? Math.max(...nonSelfWeights) : 1e-9;
            const selfWeights = drawEdges.filter((e2) => e2.pair[0] === e2.pair[1]).map((e2) => e2.weight);
            const maxSelfWeight = selfWeights.length > 0 ? Math.max(...selfWeights) : 0;
            const nodeWeightSum = {};
            drawEdges.forEach(({ pair, weight }) => {
              const isSelf = pair[0] === pair[1];
              if (isSelf && !isDirected) return;
              nodeWeightSum[pair[0]] = (nodeWeightSum[pair[0]] ?? 0) + weight;
              if (!isSelf) {
                nodeWeightSum[pair[1]] = (nodeWeightSum[pair[1]] ?? 0) + weight;
              }
            });
            const maxNodeWeight = Math.max(1, ...Object.values(nodeWeightSum));
            const nodeSizes = {};
            model.nodes.rows().forEach((row) => {
              const codeIdx = row.names.indexOf(nodeIdCol);
              const id = codeIdx >= 0 ? String(row[codeIdx]) : "";
              if (!id) return;
              const pt = nodeLayer.__data__.objects.get(id);
              if (!pt) return;
              const w = nodeWeightSum[id] ?? 0;
              pt.size = 2 + w / maxNodeWeight * 3;
              nodeSizes[id] = pt.size;
            });
            const totalWeightByPair = {};
            if (isDirected) {
              drawEdges.forEach(({ pair, weight }) => {
                const key = `${pair[0]}.${pair[1]}`;
                totalWeightByPair[key] = (totalWeightByPair[key] ?? 0) + weight;
              });
            }
            drawEdges.forEach(({ col, pair, weight, color }) => {
              const fromNode = nodeLayer.__data__.objects.get(pair[0]);
              const toNode = nodeLayer.__data__.objects.get(pair[1]);
              if (!fromNode || !toNode) return;
              const isSelf = pair[0] === pair[1];
              if (isSelf && !isDirected) return;
              const classMax = isSelf ? Math.max(maxSelfWeight, 1e-9) : maxEdgeWeight;
              const opacity = Math.min(1, weight / classMax);
              const fromPt = new Point({ ID: `${pair[0]}-src`, dimensions: [fromNode.x, fromNode.y], meta: {} });
              const toPt = new Point({ ID: `${pair[1]}-dst`, dimensions: [toNode.x, toNode.y], meta: {} });
              let edgeLine;
              if (isSelf) {
                edgeLine = new NodeEdge({}, fromPt, toPt);
                edgeLine.weight = 0;
              } else if (isDirected) {
                const fwd = totalWeightByPair[`${pair[0]}.${pair[1]}`] ?? weight;
                const bwd = totalWeightByPair[`${pair[1]}.${pair[0]}`] ?? 0;
                const totalweight = fwd + bwd;
                edgeLine = new TaperedWeightedMidpointEdge(
                  { weight, totalweight },
                  fromPt,
                  toPt
                );
              } else {
                edgeLine = new Line({}, fromPt, toPt);
              }
              edgeLine.ID = `edge-${col}`;
              edgeLine.color = new Color(color);
              edgeLine.meta = {
                isMeanEdge: true,
                weight,
                // NodeEdge compares within the self-loop class; cross-pair edges
                // compare within their own class.  Store the correct denominator
                // so QELine.update() can compute opacity and display size properly.
                maxWeight: isSelf ? maxSelfWeight : maxEdgeWeight,
                opacity,
                isDirected,
                isSelf,
                // nodeSize is needed by QELine.update() to compute the NodeEdge
                // display radius at update time (when extremes.x_max is available).
                nodeSize: isSelf ? nodeSizes[pair[0]] ?? 2 : void 0,
                // Identity for the qe-edge-* interaction events.
                source: pair[0],
                target: pair[1],
                group: groupAttr ?? void 0,
                unit: unitAttr ?? void 0
              };
              const targetLayer = isSelf ? edgenodeLayer ?? edgeLayer : edgeLayer;
              targetLayer.__data__.objects.set(edgeLine.ID, edgeLine);
            });
            edgeLayer.__data__.__state__.setVariable("layer_updated", edgeLayer.__data__);
            if (edgenodeLayer) edgenodeLayer.__data__.__state__.setVariable("layer_updated", edgenodeLayer.__data__);
          }
          const nodesVisible = config.showNodes;
          if (nodeLayer.svg_element) {
            nodeLayer.svg_element.style.display = nodesVisible ? "" : "none";
          }
          if (!nodesVisible) {
            this._nodeLabels.forEach((lbl) => lbl.remove());
            this._nodeLabels.clear();
          }
          if (labelSvg && labelNodes !== 0 && nodesVisible) {
            this._nodeLabels.forEach((lbl, id) => {
              if (!nodeLayer.__data__.objects.get(id)) {
                lbl.remove();
                this._nodeLabels.delete(id);
              }
            });
            model.nodes.rows().forEach((row) => {
              const codeIdx = row.names.indexOf(nodeIdCol);
              const id = codeIdx >= 0 ? String(row[codeIdx]) : "";
              if (!id) return;
              const pt = nodeLayer.__data__.objects.get(id);
              if (!pt) return;
              let lbl = this._nodeLabels.get(id);
              if (!lbl) {
                lbl = new QELabel(id, pt, labelSvg, this, labelNodes);
                this._nodeLabels.set(id, lbl);
              } else {
                labelNodes === Label.DISPLAY_TYPES.ON ? lbl.show() : lbl.hide();
              }
            });
          }
          nodeLayer.__data__.__state__.setVariable("layer_updated", nodeLayer.__data__);
        }
        const axisPointsLayer = this.__children__.search("__children__", "axis_points");
        const axisLinesLayer = this.__children__.search("__children__", "axis_lines");
        if (axisPointsLayer) this.__data__.__state__.setVariable("graph_updated_axis_points", axisPointsLayer.__data__.objects);
        if (axisLinesLayer) this.__data__.__state__.setVariable("graph_updated_axis_lines", axisLinesLayer.__data__.objects);
        this.update();
        if (tweenFrom) this._runTween(tweenFrom);
      });
    }
    static get observedAttributes() {
      return [
        "width",
        "height",
        "for",
        "scale-points",
        "labels",
        "label-nodes",
        "label-means",
        "label-points"
      ];
    }
    get vizena() {
      return this._vizena;
    }
    // ── Shared re-render scheduler ───────────────────────────────────────────────
    // Batches synchronous attribute / child-list changes into a single microtask
    // so that e.g. adding <qe-edges> and setting its attributes in the same tick
    // only triggers one render cycle.
    _scheduleRerender() {
      if (!this._vizena || !this._hasModel) return;
      if (this._renderPending) return;
      this._renderPending = true;
      queueMicrotask(() => {
        var _a;
        this._renderPending = false;
        (_a = this._vizena) == null ? void 0 : _a.dispatchEvent(new CustomEvent("model-updated", {
          detail: this._vizena.model,
          bubbles: true,
          composed: true
        }));
      });
    }
    // ── Layer configuration reader ────────────────────────────────────────────────
    // Reads child element presence / attributes to determine what each layer
    // should render.  Called once at the top of every model-updated handler so
    // all rendering decisions are derived from a single snapshot.
    _readLayerConfig() {
      const nodesEl = this.querySelector("qe-nodes");
      const meansEl = this.querySelector("qe-means");
      const pointsEl = this.querySelector("qe-points");
      const edgesEl = this.querySelector("qe-edges");
      const trajectoriesEl = this.querySelector("qe-trajectories");
      const axesEl = this.querySelector("qe-axes");
      const labelsShorthand = this.getAttribute("labels");
      return {
        // Nodes — always placed from the model (they anchor the coordinate
        // space); <qe-nodes> presence draws them, like every other layer.
        labelNodes: parseLabelMode(
          (nodesEl == null ? void 0 : nodesEl.getAttribute("label")) ?? this.getAttribute("label-nodes") ?? labelsShorthand,
          Label.DISPLAY_TYPES.ON
        ),
        showNodes: !!nodesEl,
        scalePoints: this.getAttribute("scale-points") !== "false",
        // Means — presence of <qe-means> = show; absence = hide.
        showMeans: !!meansEl,
        activeMeanGroups: (meansEl == null ? void 0 : meansEl.getAttribute("groups")) ?? null,
        showCI: !!meansEl && meansEl.hasAttribute("confidence"),
        labelMeans: parseLabelMode(
          (meansEl == null ? void 0 : meansEl.getAttribute("label")) ?? this.getAttribute("label-means") ?? labelsShorthand,
          Label.DISPLAY_TYPES.ON
        ),
        // fixed-size keeps mean markers a constant on-screen px size (webENA parity).
        meanFixedSize: !!meansEl && meansEl.hasAttribute("fixed-size"),
        // Points — presence of <qe-points> = show unit dots.
        showPoints: !!pointsEl,
        labelPoints: parseLabelMode(
          (pointsEl == null ? void 0 : pointsEl.getAttribute("label")) ?? this.getAttribute("label-points") ?? labelsShorthand,
          Label.DISPLAY_TYPES.OFF
        ),
        pointSize: (pointsEl == null ? void 0 : pointsEl.getAttribute("size")) ? parseFloat(pointsEl.getAttribute("size")) : null,
        // fixed-size keeps unit dots a constant on-screen px size (webENA parity).
        pointFixedSize: !!pointsEl && pointsEl.hasAttribute("fixed-size"),
        // Edges — presence of <qe-edges> = draw a network.
        showEdges: !!edgesEl,
        edgeGroup: (edgesEl == null ? void 0 : edgesEl.getAttribute("group")) ?? null,
        edgeUnit: (edgesEl == null ? void 0 : edgesEl.getAttribute("unit")) ?? null,
        edgeCompare: (edgesEl == null ? void 0 : edgesEl.getAttribute("compare")) ?? null,
        edgeAlso: (edgesEl == null ? void 0 : edgesEl.getAttribute("also")) ?? null,
        // Trajectories — presence of <qe-trajectories> = draw cognitive trajectories
        showTrajectories: !!trajectoriesEl,
        trajectoryUnits: (trajectoriesEl == null ? void 0 : trajectoriesEl.getAttribute("units")) ?? null,
        trajectorySmooth: (trajectoriesEl == null ? void 0 : trajectoriesEl.getAttribute("smooth")) ?? "none",
        trajectoryMaxDegree: (trajectoriesEl == null ? void 0 : trajectoriesEl.getAttribute("max-degree")) ? parseInt(trajectoriesEl.getAttribute("max-degree"), 10) : 3,
        trajectoryDegreeSelection: (trajectoriesEl == null ? void 0 : trajectoriesEl.getAttribute("degree-selection")) ?? "loocv_2d",
        trajectoryShowPoints: (trajectoriesEl == null ? void 0 : trajectoriesEl.getAttribute("points")) !== "false",
        trajectoryShowTips: (trajectoriesEl == null ? void 0 : trajectoriesEl.getAttribute("tips")) !== "false",
        trajectoryPlayhead: (trajectoriesEl == null ? void 0 : trajectoriesEl.getAttribute("playhead")) ? parseFloat(trajectoriesEl.getAttribute("playhead")) : null,
        trajectoryLineStyle: (trajectoriesEl == null ? void 0 : trajectoriesEl.getAttribute("line-style")) ?? "uniform",
        trajectoryStrokeWidth: (trajectoriesEl == null ? void 0 : trajectoriesEl.getAttribute("stroke-width")) ? parseFloat(trajectoriesEl.getAttribute("stroke-width")) : 2,
        trajectoryStrokeWidthRange: this._parseNumberPair(trajectoriesEl == null ? void 0 : trajectoriesEl.getAttribute("stroke-width-range"), [1, 6]),
        trajectoryOpacityRange: this._parseNumberPair(trajectoriesEl == null ? void 0 : trajectoriesEl.getAttribute("opacity-range"), [0.3, 1]),
        // Axes — presence of <qe-axes> = draw axis lines. The x / y attributes add
        // a per-axis label: a value is used verbatim, an empty attribute falls back
        // to the dimension name (resolved later, where dims are known). null = no
        // label for that axis.
        showAxes: !!axesEl,
        axisXLabel: (axesEl == null ? void 0 : axesEl.hasAttribute("x")) ? axesEl.getAttribute("x") ?? "" : null,
        axisYLabel: (axesEl == null ? void 0 : axesEl.hasAttribute("y")) ? axesEl.getAttribute("y") ?? "" : null
      };
    }
    _parseNumberPair(value, fallback) {
      if (!value) return fallback;
      const parts = value.split(",").map((part) => Number(part.trim()));
      if (parts.length < 2 || !parts.every(Number.isFinite)) return fallback;
      return [parts[0], parts[1]];
    }
    attributeChangedCallback(_name2, oldValue, newValue) {
      if (oldValue === newValue) return;
      this._scheduleRerender();
    }
    connectedCallback() {
      var _a;
      const w = this.getAttribute("width");
      const h = this.getAttribute("height");
      this.style.display = "block";
      if (w) this.style.width = isNaN(Number(w)) ? w : `${w}px`;
      if (h) this.style.height = isNaN(Number(h)) ? h : `${h}px`;
      this.appendChild(this.svg_element);
      _QEGraphElement._instances.add(this);
      this._childObserver = new MutationObserver(() => this._scheduleRerender());
      this._childObserver.observe(this, {
        childList: true,
        attributes: true,
        subtree: true,
        attributeFilter: [
          "group",
          "unit",
          "compare",
          "also",
          "groups",
          "confidence",
          "label",
          "scale-points",
          "labels",
          "label-nodes",
          "label-means",
          "label-points",
          "units",
          "smooth",
          "degree",
          "points",
          "tips",
          "playhead",
          "line-style",
          "stroke-width",
          "stroke-width-range",
          "opacity-range",
          "x",
          "y",
          "size",
          "fixed-size"
        ]
      });
      const forId = this.getAttribute("for");
      this._vizena = (forId ? document.getElementById(forId) : null) ?? this.closest("qe-visual") ?? ((_a = this.parentElement) == null ? void 0 : _a.closest("qe-visual")) ?? document.querySelector("qe-visual");
      this.draw();
      const labelsLayer = this.__children__.search("__children__", "labels");
      if (labelsLayer == null ? void 0 : labelsLayer.svg_element) {
        this._labelsGroup = labelsLayer.svg_element;
      } else {
        console.warn("[ena-graph] labels layer not found in layer tree; creating fallback <g>");
        const graphLayer = this.__children__[0];
        if (graphLayer == null ? void 0 : graphLayer.svg_element) {
          this._labelsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
          this._labelsGroup.setAttribute("data-layer-name", "labels-fallback");
          graphLayer.svg_element.appendChild(this._labelsGroup);
        }
      }
    }
    disconnectedCallback() {
      var _a, _b;
      (_a = this._childObserver) == null ? void 0 : _a.disconnect();
      this._childObserver = null;
      _QEGraphElement._instances.delete(this);
      (_b = this._tooltipEl) == null ? void 0 : _b.remove();
      this._tooltipEl = null;
    }
    /** All connected <qe-graph> instances (newest membership order). */
    static instances() {
      return [..._QEGraphElement._instances];
    }
    /** Look up a graph by its `id` or `plot-group` attribute. */
    static getGraph(key) {
      for (const g of _QEGraphElement._instances) {
        if (g.id === key || g.getAttribute("plot-group") === key) return g;
      }
      return null;
    }
    /** Resolved code nodes with their current graph-space coordinates. */
    getNodes() {
      const layer = this.__children__.search("__children__", "nodes");
      if (!layer) return [];
      return [...layer.__data__.objects.values()].map((o) => {
        var _a;
        return {
          id: o.ID,
          name: ((_a = o.meta) == null ? void 0 : _a.name) ?? o.ID,
          x: o.x,
          y: o.y
        };
      });
    }
    /** Resolved edges of the current network with weights and direction. */
    getEdges() {
      const collect = /* @__PURE__ */ __name((name) => {
        const l = this.__children__.search("__children__", name);
        return l ? [...l.__data__.objects.values()] : [];
      }, "collect");
      return [...collect("edges"), ...collect("edgenodes")].map((o) => {
        const m = o.meta ?? {};
        return {
          source: m.source,
          target: m.target,
          weight: m.weight ?? 0,
          directed: !!m.isDirected,
          self: !!m.isSelf
        };
      }).filter((e) => e.source != null && e.target != null);
    }
    /** Marks (circles/rects), undirected edge lines, and directed / self-edge
     *  triangle paths all participate in tweening. */
    _tweenTargets() {
      return [...this.svg_element.querySelectorAll(
        "circle[data-point-id], rect[data-point-id], line[data-edge-source], path[data-edge-source]"
      )];
    }
    _readCoords(el) {
      const tag = el.tagName.toLowerCase();
      const n = /* @__PURE__ */ __name((a) => parseFloat(el.getAttribute(a) || "0"), "n");
      if (tag === "circle") return { t: "c", cx: n("cx"), cy: n("cy") };
      if (tag === "rect") return { t: "r", x: n("x"), y: n("y") };
      if (tag === "line") return { t: "l", x1: n("x1"), y1: n("y1"), x2: n("x2"), y2: n("y2") };
      if (tag === "path") {
        const d = el.getAttribute("d") || "";
        return { t: "p", d, nums: (d.match(_QEGraphElement._PATH_NUM_RE) || []).map(Number) };
      }
      return null;
    }
    /** Snapshot current tween-target positions keyed by element. */
    _captureTween() {
      const m = /* @__PURE__ */ new Map();
      this._tweenTargets().forEach((el) => {
        const c = this._readCoords(el);
        if (c) m.set(el, c);
      });
      return m;
    }
    /** Animate each still-present element from its snapshot to its new position. */
    _runTween(from) {
      if (this._tweenRaf !== null) {
        cancelAnimationFrame(this._tweenRaf);
        this._tweenRaf = null;
      }
      const to = /* @__PURE__ */ new Map();
      this._tweenTargets().forEach((el) => {
        if (from.has(el)) {
          const c = this._readCoords(el);
          if (c) to.set(el, c);
        }
      });
      if (!to.size) return;
      const dur = this._animateMs;
      const t0 = performance.now();
      const ease = /* @__PURE__ */ __name((t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, "ease");
      const lerp = /* @__PURE__ */ __name((a, b, k) => a + (b - a) * k, "lerp");
      const step = /* @__PURE__ */ __name((now) => {
        const t = Math.min(1, (now - t0) / dur);
        const k = ease(t);
        to.forEach((nc, el) => {
          const oc = from.get(el);
          if (!oc || oc.t !== nc.t) return;
          if (nc.t === "c") {
            el.setAttribute("cx", String(lerp(oc.cx, nc.cx, k)));
            el.setAttribute("cy", String(lerp(oc.cy, nc.cy, k)));
          } else if (nc.t === "r") {
            el.setAttribute("x", String(lerp(oc.x, nc.x, k)));
            el.setAttribute("y", String(lerp(oc.y, nc.y, k)));
          } else if (nc.t === "l") {
            el.setAttribute("x1", String(lerp(oc.x1, nc.x1, k)));
            el.setAttribute("y1", String(lerp(oc.y1, nc.y1, k)));
            el.setAttribute("x2", String(lerp(oc.x2, nc.x2, k)));
            el.setAttribute("y2", String(lerp(oc.y2, nc.y2, k)));
          } else {
            if (!oc.nums || oc.nums.length !== nc.nums.length) return;
            let i = 0;
            const d = nc.d.replace(
              _QEGraphElement._PATH_NUM_RE,
              () => String(lerp(oc.nums[i], nc.nums[i++], k))
            );
            el.setAttribute("d", d);
          }
        });
        this._tweenRaf = t < 1 ? requestAnimationFrame(step) : null;
      }, "step");
      this._tweenRaf = requestAnimationFrame(step);
    }
    /** Serialize the current plot as a standalone SVG string (webENA P2.3). */
    toSVG() {
      const svg = this.svg_element.cloneNode(true);
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
      const rect = this.svg_element.getBoundingClientRect();
      if (rect.width) svg.setAttribute("width", String(Math.round(rect.width)));
      if (rect.height) svg.setAttribute("height", String(Math.round(rect.height)));
      return new XMLSerializer().serializeToString(svg);
    }
    /** Rasterize the current plot to a PNG data URL (webENA P2.3). `scale`
     *  multiplies the pixel dimensions for a higher-resolution image. */
    toPNG(scale = 2) {
      const svgStr = this.toSVG();
      const rect = this.svg_element.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      return new Promise((resolve, reject) => {
        const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = w * scale;
            canvas.height = h * scale;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              URL.revokeObjectURL(url);
              reject(new Error("no 2d context"));
              return;
            }
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/png"));
          } catch (err) {
            URL.revokeObjectURL(url);
            reject(err);
          }
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        img.src = url;
      });
    }
    /** Unit points with their current graph-space coordinates. */
    getPoints() {
      const layer = this.__children__.search("__children__", "points");
      if (!layer) return [];
      return [...layer.__data__.objects.values()].filter((o) => {
        var _a;
        return ((_a = o.meta) == null ? void 0 : _a.kind) === "point";
      }).map((o) => {
        var _a;
        return { id: o.ID, group: (_a = o.meta) == null ? void 0 : _a.group, x: o.x, y: o.y };
      });
    }
    /** Ids of unit points inside a graph-space rectangle (for drag/lasso select). */
    pointsInRect(rect) {
      return this.getPoints().filter((p) => p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h).map((p) => p.id);
    }
    /** Order-independent key so an undirected pair matches either direction. */
    _edgeKey(a, b) {
      return a <= b ? `${a}\0${b}` : `${b}\0${a}`;
    }
    /** Mark edges/nodes as highlighted. Replaces the previous selection. */
    setHighlight(sel) {
      this._highlight.edges = new Set((sel.edges ?? []).map((e) => this._edgeKey(e.source, e.target)));
      this._highlight.nodes = new Set((sel.nodes ?? []).map(String));
      this._applyHighlights();
    }
    /** Clear all highlighting. */
    clearHighlight() {
      this._highlight.edges.clear();
      this._highlight.nodes.clear();
      this._applyHighlights();
    }
    _applyHighlights() {
      if (!this.svg_element) return;
      if (!this._highlightGroup) {
        this._highlightGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this._highlightGroup.setAttribute("data-layer-name", "highlight");
        this._highlightGroup.setAttribute("pointer-events", "none");
      }
      this.svg_element.appendChild(this._highlightGroup);
      const g = this._highlightGroup;
      g.textContent = "";
      const extent = this.__data__.extremes.x_max || 1;
      const HL = "#f5a623";
      const mk = /* @__PURE__ */ __name((tag, attrs) => {
        const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
        for (const k in attrs) el.setAttribute(k, String(attrs[k]));
        return el;
      }, "mk");
      if (this._highlight.edges.size) {
        const xy = {};
        this.getNodes().forEach((n) => {
          xy[n.id] = { x: n.x, y: n.y };
        });
        this._highlight.edges.forEach((key) => {
          const [a, b] = key.split("\0");
          const A = xy[a], B = xy[b];
          if (!A || !B) return;
          g.appendChild(mk("line", {
            x1: A.x,
            y1: A.y,
            x2: B.x,
            y2: B.y,
            stroke: HL,
            "stroke-width": extent * 0.02,
            "stroke-opacity": 0.6,
            "stroke-linecap": "round"
          }));
        });
      }
      this._highlight.nodes.forEach((id) => {
        var _a;
        const el = this.svg_element.querySelector(`[data-point-id="${((_a = window.CSS) == null ? void 0 : _a.escape) ? CSS.escape(id) : id}"]`);
        if (!el) return;
        const tag = el.tagName.toLowerCase();
        let cx, cy, r;
        if (tag === "rect") {
          const w = parseFloat(el.getAttribute("width") || "0");
          cx = parseFloat(el.getAttribute("x") || "0") + w / 2;
          cy = parseFloat(el.getAttribute("y") || "0") + parseFloat(el.getAttribute("height") || "0") / 2;
          r = w / 2;
        } else {
          cx = parseFloat(el.getAttribute("cx") || "0");
          cy = parseFloat(el.getAttribute("cy") || "0");
          r = parseFloat(el.getAttribute("r") || "0");
        }
        g.appendChild(mk("circle", {
          cx,
          cy,
          r: r * 1.7 + extent * 4e-3,
          fill: "none",
          stroke: HL,
          "stroke-width": extent * 6e-3
        }));
      });
    }
    create() {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("graph");
      svg.style.display = "block";
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.setAttribute("viewBox", this.__data__.extremes.as_viewBox());
      svg.setAttribute("transform", this.__data__.transform.toString());
      svg.setAttribute("role", "figure");
      svg.setAttribute("data-graph-size", `${Math.min(this.__data__.extremes.width, this.__data__.extremes.height)}`);
      this.svg_element = svg;
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const AW = 0.22, AH = 0.15;
      const makeArrow = /* @__PURE__ */ __name((id, fill) => {
        const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        m.setAttribute("id", id);
        m.setAttribute("markerWidth", String(AW));
        m.setAttribute("markerHeight", String(AH));
        m.setAttribute("refX", String(AW));
        m.setAttribute("refY", String(AH / 2));
        m.setAttribute("orient", "auto");
        m.setAttribute("markerUnits", "userSpaceOnUse");
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", `M0,0 L0,${AH} L${AW},${AH / 2} z`);
        p.setAttribute("fill", fill);
        m.appendChild(p);
        defs.appendChild(m);
      }, "makeArrow");
      GROUP_PALETTE.forEach((color) => makeArrow(`qe-arrow-${color.slice(1)}`, color));
      svg.appendChild(defs);
      this.__data__.layers.forEach((layer) => {
        const layer_g = new QELayer(layer, this.svg_element, this);
        this.__children__.push(layer_g);
      });
      this.__data__.__state__.setVariable("graph_updated", this.__data__);
      this.attach_events();
      return svg;
    }
    attach_events() {
      this.svg_element.addEventListener("wheel", (ev) => {
        console.log("Wheel event: ", ev);
        ev.preventDefault();
        const delta = Math.sign(ev.deltaY);
        if (delta < 0) {
          this.zoom_level *= 1.1;
        } else {
          this.zoom_level /= 1.1;
        }
        this.__data__.transform.zoom(this.zoom_level);
        this.update();
      });
      let isPanning = false;
      let startX, startY;
      this.svg_element.addEventListener("mousedown", (ev) => {
        isPanning = true;
        startX = ev.clientX;
        startY = ev.clientY;
      });
      let panAnimationFrame = null;
      let pendingPan = null;
      const panUpdate = /* @__PURE__ */ __name(() => {
        if (pendingPan) {
          this.__data__.transform.pan(pendingPan.dx, pendingPan.dy);
          this.__children__[0].svg_element.setAttribute("transform", this.__data__.transform.toString());
          pendingPan = null;
        }
        panAnimationFrame = null;
      }, "panUpdate");
      this.svg_element.addEventListener("mousemove", (ev) => {
        if (!isPanning) return;
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        pendingPan = { dx: dx / 100, dy: dy / 100 };
        startX = ev.clientX;
        startY = ev.clientY;
        if (panAnimationFrame === null) {
          panAnimationFrame = requestAnimationFrame(panUpdate);
        }
      });
      this.svg_element.addEventListener("mouseup", (ev) => {
        isPanning = false;
      });
      this.svg_element.addEventListener("point-clicked", ((ev) => {
        var _a, _b;
        const id = (_b = (_a = ev.detail) == null ? void 0 : _a.pointData) == null ? void 0 : _b.ID;
        if (!id) return;
        const lbl = this._pointLabels.get(id) ?? this._meanLabels.get(id.replace("mean-", "")) ?? this._nodeLabels.get(id);
        if (lbl && lbl.displayMode === Label.DISPLAY_TYPES.CLICK) lbl.toggle();
      }));
      const findPointId = /* @__PURE__ */ __name((el) => {
        var _a;
        while (el && el !== this.svg_element) {
          const id = (_a = el.getAttribute) == null ? void 0 : _a.call(el, "data-point-id");
          if (id) return id;
          el = el.parentElement;
        }
        return null;
      }, "findPointId");
      const getAutoLabel = /* @__PURE__ */ __name((id) => {
        return this._pointLabels.get(id) ?? this._meanLabels.get(id.replace(/^mean-/, "")) ?? this._nodeLabels.get(id);
      }, "getAutoLabel");
      this.svg_element.addEventListener("mouseover", (ev) => {
        const id = findPointId(ev.target);
        if (!id) return;
        const lbl = getAutoLabel(id);
        if ((lbl == null ? void 0 : lbl.displayMode) === Label.DISPLAY_TYPES.AUTO) lbl.show();
      });
      this.svg_element.addEventListener("mouseout", (ev) => {
        const id = findPointId(ev.target);
        if (!id) return;
        const related = ev.relatedTarget;
        const relatedId = findPointId(related);
        if (relatedId === id) return;
        const lbl = getAutoLabel(id);
        if ((lbl == null ? void 0 : lbl.displayMode) === Label.DISPLAY_TYPES.AUTO) lbl.hide();
      });
      this._attachInteractionEvents();
    }
    /** Emit a namespaced CustomEvent on the public element (bubbles + composed). */
    _emit(name, detail) {
      this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }
    /** Walk up from a hit element to the nearest ancestor carrying `attr`. */
    _closestWith(el, attr) {
      var _a, _b;
      while (el && el !== this.svg_element) {
        if (((_a = el.getAttribute) == null ? void 0 : _a.call(el, attr)) != null && ((_b = el.hasAttribute) == null ? void 0 : _b.call(el, attr))) return el;
        el = el.parentElement;
      }
      return null;
    }
    /** Resolve an edge hit element to a qe-edge-* detail, or null. */
    _edgeDetail(el) {
      const e = this._closestWith(el, "data-edge-source");
      if (!e) return null;
      const d = {
        source: e.getAttribute("data-edge-source"),
        target: e.getAttribute("data-edge-target"),
        weight: parseFloat(e.getAttribute("data-edge-weight") || "0"),
        directed: e.getAttribute("data-edge-directed") === "true",
        self: e.getAttribute("data-edge-self") === "true"
      };
      if (e.hasAttribute("data-edge-group")) d.group = e.getAttribute("data-edge-group");
      if (e.hasAttribute("data-edge-unit")) d.unit = e.getAttribute("data-edge-unit");
      return d;
    }
    /** Resolve a node/mean/point hit element to a qe-node-* detail, or null. */
    _nodeDetail(el) {
      const n = this._closestWith(el, "data-point-id");
      if (!n) return null;
      const tag = n.tagName.toLowerCase();
      let x, y;
      if (tag === "rect") {
        x = parseFloat(n.getAttribute("x") || "0") + parseFloat(n.getAttribute("width") || "0") / 2;
        y = parseFloat(n.getAttribute("y") || "0") + parseFloat(n.getAttribute("height") || "0") / 2;
      } else {
        x = parseFloat(n.getAttribute("cx") || "0");
        y = parseFloat(n.getAttribute("cy") || "0");
      }
      const id = n.getAttribute("data-point-id");
      const d = {
        id,
        kind: n.getAttribute("data-kind") || "point",
        name: n.getAttribute("data-name") || id,
        x,
        y
      };
      if (n.hasAttribute("data-group")) d.group = n.getAttribute("data-group");
      if (n.hasAttribute("data-unit")) d.unit = n.getAttribute("data-unit");
      return d;
    }
    _attachInteractionEvents() {
      const svg = this.svg_element;
      svg.addEventListener("click", (ev) => {
        const target = ev.target;
        const edge = this._edgeDetail(target);
        if (edge) {
          this._emit("qe-edge-click", { ...edge, originalEvent: ev });
          return;
        }
        const node = this._nodeDetail(target);
        if (node) this._emit("qe-node-click", { ...node, originalEvent: ev });
      });
      let hovered = null;
      const keyOf = /* @__PURE__ */ __name((t, d) => t === "edge" ? `${d.source}\0${d.target}` : String(d.id), "keyOf");
      svg.addEventListener("mousemove", (ev) => {
        const target = ev.target;
        const edge = this._edgeDetail(target);
        const node = edge ? null : this._nodeDetail(target);
        const next = edge ? { type: "edge", detail: edge } : node ? { type: "node", detail: node } : null;
        const nextKey = next ? keyOf(next.type, next.detail) : null;
        if (hovered && (!next || hovered.key !== nextKey)) {
          this._emit(hovered.type === "edge" ? "qe-edge-unhover" : "qe-node-unhover", { key: hovered.key });
          hovered = null;
        }
        if (next && (!hovered || hovered.key !== nextKey)) {
          this._emit(next.type === "edge" ? "qe-edge-hover" : "qe-node-hover", { ...next.detail, originalEvent: ev });
          hovered = { type: next.type, key: nextKey };
        }
        if (this.hasAttribute("tooltip") && next) {
          this._showTooltip(this._tooltipText(next.type, next.detail), ev.clientX, ev.clientY);
        } else {
          this._hideTooltip();
        }
      });
      svg.addEventListener("mouseleave", () => {
        if (hovered) {
          this._emit(hovered.type === "edge" ? "qe-edge-unhover" : "qe-node-unhover", { key: hovered.key });
          hovered = null;
        }
        this._hideTooltip();
      });
    }
    /** "source – target (weight)" for edges; the mark name for nodes/means/points. */
    _tooltipText(type, d) {
      if (type === "edge") {
        const w = Number(d.weight);
        const wStr = Number.isFinite(w) ? ` (${+w.toFixed(3)})` : "";
        return `${d.source} – ${d.target}${wStr}`;
      }
      return String(d.name ?? d.id);
    }
    _showTooltip(text, clientX, clientY) {
      if (!this._tooltipEl) {
        const el = document.createElement("div");
        el.setAttribute("data-qe-tooltip", "");
        Object.assign(el.style, {
          position: "fixed",
          zIndex: "2147483647",
          pointerEvents: "none",
          background: "rgba(20,20,20,0.92)",
          color: "#fff",
          font: "12px/1.4 system-ui, sans-serif",
          padding: "3px 7px",
          borderRadius: "4px",
          whiteSpace: "nowrap",
          transform: "translate(-50%, calc(-100% - 8px))"
        });
        document.body.appendChild(el);
        this._tooltipEl = el;
      }
      this._tooltipEl.textContent = text;
      this._tooltipEl.style.left = `${clientX}px`;
      this._tooltipEl.style.top = `${clientY}px`;
      this._tooltipEl.style.display = "block";
    }
    _hideTooltip() {
      if (this._tooltipEl) this._tooltipEl.style.display = "none";
    }
    draw() {
      var _a;
      if (!this.svg_element) {
        console.error("No element to draw to: ", this);
        return;
      }
      (_a = this.wrapper) == null ? void 0 : _a.appendChild(this.svg_element);
      this.__children__.forEach((enaLayer) => {
        enaLayer.draw();
      });
    }
    update() {
      this.update_extremes();
      this.update_layers();
      this.update_labels();
      this.update_extremes();
      this.update_axes();
      this._applyHighlights();
    }
    /**
     * Axes (<qe-axes>): toggle the axis-line cross by presence, and draw/position
     * per-axis labels at the positive ends using the current extent. Labels are
     * cached SVG <text> nodes in the labels group; null text removes them.
     */
    update_axes() {
      const axesLayer = this.__children__.search("__children__", "axes");
      if (axesLayer == null ? void 0 : axesLayer.svg_element) {
        axesLayer.svg_element.style.display = this._showAxes ? "" : "none";
      }
      const parent = this._labelsGroup;
      const extent = this.__data__.extremes.x_max;
      if (!parent || extent <= 0) return;
      const fontSize = extent * 0.06;
      const gap = fontSize * 0.6;
      const place = /* @__PURE__ */ __name((axis, text) => {
        let el = this._axisLabelEls.get(axis);
        if (!this._showAxes || text == null) {
          if (el) {
            el.remove();
            this._axisLabelEls.delete(axis);
          }
          return;
        }
        if (!el) {
          el = document.createElementNS("http://www.w3.org/2000/svg", "text");
          el.setAttribute("data-axis-label", axis);
          el.setAttribute("pointer-events", "none");
          parent.appendChild(el);
          this._axisLabelEls.set(axis, el);
        }
        el.textContent = text;
        el.setAttribute("font-size", fontSize.toString());
        el.setAttribute("font-family", "system-ui, sans-serif");
        el.setAttribute("font-weight", "600");
        el.setAttribute("fill", "#556");
        if (axis === "x") {
          el.setAttribute("x", (extent - gap).toString());
          el.setAttribute("y", (-gap).toString());
          el.setAttribute("text-anchor", "end");
        } else {
          el.setAttribute("x", gap.toString());
          el.setAttribute("y", (-extent + fontSize + gap).toString());
          el.setAttribute("text-anchor", "start");
        }
      }, "place");
      place("x", this._axisXText);
      place("y", this._axisYText);
    }
    update_labels() {
      this._nodeLabels.forEach((lbl) => lbl.update());
      this._meanLabels.forEach((lbl) => lbl.update());
      this._pointLabels.forEach((lbl) => lbl.update());
    }
    update_extremes() {
      var _a;
      this.__data__.update_extremes();
      const svgRect = (_a = this.svg_element) == null ? void 0 : _a.getBoundingClientRect();
      if (this.svg_element && svgRect) {
        console.log("SVG rect: ", svgRect);
        let w, h;
        if (svgRect.width === 0 || svgRect.height === 0) {
          w = 1;
          h = 1;
        } else {
          w = svgRect.width;
          h = svgRect.height;
        }
        this.__data__.scale_x = 1 / (w / (4 * this.__data__.extremes.x_max));
        this.__data__.scale_y = 1 / (h / (4 * this.__data__.extremes.y_max));
        this.__children__[0].svg_element.setAttribute("transform", this.__data__.transform.toString());
        this.svg_element.setAttribute("viewBox", this.__data__.extremes.as_viewBox());
        let axisLineLayer = this.__data__.layers.search("layers", "axis_lines");
        if (axisLineLayer) {
          let axis_x = axisLineLayer.objects.get("axis-x"), axis_y = axisLineLayer.objects.get("axis-y");
          if (axis_x && axis_y) {
            axis_x.from = new Point({ ID: "axis-x-start", dimensions: [-this.__data__.extremes.x_max, 0], classes: ["ena.dimension", "ena.dimension"] });
            axis_x.to = new Point({ ID: "axis-x-end", dimensions: [this.__data__.extremes.x_max, 0], classes: ["ena.dimension", "ena.dimension"] });
            axis_y.from = new Point({ ID: "axis-y-start", dimensions: [0, -this.__data__.extremes.y_max], classes: ["ena.dimension", "ena.dimension"] });
            axis_y.to = new Point({ ID: "axis-y-end", dimensions: [0, this.__data__.extremes.y_max], classes: ["ena.dimension", "ena.dimension"] });
          }
        }
      }
    }
    update_layers() {
      this.__children__.forEach((enaLayer) => {
        enaLayer.update();
      });
    }
  };
  __name(_QEGraphElement, "QEGraphElement");
  _QEGraphElement.tagName = "qe-graph";
  _QEGraphElement.style = `
    ${DrawableElement.style}

    :host {
      display: block;
    }

    .wrapper {
      width: 100%;
      height: 100%;
    }

    svg {
      width: 100%;
      height: 100%;
      aspect-ratio: 1 / 1;
      background-color: #FFF;
    }
  `;
  _QEGraphElement._instances = /* @__PURE__ */ new Set();
  _QEGraphElement._PATH_NUM_RE = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
  let QEGraphElement = _QEGraphElement;
  customElements.define(QEGraphElement.tagName, QEGraphElement);
  const getGraph = /* @__PURE__ */ __name((key) => QEGraphElement.getGraph(key), "getGraph");
  const getGraphs = /* @__PURE__ */ __name(() => QEGraphElement.instances(), "getGraphs");
  exports2.Color = Color;
  exports2.DataFrame = DataFrame;
  exports2.DataFrameColumn = DataFrameColumn;
  exports2.DataFrameColumnType = DataFrameColumnType;
  exports2.DataFrameRow = DataFrameRow;
  exports2.Edge = Edge;
  exports2.Graph = Graph;
  exports2.QEAxesElement = QEAxesElement;
  exports2.QEEdgesElement = QEEdgesElement;
  exports2.QEGraphElement = QEGraphElement;
  exports2.QELayer = QELayer;
  exports2.QELine = QELine;
  exports2.QEMeansElement = QEMeansElement;
  exports2.QENodesElement = QENodesElement;
  exports2.QEPoint = QEPoint;
  exports2.QEPointsElement = QEPointsElement;
  exports2.QETrajectoriesElement = QETrajectoriesElement;
  exports2.QETrajectory = QETrajectory;
  exports2.QEVisualElement = QEVisualElement;
  exports2.TRAJECTORY_ZERO_EPS = TRAJECTORY_ZERO_EPS;
  exports2.Trajectory = Trajectory;
  exports2.WeightedColor = WeightedColor;
  exports2.fitTrajectory = fitTrajectory;
  exports2.getGraph = getGraph;
  exports2.getGraphs = getGraphs;
  exports2.nearOriginFilter = nearOriginFilter;
  exports2.sampleCurve = sampleCurve;
  exports2.selectDegree = selectDegree;
  exports2.vizENA = vizENA;
  Object.defineProperty(exports2, Symbol.toStringTag, { value: "Module" });
}));
//# sourceMappingURL=qeviz.umd.js.map
