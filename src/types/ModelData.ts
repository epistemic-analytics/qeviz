/**
 * A frame of tabular data — one row per record, typed columns.
 *
 * `data`  — array of row objects (column name → value)
 * `types` — maps each column name to its type string:
 *           "character" | "numeric" | "integer" | "logical"
 */
export interface QEFrame {
  data:  Record<string, any>[];
  types: Record<string, string>;
}

/**
 * Generic model data accepted by <qe-visual>.setModelData().
 *
 * All frames are optional — pass only what your visualization needs.
 * Column name overrides (id_col, x_col, etc.) let you use any column names;
 * omit them and qeviz auto-detects from column types.
 *
 * ── Frames ───────────────────────────────────────────────────────────────────
 *
 *   nodes   — one row per node; must include an id column and x/y position
 *             columns. Additional columns are available as node metadata.
 *
 *   edges   — adjacency matrix (one row per unit, one column per node-pair)
 *             OR edge list (columns: source, target, weight / weight_col).
 *             Auto-detected from column names.
 *
 *   points  — one row per unit/observation; must include an id column and
 *             x/y position columns. An optional group column colours the
 *             points and drives group-mean computation.
 *
 *   groups  — pre-computed group summaries (means, CI bounds, outlier bounds).
 *             One row per group. Bounds use {x_col}.low / {x_col}.high
 *             (dot or underscore suffix both accepted).
 *
 * ── Column name overrides ────────────────────────────────────────────────────
 *
 *   id_col      — row-identifier column in points and edges (auto: first
 *                 character column)
 *   node_id_col — row-identifier column in nodes (auto: first character column)
 *   x_col       — x-position column (auto: first numeric column)
 *   y_col       — y-position column (auto: second numeric column)
 *   group_col   — grouping column in points (auto: first non-id character col)
 *   weight_col  — weight column for edge-list format (default: "weight")
 *
 * ── Other options ────────────────────────────────────────────────────────────
 *
 *   directed  — true = directed edges (arrows); false = undirected (default)
 *   updated   — millisecond timestamp; changing it forces a re-render
 */
export interface ModelData {
  nodes?:       QEFrame;
  edges?:       QEFrame;
  points?:      QEFrame;
  groups?:      QEFrame;
  /** @deprecated use groups with bound columns instead */
  confidence?:  QEFrame;
  /** @deprecated use groups with bound columns instead */
  outlier?:     QEFrame;
  directed?:    boolean;
  updated?:     number;
  // column name overrides (auto-detected if omitted)
  id_col?:      string;
  node_id_col?: string;
  x_col?:       string;
  y_col?:       string;
  group_col?:   string;
  weight_col?:  string;
}

// ── Backward-compat aliases (ENA adapters) ───────────────────────────────────
/** @deprecated use QEFrame */
export type ENADataFrame    = QEFrame;
/** @deprecated use QEFrame */
export type ENAIntervalFrame = QEFrame;
/** @deprecated use ModelData */
export type ENAModelData    = ModelData;
