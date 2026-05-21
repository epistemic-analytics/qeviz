export interface ENADataFrame {
  data: Record<string, any>[];
  types: Record<string, string>;
}

/**
 * Pre-computed interval bounds per group, as produced by libqe's
 * lq_group_ci() and lq_outlier_ci().
 *
 * Each row represents one group. Row names (or a character column matching
 * the points group column) identify the group.
 *
 * Bound columns are named after the model dimensions with a suffix:
 *   "{dim}.low"  / "{dim}.high"   (R dot notation)  — preferred
 *   "{dim}_low"  / "{dim}_high"   (underscore)       — also accepted
 *
 * Example for SVD rotation with dims SVD1, SVD2:
 *   group | SVD1.low | SVD1.high | SVD2.low | SVD2.high
 */
export interface ENAIntervalFrame extends ENADataFrame {}

export interface ENAModelData {
  nodes:       ENADataFrame;
  edges:       ENADataFrame;
  points:      ENADataFrame;
  /** 95% CI on the group mean — computed by libqe::lq_group_ci() */
  confidence?: ENAIntervalFrame;
  /** Outlier interval (IQR-based) — computed by libqe::lq_outlier_ci() */
  outlier?:    ENAIntervalFrame;
  updated?:    number;
}
