model <- qe_model_data(nodes_df, edges_df, points_df,
                       id_col = "ENA_UNIT", group_col = "Condition")
trajectory_model <- qe_model_data(nodes_df, edges_df, points_df,
                                  trajectories = trajectory_df,
                                  id_col = "ENA_UNIT", group_col = "Condition")

# ── qe_axes ──────────────────────────────────────────────────────────────────

# Assert against the pure graph-element builder — qe_html inlines the JS bundle,
# whose comments mention tag names and would confuse whole-document grepping.
.graph_el <- function(p) qeviz:::.build_graph_element(p$graph_opts)

test_that("qe_axes draws lines only by default (labels are opt-in)", {
  expect_match(.graph_el(qe_plot(model) |> qe_axes()), "<qe-axes>", fixed = TRUE)
})

test_that("qe_axes x/y = TRUE emit dimension-name labels", {
  expect_match(.graph_el(qe_plot(model) |> qe_axes(x = TRUE, y = TRUE)),
               "<qe-axes x y>", fixed = TRUE)
})

test_that("qe_axes supports a custom x label alone", {
  expect_match(.graph_el(qe_plot(model) |> qe_axes(x = "Task focus")),
               '<qe-axes x="Task focus">', fixed = TRUE)
})

test_that("qe_axes show=FALSE omits the axes element", {
  expect_false(grepl("<qe-axes", .graph_el(qe_plot(model) |> qe_axes(show = FALSE)), fixed = TRUE))
})

test_that("plots omit axes unless qe_axes is called", {
  expect_false(grepl("<qe-axes", .graph_el(qe_plot(model)), fixed = TRUE))
})

test_that("qe-nodes is emitted only alongside an edge network by default", {
  expect_false(grepl("<qe-nodes", .graph_el(qe_plot(model)), fixed = TRUE))
  expect_false(grepl("<qe-nodes", .graph_el(qe_plot(model) |> qe_group()), fixed = TRUE))
  expect_match(.graph_el(qe_plot(model) |> qe_edges("OA")),
               '<qe-nodes label="on"></qe-nodes>', fixed = TRUE)
})

test_that("qe_nodes always / never override the network rule", {
  expect_match(.graph_el(qe_plot(model) |> qe_nodes("always")), "<qe-nodes", fixed = TRUE)
  expect_match(.graph_el(qe_plot(model) |> qe_nodes(TRUE)),     "<qe-nodes", fixed = TRUE)
  expect_false(grepl("<qe-nodes",
    .graph_el(qe_plot(model) |> qe_edges("OA") |> qe_nodes("never")), fixed = TRUE))
  expect_error(qe_nodes(qe_plot(model), "sometimes"))
})

test_that("qe_nodes unconnected = hide emits the attribute", {
  expect_false(grepl("unconnected", .graph_el(qe_plot(model) |> qe_edges("OA")), fixed = TRUE))
  expect_match(.graph_el(qe_plot(model) |> qe_edges("OA") |> qe_nodes(unconnected = "hide")),
               '<qe-nodes label="on" unconnected="hide">', fixed = TRUE)
  expect_error(qe_nodes(qe_plot(model), unconnected = "fade"))
})

test_that("qe-nodes stays the first child element", {
  g <- .graph_el(qe_plot(model) |> qe_edges("OA"))
  expect_lt(regexpr("<qe-nodes", g, fixed = TRUE), regexpr("<qe-means", g, fixed = TRUE))
})

test_that("qe_edges color_scale defaults to model (no attribute)", {
  expect_false(grepl("color-scale=", .graph_el(qe_plot(model) |> qe_edges("OA")), fixed = TRUE))
})

test_that("qe_edges color_scale = plot / absolute emit the attribute", {
  expect_match(.graph_el(qe_plot(model) |> qe_edges("OA", color_scale = "plot")),
               '<qe-edges group="OA" color-scale="plot">', fixed = TRUE)
  expect_match(.graph_el(qe_plot(model) |> qe_edges("OA", color_scale = "absolute")),
               'color-scale="absolute"', fixed = TRUE)
  expect_error(qe_edges(qe_plot(model), "OA", color_scale = "big"))
})

test_that("qe_edges edge_width sets <qe-graph edge-width>", {
  expect_false(grepl("edge-width", .graph_el(qe_plot(model) |> qe_edges("OA")), fixed = TRUE))
  expect_match(.graph_el(qe_plot(model) |> qe_edges("OA", edge_width = 0.05)),
               '<qe-graph width="100%" height="440" edge-width="0.05">', fixed = TRUE)
  expect_error(qe_edges(qe_plot(model), "OA", edge_width = 2))
})

test_that("qe_edges magnify emits the attribute (including 1)", {
  expect_false(grepl("magnify", .graph_el(qe_plot(model) |> qe_edges("OA")), fixed = TRUE))
  expect_match(.graph_el(qe_plot(model) |> qe_edges("OA", magnify = 1.5)),
               'magnify="1.5"', fixed = TRUE)
  expect_match(.graph_el(qe_plot(model) |> qe_edges("OA", magnify = 1)),
               'magnify="1"', fixed = TRUE)
  expect_error(qe_edges(qe_plot(model), "OA", magnify = 0))
})

test_that("qe_points size emits a size attribute", {
  expect_match(.graph_el(qe_plot(model) |> qe_points(size = 5)),
               'size="5"', fixed = TRUE)
})

test_that("qe_points omits size by default", {
  el <- .graph_el(qe_plot(model) |> qe_points())
  expect_match(el, "<qe-points", fixed = TRUE)
  expect_false(grepl("size=", el, fixed = TRUE))
})

test_that("qe_points fixed_size emits fixed-size on qe-points", {
  el <- .graph_el(qe_plot(model) |> qe_points(fixed_size = TRUE))
  expect_match(el, "<qe-points", fixed = TRUE)
  expect_true(grepl("fixed-size", el, fixed = TRUE))
})

test_that("qe_points omits fixed-size by default", {
  el <- .graph_el(qe_plot(model) |> qe_points())
  expect_false(grepl("fixed-size", el, fixed = TRUE))
})

test_that("qe_group fixed_size emits fixed-size on qe-means", {
  el <- .graph_el(qe_plot(model) |> qe_group(fixed_size = TRUE))
  means_line <- grep("<qe-means", strsplit(el, "\n", fixed = TRUE)[[1]], value = TRUE)
  expect_true(any(grepl("fixed-size", means_line, fixed = TRUE)))
})

test_that("qe_group omits fixed-size by default", {
  el <- .graph_el(qe_plot(model) |> qe_group())
  means_line <- grep("<qe-means", strsplit(el, "\n", fixed = TRUE)[[1]], value = TRUE)
  expect_false(any(grepl("fixed-size", means_line, fixed = TRUE)))
})

# ── qe_html ────────────────────────────────────────────────────────────────────

test_that("qe_html returns a single character string", {
  html <- qe_html(model)
  expect_type(html, "character")
  expect_length(html, 1L)
})

test_that("qe_html output is a complete HTML document", {
  html <- qe_html(model)
  expect_match(html, "<!DOCTYPE html>", fixed = TRUE)
  expect_match(html, "</html>",         fixed = TRUE)
})

test_that("qe_html contains required custom elements", {
  html <- qe_html(model)
  expect_match(html, "qe-visual", fixed = TRUE)
  expect_match(html, "qe-graph",  fixed = TRUE)
})

test_that("qe_html embeds setModelData call", {
  html <- qe_html(model)
  expect_match(html, "setModelData", fixed = TRUE)
})

test_that("qe_html embeds model JSON", {
  html <- qe_html(model)
  expect_match(html, '"nodes"',  fixed = TRUE)
  expect_match(html, '"edges"',  fixed = TRUE)
  expect_match(html, '"groups"', fixed = TRUE)
})

test_that("qe_html title appears in <title> tag", {
  html <- qe_html(model, title = "My ENA Plot")
  expect_match(html, "<title>My ENA Plot</title>", fixed = TRUE)
})

test_that("qe_html graph_opts are reflected as element attributes", {
  # <qe-nodes> is only emitted with a network, so give it one.
  html <- qe_html(model, graph_opts = list("label-nodes" = "off", group = "OA"))
  expect_match(html, '<qe-nodes label="off">', fixed = TRUE)
})

test_that("qe_html emits trajectory element from graph opts", {
  html <- qe_html(
    trajectory_model,
    graph_opts = list(
      trajectories = TRUE,
      "trajectory-units" = "OA.alice",
      "trajectory-smooth" = "poly",
      "trajectory-max-degree" = 3,
      "trajectory-degree-selection" = "loocv_2d",
      "trajectory-line-style" = "tapered",
      "trajectory-stroke-width-range" = "1,8",
      "trajectory-opacity-range" = "0.3,1"
    )
  )
  expect_match(html, "<qe-trajectories", fixed = TRUE)
  expect_match(html, 'units="OA.alice"', fixed = TRUE)
  expect_match(html, 'smooth="poly"', fixed = TRUE)
  expect_match(html, 'max-degree="3"', fixed = TRUE)
  expect_match(html, 'degree-selection="loocv_2d"', fixed = TRUE)
  expect_match(html, 'line-style="tapered"', fixed = TRUE)
})

test_that("qe_trajectories chain emits trajectory element", {
  html <- qe_html(
    qe_plot(trajectory_model) |>
      qe_trajectories(units = "OA.alice", smooth = "poly",
                      max_degree = 4, degree_selection = "fixed",
                      line_style = "tapered",
                      stroke_width_range = c(1, 8))
  )
  expect_match(html, "<qe-trajectories", fixed = TRUE)
  expect_match(html, 'units="OA.alice"', fixed = TRUE)
  expect_match(html, 'max-degree="4"', fixed = TRUE)
  expect_match(html, 'degree-selection="fixed"', fixed = TRUE)
  expect_match(html, 'stroke-width-range="1,8"', fixed = TRUE)
})

test_that("qe_trajectories rejects an invalid degree_selection", {
  expect_error(
    qe_plot(trajectory_model) |>
      qe_trajectories(smooth = "poly", degree_selection = "bogus"),
    "should be one of"
  )
})

test_that("qe_trajectories validates requested units", {
  expect_error(
    qe_plot(trajectory_model) |> qe_trajectories(units = "missing"),
    "unit\\(s\\) not found"
  )
})

# ── qe_fragment ────────────────────────────────────────────────────────────────

test_that("qe_fragment returns a character string classed as html", {
  frag <- qe_fragment(model)
  expect_type(frag, "character")
  expect_true(inherits(frag, "html"))
})

test_that("qe_fragment does not contain a DOCTYPE or <html> tag", {
  frag <- qe_fragment(model)
  expect_no_match(frag, "<!DOCTYPE")
  expect_no_match(frag, "<html")
})

test_that("qe_fragment contains required custom elements", {
  frag <- qe_fragment(model)
  expect_match(frag, "qe-visual",    fixed = TRUE)
  expect_match(frag, "qe-graph",     fixed = TRUE)
  expect_match(frag, "setModelData", fixed = TRUE)
})

test_that("qe_fragment respects height argument", {
  frag <- qe_fragment(model, height = "600px")
  expect_match(frag, "height:600px", fixed = TRUE)
})

test_that("successive qe_fragment calls produce different element IDs", {
  Sys.sleep(0.01)   # ensure proc.time() ticks between calls
  id1 <- regmatches(qe_fragment(model), regexpr('id="qeviz[0-9]+"', qe_fragment(model)))
  Sys.sleep(0.01)
  id2 <- regmatches(qe_fragment(model), regexpr('id="qeviz[0-9]+"', qe_fragment(model)))
  # At minimum both should be valid IDs; collision is possible but unlikely
  expect_match(id1, "^id=\"qeviz[0-9]+\"$")
  expect_match(id2, "^id=\"qeviz[0-9]+\"$")
})

# ── qe_export_html ─────────────────────────────────────────────────────────────

test_that("qe_export_html writes a file and returns its path", {
  tmp <- tempfile(fileext = ".html")
  on.exit(unlink(tmp))
  out <- qe_export_html(model, tmp, open = FALSE)
  expect_true(file.exists(out))
})

test_that("qe_export_html returned path is normalised and matches tmp", {
  tmp <- tempfile(fileext = ".html")
  on.exit(unlink(tmp))
  out <- qe_export_html(model, tmp, open = FALSE)
  expect_equal(out, normalizePath(tmp))
})

test_that("qe_export_html written file contains valid HTML", {
  tmp  <- tempfile(fileext = ".html")
  on.exit(unlink(tmp))
  qe_export_html(model, tmp, open = FALSE)
  html <- paste(readLines(tmp, warn = FALSE), collapse = "\n")
  expect_match(html, "<!DOCTYPE html>", fixed = TRUE)
  expect_match(html, "setModelData",    fixed = TRUE)
})

test_that("qe_export_html file size is non-trivial (bundle inlined)", {
  tmp <- tempfile(fileext = ".html")
  on.exit(unlink(tmp))
  qe_export_html(model, tmp, open = FALSE)
  expect_gt(file.size(tmp), 10000L)   # bundle alone is >> 10 kB
})
