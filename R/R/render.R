# render.R — HTML rendering and display

# ── Internal: locate and read the bundled JS ───────────────────────────────────

.bundle_js <- function() {
  path <- system.file("htmlwidgets", "lib", "qeviz", "qeviz.umd.js", package = "qeviz")
  if (!nzchar(path) || !file.exists(path))
    stop("qeviz.umd.js not found in package inst/. Re-install the package.")
  paste(readLines(path, warn = FALSE), collapse = "\n")
}

# ── Internal: accept either a raw rENA set, a pre-extracted ModelData list,
#             or a qe_plot object ────────────────────────────────────────────
#
# • ena.set objects  → qe_extract() with any forwarded args
# • qe_plot objects  → return the model slot directly
# • anything else    → assumed to be a ModelData list already
.to_model <- function(x, ...) {
  if (inherits(x, "qe_plot"))  return(x$model)
  if (inherits(x, "ena.set"))  return(qe_extract(x, ...))
  x
}

# ── Internal: resolve graph_opts from a qe_plot object or plain list ──────────
# When x is a qe_plot, its stored opts are used as the base; the caller can
# still pass graph_opts to override individual keys.
.resolve_opts <- function(x, graph_opts = list()) {
  base <- if (inherits(x, "qe_plot")) x$graph_opts else list()
  utils::modifyList(base, graph_opts)
}

# ── Internal: resolve title ───────────────────────────────────────────────────
.resolve_title <- function(x, title) {
  if (!is.null(title)) return(title)
  if (inherits(x, "qe_plot")) x$title %||% "qeviz" else "qeviz"
}

# ── Internal: build the <qe-graph> element with child layer elements ──────────
#
# Each declarative child element maps directly to a rendering layer:
#   <qe-nodes>  — code nodes (emitted with an edge network, or via qe_nodes())
#   <qe-means>  — group mean markers + CI boxes  (omit to hide)
#   <qe-points> — unit scatter dots              (omit to hide)
#   <qe-edges>  — edge network                   (omit to hide)
#   <qe-trajectories> — ordered unit paths       (omit to hide)
#
# Presence of a child = the layer renders.
# Absence            = the layer is hidden.
# DOM order          = SVG render order (later children draw on top).

.build_graph_element <- function(opts) {
  w <- opts[["width"]]  %||% "100%"
  h <- opts[["height"]] %||% "440"
  children <- character(0)

  # <qe-nodes> is emitted after <qe-edges> is decided (see .nodes_element()),
  # but placed first so DOM order is unchanged.
  nodes_at <- length(children) + 1L

  # ── <qe-means> — show group means + optional CI boxes ────────────────────
  # Omit entirely only if explicitly suppressed (not currently exposed in API;
  # defaults to present so `qe_plot(set)` always shows group means).
  means_parts <- character(0)
  if (!is.null(opts[["groups"]]))
    means_parts <- c(means_parts, sprintf('groups="%s"', opts[["groups"]]))
  if (!isFALSE(opts[["confidence"]]))
    means_parts <- c(means_parts, "confidence")
  if (!is.null(opts[["intervals"]]) && opts[["intervals"]] != "box")
    means_parts <- c(means_parts, sprintf('intervals="%s"', opts[["intervals"]]))
  if (isTRUE(opts[["mean-outlier"]]))
    means_parts <- c(means_parts, "outlier")
  means_label <- opts[["label-means"]] %||% "on"
  means_parts <- c(means_parts, sprintf('label="%s"', means_label))
  if (isTRUE(opts[["mean-fixed-size"]]))
    means_parts <- c(means_parts, "fixed-size")
  children <- c(children,
    sprintf('    <qe-means %s></qe-means>', paste(means_parts, collapse = " ")))

  # ── <qe-points> — unit scatter dots (only when points = TRUE) ────────────
  if (isTRUE(opts[["points"]])) {
    pt_label <- opts[["label-points"]] %||% "auto"
    pt_parts <- sprintf('label="%s"', pt_label)
    if (!is.null(opts[["point-size"]]))
      pt_parts <- c(pt_parts, sprintf('size="%s"', opts[["point-size"]]))
    if (isTRUE(opts[["point-fixed-size"]]))
      pt_parts <- c(pt_parts, "fixed-size")
    children <- c(children,
      sprintf('    <qe-points %s></qe-points>', paste(pt_parts, collapse = " ")))
  }
  # Explicit point sets (qe_points(units =, points =)).
  for (ps in opts[["point-sets"]] %||% list()) {
    pt_parts <- c(sprintf('set="%s"', ps$set),
                  sprintf('label="%s"', opts[["label-points"]] %||% "auto"),
                  if (!is.null(ps$size)) sprintf('size="%s"', ps$size),
                  if (isTRUE(ps$fixed)) "fixed-size")
    children <- c(children,
      sprintf('    <qe-points %s></qe-points>', paste(pt_parts, collapse = " ")))
  }

  # ── <qe-edges> — edge network (omit when no primary target or suppressed) ─
  # Emitted only when at least one of group/unit is set (or compare/also are,
  # though those require a primary).  The R chain functions validate this.
  if (!identical(opts[["edges"]], "false")) {
    edge_parts <- character(0)
    if (!is.null(opts[["group"]]))
      edge_parts <- c(edge_parts, sprintf('group="%s"',   opts[["group"]]))
    if (!is.null(opts[["unit"]]))
      edge_parts <- c(edge_parts, sprintf('unit="%s"',    opts[["unit"]]))
    if (!is.null(opts[["compare"]]))
      edge_parts <- c(edge_parts, sprintf('compare="%s"', opts[["compare"]]))
    if (!is.null(opts[["also"]]))
      edge_parts <- c(edge_parts, sprintf('also="%s"',    opts[["also"]]))
    # Layer attributes (0.5): colors / threshold / name for the named network,
    # then one <qe-edges network="…"> per explicit layer.
    attr_parts <- function(a) vapply(names(a), function(k) sprintf('%s="%s"', k, a[[k]]), "")
    layers <- list()
    if (length(edge_parts) > 0)
      layers <- list(c(edge_parts, attr_parts(opts[["edge-named"]] %||% list())))
    for (L in opts[["edge-layers"]] %||% list()) layers <- c(layers, list(attr_parts(L)))
    # Plot-wide settings ride on the first layer.
    if (length(layers) > 0) {
      if (!is.null(opts[["edge-magnify"]]))
        layers[[1]] <- c(layers[[1]], sprintf('magnify="%s"', opts[["edge-magnify"]]))
      if (!is.null(opts[["edge-color-scale"]]))
        layers[[1]] <- c(layers[[1]], sprintf('color-scale="%s"', opts[["edge-color-scale"]]))
    }
    for (parts in layers)
      children <- c(children,
        sprintf('    <qe-edges %s></qe-edges>', paste(parts, collapse = " ")))
  }
  has_network <- any(startsWith(children, "    <qe-edges"))

  # ── <qe-trajectories> — ordered unit trajectories ───────────────────────
  if (isTRUE(opts[["trajectories"]])) {
    traj_parts <- character(0)
    if (!is.null(opts[["trajectory-units"]]))
      traj_parts <- c(traj_parts, sprintf('units="%s"', opts[["trajectory-units"]]))
    traj_parts <- c(traj_parts,
      sprintf('smooth="%s"', opts[["trajectory-smooth"]] %||% "none"),
      sprintf('max-degree="%s"', opts[["trajectory-max-degree"]] %||% "3"),
      sprintf('degree-selection="%s"', opts[["trajectory-degree-selection"]] %||% "loocv_2d"),
      sprintf('points="%s"', if (isFALSE(opts[["trajectory-points"]])) "false" else "true"),
      sprintf('tips="%s"', if (isFALSE(opts[["trajectory-tips"]])) "false" else "true")
    )
    if (!is.null(opts[["trajectory-playhead"]]))
      traj_parts <- c(traj_parts, sprintf('playhead="%s"', opts[["trajectory-playhead"]]))
    traj_parts <- c(traj_parts,
      sprintf('line-style="%s"', opts[["trajectory-line-style"]] %||% "uniform"),
      sprintf('stroke-width="%s"', opts[["trajectory-stroke-width"]] %||% "2"),
      sprintf('stroke-width-range="%s"', opts[["trajectory-stroke-width-range"]] %||% "1,6"),
      sprintf('opacity-range="%s"', opts[["trajectory-opacity-range"]] %||% "0.3,1")
    )
    children <- c(children,
      sprintf('    <qe-trajectories %s></qe-trajectories>', paste(traj_parts, collapse = " ")))
  }

  # ── <qe-axes> — axis lines + optional per-axis labels ───────────────────
  if (isTRUE(opts[["axes"]])) {
    axis_parts <- character(0)
    ax <- opts[["axis-x"]]
    ay <- opts[["axis-y"]]
    # TRUE → boolean attribute (label defaults to dimension name);
    # a string → attribute with that value; FALSE/NULL → no attribute.
    if (isTRUE(ax))                     axis_parts <- c(axis_parts, "x")
    else if (is.character(ax))          axis_parts <- c(axis_parts, sprintf('x="%s"', ax))
    if (isTRUE(ay))                     axis_parts <- c(axis_parts, "y")
    else if (is.character(ay))          axis_parts <- c(axis_parts, sprintf('y="%s"', ay))
    children <- c(children,
      sprintf('    <qe-axes%s></qe-axes>',
              if (length(axis_parts)) paste0(" ", paste(axis_parts, collapse = " ")) else ""))
  }

  # ── <qe-nodes> — draw code nodes (positions always come from the model) ──
  # "auto" draws them only with an edge network, as rENA does.
  node_show <- opts[["nodes-show"]] %||% "auto"
  if (node_show == "always" || (node_show == "auto" && has_network)) {
    node_label <- opts[["label-nodes"]] %||% "on"
    unconn     <- if (identical(opts[["nodes-unconnected"]], "hide")) ' unconnected="hide"' else ""
    children <- append(children,
      sprintf('    <qe-nodes label="%s"%s></qe-nodes>', node_label, unconn), after = nodes_at - 1L)
  }

  children_str <- paste(children, collapse = "\n")
  # Plot-wide attributes on <qe-graph> (values HTML-escaped).
  esc <- function(v) gsub('"', "&quot;", gsub("<", "&lt;", gsub("&", "&amp;", as.character(v), fixed = TRUE),
                                          fixed = TRUE), fixed = TRUE)
  gattr <- c("edge-width", "plot-title", "range", "scale-points",
             "label-font-size", "label-font-family", "label-font-color")
  ga <- paste0(vapply(gattr, function(k)
    if (is.null(opts[[k]])) "" else sprintf(' %s="%s"', k, esc(opts[[k]])), ""), collapse = "")
  sprintf('<qe-graph width="%s" height="%s"%s>\n%s\n  </qe-graph>', w, h, ga, children_str)
}

# ── Internal: build the full HTML document string ─────────────────────────────

.build_html <- function(model_json, title = "qeviz", graph_opts = list()) {
  bundle     <- .bundle_js()
  graph_elem <- .build_graph_element(graph_opts)

  sprintf('<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%s</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: #fff; }
    qe-visual { display: block; width: 100%%; height: 480px; }
    qe-graph  { display: block; width: 100%%; height: 100%%; }
  </style>
</head>
<body>
<qe-visual id="vis">
  %s
</qe-visual>
<script>%s</script>
<script>
const model = %s;
document.getElementById("vis").setModelData(model);
</script>
</body>
</html>', title, graph_elem, bundle, model_json)
}

# ── NULL-coalescing helper ─────────────────────────────────────────────────────
`%||%` <- function(a, b) if (!is.null(a)) a else b


# ══ qe_plot object ════════════════════════════════════════════════════════════

#' Create a qeviz plot object
#'
#' Returns a `qe_plot` object that can be customised with chained `qe_*()`
#' functions and rendered by printing, [qe_export_html()], or [qe_html()].
#'
#' `width` and `height` set the plot dimensions and can be supplied here rather
#' than in a separate sizing call.
#'
#' @param x       Either a raw rENA / tma / ona set object **or** a `ModelData`
#'   list from [qe_model_data()] / [qe_extract()].
#' @param title   Plot title. When given it is drawn at the top of the plot
#'   (and included in SVG / PNG exports) and used as the page title; when
#'   `NULL` (default) nothing is drawn and the page title is "qeviz".
#' @param width   CSS width string. Default `"100%"`.
#' @param height  Plot height in pixels (numeric) or any CSS string. Default `440`.
#' @param range   Symmetric axis range, as rENA's `scale.to`: `"network"`
#'   (±max |node| × 1.2), `"points"` (±max |point| × 1.2) or a positive number.
#'   `NULL` (default) uses qeviz's fit (1.3 × the largest mark). Asymmetric
#'   ranges (rENA's `list(x =, y =)`) are not supported.
#' @param scale_points Rescale unit points and means so the outermost point
#'   meets the outermost code node (default `TRUE`); `FALSE` plots raw
#'   coordinates, as rENA does.
#' @param palette Group colours, assigned in order of appearance. Default:
#'   Paul Tol's colour-blind-safe "bright" scheme. See also [qe_colors()].
#' @param ...     Additional arguments forwarded to [qe_extract()] when `x` is a
#'   raw set (e.g. `group_col = "Condition"`, `dims = c("SVD1", "SVD3")`).
#'   Directionality is detected automatically from the set class.
#'
#' @return An object of class `qe_plot`.
#'
#' @examples
#' \dontrun{
#' qe_plot(set)
#' qe_plot(set, height = 600) |> qe_group("FirstGame")
#' }
#'
#' @export
qe_plot <- function(x, title = NULL, width = "100%", height = 440,
                    range = NULL, scale_points = TRUE, palette = NULL, ...) {
  if (is.list(range))
    stop("qe_plot(): only symmetric ranges are supported: \"network\", \"points\" or a number.",
         call. = FALSE)
  if (!is.null(range) && !(identical(range, "network") || identical(range, "points") ||
                           (is.numeric(range) && length(range) == 1L && is.finite(range) && range > 0)))
    stop("qe_plot(): range must be \"network\", \"points\" or a positive number.", call. = FALSE)
  if (!is.null(palette) && !(is.character(palette) && length(palette) >= 1L))
    stop("qe_plot(): palette must be a character vector of colours.", call. = FALSE)
  p <- structure(
    list(
      model      = .to_model(x, ...),
      title      = title %||% "qeviz",
      graph_opts = list()
    ),
    class = "qe_plot"
  )
  p$graph_opts$width  <- width
  p$graph_opts$height <- as.character(height)
  p$graph_opts[["plot-title"]] <- title
  p$graph_opts[["range"]] <- range
  if (isFALSE(scale_points)) p$graph_opts[["scale-points"]] <- "false"
  if (!is.null(palette)) p$model$palette <- as.list(palette)
  p
}

#' Set group colours
#'
#' Pins groups to colours; each group's mean, unit points and networks use
#' it. Unlisted groups keep the palette colour.
#'
#' @param p   A `qe_plot` object.
#' @param ... Named colours: `FirstGame = "#E69F00"`, …
#' @return The modified `qe_plot` object.
#' @examples
#' \dontrun{
#' qe_plot(set) |> qe_colors(FirstGame = "#E69F00", SecondGame = "#56B4E9") |>
#'   qe_edges("FirstGame", compare = "SecondGame")
#' }
#' @export
qe_colors <- function(p, ...) {
  cols <- unlist(list(...))
  if (!length(cols) || is.null(names(cols)) || any(!nzchar(names(cols))))
    stop("qe_colors(): give named colours, e.g. qe_colors(p, FirstGame = \"#E69F00\").",
         call. = FALSE)
  bad <- setdiff(names(cols), qe_groups(p))
  if (length(bad))
    stop(sprintf("qe_colors(): group(s) not found in model: %s", paste(dQuote(bad), collapse = ", ")),
         call. = FALSE)
  g <- .qe_frame_df(p$model$groups)
  if (is.null(g$color)) g$color <- NA_character_
  gcol <- p$model$group_col
  g$color[match(names(cols), g[[gcol]])] <- unname(cols)
  p$model$groups <- qe_frame(g)
  p
}



# ══ Chain functions ════════════════════════════════════════════════════════════

#' Select which group means to display
#'
#' Controls which groups' mean markers and CI boxes appear in the plot.  This
#' is independent of edge rendering — use [qe_edges()] to select whose network
#' to draw.
#'
#' @param p         A `qe_plot` object.
#' @param ...       Group names to show means for.  Supply one or more strings,
#'   each matching a value in the model's group column.  Omit entirely to show
#'   means for **all** groups in the model (the default).
#' @param points    An arbitrary subset to average — a matrix, data frame or
#'   `ena.points` rows (as rENA's `ena.plot.group()` accepts). Its mean, t CI
#'   and (with `outlier`) fences are computed here and added as a group named
#'   `label`. Cannot be combined with group names.
#' @param label     Name for an explicit mean. Default `"mean 1"`, `"mean 2"`, ….
#' @param color     Colour of an explicit mean. Default: next palette colour.
#' @param shape     Marker shape for an explicit mean: `"square"` (default),
#'   `"circle"`, `"triangle"` or `"diamond"`.
#' @param by        The metadata column used for grouping (e.g. `"Condition"`).
#'   Optional — used to validate against the column baked into the model at
#'   extraction time.  An error is raised if the column name does not match.
#' @param intervals `"box"` (default), `"crosshairs"` or `"none"`; `TRUE` /
#'   `FALSE` are accepted as `"box"` / `"none"`. rENA's default is `"none"`.
#' @param conf_level Confidence level of the t interval. Default 0.95.
#' @param outlier   Also draw the outlier interval (Q1 − 1.5·IQR … Q3 + 1.5·IQR
#'   per dimension). Default `FALSE`.
#' @param fixed_size Logical. When `TRUE`, group mean markers keep a constant
#'   on-screen pixel size regardless of data extent, container size, or zoom.
#'   Default `FALSE` (markers scale with the coordinate space).
#'
#' @return The modified `qe_plot` object.
#'
#' @examples
#' \dontrun{
#' # Show means for all groups (default)
#' qe_plot(set) |> qe_group()
#'
#' # Show means for specific groups only
#' qe_plot(set) |> qe_group("FirstGame", "SecondGame")
#'
#' # Explicit column name — validates against model
#' qe_plot(set) |> qe_group("FirstGame", by = "Condition")
#' }
#'
#' @export
qe_group <- function(p, ..., points = NULL, label = NULL, color = NULL, shape = NULL,
                     by = NULL, intervals = c("box", "crosshairs", "none"),
                     conf_level = 0.95, outlier = FALSE, fixed_size = FALSE) {
  requested <- c(...)   # character vector of group names, or length-0

  # Validate `by` against the model's group_col
  if (!is.null(by)) {
    model_gcol <- if (inherits(p, "qe_plot")) p$model$group_col else p$group_col
    if (!is.null(model_gcol) && !identical(by, model_gcol)) {
      stop(sprintf(
        "qe_group(): by = %s does not match the model's group column (%s).\n",
        dQuote(by), dQuote(model_gcol)
      ), call. = FALSE)
    }
  }
  if (is.logical(intervals)) intervals <- if (isTRUE(intervals)) "box" else "none"
  intervals <- match.arg(intervals)
  if (!(is.numeric(conf_level) && length(conf_level) == 1L && conf_level > 0 && conf_level < 1))
    stop("qe_group(): conf_level must be a number in (0, 1).", call. = FALSE)
  if (!is.null(points) && length(requested))
    stop("qe_group(): supply group names or 'points', not both.", call. = FALSE)

  p$graph_opts$intervals <- intervals
  p$graph_opts$confidence <- intervals != "none"
  p$graph_opts[["mean-outlier"]] <- isTRUE(outlier) || isTRUE(p$graph_opts[["mean-outlier"]])
  p$graph_opts[["mean-fixed-size"]] <- isTRUE(fixed_size)

  if (!is.null(points)) {
    # ── Explicit: the mean (+ t CI, outlier fences) of an arbitrary subset ───
    m   <- p$model
    df  <- .qe_point_frame(points, m)
    lbl <- label %||% sprintf("mean %d", length(p$graph_opts[["groups-explicit"]]) + 1L)
    if (lbl %in% qe_groups(p) && !lbl %in% p$graph_opts[["groups-explicit"]])
      stop(sprintf("qe_group(): label %s is already a group in the model.", dQuote(lbl)),
           call. = FALSE)
    df[[m$group_col]] <- lbl
    row <- group_summary(df, m$x_col, m$y_col, m$group_col, conf_level = conf_level,
                         outlier = outlier)
    if (!is.null(color)) row$color <- color
    if (!is.null(shape)) row$shape <- .qe_shape(shape, "qe_group")
    p$model$groups <- .qe_upsert_rows(p$model$groups, row, m$group_col)
    p$graph_opts[["groups-explicit"]] <- union(p$graph_opts[["groups-explicit"]], lbl)
  } else {
    # ── By name ─────────────────────────────────────────────────────────────
    if (length(requested) > 0) {
      available <- qe_groups(p)
      bad <- requested[!requested %in% available]
      if (length(bad) > 0) {
        stop(sprintf(
          "qe_group(): group(s) not found in model: %s\nAvailable: %s",
          paste(dQuote(bad), collapse = ", "),
          paste(dQuote(available), collapse = ", ")
        ), call. = FALSE)
      }
    }
    p$graph_opts[["groups-named"]] <- as.character(requested)   # character(0) = all
    # Non-default CI level / outlier fences: recompute the named groups' rows
    # from the unit points (explicit rows keep what they were computed with).
    m <- p$model
    if ((conf_level != 0.95 || isTRUE(outlier)) && !is.null(m$points)) {
      pts <- .qe_frame_df(m$points)
      rows <- group_summary(pts, m$x_col, m$y_col, m$group_col,
                            conf_level = conf_level, outlier = outlier)
      p$model$groups <- .qe_upsert_rows(p$model$groups, rows, m$group_col)
    }
  }

  # `groups` filter: named selection (all / some) plus explicit means. With
  # only explicit means, show just those (as rENA's ena.plot.group does).
  named <- p$graph_opts[["groups-named"]]
  expl  <- p$graph_opts[["groups-explicit"]]
  p$graph_opts$groups <-
    if (!length(expl)) { if (length(named)) paste(named, collapse = ",") else NULL }
    else if (is.null(named)) paste(expl, collapse = ",")
    else if (!length(named)) NULL
    else paste(c(named, expl), collapse = ",")
  p
}

#' Select which edge network to draw
#'
#' Controls edge rendering.  A network is chosen **by name** — a group
#' (`group`) or a unit (`unit`), optionally with `compare` / `also` — or given
#' **as data** with `weights` (any vector, matrix or data frame, as rENA's
#' `ena.plot.network()` accepts).  Name calls replace the plot's named network;
#' `weights` calls add a layer, so repeated calls overlay.  `qe_edges(show =
#' FALSE)` clears every network.
#'
#' Use [qe_units()] to inspect the unit IDs present in the model.
#'
#' @param p       A `qe_plot` object.
#' @param group   Name of the primary group whose **mean** edge network to draw.
#'   Must match a value in the model's group column.  Mutually exclusive with
#'   `unit`.
#' @param unit    ID of a single unit whose **individual** edge network to draw
#'   (e.g. `"FirstGame::steven z"`).  Mutually exclusive with `group`.
#'   `compare` and `also` are not supported when `unit` is supplied.
#' @param weights Explicit network data: a named numeric vector (names
#'   `"A & B"` or `"A.B"`; missing edges are 0), an unnamed vector in the
#'   model's edge-column order, a matrix / data frame of rows (column means;
#'   non-numeric columns are dropped, so `set$line.weights[...]` works), or a
#'   named list of any of those (one layer each). Signed: positive weights use
#'   `colors[1]`, negative `colors[2]`. Drawn on the model's scales — absolute
#'   width, and colour from the model-wide range (values beyond it clamp).
#'   Mutually exclusive with `group` / `unit`.
#' @param compare Name of a second group to subtract (`group − compare`), or —
#'   with `weights` — explicit data in any `weights` form, or a group name
#'   (`weights − that group's mean`). Positive differences use the primary
#'   colour; negative the secondary. Cannot be combined with `unit`.
#' @param also    Name of a second group to overlay alongside `group`.
#'   Cannot be combined with `unit`.
#' @param colors  `c(positive, negative)` colours for this network, or one
#'   colour (negatives then use its complement, as in rENA). Default: the
#'   group's palette colour(s); the first two palette colours for `weights`.
#' @param threshold `c(min, max)`, or `min` alone: edges with |weight| < `min`
#'   are not drawn and |weight| > `max` is capped at `max` (sign kept) — rENA's
#'   `threshold` semantics.
#' @param name    Label for this network layer, reported in edge events and
#'   tooltips. Default: the group / unit name, list element names, or
#'   `"network 1"`, `"network 2"`, ….
#' @param show    Logical.  `FALSE` clears all networks (named and explicit).
#'   Default `TRUE`.
#' @param color_scale How edge weights map to colour, using webENA's ramps
#'   (saturation 0.25–1, opacity 0.3–1). `"model"` (default) rescales from the
#'   smallest to the largest non-zero weight anywhere in the model, so separate
#'   plots of the same model (one group, another group, a unit, a subtraction)
#'   share one colour scale. `"plot"` rescales within this plot, as webENA
#'   does. `"absolute"` skips the ramps: saturation = opacity = |weight|.
#' @param edge_width Width of an edge of weight 1, as a fraction of the plot
#'   width. Width is absolute (raw weight × this), as in webENA, so equal
#'   weights draw equally wide in graphs of the same size; each node's
#'   diameter is the sum of its edges' widths. `NULL` uses qeviz's default
#'   (0.04).
#' @param magnify Multiply this plot's edge widths and node sizes (colour is
#'   unchanged), e.g. to make a faint subtraction readable. Whenever it is set
#'   — including `1` — the plot is labelled "(scaled N.Nx)", so exported plots
#'   state their scaling (webENA labels its side plots "(scaled 1.0x)" for the
#'   same reason). `NULL` (default) means no magnification and no label.
#'
#' @return The modified `qe_plot` object.
#'
#' @examples
#' \dontrun{
#' # Two plots on the same scale (the default): SecondGame's lighter, thinner
#' # lines mean weaker connections, not a different scaling
#' qe_plot(set) |> qe_edges("FirstGame")
#' qe_plot(set) |> qe_edges("SecondGame")
#'
#' # Single group mean network, by name or from data
#' qe_plot(set) |> qe_edges("FirstGame")
#' m <- as.matrix(set$line.weights)
#' fg <- set$meta.data$Condition == "FirstGame"
#' sg <- set$meta.data$Condition == "SecondGame"
#' qe_plot(set) |> qe_edges(weights = m[fg, ])
#'
#' # Subtraction from data, with explicit colours
#' qe_plot(set) |> qe_edges(weights = m[fg, ], compare = m[sg, ], colors = c("blue", "red"))
#'
#' # A non-group subset, thresholded
#' qe_plot(set) |> qe_edges(weights = m[set$points$SVD1 > 0, ], threshold = 0.05,
#'                          name = "SVD1 > 0")
#'
#' # Individual unit network
#' qe_plot(set) |> qe_edges(unit = "FirstGame::steven z")
#'
#' # Individual unit + show all group means
#' qe_plot(set) |> qe_group() |> qe_edges(unit = "FirstGame::steven z")
#'
#' # Subtraction
#' qe_plot(set) |> qe_edges("FirstGame", compare = "SecondGame")
#'
#' # Overlay
#' qe_plot(set) |> qe_edges("FirstGame", also = "SecondGame")
#'
#' # No edges (means and/or points only)
#' qe_plot(set) |> qe_group() |> qe_edges(show = FALSE)
#' }
#'
#' @export
qe_edges <- function(p, group = NULL, unit = NULL, weights = NULL,
                     compare = NULL, also = NULL,
                     colors = NULL, threshold = NULL, name = NULL, show = TRUE,
                     color_scale = c("model", "plot", "absolute"), edge_width = NULL,
                     magnify = NULL) {
  if (!is.null(group) && !is.null(unit))
    stop("qe_edges(): supply either 'group' or 'unit', not both.", call. = FALSE)
  if (!is.null(weights) && (!is.null(group) || !is.null(unit)))
    stop("qe_edges(): supply 'weights' or a 'group' / 'unit' name, not both.", call. = FALSE)

  if (!show) {
    # TypeScript reads getAttribute('edges') !== 'false', so we must emit the
    # string "false" — a logical FALSE would be omitted and edges would stay on.
    p$graph_opts$edges   <- "false"
    p$graph_opts$group   <- NULL
    p$graph_opts$unit    <- NULL
    p$graph_opts$compare <- NULL
    p$graph_opts$also    <- NULL
    p$graph_opts[["edge-named"]]  <- NULL
    p$graph_opts[["edge-layers"]] <- NULL
    p$model$networks <- NULL
    return(p)
  }

  color_scale <- match.arg(color_scale)
  if (!is.null(edge_width) && !(is.numeric(edge_width) && length(edge_width) == 1L &&
                                is.finite(edge_width) && edge_width > 0 && edge_width <= 1))
    stop("qe_edges(): edge_width must be a number in (0, 1].", call. = FALSE)
  if (!is.null(magnify) && !(is.numeric(magnify) && length(magnify) == 1L &&
                             is.finite(magnify) && magnify > 0))
    stop("qe_edges(): magnify must be a positive number.", call. = FALSE)
  layer_attrs <- .qe_layer_attrs(colors, threshold)

  p$graph_opts$edges   <- TRUE
  p$graph_opts[["edge-color-scale"]] <- if (color_scale == "model") NULL else color_scale
  if (!is.null(edge_width)) p$graph_opts[["edge-width"]] <- edge_width
  if (!is.null(magnify))    p$graph_opts[["edge-magnify"]] <- magnify

  # ── Explicit data: append one layer per network ────────────────────────────
  if (!is.null(weights)) {
    if (!is.null(also))
      stop("qe_edges(): 'also' takes group names; for data, pass a list to 'weights'.",
           call. = FALSE)
    cols <- .qe_edge_columns(p$model)
    nets <- if (is.list(weights) && !is.data.frame(weights)) weights else list(weights)
    base <- length(p$graph_opts[["edge-layers"]])
    for (k in seq_along(nets)) {
      w <- .qe_resolve_weights(nets[[k]], cols, "weights")
      if (!is.null(compare)) {
        w <- w - if (is.character(compare) && length(compare) == 1L)
          .qe_group_network(p, compare, cols)
        else .qe_resolve_weights(compare, cols, "compare")
      }
      lname <- if (!is.null(name) && length(nets) == 1L) name
               else if (!is.null(names(nets)) && nzchar(names(nets)[k])) names(nets)[k]
               else sprintf("network %d", base + k)
      p$model$networks <- .qe_append_network(p$model$networks, lname, w)
      p$graph_opts[["edge-layers"]] <- c(p$graph_opts[["edge-layers"]],
        list(c(list(network = lname), layer_attrs)))
    }
    return(p)
  }

  # ── By name: replace the named network ─────────────────────────────────────
  available_groups <- qe_groups(p)
  available_units  <- qe_units(p)

  # Validate group-based targets
  .check_group <- function(name, arg) {
    if (!is.null(name) && !name %in% available_groups) {
      stop(sprintf(
        "qe_edges(): %s = %s not found in model.\nAvailable groups: %s",
        arg, dQuote(name),
        paste(dQuote(available_groups), collapse = ", ")
      ), call. = FALSE)
    }
  }
  if (!is.null(compare) && !(is.character(compare) && length(compare) == 1L))
    stop("qe_edges(): 'compare' as data needs 'weights'; with 'group' it takes a group name.",
         call. = FALSE)
  .check_group(group,   "group")
  .check_group(compare, "compare")
  .check_group(also,    "also")

  # Validate unit ID
  if (!is.null(unit) && !unit %in% available_units) {
    stop(sprintf(
      "qe_edges(): unit = %s not found in model.\nUse qe_units() to see available unit IDs.",
      dQuote(unit)
    ), call. = FALSE)
  }

  if (!is.null(compare) && !is.null(also))
    stop("qe_edges(): supply either 'compare' or 'also', not both.", call. = FALSE)

  if (!is.null(unit) && (!is.null(compare) || !is.null(also)))
    stop("qe_edges(): 'compare' and 'also' cannot be combined with 'unit'.", call. = FALSE)

  p$graph_opts$group   <- group
  p$graph_opts$unit    <- unit
  p$graph_opts$compare <- compare
  p$graph_opts$also    <- also
  p$graph_opts[["edge-named"]] <- c(if (!is.null(name)) list(name = name), layer_attrs)
  p
}

# ── Explicit-network helpers ────────────────────────────────────────────────

# Edge columns of the model: every "A.B" column of the edges frame whose parts
# are both node codes (ONA includes the self-connections "A.A").
.qe_edge_columns <- function(model) {
  codes <- vapply(model$nodes$data, function(r) as.character(r[[model$node_id_col]]), "")
  pairs <- as.vector(outer(codes, codes, paste, sep = "."))
  intersect(names(model$edges$types), pairs)
}

.qe_norm_names <- function(x) gsub(" & ", ".", x, fixed = TRUE)

# Any rENA-style network input → a numeric vector named by `cols`.
.qe_resolve_weights <- function(x, cols, arg) {
  if (is.data.frame(x) || is.matrix(x)) {
    df <- as.data.frame(x, check.names = FALSE)
    df <- df[, vapply(df, is.numeric, logical(1)), drop = FALSE]
    x  <- colMeans(as.matrix(df))
    if (is.null(names(x)) && length(x) == length(cols)) names(x) <- cols
  }
  if (!is.numeric(x))
    stop(sprintf("qe_edges(): '%s' must be numeric (vector, matrix or data frame).", arg),
         call. = FALSE)
  if (is.null(names(x))) {
    if (length(x) != length(cols))
      stop(sprintf("qe_edges(): unnamed '%s' has %d values; the model has %d edge columns.",
                   arg, length(x), length(cols)), call. = FALSE)
    names(x) <- cols
  }
  names(x) <- .qe_norm_names(names(x))
  unknown <- setdiff(names(x), cols)
  if (length(unknown))
    stop(sprintf("qe_edges(): '%s' has edges not in the model: %s\nExamples of valid names: %s",
                 arg, paste(utils::head(unknown, 3), collapse = ", "),
                 paste(utils::head(cols, 3), collapse = ", ")), call. = FALSE)
  out <- stats::setNames(numeric(length(cols)), cols)
  out[names(x)] <- as.numeric(x)
  out
}

# A group's mean network from the model's edges frame (for `compare = "B"`).
.qe_group_network <- function(p, group, cols) {
  gcol <- p$model$group_col
  rows <- Filter(function(r) identical(as.character(r[[gcol]]), group), p$model$edges$data)
  if (!length(rows))
    stop(sprintf("qe_edges(): compare = %s not found in model.", dQuote(group)), call. = FALSE)
  colMeans(do.call(rbind, lapply(rows, function(r) unlist(r[cols]))))
}

.qe_append_network <- function(frame, name, w) {
  row <- c(list(name = name), as.list(w))
  if (is.null(frame)) {
    types <- c(list(name = "character"), stats::setNames(as.list(rep("numeric", length(w))), names(w)))
    return(list(data = list(row), types = types))
  }
  frame$data <- c(Filter(function(r) !identical(r$name, name), frame$data), list(row))
  frame
}

.qe_layer_attrs <- function(colors, threshold) {
  if (!is.null(colors) && !(is.character(colors) && length(colors) %in% 1:2))
    stop("qe_edges(): colors must be one or two colours.", call. = FALSE)
  if (!is.null(threshold) && !(is.numeric(threshold) && length(threshold) %in% 1:2 &&
                               all(is.finite(threshold)) && all(threshold >= 0)))
    stop("qe_edges(): threshold must be c(min, max) or min, non-negative.", call. = FALSE)
  c(if (!is.null(colors)) list(colors = paste(colors, collapse = ",")),
    if (!is.null(threshold)) list(threshold = paste(threshold, collapse = ",")))
}

#' Show or hide unit points
#'
#' @param p    A `qe_plot` object.
#' @param show Logical. Default `TRUE`; `FALSE` clears all points and point sets.
#' @param units  Unit IDs to draw as a point set (a subset of the model's units).
#' @param points An arbitrary points matrix / data frame / `ena.points` rows
#'   (as rENA's `ena.plot.points()` accepts). IDs come from the model's id
#'   column when present; dimensions from the model's x / y columns, else the
#'   first two numeric columns.
#' @param color  One colour, or one per point. Default: each point's group
#'   colour, else a palette colour per set.
#' @param shape  `"circle"` (default), `"square"`, `"triangle"` or `"diamond"`;
#'   one or one per point. rENA's `"triangle-up"` is accepted.
#' @param labels Per-point label text (shown per the point label mode).
#' @param name   Point-set name; calls with `units` / `points` add a set, and a
#'   repeated name replaces it. Default `"points 1"`, `"points 2"`, ….
#' @param size Optional numeric dot size. Omit for the default (2.5).  Larger
#'   values draw bigger dots; the size is relative to the code-node size.
#' @param fixed_size Logical. When `TRUE`, unit dots keep a constant on-screen
#'   pixel size regardless of data extent, container size, or zoom. Default
#'   `FALSE` (dots scale with the coordinate space, like nodes and edges).
#' @return The modified `qe_plot` object.
#' @export
qe_points <- function(p, show = TRUE, units = NULL, points = NULL,
                      color = NULL, shape = NULL, labels = NULL, name = NULL,
                      size = NULL, fixed_size = FALSE) {
  if (!show) {
    p$graph_opts$points <- FALSE
    p$graph_opts[["point-sets"]] <- NULL
    p$model$pointsets <- NULL
    return(p)
  }
  if (is.null(units) && is.null(points)) {
    # All unit points, coloured by group (0.4 behaviour).
    p$graph_opts$points <- TRUE
    p$graph_opts[["point-size"]] <- size
    p$graph_opts[["point-fixed-size"]] <- isTRUE(fixed_size)
    return(p)
  }
  if (!is.null(units) && !is.null(points))
    stop("qe_points(): supply 'units' or 'points', not both.", call. = FALSE)

  m <- p$model
  df <- if (!is.null(units)) {
    all <- .qe_frame_df(m$points)
    bad <- setdiff(units, all[[m$id_col]])
    if (length(bad))
      stop(sprintf("qe_points(): unit(s) not in model: %s", paste(dQuote(utils::head(bad, 3)), collapse = ", ")),
           call. = FALSE)
    all[match(units, all[[m$id_col]]), , drop = FALSE]
  } else .qe_point_frame(points, m)

  n   <- nrow(df)
  set <- name %||% sprintf("points %d", length(p$graph_opts[["point-sets"]]) + 1L)
  rows <- data.frame(set = rep(set, n), id = as.character(df[[m$id_col]]), stringsAsFactors = FALSE)
  rows[[m$x_col]] <- df[[m$x_col]]
  rows[[m$y_col]] <- df[[m$y_col]]
  if (!is.null(df[[m$group_col]])) rows$group <- as.character(df[[m$group_col]])
  per_point <- function(v, arg) {
    if (is.null(v)) return(NULL)
    if (!length(v) %in% c(1L, n))
      stop(sprintf("qe_points(): '%s' must have length 1 or %d.", arg, n), call. = FALSE)
    rep_len(as.character(v), n)
  }
  rows$color <- per_point(color, "color")
  rows$shape <- per_point(if (is.null(shape)) NULL else .qe_shape(shape, "qe_points"), "shape")
  rows$label <- per_point(labels, "labels")

  p$model$pointsets <- .qe_upsert_rows(p$model$pointsets,
    rows, key = NULL, drop = function(r) identical(r$set, set))
  p$graph_opts[["point-sets"]] <- c(Filter(function(s) !identical(s$set, set),
                                           p$graph_opts[["point-sets"]]),
    list(list(set = set, size = size, fixed = isTRUE(fixed_size))))
  p
}

# ── Explicit point / group helpers ─────────────────────────────────────────

# A QEFrame back to a data.frame (rows may lack some columns).
.qe_frame_df <- function(frame) {
  if (is.null(frame) || !length(frame$data)) return(data.frame())
  cols <- names(frame$types)
  do.call(rbind, lapply(frame$data, function(r) {
    r <- lapply(cols, function(k) if (is.null(r[[k]])) NA else r[[k]])
    as.data.frame(stats::setNames(r, cols), stringsAsFactors = FALSE, check.names = FALSE)
  }))
}

# Append rows to a QEFrame; rows whose `key` value (or `drop(row)`) matches
# are replaced. Columns are unioned (missing values → NA).
.qe_upsert_rows <- function(frame, rows, key, drop = NULL) {
  old <- .qe_frame_df(frame)
  if (nrow(old)) {
    keep <- if (!is.null(drop)) !vapply(seq_len(nrow(old)), function(i) drop(as.list(old[i, ])), TRUE)
            else !(old[[key]] %in% rows[[key]])
    old <- old[keep, , drop = FALSE]
  }
  all_cols <- union(names(old), names(rows))
  pad <- function(d) { for (k in setdiff(all_cols, names(d))) d[[k]] <- rep(NA, nrow(d)); d[all_cols] }
  qe_frame(rbind(if (nrow(old)) pad(old), pad(rows)))
}

# Any rENA-style points input → data.frame with the model's id / x / y (and
# group, when present) columns. Dimensions: the model's x_col / y_col when the
# input has them, else its first two numeric columns (rENA's convention).
.qe_point_frame <- function(x, model) {
  df <- as.data.frame(x, check.names = FALSE)
  df <- df[, !duplicated(names(df)), drop = FALSE]
  num <- names(df)[vapply(df, is.numeric, logical(1))]
  dims <- if (all(c(model$x_col, model$y_col) %in% num)) c(model$x_col, model$y_col) else num[1:2]
  if (length(num) < 2 || anyNA(dims))
    stop("need at least two numeric (dimension) columns in 'points'.", call. = FALSE)
  out <- data.frame(id = if (model$id_col %in% names(df)) as.character(df[[model$id_col]])
                         else if (!is.null(rownames(x))) rownames(x) else as.character(seq_len(nrow(df))),
                    stringsAsFactors = FALSE)
  names(out) <- model$id_col
  out[[model$x_col]] <- df[[dims[1]]]
  out[[model$y_col]] <- df[[dims[2]]]
  if (!is.null(model$group_col) && model$group_col %in% names(df))
    out[[model$group_col]] <- as.character(df[[model$group_col]])
  out
}

.qe_shape <- function(shape, fn) {
  alias <- c(circle = "circle", square = "rect", rect = "rect", triangle = "triangle",
             `triangle-up` = "triangle", diamond = "diamond")
  bad <- setdiff(shape, names(alias))
  if (length(bad))
    stop(sprintf('%s(): shape must be "circle", "square", "triangle" or "diamond".', fn),
         call. = FALSE)
  unname(alias[shape])
}

#' Show or hide the code nodes
#'
#' By default (`"auto"`) code nodes are drawn only when an edge network is
#' drawn, matching rENA, where nodes are part of `ena.plot.network()`: the
#' `<qe-nodes>` element is emitted only then.  Node positions always come from
#' the model and set the plot extent, so the scale does not change.
#'
#' Each node's diameter equals the summed widths of its drawn edges (for
#' directed / ONA models, only the edges directed at the node, plus its
#' self-connection), so node size is proportional to its accumulated
#' connection weight and comparable across plots of the same model.
#'
#' @param p    A `qe_plot` object.
#' @param show `"auto"` (default), `"always"`, or `"never"`.  `TRUE` / `FALSE`
#'   are accepted as `"always"` / `"never"`.
#' @param unconnected What to draw for nodes with no drawn edges: `"dot"`
#'   (default, a tiny dot that still marks the code's position) or `"hide"`
#'   (omit the node and its label).
#' @param positions Node positions for this plot, replacing the model's (as
#'   rENA's `ena.plot.network(node.positions =)`): a data frame / matrix /
#'   `rotation$nodes`-like table with a code column (the model's node id
#'   column, `code`, or row names) and two numeric columns (the model's x / y
#'   columns when present, else the first two numeric ones). A subset of codes
#'   moves only those nodes. Edges, node sizes, labels and the plot extent all
#'   follow the new positions.
#' @param labels Display text per code: a named character vector
#'   (`c(Technical.Constraints = "Tech. constraints")`). The code stays the
#'   node's identity (events, edges); only the drawn label changes.
#' @return The modified `qe_plot` object.
#' @examples
#' \dontrun{
#' # Means only, but keep the code nodes for orientation
#' qe_plot(set) |> qe_group() |> qe_nodes("always")
#' }
#' @export
qe_nodes <- function(p, show = c("auto", "always", "never"),
                     unconnected = c("dot", "hide"), positions = NULL, labels = NULL) {
  if (isTRUE(show))  show <- "always"
  if (isFALSE(show)) show <- "never"
  show <- match.arg(show)
  unconnected <- match.arg(unconnected)
  p$graph_opts[["nodes-show"]] <- show
  p$graph_opts[["nodes-unconnected"]] <- if (unconnected == "hide") "hide" else NULL

  if (!is.null(positions) || !is.null(labels)) {
    m     <- p$model
    nodes <- .qe_frame_df(m$nodes)
    idc   <- m$node_id_col
    codes <- as.character(nodes[[idc]])
    check <- function(got, arg) {
      bad <- setdiff(got, codes)
      if (length(bad))
        stop(sprintf("qe_nodes(): '%s' has codes not in the model: %s\nModel codes: %s", arg,
                     paste(dQuote(utils::head(bad, 3)), collapse = ", "),
                     paste(utils::head(codes, 4), collapse = ", ")), call. = FALSE)
    }
    if (!is.null(positions)) {
      pos <- as.data.frame(positions, check.names = FALSE)
      pc  <- if (idc %in% names(pos)) as.character(pos[[idc]])
             else if ("code" %in% names(pos)) as.character(pos$code)
             else if (!is.null(rownames(positions))) rownames(positions)
             else stop("qe_nodes(): 'positions' needs a code column or row names.", call. = FALSE)
      num  <- names(pos)[vapply(pos, is.numeric, logical(1))]
      dims <- if (all(c(m$x_col, m$y_col) %in% num)) c(m$x_col, m$y_col) else num[1:2]
      if (length(num) < 2 || anyNA(dims))
        stop("qe_nodes(): 'positions' needs two numeric (x, y) columns.", call. = FALSE)
      check(pc, "positions")
      i <- match(pc, codes)
      nodes[[m$x_col]][i] <- pos[[dims[1]]]
      nodes[[m$y_col]][i] <- pos[[dims[2]]]
    }
    if (!is.null(labels)) {
      if (!is.character(labels) || is.null(names(labels)))
        stop("qe_nodes(): 'labels' must be a named character vector (code = text).", call. = FALSE)
      check(names(labels), "labels")
      if (is.null(nodes$label)) nodes$label <- NA_character_
      nodes$label[match(names(labels), codes)] <- unname(labels)
    }
    p$model$nodes <- qe_frame(nodes)
  }
  p
}

#' Show or hide the axes
#'
#' Adds a `<qe-axes>` layer (the x/y axis cross) to the rendered graph.  Axis
#' labels are opt-in: each of `x` and `y` is `FALSE` (no label) by default;
#' `TRUE` uses the dimension name (e.g. `"SVD1"`) and a string sets custom text.
#'
#' @param p    A `qe_plot` object.
#' @param x    `TRUE` to label the x-axis with its dimension name, a string for
#'   custom text, or `FALSE` for no x-axis label.  Default `FALSE`.
#' @param y    Same as `x`, for the y-axis.  Default `FALSE`.
#' @param show Logical. `FALSE` suppresses the axes entirely.  Default `TRUE`.
#' @return The modified `qe_plot` object.
#' @export
qe_axes <- function(p, x = FALSE, y = FALSE, show = TRUE) {
  if (!show) {
    p$graph_opts$axes <- FALSE
    return(p)
  }
  p$graph_opts$axes <- TRUE
  p$graph_opts[["axis-x"]] <- x
  p$graph_opts[["axis-y"]] <- y
  p
}

#' Show or hide trajectory paths
#'
#' Adds a `<qe-trajectories>` layer to the rendered graph.  QEviz only renders
#' supplied trajectory rows; accumulation, dooring, model selection, and
#' inference remain the caller's responsibility.
#'
#' @param p A `qe_plot` object.
#' @param units Optional character vector of unit IDs to show.  Omit to show all
#'   units present in the model's `trajectories` frame.
#' @param smooth Path treatment: `"none"` for observed steps or `"poly"` for
#'   polynomial smoothing.
#' @param max_degree Upper bound on polynomial degree when `smooth = "poly"`.
#'   With `degree_selection = "loocv_2d"` the actual degree is chosen in
#'   `1..max_degree`; with `"fixed"` this degree is always used.
#' @param degree_selection Degree selection when `smooth = "poly"`. `"loocv_2d"`
#'   (default) picks the degree by joint 2D leave-one-out cross-validation;
#'   `"fixed"` always uses `max_degree`. Near-origin points are excluded from the
#'   fit (still drawn), matching `ena.plot.trajectory()`.
#' @param points Logical. Show observed state dots.
#' @param tips Logical. Show the leading current-state marker.
#' @param playhead Optional numeric time value. Rows after this value are hidden.
#' @param line_style `"uniform"` or `"tapered"`.
#' @param stroke_width Uniform stroke width in display pixels.
#' @param stroke_width_range Numeric length-2 vector for tapered paths.
#' @param opacity_range Numeric length-2 vector for tapered paths.
#' @param show Logical. `FALSE` suppresses trajectory rendering.
#'
#' @return The modified `qe_plot` object.
#'
#' @export
qe_trajectories <- function(p, units = NULL, smooth = c("none", "poly"),
                            max_degree = 3L,
                            degree_selection = c("loocv_2d", "fixed"),
                            points = TRUE, tips = TRUE,
                            playhead = NULL,
                            line_style = c("uniform", "tapered"),
                            stroke_width = 2,
                            stroke_width_range = c(1, 6),
                            opacity_range = c(0.3, 1),
                            show = TRUE) {
  if (!show) {
    p$graph_opts$trajectories <- FALSE
    return(p)
  }

  smooth <- match.arg(smooth)
  degree_selection <- match.arg(degree_selection)
  line_style <- match.arg(line_style)

  if (!is.null(units)) {
    available <- qe_trajectory_units(p)
    bad <- units[!units %in% available]
    if (length(bad) > 0) {
      stop(sprintf(
        "qe_trajectories(): unit(s) not found in model: %s\nAvailable: %s",
        paste(dQuote(bad), collapse = ", "),
        paste(dQuote(available), collapse = ", ")
      ), call. = FALSE)
    }
  }

  p$graph_opts$trajectories <- TRUE
  p$graph_opts[["trajectory-units"]] <- if (is.null(units)) NULL else paste(units, collapse = ",")
  p$graph_opts[["trajectory-smooth"]] <- smooth
  p$graph_opts[["trajectory-max-degree"]] <- as.integer(max_degree)
  p$graph_opts[["trajectory-degree-selection"]] <- degree_selection
  p$graph_opts[["trajectory-points"]] <- isTRUE(points)
  p$graph_opts[["trajectory-tips"]] <- isTRUE(tips)
  p$graph_opts[["trajectory-playhead"]] <- playhead
  p$graph_opts[["trajectory-line-style"]] <- line_style
  p$graph_opts[["trajectory-stroke-width"]] <- stroke_width
  p$graph_opts[["trajectory-stroke-width-range"]] <- paste(stroke_width_range, collapse = ",")
  p$graph_opts[["trajectory-opacity-range"]] <- paste(opacity_range, collapse = ",")
  p
}

#' Control label visibility
#'
#' @param p      A `qe_plot` object.
#' @param nodes  Label mode for code nodes.  One of `"on"`, `"off"`,
#'   `"click"`, `"auto"`. Default `"on"`.
#' @param means  Label mode for group means. Default `"on"`.
#' @param points Label mode for unit points. Default `"auto"`.
#' @param font_size   Label font size in **pixels** (constant on screen, as in
#'   rENA). Default: scales with the plot. The title is drawn at 1.35×.
#' @param font_family Label (and title) font family, e.g. `"Georgia"`.
#' @param font_color  Label (and title) colour. Default: each label's own colour
#'   (group colours for means).
#' @return The modified `qe_plot` object.
#' @export
qe_labels <- function(p, nodes = "on", means = "on", points = "auto",
                      font_size = NULL, font_family = NULL, font_color = NULL) {
  if (!is.null(font_size) && !(is.numeric(font_size) && length(font_size) == 1L && font_size > 0))
    stop("qe_labels(): font_size must be a positive number of pixels.", call. = FALSE)
  p$graph_opts[["label-nodes"]]  <- nodes
  p$graph_opts[["label-means"]]  <- means
  p$graph_opts[["label-points"]] <- points
  p$graph_opts[["label-font-size"]]   <- font_size
  p$graph_opts[["label-font-family"]] <- font_family
  p$graph_opts[["label-font-color"]]  <- font_color
  p
}


# ══ Output functions ═══════════════════════════════════════════════════════════
# All three accept a qe_plot object, a raw ena.set, or a plain ModelData list.

#' Return a qeviz plot as an HTML string
#'
#' @param x           A `qe_plot` object, a raw rENA / tma / ona set, or a
#'   `ModelData` list from [qe_model_data()] / [qe_extract()].
#' @param title       `<title>` text. Defaults to the title stored in the
#'   `qe_plot` object when one is supplied.
#' @param graph_opts  Named list of `<qe-graph>` attribute overrides.  When `x`
#'   is a `qe_plot` object the stored opts are used as the base; keys supplied
#'   here take precedence.
#' @param ...         Additional arguments forwarded to [qe_extract()] when `x`
#'   is a raw set.
#' @return A single character string containing a complete HTML document.
#' @examples
#' \dontrun{
#' writeLines(qe_html(set), "plot.html")
#' writeLines(qe_html(qe_plot(set) |> qe_group("FirstGame")), "plot.html")
#' }
#' @export
qe_html <- function(x, title = NULL, graph_opts = list(), ...) {
  model <- .to_model(x, ...)
  opts  <- .resolve_opts(x, graph_opts)
  ttl   <- .resolve_title(x, title)
  json  <- jsonlite::toJSON(model, auto_unbox = TRUE, digits = 6, null = "null")
  .build_html(json, title = ttl, graph_opts = opts)
}

#' Write a self-contained qeviz HTML file
#'
#' @param x          A `qe_plot` object, a raw rENA / tma / ona set, or a
#'   `ModelData` list.
#' @param file       Output file path (should end in `.html`).
#' @param title      `<title>` text (defaults to stored title for `qe_plot` objects).
#' @param graph_opts Named list of `<qe-graph>` attribute overrides.
#' @param open       If `TRUE` (default when interactive), open after writing.
#' @param ...        Additional arguments forwarded to [qe_extract()] when `x`
#'   is a raw set.
#' @return The normalised `file` path, invisibly.
#' @examples
#' \dontrun{
#' qe_export_html(set, "ena_plot.html")
#' qe_export_html(qe_plot(set) |> qe_group("FirstGame"), "fg.html")
#' }
#' @export
qe_export_html <- function(x, file, title = NULL, graph_opts = list(),
                           open = interactive(), ...) {
  html <- qe_html(x, title = title, graph_opts = graph_opts, ...)
  writeLines(html, file)
  if (open) .open_viewer(file)
  invisible(normalizePath(file))
}

#' Return a qeviz plot as an embeddable HTML fragment
#'
#' Returns a `<div>` with the inlined bundle and a `<qe-visual>` / `<qe-graph>`
#' pair — no `<html>` wrapper, suitable for R Markdown / Quarto via
#' `htmltools::HTML()`.
#'
#' @param x           A `qe_plot` object, a raw rENA / tma / ona set, or a
#'   `ModelData` list.
#' @param height      CSS height of the containing `<div>`. Default `"480px"`.
#' @param graph_opts  Named list of `<qe-graph>` attribute overrides.
#' @param ...         Additional arguments forwarded to [qe_extract()] when `x`
#'   is a raw set.
#' @return A character string of class `"html"`.
#' @examples
#' \dontrun{
#' htmltools::HTML(qe_fragment(set))
#' htmltools::HTML(qe_fragment(qe_plot(set) |> qe_group("FirstGame")))
#' }
#' @export
qe_fragment <- function(x, height = "480px", graph_opts = list(), ...) {
  model      <- .to_model(x, ...)
  opts       <- .resolve_opts(x, graph_opts)
  json       <- jsonlite::toJSON(model, auto_unbox = TRUE, digits = 6, null = "null")
  bundle     <- .bundle_js()
  graph_elem <- .build_graph_element(opts)
  uid        <- paste0("qeviz", as.integer(proc.time()[["elapsed"]] * 1e4) %% 1e9L)

  html <- sprintf(
    '<div style="width:100%%;height:%s">\n<script>%s</script>\n<qe-visual id="%s">\n  %s\n</qe-visual>\n<script>\ndocument.getElementById("%s").setModelData(%s);\n</script>\n</div>',
    height, bundle, uid, graph_elem, uid, json
  )
  structure(html, class = c("html", "character"))
}

# ── Internal: open a file in RStudio viewer or browser ────────────────────────

.open_viewer <- function(path) {
  path <- normalizePath(path)
  if (requireNamespace("rstudioapi", quietly = TRUE) &&
      rstudioapi::isAvailable() &&
      rstudioapi::hasFun("viewer")) {
    rstudioapi::viewer(path)
  } else {
    utils::browseURL(paste0("file://", path))
  }
  invisible(path)
}
