import { Label, Point } from "../objects/PlottedObject";
import { Edge } from "../objects/Edges";
import Model, { ModelKey } from "../objects/Model";
import { DataFrame } from "../types/DataFrame.js";
import { dbg } from "../utils/debug.js";
import { ENAModelData } from "../types/ENAModelData.js";

export const vizENA = {
  get: (n: number) => {
    const elements = [...(document as any).querySelectorAll("ena-graph")];
    if (typeof n === "number" && n >= 0) {
      return elements[n];
    }
    return elements;
  },
}

export class VisualENAElement extends HTMLElement {
  static tagName = 'ena-visual';

  static get observedAttributes() {
    return ['updated'];
  }

  static styles = `
    :host { display: inline-block; }
    :host(.hidden) { display: none !important; }
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
    // RVisualENAElement (and any other arbor consumer) listens for this and
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
    style.textContent = VisualENAElement.styles;
    shadow.appendChild(style);

    this._outputElement = document.createElement('div');
    shadow.appendChild(this._outputElement);
  }

  connectedCallback(): void {
    dbg("VisualENAElement connected");
    this.render();
  }

  /**
   * Accept pre-fetched ENA model data and update the visualization.
   * Call this directly when data is available from any source —
   * rENA R package, Python package, or static JSON.
   */
  setModelData(data: ENAModelData): void {
    const keys: ModelKey[] = ['nodes', 'edges', 'points', 'confidence', 'outlier', 'updated'] as ModelKey[];

    // Known ID columns that should not be treated as the row-identifier for
    // interval frames (confidence / outlier).
    const KNOWN_ID_COLS = new Set(['QEUNIT', 'code', 'ENA_UNIT', 'unit']);

    keys.forEach((name) => {
      const raw = (data as any)[name];
      if (raw === undefined) return;

      if (['points', 'nodes', 'edges', 'confidence', 'outlier'].includes(name)) {
        const
          these_values: any = raw.data || [],
          these_types: any  = raw.types || {},
          colNames  = Object.keys(these_values[0]) || [],
          colValues = Object.values(these_values).map((v: any) => Object.values(v)) || [],
          classes   = colNames.map(col => (these_types[col] ?? 'character') as string)
        ;

        let removalCol: number;
        if (name === 'nodes') {
          removalCol = colNames.indexOf('code');
        } else if (name === 'edges' || name === 'points') {
          removalCol = colNames.indexOf('QEUNIT');
        } else {
          // confidence / outlier: auto-detect first character column that isn't a
          // known ID column; fall back to 'group', then index 0.
          removalCol = colNames.findIndex((col, idx) => {
            return !KNOWN_ID_COLS.has(col) && (these_types[col] ?? 'character') === 'character';
          });
          if (removalCol < 0) removalCol = colNames.indexOf('group');
          if (removalCol < 0) removalCol = 0;
        }

        const rowNames = colValues.map((v: any) => v[removalCol]) as string[];
        this._model.setByKey(name, new DataFrame(colNames, colValues, rowNames, classes));
      } else {
        this._model.setByKey(name, raw);
      }
    });

    // Auto-detect dimension columns from the nodes DataFrame.
    // We look for numeric (non-character, non-logical) columns that aren't the
    // row-identifier column ('code'). This lets setModelData work with plain
    // data from rENA, pyENA, or static JSON without requiring ENA class tags.
    const nodesDF = this._model.nodes;
    if (nodesDF?.names?.length) {
      const dimCols = nodesDF.names.filter(name => {
        if (name === 'code') return false;
        const col = nodesDF.col(name);
        return col && col.type !== 'character' && col.type !== 'logical';
      });
      if (dimCols.length >= 2) {
        this._model.dimensions = dimCols.slice(0, 2);
      }
    }

    this.updated = this._model.updated !== undefined ? String(this._model.updated) : '';
    dbg("Model updated via setModelData:", this.updated);
    this.render();
  }

  /**
   * Base implementation is a no-op. Subclasses (e.g. RVisualENAElement) override
   * this to fetch data from a backend and call setModelData().
   */
  async calculate(): Promise<void> {}

  render(): void {
    if (!this._isVisible) {
      this.classList.add('hidden');
    } else {
      this.classList.remove('hidden');
    }

    if (this._model?.updated !== undefined && this._model.updated !== null && this._model.updated !== '') {
      this._outputElement.innerHTML = `${this.output}<slot></slot>`;
    } else {
      this._outputElement.innerHTML = "Define the model on the left.";
    }
  }
}
customElements.define(VisualENAElement.tagName, VisualENAElement);

export default VisualENAElement;
