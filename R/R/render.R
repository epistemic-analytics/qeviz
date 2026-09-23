# render.R — HTML rendering and display

# ── Internal: locate and read the bundled JS ───────────────────────────────────

.bundle_js <- function() {
  path <- system.file("qeviz.umd.js", package = "qeviz")
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
  if (inherits(x, "qe_plot")) x$title else "qeviz"
}

# ── Internal: build the <qe-graph> element with child layer elements ──────────
#
# Each declarative child element maps directly to a rendering layer:
#   <qe-nodes>  — code-node labels (always rendered; controls label mode)
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

  # ── <qe-nodes> — always emitted; controls node label mode ────────────────
  node_label <- opts[["label-nodes"]] %||% "on"
  children <- c(children,
    sprintf('    <qe-nodes label="%s"></qe-nodes>', node_label))

  # ── <qe-means> — show group means + optional CI boxes ────────────────────
  # Omit entirely only if explicitly suppressed (not currently exposed in API;
  # defaults to present so `qe_plot(set)` always shows group means).
  means_parts <- character(0)
  if (!is.null(opts[["groups"]]))
    means_parts <- c(means_parts, sprintf('groups="%s"', opts[["groups"]]))
  if (!isFALSE(opts[["confidence"]]))
    means_parts <- c(means_parts, "confidence")
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
    if (length(edge_parts) > 0) {
      children <- c(children,
        sprintf('    <qe-edges %s></qe-edges>', paste(edge_parts, collapse = " ")))
    }
  }

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

  children_str <- paste(children, collapse = "\n")
  sprintf('<qe-graph width="%s" height="%s">\n%s\n  </qe-graph>', w, h, children_str)
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
#' @param title   Window / tab title used when the plot is saved or opened.
#' @param width   CSS width string. Default `"100%"`.
#' @param height  Plot height in pixels (numeric) or any CSS string. Default `440`.
#' @param ...     Additional arguments forwarded to [qe_extract()] when `x` is a
#'   raw set (e.g. `group_col = "Condition"`).  Directionality is detected
#'   automatically from the set class and rarely needs to be overridden.
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
qe_plot <- function(x, title = "qeviz", width = "100%", height = 440, ...) {
  p <- structure(
    list(
      model      = .to_model(x, ...),
      title      = title,
      graph_opts = list()
    ),
    class = "qe_plot"
  )
  p$graph_opts$width  <- width
  p$graph_opts$height <- as.character(height)
  p
}

#' Render a qe_plot object in the viewer
#'
#' Called automatically when a `qe_plot` object is returned at the top level
#' of the console.  Writes to a temp file and opens the RStudio viewer or
#' the system browser.
#'
#' @param x A `qe_plot` object.
#' @param ... Ignored.
#' @export
print.qe_plot <- function(x, ...) {
  tmp <- tempfile(fileext = ".html")
  qe_export_html(x, tmp, open = TRUE)
  invisible(x)
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
#' @param by        The metadata column used for grouping (e.g. `"Condition"`).
#'   Optional — used to validate against the column baked into the model at
#'   extraction time.  An error is raised if the column name does not match.
#' @param intervals Logical.  Show 95% CI box(es) around group mean(s).
#'   Default `TRUE`.
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
qe_group <- function(p, ..., by = NULL, intervals = TRUE, fixed_size = FALSE) {
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

  # Validate requested group names against model
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
    # Comma-separated list → `groups` attribute (means filter)
    p$graph_opts$groups <- paste(requested, collapse = ",")
  } else {
    # No names → show all groups; remove any previous filter
    p$graph_opts$groups <- NULL
  }

  p$graph_opts$confidence <- intervals
  p$graph_opts[["mean-fixed-size"]] <- isTRUE(fixed_size)
  p
}

#' Select which edge network to draw
#'
#' Controls edge rendering.  Supply **either** a group name (`group`) **or** a
#' specific unit ID (`unit`) as the primary edge source; `compare` or `also`
#' optionally bring in a second group for subtraction or overlay.  Omitting both
#' `group` and `unit` (or calling `qe_edges(show = FALSE)`) suppresses the edge
#' network entirely, leaving only group means and unit points visible.
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
#' @param compare Name of a second group to subtract (`group − compare`).
#'   Positive differences use the primary colour; negative use the secondary.
#'   Cannot be combined with `unit`.
#' @param also    Name of a second group to overlay alongside `group`.
#'   Cannot be combined with `unit`.
#' @param show    Logical.  `FALSE` suppresses all edge rendering regardless of
#'   other arguments.  Default `TRUE`.
#'
#' @return The modified `qe_plot` object.
#'
#' @examples
#' \dontrun{
#' # Single group mean network
#' qe_plot(set) |> qe_edges("FirstGame")
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
qe_edges <- function(p, group = NULL, unit = NULL,
                     compare = NULL, also = NULL, show = TRUE) {
  if (!is.null(group) && !is.null(unit))
    stop("qe_edges(): supply either 'group' or 'unit', not both.", call. = FALSE)

  if (!show) {
    # TypeScript reads getAttribute('edges') !== 'false', so we must emit the
    # string "false" — a logical FALSE would be omitted and edges would stay on.
    p$graph_opts$edges   <- "false"
    p$graph_opts$group   <- NULL
    p$graph_opts$unit    <- NULL
    p$graph_opts$compare <- NULL
    p$graph_opts$also    <- NULL
    return(p)
  }

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

  p$graph_opts$edges   <- TRUE
  p$graph_opts$group   <- group
  p$graph_opts$unit    <- unit
  p$graph_opts$compare <- compare
  p$graph_opts$also    <- also
  p
}

#' Show or hide unit points
#'
#' @param p    A `qe_plot` object.
#' @param show Logical. Default `TRUE`.
#' @param size Optional numeric dot size. Omit for the default (2.5).  Larger
#'   values draw bigger dots; the size is relative to the code-node size.
#' @param fixed_size Logical. When `TRUE`, unit dots keep a constant on-screen
#'   pixel size regardless of data extent, container size, or zoom. Default
#'   `FALSE` (dots scale with the coordinate space, like nodes and edges).
#' @return The modified `qe_plot` object.
#' @export
qe_points <- function(p, show = TRUE, size = NULL, fixed_size = FALSE) {
  p$graph_opts$points <- show
  p$graph_opts[["point-size"]] <- size
  p$graph_opts[["point-fixed-size"]] <- isTRUE(fixed_size)
  p
}

#' Show or hide the axes
#'
#' Adds a `<qe-axes>` layer (the x/y axis cross) to the rendered graph.  Each of
#' `x` and `y` adds a per-axis label: `TRUE` uses the dimension name, a string
#' sets custom text, and `FALSE` omits that axis label (the lines still show).
#'
#' @param p    A `qe_plot` object.
#' @param x    `TRUE` to label the x-axis with its dimension name, a string for
#'   custom text, or `FALSE` for no x-axis label.  Default `TRUE`.
#' @param y    Same as `x`, for the y-axis.  Default `TRUE`.
#' @param show Logical. `FALSE` suppresses the axes entirely.  Default `TRUE`.
#' @return The modified `qe_plot` object.
#' @export
qe_axes <- function(p, x = TRUE, y = TRUE, show = TRUE) {
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
#' @return The modified `qe_plot` object.
#' @export
qe_labels <- function(p, nodes = "on", means = "on", points = "auto") {
  p$graph_opts[["label-nodes"]]  <- nodes
  p$graph_opts[["label-means"]]  <- means
  p$graph_opts[["label-points"]] <- points
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
