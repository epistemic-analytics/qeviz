# model.R — build ModelData structures from data.frames or rENA/tma set objects

#' Build a qeviz ModelData list from data.frames
#'
#' Assembles the `ModelData` structure consumed by `<qe-visual>` from
#' pre-prepared data.frames.  All data.frames are converted to QEFrames
#' (see [qe_frame()]).
#'
#' @param nodes     `data.frame` of code-node positions.  Must contain columns
#'   `node_id_col`, `x_col`, `y_col`.
#' @param edges     `data.frame` of edge weights.  Must contain `id_col` plus
#'   one column per edge pair (e.g. `Data.Collaboration`).
#' @param points    `data.frame` of unit positions.  Must contain `id_col`,
#'   `group_col`, `x_col`, `y_col`.
#' @param groups    `data.frame` of group summary statistics as returned by
#'   [group_summary()], or `NULL` to compute automatically from `points`.
#' @param directed  Logical.  `TRUE` for ONA (ordered/directed) models.
#' @param id_col      Name of the unit-ID column in `edges` and `points`.
#' @param node_id_col Name of the code-ID column in `nodes`.
#' @param x_col       Name of the x-coordinate column.
#' @param y_col       Name of the y-coordinate column.
#' @param group_col   Name of the group column in `points`.
#'
#' @return A named list suitable for serialisation with [jsonlite::toJSON()]
#'   and passing to `qe_export_html()` or `qe_plot()`.
#'
#' @examples
#' \dontrun{
#' model <- qe_model_data(nodes_df, edges_df, points_df, directed = FALSE)
#' qe_plot(model)
#' }
#'
#' @export
qe_model_data <- function(
    nodes,
    edges,
    points      = NULL,
    groups      = NULL,
    directed    = FALSE,
    id_col      = "ENA_UNIT",
    node_id_col = "code",
    x_col       = "x",
    y_col       = "y",
    group_col   = "Condition"
) {
  if (!is.null(points) && is.null(groups)) {
    groups <- group_summary(as.data.frame(points), x_col, y_col, group_col)
  }
  result <- list(
    directed    = directed,
    updated     = as.numeric(Sys.time()) * 1000L,
    id_col      = id_col,
    node_id_col = node_id_col,
    x_col       = x_col,
    y_col       = y_col,
    group_col   = group_col,
    nodes       = qe_frame(nodes),
    edges       = qe_frame(edges)
  )
  if (!is.null(points)) result$points <- qe_frame(points)
  if (!is.null(groups)) result$groups <- qe_frame(groups)
  result
}

#' Extract a qeviz ModelData list from an rENA / tma model object
#'
#' Reads nodes, points, edges, and group membership from a set object
#' produced by `rENA::model()` (tma pipeline) and returns a `ModelData`
#' list ready for rendering.
#'
#' The set object must expose:
#' * `set$rotation$nodes`  — code positions data.frame with a `code` column
#' * `set$points`          — unit positions data.frame with `ENA_UNIT`,
#'   `Condition`, and rotated-dimension columns
#' * `set$line.weights`    — edge-weight columns (one per code pair)
#' * `set$meta.data`       — unit metadata including `ENA_UNIT`, `Condition`
#'
#' Edge column names are normalised: `" & "` separators are replaced with
#' `"."` so qeviz's edge parser can resolve them (e.g. `"Data & Collab"`
#' becomes `"Data.Collab"`).
#'
#' @param set       A model set object from `rENA::model()`.
#' @param directed  Logical.  `TRUE` for ONA (ordered/directed) models.
#' @param id_col      Unit-ID column name in the set's meta/points frames.
#' @param node_id_col Code-ID column name in the nodes frame.
#' @param group_col   Group column name.
#'
#' @return A `ModelData` list (see [qe_model_data()]).
#'
#' @examples
#' \dontrun{
#' library(tma); library(rENA)
#' data(RS.data)
#' result <- tma::accumulate(tensor, codes = codes,
#'                           context_model = ctx, ordered = FALSE)
#' ena_set   <- rENA::model(result)
#' ena_model <- qe_extract(ena_set, directed = FALSE)
#' qe_plot(ena_model)
#' }
#'
#' @export
qe_extract <- function(
    set,
    directed    = FALSE,
    id_col      = "ENA_UNIT",
    node_id_col = "code",
    group_col   = "Condition"
) {
  # ── Nodes ──────────────────────────────────────────────────────────────────
  nodes_raw <- as.data.frame(set$rotation$nodes)
  dims      <- find_dims(nodes_raw)
  nodes_df  <- nodes_raw[, c(node_id_col, dims), drop = FALSE]
  names(nodes_df)[2:3] <- c("x", "y")

  # ── Points ─────────────────────────────────────────────────────────────────
  pts_raw   <- as.data.frame(set$points)
  points_df <- pts_raw[, c(id_col, group_col, dims), drop = FALSE]
  names(points_df)[3:4] <- c("x", "y")

  # ── Edges ──────────────────────────────────────────────────────────────────
  meta_df   <- as.data.frame(set$meta.data)[, c(id_col, group_col), drop = FALSE]
  edges_raw <- as.data.frame(set$line.weights)
  edges_df  <- cbind(meta_df, edges_raw)
  # Normalise separator: rENA uses " & ", qeviz expects "."
  names(edges_df) <- gsub(" & ", ".", names(edges_df), fixed = TRUE)

  # ── Groups (means + 95% CI) ────────────────────────────────────────────────
  groups_df <- group_summary(points_df, "x", "y", group_col)

  qe_model_data(
    nodes    = nodes_df,
    edges    = edges_df,
    points   = points_df,
    groups   = groups_df,
    directed = directed,
    id_col      = id_col,
    node_id_col = node_id_col,
    x_col       = "x",
    y_col       = "y",
    group_col   = group_col
  )
}
