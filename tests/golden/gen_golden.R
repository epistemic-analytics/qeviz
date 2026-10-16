# tests/golden/gen_golden.R — cross-language parity fixtures.
#
# Builds each scenario below with the R package (the reference API) from the
# shared CSV fixture, and writes its <qe-graph> markup and full ModelData to
# golden.json. The Python and Julia test suites rebuild every scenario by name
# with their own API and must match: markup attribute-for-attribute and model
# data to 1e-9. Regenerate after any R API change:
#
#   Rscript tests/golden/gen_golden.R
suppressMessages(pkgload::load_all(file.path(getwd(), "R"), quiet = TRUE))

dir   <- file.path(getwd(), "tests", "golden")
read  <- function(f) utils::read.csv(file.path(dir, "fixture", f), stringsAsFactors = FALSE)
nodes <- read("nodes.csv"); edges <- read("edges.csv"); points <- read("points.csv")

m  <- qe_model_data(nodes, edges, points, id_col = "ENA_UNIT", group_col = "Condition")
m0 <- qe_model_data(nodes, edges, points[, c("ENA_UNIT", "x", "y")], id_col = "ENA_UNIT",
                    group_col = NULL)
ecols <- setdiff(names(edges), c("ENA_UNIT", "Condition"))
oa    <- edges$Condition == "OA"
w_oa  <- colMeans(as.matrix(edges[oa, ecols]))   # named vector
base  <- function(...) qe_plot(m, width = "100%", height = 440, ...)

scenarios <- list(
  # ── 0.4 behaviour (the shared baseline) ─────────────────────────────────────
  base             = function() base(),
  edges_group      = function() base() |> qe_edges("OA"),
  edges_compare    = function() base() |> qe_edges("OA", compare = "OB"),
  edges_also_mag   = function() base() |> qe_edges("OA", also = "OB", magnify = 2,
                                                   color_scale = "plot", edge_width = 0.05),
  points_all       = function() base() |> qe_points(size = 3, fixed_size = TRUE),
  axes_labels      = function() base() |> qe_axes(x = TRUE, y = "Second"),

  # ── §1 explicit networks ────────────────────────────────────────────────────
  w_vector         = function() base() |> qe_edges(weights = w_oa, colors = c("#228833", "#AA3377"),
                                                   threshold = c(0.05, 0.3), name = "net A"),
  w_unnamed        = function() base() |> qe_edges(weights = unname(w_oa), colors = "#228833",
                                                   threshold = 0.1),
  w_matrix_compare = function() base() |> qe_edges(weights = edges[oa, ecols],
                                                   compare = edges[!oa, ecols]),
  w_two_layers     = function() base() |> qe_edges(weights = w_oa, name = "first") |>
                                           qe_edges(weights = w_oa * 0.5, name = "second",
                                                    magnify = 1.5),
  w_replace        = function() base() |> qe_edges(weights = w_oa, name = "n") |>
                                           qe_edges(weights = w_oa * 2, name = "n"),
  w_then_hide      = function() base() |> qe_edges(weights = w_oa) |> qe_edges(show = FALSE),

  # ── §2 point sets ───────────────────────────────────────────────────────────
  ps_units         = function() base() |> qe_points(units = c("OA.alice", "OB.eve"),
                                                    color = "#228833", shape = "triangle",
                                                    labels = c("A", "E"), name = "picked"),
  ps_points        = function() base() |> qe_points(points = points[1:3, ], size = 4,
                                                    shape = "diamond"),
  ps_two_sets      = function() base() |> qe_points(points = points[1:2, ], name = "one") |>
                                           qe_points(points = points[5:6, ], color = "#EE6677"),

  # ── §3 means ────────────────────────────────────────────────────────────────
  g_named          = function() base() |> qe_group("OA", intervals = "crosshairs"),
  g_named_outlier  = function() base() |> qe_group(conf_level = 0.9, outlier = TRUE),
  g_explicit       = function() base() |> qe_group(points = points[1:4, ], label = "sub",
                                                   color = "#CCBB44", shape = "diamond",
                                                   intervals = "box", outlier = TRUE,
                                                   conf_level = 0.9),
  g_explicit_two   = function() base() |> qe_group(points = points[1:4, ], label = "a") |>
                                           qe_group(points = points[5:8, ], label = "b",
                                                    intervals = "crosshairs"),
  g_hidden         = function() base() |> qe_edges("OA") |> qe_group(show = FALSE),

  # ── §4 nodes ────────────────────────────────────────────────────────────────
  n_positions      = function() base() |> qe_nodes(positions = data.frame(
                                             code = c("Data", "Tech"), x = c(0.5, -0.5),
                                             y = c(0.5, -0.5))) |> qe_edges("OA"),
  n_labels         = function() base() |> qe_nodes("always", unconnected = "hide",
                                                   labels = c(Data = "D", Collab = "C")),

  # ── §6 plot settings (+ 0.5.1 center / point_scale) ─────────────────────────
  plot_settings    = function() base(title = "Settings", range = "points", scale_points = FALSE,
                                     palette = c("#111111", "#222222"), center = "content",
                                     point_scale = 2) |> qe_edges("OA"),
  range_number     = function() base() |> qe_range(1.5),
  colors_labels    = function() base() |> qe_colors(OA = "#000000") |>
                                           qe_labels(nodes = "off", means = "click") |>
                                           qe_labels(font_size = 12, font_family = "Georgia",
                                                     font_color = "#333333"),

  # ── 0.6 options ─────────────────────────────────────────────────────────────
  opts_060         = function() base(view_padding = 1) |>
                                  qe_edges("OA", fixed_size = TRUE, self_size = "node") |>
                                  qe_nodes("always", sizes = c(Data = 24, Tech = 12.5),
                                           fixed_size = TRUE) |>
                                  qe_axes(x = TRUE, fixed_size = TRUE) |>
                                  qe_labels(font_weight = c(nodes = "bold")),
  opts_060_layers  = function() base() |> qe_points(size = 3) |>
                                  qe_points(points = points[1:2, ], name = "one") |>
                                  qe_labels(font_weight = 600) |>
                                  qe_labels(font_weight = c(means = "bold")) |>
                                  qe_edges(weights = w_oa, name = "a", self_size = 0.3) |>
                                  qe_edges(weights = w_oa * 0.5, name = "b"),
  opts_060_clear   = function() base() |> qe_labels(font_weight = "bold") |>
                                  qe_labels(font_weight = NULL) |>
                                  qe_edges("OA", fixed_size = TRUE) |>
                                  qe_edges("OB", fixed_size = FALSE),
  ps_label_na      = function() base() |> qe_points(units = c("OA.alice", "OB.eve"),
                                                    labels = c("A", NA)),

  # ── no group column (rENA backend style) ────────────────────────────────────
  nogroup_explicit = function() qe_plot(m0, width = "100%", height = 440) |>
                                  qe_group(show = FALSE) |>
                                  qe_edges(weights = w_oa) |>
                                  qe_points(points = points[1:4, c("ENA_UNIT", "x", "y")]) |>
                                  qe_group(points = points[1:4, c("ENA_UNIT", "x", "y")],
                                           label = "subset")
)

golden <- lapply(scenarios, function(f) {
  p <- f()
  model <- p$model
  model$updated <- NULL
  list(graph = .build_graph_element(p$graph_opts), model = model)
})
json <- jsonlite::toJSON(golden, auto_unbox = TRUE, digits = NA, null = "null", na = "null",
                         pretty = TRUE)
writeLines(json, file.path(dir, "golden.json"))
message("Wrote ", length(golden), " scenarios to tests/golden/golden.json")
