import { Label, Point } from "../objects/PlottedObject";
import { Edge } from "../objects/Edges";
import Model, { ModelKey } from "../objects/Model";
import { DataFrame } from "../types/DataFrame.js";
import { dbg } from "../utils/debug.js";
import { ModelData } from "../types/ModelData.js";

export const vizENA = {
  get: (n: number) => {
    const elements = [...(document as any).querySelectorAll("qe-graph")];
    if (typeof n === "number" && n >= 0) {
      return elements[n];
    }
    return elements;
  },
}

export class QEVisualElement extends HTMLElement {
  static tagName = 'qe-visual';

  static get observedAttributes() {
    return ['updated'];
  }

  static styles = `
    :host { display: block; width: 100%; }
    :host(.hidden) { display: none !important; }
    /* The output wrapper and the slotted graph fill the host so the plot
       stretches to its container instead of collapsing to intrinsic size. */
    div { display: block; width: 100%; height: 100%; }
    ::slotted(qe-graph) { display: block; width: 100%; height: 100%; }
  `;

  protected _outputElement!: HTMLElement;
  protected _isVisible: boolean = true;
  protected output: string = '';

  private _model: Model;
  /** Public accessor so ena-graph (and external code) can read the model. */
  get model(): Model {
    return this._model;
  }

  private _updated: string = '';
  get updated(): string {
    return this._updated;
  }
  set updated(val: string) {
    this._updated = val;
    this.setAttribute('updated', val);
    // Notify via CustomEvent instead of directly coupling to StateManager.
    // RQEVisualElement (and any other arbor consumer) listens for this and
    // forwards to globalStateManager.
    this.dispatchEvent(new CustomEvent('model-updated', {
      detail: this._model,
      bubbles: true,
      composed: true,
    }));
  }

  private _active_points: Point[] = [];
  private _points: Map<any, Point> = new Map();
  get points(): Map<any, Point> {
    return this._points;
  }
  set points(pts: Map<any, Point> | Point[]) {
    this._points.clear();
    if (pts instanceof Map) {
      this._points = pts;
    } else if (Array.isArray(pts)) {
      pts.forEach(p => this._points.set(p.ID, p));
    }
  }
  get active_points(): Point[] {
    return Array.from(this._active_points.values());
  }

  private _edges: Map<any, Edge> = new Map();
  get edges(): Map<any, Edge> {
    return this._edges;
  }
  set edges(edges: Map<any, Edge> | Edge[]) {
    this._edges.clear();
    if (edges instanceof Map) {
      this._edges = edges;
    } else if (Array.isArray(edges)) {
      this._edges = new Map();
      edges.forEach(e => this._edges.set(e.ID, e));
    }
  }

  private _labels: Map<any, Label> = new Map();
  get labels(): Map<any, Label> {
    return this._labels;
  }

  constructor() {
    super();

    this._model = new Model();

    const shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = QEVisualElement.styles;
    shadow.appendChild(style);

    this._outputElement = document.createElement('div');
    shadow.appendChild(this._outputElement);
  }

  connectedCallback(): void {
    dbg("QEVisualElement connected");
    this.render();
  }

  /**
   * Accept pre-fetched ENA model data and update the visualization.
   * Call this directly when data is available from any source —
   * rENA R package, Python package, or static JSON.
   */
  setModelData(data: ModelData): void {
    const frameKeys: ModelKey[] = ['nodes', 'edges', 'points', 'groups', 'confidence', 'outlier', 'trajectories', 'networks'] as ModelKey[];

    // ── Step 1: ingest all frames into DataFrames ──────────────────────────
    frameKeys.forEach((name) => {
      const raw = (data as any)[name];
      if (!raw?.data?.length) return;

      const
        rows:      any[]   = raw.data,
        types:     any     = raw.types || {},
        colNames:  string[] = Object.keys(rows[0]),
        colValues: any[][]  = rows.map((v: any) => Object.values(v)),
        classes:   string[] = colNames.map(col => (types[col] ?? 'character') as string);

      // Determine which column is the row-identifier (stored as DataFrame.rowName).
      // The caller can supply overrides; otherwise we auto-detect.
      let idCol: string | undefined;
      if (name === 'networks') {
        idCol = 'name';                       // one row per explicit network layer
      } else if (name === 'nodes') {
        idCol = data.node_id_col
          ?? colNames.find(c => (types[c] ?? 'character') === 'character');
      } else if (name === 'edges' || name === 'points' || name === 'trajectories') {
        idCol = data.id_col
          ?? colNames.find(c => (types[c] ?? 'character') === 'character');
      } else {
        // groups / confidence / outlier: first character column is the group id
        idCol = data.group_col
          ?? colNames.find(c => (types[c] ?? 'character') === 'character');
      }

      const removalCol = idCol ? colNames.indexOf(idCol) : 0;
      const rowNames   = colValues.map((v: any) => String(v[removalCol]));
      this._model.setByKey(name, new DataFrame(colNames, colValues, rowNames, classes));
    });

    // ── Step 2: ingest scalar fields ─────────────────────────────────────
    if (data.updated  !== undefined) this._model.setByKey('updated', data.updated);
    if (data.directed !== undefined) this._model.directed = data.directed;

    // ── Step 3: resolve and store column names on the model ───────────────
    // These are read by QEGraph at render time instead of hardcoded strings.

    // node id col — first character column in nodes, or override
    const nodesDF = this._model.nodes;
    this._model.node_id_col = data.node_id_col
      ?? nodesDF?.names?.find(n => nodesDF.col(n)?.type === 'character')
      ?? 'id';

    // unit id col — first character column in points, or override
    const pointsDF = this._model.points;
    this._model.unit_id_col = data.id_col
      ?? pointsDF?.names?.find(n => pointsDF.col(n)?.type === 'character')
      ?? 'id';

    // group col — caller override, or first non-unit-id character col in points
    const unitId = this._model.unit_id_col;
    this._model.group_col = data.group_col
      ?? pointsDF?.names?.find(n => n !== unitId && pointsDF.col(n)?.type === 'character')
      ?? null;

    // ── Step 4: auto-detect dimension (x/y) columns from nodes ───────────
    // Numeric columns that aren't the node id. Caller can override via
    // x_col / y_col but those are passed in ModelData for the renderer to use
    // directly; here we just set model.dimensions as the default.
    if (nodesDF?.names?.length) {
      const nodeId  = this._model.node_id_col;
      const xColOvr = data.x_col;
      const yColOvr = data.y_col;
      if (xColOvr && yColOvr) {
        this._model.dimensions = [xColOvr, yColOvr];
      } else {
        const numCols = nodesDF.names.filter(n => {
          if (n === nodeId) return false;
          const col = nodesDF.col(n);
          return col && col.type !== 'character' && col.type !== 'logical';
        });
        if (numCols.length >= 2) {
          this._model.dimensions = [xColOvr ?? numCols[0], yColOvr ?? numCols[1]];
        }
      }
    }

    this.updated = this._model.updated !== undefined ? String(this._model.updated) : String(Date.now());
    dbg("Model updated via setModelData:", this.updated);
    this.render();
  }

  /**
   * Base implementation is a no-op. Subclasses (e.g. RQEVisualElement) override
   * this to fetch data from a backend and call setModelData().
   */
  async calculate(): Promise<void> {}

  render(): void {
    if (!this._isVisible) {
      this.classList.add('hidden');
    } else {
      this.classList.remove('hidden');
    }

    if (this._model?.updated !== undefined && this._model.updated !== null) {
      this._outputElement.innerHTML = `${this.output}<slot></slot>`;
    } else {
      this._outputElement.innerHTML = "Define the model on the left.";
    }
  }
}
customElements.define(QEVisualElement.tagName, QEVisualElement);

export default QEVisualElement;
