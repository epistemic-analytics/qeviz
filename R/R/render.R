# render.R — HTML rendering and display

# ── Internal: locate and read the bundled JS ───────────────────────────────────

.bundle_js <- function() {
  path <- system.file("qeviz.umd.js", package = "qeviz")
  if (!nzchar(path) || !file.exists(path))
    stop("qeviz.umd.js not found in package inst/. Re-install the package.")
  paste(readLines(path, warn = FALSE), collapse = "\n")
}

# ── Internal: build a <qe-graph> attribute string ─────────────────────────────

.graph_attrs <- function(opts) {
  defaults <- list(
    width          = "100%",
    height         = "440",
    points         = TRUE,
    "label-nodes"  = "on",
    "label-points" = "auto"
  )
  # Merge user overrides (user values win)
  merged <- utils::modifyList(defaults, opts)
  parts <- mapply(function(k, v) {
    if (isTRUE(v))       k                          # boolean flag attribute
    else if (isFALSE(v)) NULL                        # omit false flags
    else                 sprintf('%s="%s"', k, v)
  }, names(merged), merged, SIMPLIFY = FALSE)
  paste(Filter(Negate(is.null), parts), collapse = " ")
}

# ── Internal: build the full HTML document string ─────────────────────────────

.build_html <- function(model_json, title = "qeviz", graph_opts = list()) {
  bundle  <- .bundle_js()
  g_attrs <- .graph_attrs(graph_opts)

  sprintf('<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%s</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem; background: #f5f5f5; }
    qe-visual { display: block; width: 100%%; height: 480px; }
    qe-graph  { display: block; width: 100%%; height: 100%%; }
  </style>
</head>
<body>
<qe-visual id="vis">
  <qe-graph id="graph" %s></qe-graph>
</qe-visual>
<script>%s</script>
<script>
const model = %s;
document.getElementById("vis").setModelData(model);
</script>
</body>
</html>', title, g_attrs, bundle, model_json)
}

# ── Public API ─────────────────────────────────────────────────────────────────

#' Return a qeviz plot as an HTML string
#'
#' Serialises `model` to JSON and wraps it in a self-contained HTML document
#' with the qeviz bundle inlined.  Useful for embedding in R Markdown / Quarto
#' via `htmltools::HTML()`, or for writing to a file manually.
#'
#' @param model       A `ModelData` list from [qe_model_data()] or [qe_extract()].
#' @param title       `<title>` text for the HTML document.
#' @param graph_opts  Named list of `<qe-graph>` attribute overrides.
#'   Defaults: `width="100%"`, `height="440"`, `points` (flag),
#'   `label-nodes="on"`, `label-points="auto"`.
#'   Pass `list("label-nodes" = "off")` to suppress node labels, etc.
#'
#' @return A single character string containing a complete HTML document.
#'
#' @examples
#' \dontrun{
#' html <- qe_html(model)
#' writeLines(html, "plot.html")
#' }
#'
#' @export
qe_html <- function(model, title = "qeviz", graph_opts = list()) {
  json <- jsonlite::toJSON(model, auto_unbox = TRUE, digits = 6, null = "null")
  .build_html(json, title = title, graph_opts = graph_opts)
}

#' Write a self-contained qeviz HTML file
#'
#' Equivalent to [qe_html()] but writes directly to `file`.
#'
#' @param model      A `ModelData` list.
#' @param file       Output file path (should end in `.html`).
#' @param title      `<title>` text.
#' @param graph_opts Named list of `<qe-graph>` attribute overrides (see [qe_html()]).
#' @param open       If `TRUE` (default when interactive), open the file in the
#'   RStudio viewer or default browser after writing.
#'
#' @return The normalised `file` path, invisibly.
#'
#' @examples
#' \dontrun{
#' qe_export_html(model, "ena_plot.html")
#' }
#'
#' @export
qe_export_html <- function(model, file, title = "qeviz",
                           graph_opts = list(), open = interactive()) {
  html <- qe_html(model, title = title, graph_opts = graph_opts)
  writeLines(html, file)
  if (open) .open_viewer(file)
  invisible(normalizePath(file))
}

#' Display a qeviz plot interactively
#'
#' Writes the plot to a temporary HTML file and opens it in the RStudio
#' viewer pane (if available) or the system browser.
#'
#' @param model      A `ModelData` list.
#' @param title      Window / tab title.
#' @param graph_opts Named list of `<qe-graph>` attribute overrides (see [qe_html()]).
#'
#' @return The path to the temporary HTML file, invisibly.
#'
#' @examples
#' \dontrun{
#' qe_plot(model)
#' qe_plot(model, graph_opts = list("label-nodes" = "off", height = "600"))
#' }
#'
#' @export
qe_plot <- function(model, title = "qeviz", graph_opts = list()) {
  tmp <- tempfile(fileext = ".html")
  qe_export_html(model, tmp, title = title, graph_opts = graph_opts, open = FALSE)
  .open_viewer(tmp)
  invisible(tmp)
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
