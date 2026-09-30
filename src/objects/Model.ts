import { DataFrame, DataFrameRow } from "../types/DataFrame";

/** Internal key union for Model.setByKey */
export type ModelKey =
  | "updated" | "points" | "nodes" | "edges"
  | "dimensions" | "confidence" | "outlier" | "groups" | "trajectories" | "networks" | "pointsets";

/** Internal shape of the Model class — used by setByKey */
export interface ModelSpec {
  updated?:    number;
  points:      DataFrame;
  nodes:       DataFrame;
  edges:       DataFrame;
  dimensions:  (string | number)[];
  confidence?: DataFrame;
  outlier?:    DataFrame;
  groups?:     DataFrame;
  trajectories?: DataFrame;
  networks?:   DataFrame;
  pointsets?:  DataFrame;
}

export class Model implements ModelSpec {
  private _updated:    number | undefined;
  private _points:     DataFrame;
  private _nodes:      DataFrame;
  private _edges:      DataFrame;
  private _dimensions: (string | number)[];
  private _params:     any;
  private _confidence: DataFrame | undefined;
  private _outlier:    DataFrame | undefined;
  private _groups:     DataFrame | undefined;
  private _trajectories: DataFrame | undefined;
  private _networks:   DataFrame | undefined;
  private _pointsets:  DataFrame | undefined;

  // Resolved column names — set by QEVisual.setModelData() via auto-detection
  // or caller-supplied overrides. Renderers read these instead of hardcoding.
  /** ID column in the points and edges frames */
  unit_id_col: string = 'id';
  /** ID column in the nodes frame */
  node_id_col: string = 'id';
  /** Group column in the points frame (null = no grouping) */
  group_col:   string | null = null;
  /** Directed network mode — true renders arrowheads; false (default) undirected */
  directed:    boolean = false;

  constructor(o: Partial<ModelSpec> = {}) {
    this._points     = o.points     ?? new DataFrame();
    this._nodes      = o.nodes      ?? new DataFrame();
    this._edges      = o.edges      ?? new DataFrame();
    this._dimensions = o.dimensions ?? [];
    this._confidence = undefined;
    this._outlier    = undefined;
    this._groups     = undefined;
  }

  get updated(): number | undefined { return this._updated; }
  set updated(v: number | undefined) { this._updated = v; }

  get points(): DataFrame { return this._points; }
  set points(v: DataFrame) { this._points = v; }

  get nodes(): DataFrame { return this._nodes; }
  set nodes(v: DataFrame) { this._nodes = v; }

  get edges(): DataFrame { return this._edges; }
  set edges(v: DataFrame) { this._edges = v; }

  get confidence(): DataFrame | undefined { return this._confidence; }
  set confidence(v: DataFrame | undefined) { this._confidence = v; }

  get outlier(): DataFrame | undefined { return this._outlier; }
  set outlier(v: DataFrame | undefined) { this._outlier = v; }

  get groups(): DataFrame | undefined { return this._groups; }
  set groups(v: DataFrame | undefined) { this._groups = v; }

  get trajectories(): DataFrame | undefined { return this._trajectories; }
  set trajectories(v: DataFrame | undefined) { this._trajectories = v; }

  /** Explicit networks (one row per named layer, edge columns as in `edges`),
   *  drawn by <qe-edges network="name">. */
  get networks(): DataFrame | undefined { return this._networks; }
  set networks(v: DataFrame | undefined) { this._networks = v; }

  /** Explicit point sets (rows: set, id, x, y, group?, color?, shape?, label?),
   *  drawn by <qe-points set="name">. */
  get pointsets(): DataFrame | undefined { return this._pointsets; }
  set pointsets(v: DataFrame | undefined) { this._pointsets = v; }

  get dimensions(): (string | number)[] { return this._dimensions; }
  set dimensions(v: (string | number)[]) { this._dimensions = v; }

  get params(): any { return this._params; }
  set params(v: any) { this._params = v; }

  point(id: string): DataFrameRow | undefined {
    return this._points.row(id);
  }

  setByKey<K extends keyof ModelSpec>(key: K, value: ModelSpec[K]): void {
    (this as any)[key] = value;
  }
}

export default Model;
