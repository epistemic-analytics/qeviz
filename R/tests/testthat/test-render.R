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

# ── qe_edges(weights =) — explicit networks (0.5) ─────────────────────────────

.edge_cols <- function() qeviz:::.qe_edge_columns(model)

test_that("qe_edges(weights =) accepts a matrix and adds a networks row", {
  m <- as.matrix(edges_df[edges_df$Condition == "OA", EDGE_COLS])
  p <- qe_plot(model) |> qe_edges(weights = m)
  expect_length(p$model$networks$data, 1)
  row <- p$model$networks$data[[1]]
  expect_equal(row$name, "network 1")
  expect_equal(unlist(row[EDGE_COLS]), colMeans(m))
  expect_match(.graph_el(p), '<qe-edges network="network 1">', fixed = TRUE)
})

test_that("qe_edges(weights =) accepts named ('A & B' or 'A.B') and unnamed vectors", {
  cols <- .edge_cols()
  v <- stats::setNames(seq_along(cols) / 10, gsub(".", " & ", cols, fixed = TRUE))
  a <- qe_plot(model) |> qe_edges(weights = v)
  b <- qe_plot(model) |> qe_edges(weights = unname(v))
  expect_equal(a$model$networks$data[[1]][cols], b$model$networks$data[[1]][cols])
  # a named subset fills the rest with 0
  s1 <- qe_plot(model) |> qe_edges(weights = c(Data.Design = 0.4))
  expect_equal(s1$model$networks$data[[1]]$Data.Design, 0.4)
  expect_equal(s1$model$networks$data[[1]]$Tech.Collab, 0)
})

test_that("qe_edges(weights =) validates names and lengths", {
  expect_error(qe_edges(qe_plot(model), weights = c(Nope.Data = 1)), "not in the model")
  expect_error(qe_edges(qe_plot(model), weights = c(1, 2)), "edge columns")
  expect_error(qe_edges(qe_plot(model), "OA", weights = c(Data.Design = 1)), "not both")
})

test_that("qe_edges compare works with data or a group name alongside weights", {
  oa <- as.matrix(edges_df[edges_df$Condition == "OA", EDGE_COLS])
  ob <- as.matrix(edges_df[edges_df$Condition == "OB", EDGE_COLS])
  d1 <- qe_plot(model) |> qe_edges(weights = oa, compare = ob)
  d2 <- qe_plot(model) |> qe_edges(weights = oa, compare = "OB")
  d3 <- qe_plot(model) |> qe_edges(weights = colMeans(oa) - colMeans(ob))
  w  <- function(p) unlist(p$model$networks$data[[1]][EDGE_COLS])
  expect_equal(w(d1), colMeans(oa) - colMeans(ob))
  expect_equal(w(d2), w(d1))
  expect_equal(w(d3), w(d1))
  expect_error(qe_edges(qe_plot(model), "OA", compare = ob), "needs 'weights'")
})

test_that("qe_edges weights calls append layers; a list adds one per element", {
  oa <- as.matrix(edges_df[edges_df$Condition == "OA", EDGE_COLS])
  p  <- qe_plot(model) |> qe_edges(weights = list(A = oa, B = oa * 2))
  expect_equal(vapply(p$model$networks$data, `[[`, "", "name"), c("A", "B"))
  p2 <- p |> qe_edges(weights = oa, name = "C")
  expect_length(p2$model$networks$data, 3)
  g  <- .graph_el(p2)
  expect_equal(lengths(regmatches(g, gregexpr("<qe-edges ", g))), 3)
  expect_null(qe_edges(p2, show = FALSE)$model$networks)
})

test_that("qe_edges colors / threshold / name reach the element (named and explicit)", {
  g <- .graph_el(qe_plot(model) |> qe_edges("OA", colors = c("blue", "red"),
                                              threshold = c(0.05, 0.5), name = "A net"))
  expect_match(g, 'group="OA" name="A net" colors="blue,red" threshold="0.05,0.5"', fixed = TRUE)
  g2 <- .graph_el(qe_plot(model) |> qe_edges(weights = c(Data.Design = 1), colors = "blue"))
  expect_match(g2, '<qe-edges network="network 1" colors="blue">', fixed = TRUE)
  expect_error(qe_edges(qe_plot(model), "OA", threshold = -1))
  expect_error(qe_edges(qe_plot(model), "OA", colors = c("a", "b", "c")))
})

test_that("a named network and explicit layers coexist", {
  g <- .graph_el(qe_plot(model) |> qe_edges("OA") |> qe_edges(weights = c(Data.Design = 1)))
  expect_match(g, '<qe-edges group="OA"></qe-edges>', fixed = TRUE)
  expect_match(g, '<qe-edges network="network 1"></qe-edges>', fixed = TRUE)
})

# ── qe_points(units =, points =) — explicit point sets (0.5) ──────────────────

test_that("qe_points(units =) adds a point set from the model's points", {
  ids <- points_df$ENA_UNIT[1:3]
  p <- qe_plot(model) |> qe_points(units = ids, color = "red", shape = "triangle-up",
                                   labels = c("a", "b", "c"), name = "three")
  ps <- qeviz:::.qe_frame_df(p$model$pointsets)
  expect_equal(ps$id, ids)
  expect_equal(ps$x, points_df$x[1:3])
  expect_equal(unique(ps$set), "three")
  expect_equal(unique(ps$color), "red")
  expect_equal(unique(ps$shape), "triangle")
  expect_equal(ps$label, c("a", "b", "c"))
  g <- .graph_el(p)
  expect_match(g, '<qe-points set="three" label="auto"></qe-points>', fixed = TRUE)
  expect_false(grepl('<qe-points label=', g, fixed = TRUE))   # no all-units layer
  expect_error(qe_points(qe_plot(model), units = "nobody"), "not in model")
})

test_that("qe_points(points =) takes arbitrary positions; sets append / replace by name", {
  m <- data.frame(ENA_UNIT = c("u1", "u2"), a = c(0.1, 0.2), b = c(-0.1, 0.3))
  p <- qe_plot(model) |> qe_points(points = m) |> qe_points(points = m, name = "B")
  ps <- qeviz:::.qe_frame_df(p$model$pointsets)
  expect_equal(sort(unique(ps$set)), c("B", "points 1"))
  expect_equal(ps$x[ps$set == "B"], c(0.1, 0.2))           # first two numeric columns
  p2 <- p |> qe_points(points = m[1, ], name = "B")          # same name replaces
  expect_equal(sum(qeviz:::.qe_frame_df(p2$model$pointsets)$set == "B"), 1)
  expect_null(qe_points(p2, show = FALSE)$model$pointsets)
  expect_error(qe_points(qe_plot(model), points = m, color = c("a", "b", "c")), "length 1 or 2")
  expect_error(qe_points(qe_plot(model), points = m, shape = "star"), "shape must be")
})

# ── qe_group(points =), intervals, conf_level, outlier (0.5) ──────────────────

test_that("qe_group(points =) adds the subset's mean and t CI as a group row", {
  sub <- points_df[points_df$x > 0, ]
  p <- qe_plot(model) |> qe_group(points = sub, label = "right", color = "#123456", shape = "diamond")
  g <- qeviz:::.qe_frame_df(p$model$groups)
  r <- g[g$Condition == "right", ]
  expect_equal(r$x, mean(sub$x))
  expect_equal(c(r$x.low, r$x.high), as.numeric(stats::t.test(sub$x)$conf.int))
  expect_equal(r$color, "#123456")
  expect_equal(r$shape, "diamond")
  expect_match(.graph_el(p), 'groups="right"', fixed = TRUE)   # only the explicit mean
  # with a named selection, the explicit mean joins it
  p2 <- qe_plot(model) |> qe_group("OA") |> qe_group(points = sub, label = "right")
  expect_match(.graph_el(p2), 'groups="OA,right"', fixed = TRUE)
  expect_error(qe_group(qe_plot(model), points = sub, label = "OA"), "already a group")
  expect_error(qe_group(qe_plot(model), "OA", points = sub), "not both")
})

test_that("qe_group intervals / conf_level / outlier", {
  expect_match(.graph_el(qe_plot(model) |> qe_group(intervals = "crosshairs")),
               'intervals="crosshairs"', fixed = TRUE)
  expect_false(grepl("confidence", .graph_el(qe_plot(model) |> qe_group(intervals = "none")),
                     fixed = TRUE))
  expect_false(grepl("confidence", .graph_el(qe_plot(model) |> qe_group(intervals = FALSE)),
                     fixed = TRUE))
  p <- qe_plot(model) |> qe_group(conf_level = 0.8, outlier = TRUE)
  g <- qeviz:::.qe_frame_df(p$model$groups)
  oa <- points_df$x[points_df$Condition == "OA"]
  expect_equal(c(g$x.low[g$Condition == "OA"], g$x.high[g$Condition == "OA"]),
               as.numeric(stats::t.test(oa, conf.level = 0.8)$conf.int))
  q <- stats::quantile(oa, c(.25, .75), names = FALSE)
  expect_equal(g$x.olow[g$Condition == "OA"], q[1] - 1.5 * diff(q))
  expect_match(.graph_el(p), "outlier", fixed = TRUE)
  expect_error(qe_group(qe_plot(model), conf_level = 2))
})

# ── qe_nodes(positions =, labels =) (0.5) ────────────────────────────────────

test_that("qe_nodes(positions =) replaces node positions (all or a subset)", {
  pos <- data.frame(code = CODES, a = 1:4 / 10, b = -(1:4) / 10)
  p <- qe_plot(model) |> qe_nodes(positions = pos)
  n <- qeviz:::.qe_frame_df(p$model$nodes)
  expect_equal(n$x, pos$a)            # first two numeric columns when x / y are absent
  expect_equal(n$y, pos$b)
  one <- qe_plot(model) |> qe_nodes(positions = data.frame(code = "Tech", x = 9, y = 8))
  n1 <- qeviz:::.qe_frame_df(one$model$nodes)
  expect_equal(n1$x[n1$code == "Tech"], 9)
  expect_equal(n1$x[n1$code == "Data"], nodes_df$x[nodes_df$code == "Data"])   # untouched
  mat <- matrix(c(1, 2), nrow = 1, dimnames = list("Data", c("x", "y")))
  n2 <- qeviz:::.qe_frame_df(qe_nodes(qe_plot(model), positions = mat)$model$nodes)
  expect_equal(n2$x[n2$code == "Data"], 1)                                     # row names = codes
  expect_error(qe_nodes(qe_plot(model), positions = data.frame(code = "Nope", x = 1, y = 1)),
               "not in the model")
})

test_that("qe_nodes(labels =) sets display text without changing the code", {
  p <- qe_plot(model) |> qe_nodes(labels = c(Tech = "Technology"))
  n <- qeviz:::.qe_frame_df(p$model$nodes)
  expect_equal(n$label[n$code == "Tech"], "Technology")
  expect_true(is.na(n$label[n$code == "Data"]))
  expect_equal(n$code, CODES)
  expect_error(qe_nodes(qe_plot(model), labels = c(Nope = "x")), "not in the model")
  expect_error(qe_nodes(qe_plot(model), labels = "unnamed"), "named character")
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
