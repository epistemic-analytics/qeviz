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
#' @param trajectories Optional ordered observations for one or more units.
#'   Must contain `id_col`, `x_col`, `y_col`, and ideally `time`, `RowID`, or
#'   `ActivityNumber` for playhead ordering.
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
    trajectories = NULL,
    groups      = NULL,
    directed    = FALSE,
    id_col      = "ENA_UNIT",
    node_id_col = "code",
    x_col       = "x",
    y_col       = "y",
    group_col   = "Condition"
) {
  if (!is.null(points) && is.null(groups) && !is.null(group_col)) {
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
  if (!is.null(trajectories)) result$trajectories <- qe_frame(trajectories)
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
#' @param set       A model set object from `rENA::model()` or `ona::model()`.
#' @param directed  Logical, or `NULL` (default).  When `NULL`, directionality
#'   is detected automatically: sets with class `"ena.ordered.set"` (ONA) are
#'   treated as directed; standard ENA sets are treated as undirected.  Pass
#'   `TRUE` or `FALSE` explicitly only if you need to override the default.
#' @param id_col      Unit-ID column name in the set's meta/points frames.
#' @param node_id_col Code-ID column name in the nodes frame.
#' @param group_col   Group column name.
#' @param dims        The two dimensions to plot: names (`c("SVD1", "SVD3")`) or
#'   indices among the numeric node columns. Default: the first two.
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
    directed    = NULL,
    id_col      = "ENA_UNIT",
    node_id_col = "code",
    group_col   = "Condition",
    dims        = NULL
) {
  # ── Directionality ─────────────────────────────────────────────────────────
  # Ordered (ONA) sets carry class "ena.ordered.set", which means the
  # line.weights matrix is asymmetric (A→B and B→A are distinct columns).
  # Auto-detect from the set class so callers don't have to specify it.
  # An explicit directed = TRUE/FALSE overrides the auto-detection.
  if (is.null(directed)) {
    directed <- inherits(set, "ena.ordered.set")
  }

  # ── Nodes ──────────────────────────────────────────────────────────────────
  nodes_raw <- as.data.frame(set$rotation$nodes)
  dims      <- .qe_pick_dims(nodes_raw, dims)
  # Keep the set's dimension names (e.g. SVD1 / SVD2): qeviz uses x_col / y_col
  # as the axis-label text, so renaming to x / y would label the axes "x" / "y".
  nodes_df  <- nodes_raw[, c(node_id_col, dims), drop = FALSE]

  # ── Points ─────────────────────────────────────────────────────────────────
  pts_raw   <- as.data.frame(set$points)
  points_df <- pts_raw[, c(id_col, group_col, dims), drop = FALSE]

  # ── Edges ──────────────────────────────────────────────────────────────────
  meta_df   <- as.data.frame(set$meta.data)[, c(id_col, group_col), drop = FALSE]
  edges_raw <- as.data.frame(set$line.weights)
  edges_df  <- cbind(meta_df, edges_raw)
  # Normalise separator: rENA uses " & ", qeviz expects "."
  names(edges_df) <- gsub(" & ", ".", names(edges_df), fixed = TRUE)

  # ── Groups (means + 95% CI) ────────────────────────────────────────────────
  # No group column (group_col = NULL): points and networks only, no means.
  groups_df <- if (is.null(group_col)) NULL
               else group_summary(points_df, dims[1], dims[2], group_col)

  qe_model_data(
    nodes    = nodes_df,
    edges    = edges_df,
    points   = points_df,
    groups   = groups_df,
    directed = directed,
    id_col      = id_col,
    node_id_col = node_id_col,
    x_col       = dims[1],
    y_col       = dims[2],
    group_col   = group_col
  )
}

#' List the group names in a model
#'
#' Returns the unique group names present in a `ModelData` list or `qe_plot`
#' object.  Useful when a dataset has more than two groups and you want to
#' iterate over them or validate a group name before passing it to
#' [qe_group()].
#'
#' @param x A `qe_plot` object or a `ModelData` list from [qe_model_data()] /
#'   [qe_extract()].
#'
#' @return A character vector of group names, in the order they appear in the
#'   model's group summary table.
#'
#' @examples
#' \dontrun{
#' model <- qe_extract(set)
#' qe_groups(model)
#' #> [1] "FirstGame"  "SecondGame"
#'
#' # Useful for iterating over all groups:
#' lapply(qe_groups(model), function(g) {
#'   qe_plot(model) |> qe_group(g) |> qe_export_html(paste0(g, ".html"))
#' })
#' }
#'
#' @export
qe_groups <- function(x) {
  model <- if (inherits(x, "qe_plot")) x$model
           else if (inherits(x, "ena.set")) qe_extract(x)
           else x
  gcol  <- .qe_group_key(model)
  vapply(model$groups$data, function(row) {
    v <- row[[gcol]]
    if (is.null(v)) NA_character_ else as.character(v)
  }, character(1L))
}

#' List the unit IDs in a model
#'
#' Returns the unit IDs present in a `ModelData` list or `qe_plot` object.
#' Unit IDs are the values in the model's `id_col` column (default
#' `"ENA_UNIT"`), typically in compound form `"Group::Name"` as produced by
#' rENA / tma.  Pass any of these strings to [qe_edges()] as the `unit`
#' argument to plot an individual unit's edge network.
#'
#' @param x A `qe_plot` object or a `ModelData` list from [qe_model_data()] /
#'   [qe_extract()].
#'
#' @return A character vector of unit IDs, in the order they appear in the
#'   model's points table.  Returns `character(0)` if the model has no points
#'   frame.
#'
#' @examples
#' \dontrun{
#' model <- qe_extract(set)
#' qe_units(model)
#' #> [1] "FirstGame::steven z"    "FirstGame::akash v"
#' #> [3] "SecondGame::steven z"   ...
#'
#' # Plot one unit's edge network alongside both group means:
#' qe_plot(set) |>
#'   qe_group() |>
#'   qe_points() |>
#'   qe_edges(unit = "FirstGame::steven z")
#' }
#'
#' @export
qe_units <- function(x) {
  model  <- if (inherits(x, "qe_plot")) x$model
             else if (inherits(x, "ena.set")) qe_extract(x)
             else x
  id_col <- model$id_col %||% "ENA_UNIT"
  if (is.null(model$points)) return(character(0L))
  vapply(model$points$data, function(row) {
    v <- row[[id_col]]
    if (is.null(v)) NA_character_ else as.character(v)
  }, character(1L))
}

#' List the trajectory unit IDs in a model
#'
#' Returns the unit IDs present in the model's `trajectories` frame.  If no
#' separate trajectories frame is present, falls back to [qe_units()] because
#' qeviz can use point rows as trajectory states.
#'
#' @param x A `qe_plot` object or a `ModelData` list from [qe_model_data()] /
#'   [qe_extract()].
#'
#' @return A character vector of trajectory unit IDs.
#'
#' @export
qe_trajectory_units <- function(x) {
  model  <- if (inherits(x, "qe_plot")) x$model
             else if (inherits(x, "ena.set")) qe_extract(x)
             else x
  id_col <- model$id_col %||% "ENA_UNIT"
  frame  <- model$trajectories %||% model$points
  if (is.null(frame)) return(character(0L))
  unique(vapply(frame$data, function(row) {
    v <- row[[id_col]]
    if (is.null(v)) NA_character_ else as.character(v)
  }, character(1L)))
}

# Two dimension columns: `dims` as names or indices among the numeric columns,
# else the first two numeric columns.
.qe_pick_dims <- function(df, dims = NULL) {
  num <- names(df)[vapply(df, is.numeric, logical(1L))]
  if (is.null(dims)) return(find_dims(df))
  if (length(dims) != 2L) stop("dims must name or index exactly two dimensions.", call. = FALSE)
  out <- if (is.numeric(dims)) num[dims] else as.character(dims)
  bad <- setdiff(out, num)
  if (anyNA(out) || length(bad))
    stop(sprintf("dims not found among the dimensions: %s\nAvailable: %s",
                 paste(dQuote(if (anyNA(out)) dims else bad), collapse = ", "),
                 paste(utils::head(num, 6), collapse = ", ")), call. = FALSE)
  out
}

# Column naming the group in the groups frame: the model's group column, else
# "group" (a model extracted with group_col = NULL, holding only explicit
# means; the renderer falls back to "group" the same way).
.qe_group_key <- function(model) model$group_col %||% "group"
