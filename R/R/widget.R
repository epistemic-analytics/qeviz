# widget.R — htmlwidget, knitr and Shiny output

#' Render a qeviz plot as an htmlwidget
#'
#' Wraps a [qe_plot()] chain as an htmlwidget, so it renders in the RStudio
#' Viewer, R Markdown / Quarto and Shiny, and can be saved with
#' [htmlwidgets::saveWidget()]. Printing a `qe_plot` uses this.
#'
#' @param p         A `qe_plot` object, or a set / `ModelData` list (passed to
#'   [qe_plot()] with `...`).
#' @param width,height Widget size — a number (pixels) or a CSS length.
#'   Default: the `width` / `height` given to [qe_plot()].
#' @param elementId Optional element id.
#' @param ...       Passed to [qe_plot()] when `p` is not a `qe_plot`.
#' @return An `htmlwidget`.
#' @examples
#' \dontrun{
#' w <- qe_plot(set) |> qe_edges("FirstGame") |> qe_widget()
#' htmlwidgets::saveWidget(w, "plot.html")
#' }
#' @export
qe_widget <- function(p, width = NULL, height = NULL, elementId = NULL, ...) {
  if (!inherits(p, "qe_plot")) p <- qe_plot(p, ...)
  opts <- p$graph_opts
  x <- list(
    model = as.character(jsonlite::toJSON(p$model, auto_unbox = TRUE, digits = 6, null = "null")),
    graph = .build_graph_element(opts)
  )
  htmlwidgets::createWidget(
    name         = "qeviz",
    x            = x,
    width        = .qe_css_size(width  %||% opts$width),
    height       = .qe_css_size(height %||% opts$height),
    package      = "qeviz",
    elementId    = elementId,
    dependencies = list(.qe_dependency()),
    sizingPolicy = htmlwidgets::sizingPolicy(
      defaultWidth  = "100%", defaultHeight = 440,
      viewer.padding = 5, browser.fill = TRUE,
      knitr.figure = FALSE, knitr.defaultWidth = "100%", knitr.defaultHeight = 440
    )
  )
}

#' Shiny bindings for qeviz
#'
#' `qeOutput()` places a plot in the UI; `renderQe()` fills it from an
#' expression returning a `qe_plot` or a [qe_widget()].
#'
#' @param outputId Shiny output id.
#' @param width,height CSS size of the output.
#' @param expr     Expression returning a `qe_plot` or `qe_widget()`.
#' @param env      Environment in which to evaluate `expr`.
#' @param quoted   Is `expr` already quoted?
#' @examples
#' \dontrun{
#' ui <- shiny::fluidPage(
#'   shiny::selectInput("g", "Group", c("FirstGame", "SecondGame")),
#'   qeOutput("plot")
#' )
#' server <- function(input, output) {
#'   output$plot <- renderQe(qe_plot(set) |> qe_edges(input$g) |> qe_group(input$g))
#' }
#' shiny::shinyApp(ui, server)
#' }
#' @export
qeOutput <- function(outputId, width = "100%", height = "440px") {
  htmlwidgets::shinyWidgetOutput(outputId, "qeviz", width, height, package = "qeviz")
}

#' @rdname qeOutput
#' @export
renderQe <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) expr <- substitute(expr)
  # Accept a qe_plot as well as a widget.
  expr <- bquote({
    .qe_val <- .(expr)
    if (inherits(.qe_val, "qe_plot")) qeviz::qe_widget(.qe_val) else .qe_val
  })
  htmlwidgets::shinyRenderWidget(expr, qeOutput, env, quoted = TRUE)
}

#' Render a qe_plot object in the viewer
#'
#' Called when a `qe_plot` is returned at the top level: shows it as a
#' [qe_widget()] in the RStudio Viewer or the browser.
#'
#' @param x A `qe_plot` object.
#' @param ... Ignored.
#' @export
print.qe_plot <- function(x, ...) {
  print(qe_widget(x))
  invisible(x)
}

# Registered in .onLoad so knitr stays a suggested package.
knit_print.qe_plot <- function(x, ..., options = NULL) {
  knitr::knit_print(qe_widget(x), ..., options = options)
}

.onLoad <- function(libname, pkgname) {
  if (requireNamespace("knitr", quietly = TRUE))
    registerS3method("knit_print", "qe_plot", knit_print.qe_plot, envir = asNamespace("knitr"))
  invisible()
}

.qe_dependency <- function() {
  htmltools::htmlDependency(
    name    = "qeviz",
    version = as.character(utils::packageVersion("qeviz")),
    src     = c(file = system.file("htmlwidgets", "lib", "qeviz", package = "qeviz")),
    script  = "qeviz.umd.js"
  )
}

# "440" -> 440 (pixels); CSS lengths ("100%", "30em") pass through.
.qe_css_size <- function(v) {
  if (is.null(v)) return(NULL)
  if (is.character(v) && grepl("^[0-9.]+$", v)) as.numeric(v) else v
}
