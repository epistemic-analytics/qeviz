# demo/ona_comparison.R
#
# Produces demo/ona_comparison.html — a side-by-side comparison of
# the `ona` R package (plotly, directed arrows) vs qeviz ONA (directed
# tapered edges) for the same four canonical views of RS.data.
#
# Both sides use the same ONA model (tma::accumulate ordered=TRUE +
# ona::model SVD rotation).  The left uses the `ona` package's arrow-based
# plotly renderer; the right uses qeviz's tapered-triangle SVG renderer.
#
# Panels are written to demo/panels/ and loaded via <iframe src="...">.
#
# Run from the project root:
#   Rscript demo/ona_comparison.R

suppressPackageStartupMessages({
  if (requireNamespace("pkgload", quietly = TRUE)) {
    pkgload::load_all("R", quiet = TRUE)
  } else {
    library(qeviz)
  }
  library(ona)
  library(tma)
  library(rENA)
  library(plotly)
  library(htmlwidgets)
})


# ── Data ───────────────────────────────────────────────────────────────────────

data(RS.data)

codes <- c(
  "Data", "Technical.Constraints", "Performance.Parameters",
  "Client.and.Consultant.Requests", "Design.Reasoning", "Collaboration"
)

hoo_rules <- tma::conversation_rules(
  (Condition %in% UNIT$Condition) & (GroupName %in% UNIT$GroupName)
)

context_model <- tma::contexts(
  RS.data,
  units_by  = c("Condition", "UserName"),
  hoo_rules = hoo_rules
)

multidim_arr <- tma::context_tensor(
  RS.data,
  sender_cols    = NULL,
  receiver_cols  = NULL,
  default_window = 8,
  default_weight = 1
)

# ── ONA model (directed / ordered) ────────────────────────────────────────────

result_ona <- tma::accumulate(
  tensor        = multidim_arr,
  codes         = codes,
  context_model = context_model,
  ordered       = TRUE
)
ona_set   <- ona::model(result_ona)
message("ONA model fitted.")


# ── Group masks + directed weights ────────────────────────────────────────────

pts_df  <- as.data.frame(ona_set$points)
lw_df   <- as.data.frame(ona_set$line.weights)
lw_nums <- lw_df[, sapply(lw_df, is.numeric), drop = FALSE]   # 36 directed cols

fg_mask <- pts_df$Condition == "FirstGame"
sg_mask <- pts_df$Condition == "SecondGame"

fg_weights  <- colMeans(lw_nums[fg_mask, ])
sg_weights  <- colMeans(lw_nums[sg_mask, ])
sub_weights <- fg_weights - sg_weights

# Global scale: normalise all panels relative to the same maximum weight.
# ona::edges() needs scale_edges_from explicitly because the tma-based model
# does not carry the $line.weights$ENA_DIRECTION$response slot that the ona
# package's own accumulation pipeline would produce.
max_weight  <- max(abs(lw_nums))
scale_from  <- c(0, max_weight)

# ── Scale unit-point coordinates to node extent ────────────────────────────────
# ona::model() projects points into the same SVD space as the nodes, but the
# unit-point cloud is typically much smaller than the node polygon.  Scale it
# so group means sit visibly within the node layout (same convention as qeviz).

node_dims    <- c("SVD1", "SVD2")
nodes_raw    <- as.data.frame(ona_set$rotation$nodes)
node_extent  <- max(abs(nodes_raw[, node_dims]))
point_extent <- max(abs(pts_df[, node_dims]))
sf           <- if (point_extent > 0) node_extent / point_extent else 1L

# qeviz computes extremes.x_max = ceil(max_coord * 1.5); QELine uses that as
# the "extent" denominator for taper sizing.  Mirror this so sizes match.
qe_extent <- ceiling(node_extent * 1.5)

message(sprintf("ONA — Node extent: %.4f | Point extent: %.4f | Scale: %.4f | qe_extent: %d",
                node_extent, point_extent, sf, qe_extent))

.scaled_stats <- function(mask, dim) {
  v  <- pts_df[mask, dim] * sf
  n  <- sum(mask)
  mx <- mean(v)
  ci <- 1.96 * sd(v) / sqrt(n)
  list(mean = mx, ci = ci, vals = v)
}

fg_x <- .scaled_stats(fg_mask, "SVD1");  fg_y <- .scaled_stats(fg_mask, "SVD2")
sg_x <- .scaled_stats(sg_mask, "SVD1");  sg_y <- .scaled_stats(sg_mask, "SVD2")


# ── Colours ────────────────────────────────────────────────────────────────────

COL_FG <- "#4477AA"
COL_SG <- "#EE6677"


# ── Output directory ───────────────────────────────────────────────────────────

panels_dir <- file.path("demo", "panels")
dir.create(panels_dir, showWarnings = FALSE, recursive = TRUE)


# ── ona plotly helpers ─────────────────────────────────────────────────────────

# Build a minimal plotly base with the required model attributes that
# ona::edges() looks for.  autorange = FALSE pins the axis so that shapes
# and annotations added by ona::edges() cannot expand the y-axis beyond
# the node coordinate extent.
.AX_RANGE <- c(-1, 1) * node_extent * 1.25

.base_plot <- function() {
  p <- plotly::plot_ly() |>
    plotly::layout(
      xaxis = list(title = "SVD1", zeroline = TRUE, zerolinecolor = "#cccccc",
                   zerolinewidth = 1, showgrid = FALSE, showline = FALSE,
                   range = .AX_RANGE, autorange = FALSE),
      yaxis = list(title = "SVD2", zeroline = TRUE, zerolinecolor = "#cccccc",
                   zerolinewidth = 1, showgrid = FALSE, showline = FALSE,
                   range = .AX_RANGE, autorange = FALSE),
      paper_bgcolor = "white", plot_bgcolor = "white", showlegend = TRUE
    )
  attr(p, "model")      <- ona_set
  attr(p, "dimensions") <- node_dims
  p
}

# Apply arrow shapes accumulated by ona::edges() into the actual plotly layout,
# re-pinning the axis range so plotly cannot auto-expand it.
# Force layer = "below" on every shape so that scatter traces (nodes, means)
# are always rendered on top of the edge fills.
.apply_edges <- function(p) {
  sh <- attr(p, "shapes")
  if (length(sh) > 0) {
    sh <- lapply(sh, function(s) { s$layer <- "below"; s })
  }
  plotly::layout(p,
    shapes = if (length(sh) > 0) sh else list(),
    xaxis  = list(range = .AX_RANGE, autorange = FALSE),
    yaxis  = list(range = .AX_RANGE, autorange = FALSE)
  )
}

# Add node dots + labels as plotly scatter traces (no shapes, so no axis creep).
# Open-circle style (white fill, coloured border) so nodes remain visible on top
# of any edge fill regardless of thickness.
.add_nodes <- function(p, color) {
  nd <- as.data.frame(ona_set$rotation$nodes)
  plotly::add_trace(p,
    x = nd$SVD1, y = nd$SVD2, text = nd$code,
    type = "scatter", mode = "markers+text",
    textposition = "top right",
    marker = list(color = color, size = 12, symbol = "circle",
                  line = list(color = "white", width = 1.5)),
    textfont = list(size = 10, color = "#333"),
    showlegend = FALSE, hoverinfo = "text"
  )
}

# Append a rectangle CI box to the layout shapes accumulated so far.
# Uses a dashed border to match the qeviz convention.
.add_ci <- function(p, mx, my, cix, ciy, color) {
  existing <- p$x$layout$shapes %||% list()
  plotly::layout(p,
    shapes = c(existing, list(list(
      type = "rect",
      x0 = mx - cix, x1 = mx + cix,
      y0 = my - ciy, y1 = my + ciy,
      xref = "x", yref = "y",
      line = list(color = color, width = 2, dash = "dash"),
      fillcolor = "rgba(0,0,0,0)"
    ))),
    xaxis = list(range = .AX_RANGE, autorange = FALSE),
    yaxis = list(range = .AX_RANGE, autorange = FALSE)
  )
}

# NULL-coalescing helper (available in R 4.4+ natively; define for older R).
`%||%` <- function(a, b) if (!is.null(a)) a else b

# Add a group-mean scatter marker (square, matching rENA / qeviz convention).
.add_mean <- function(p, mx, my, color, name) {
  plotly::add_markers(p, x = mx, y = my,
    marker = list(color = color, size = 12, symbol = "square",
                  line = list(color = "white", width = 2)),
    name = name, legendgroup = name, showlegend = TRUE)
}

# Save a plotly object as a self-contained HTML panel.
.save_ona <- function(p, name) {
  path <- file.path(panels_dir, paste0(name, ".html"))
  htmlwidgets::saveWidget(p, normalizePath(path, mustWork = FALSE),
                          selfcontained = TRUE)
  path
}


# ── ona ONA panels ─────────────────────────────────────────────────────────────

# Calibrate edge_size_multiplier to match qeviz's QELine.ts formula:
#   qeviz: TaperedEdge.weight = (qe_extent × 0.011 × w/maxW) × 4
#          where qe_extent = ceil(node_extent × 1.5)
#   ona:   taper full base = weight × edge_size_multiplier
# Per-group normalisation: exclude self-loops (code & code) from w_max because
# create_edge_matrix only creates cross-pair edges; self-loops inflate the max
# and make all cross-pair edges appear under-saturated.
.is_selfloop <- function(nms) {
  vapply(strsplit(nms, " & ", fixed = TRUE),
         function(x) length(x) == 2L && trimws(x[1]) == trimws(x[2]),
         logical(1))
}

.edges <- function(p, weights, color1, color2 = color1) {
  cross   <- weights[!.is_selfloop(names(weights))]
  w_max   <- max(abs(cross[cross != 0]), na.rm = TRUE)
  w_mult  <- (qe_extent * 0.044) / w_max
  norm    <- function(x) pmin(1, abs(x) / w_max)   # matches qeviz opacity = w/maxW

  message(sprintf("  edge_size_multiplier=%.4f  w_max=%.4f  taper_max=%.4f",
                  w_mult, w_max, w_max * w_mult))

  ona::edges(p,
    weights                          = weights,
    nodes                            = data.table::copy(ona_set$rotation$nodes),
    edge_color                       = c(color1, color2),
    scale_edges_from                 = c(0, w_max),
    desaturate_edges_by              = norm,
    lighten_edges_by                 = norm,
    fake_alpha                       = FALSE,
    edge_size_multiplier             = w_mult,
    edge_halo                        = 0,
    arrow_halo                       = 0,
    edge_arrow                       = TRUE,
    edge_arrow_saturation_multiplier = 1.0
  )
}

message("Rendering ona ONA view 1 (FirstGame)...")
p_fg <- .base_plot()
p_fg <- .edges(p_fg, fg_weights, COL_FG)
p_fg <- .apply_edges(p_fg)
p_fg <- .add_nodes(p_fg, COL_FG)
p_fg <- .add_mean(p_fg, fg_x$mean, fg_y$mean, COL_FG, "FirstGame")
p_fg <- .add_ci(p_fg, fg_x$mean, fg_y$mean, fg_x$ci, fg_y$ci, COL_FG)
.save_ona(p_fg, "ona_ona_fg")

message("Rendering ona ONA view 2 (SecondGame)...")
p_sg <- .base_plot()
p_sg <- .edges(p_sg, sg_weights, COL_SG)
p_sg <- .apply_edges(p_sg)
p_sg <- .add_nodes(p_sg, COL_SG)
p_sg <- .add_mean(p_sg, sg_x$mean, sg_y$mean, COL_SG, "SecondGame")
p_sg <- .add_ci(p_sg, sg_x$mean, sg_y$mean, sg_x$ci, sg_y$ci, COL_SG)
.save_ona(p_sg, "ona_ona_sg")

message("Rendering ona ONA view 3 (Subtraction FG − SG)...")
p_sub <- .base_plot()
p_sub <- .edges(p_sub, sub_weights, COL_FG, COL_SG)  # blue = FG stronger, red = SG stronger
p_sub <- .apply_edges(p_sub)
p_sub <- .add_nodes(p_sub, "#888888")
p_sub <- .add_mean(p_sub, fg_x$mean, fg_y$mean, COL_FG, "FirstGame")
p_sub <- .add_mean(p_sub, sg_x$mean, sg_y$mean, COL_SG, "SecondGame")
p_sub <- .add_ci(p_sub, fg_x$mean, fg_y$mean, fg_x$ci, fg_y$ci, COL_FG)
p_sub <- .add_ci(p_sub, sg_x$mean, sg_y$mean, sg_x$ci, sg_y$ci, COL_SG)
.save_ona(p_sub, "ona_ona_sub")

message("Rendering ona ONA view 4 (Overlay means, no network)...")
p_both <- .base_plot()
p_both <- .add_nodes(p_both, "#888888")
p_both <- .add_mean(p_both, fg_x$mean, fg_y$mean, COL_FG, "FirstGame")
p_both <- .add_mean(p_both, sg_x$mean, sg_y$mean, COL_SG, "SecondGame")
p_both <- .add_ci(p_both, fg_x$mean, fg_y$mean, fg_x$ci, fg_y$ci, COL_FG)
p_both <- .add_ci(p_both, sg_x$mean, sg_y$mean, sg_x$ci, sg_y$ci, COL_SG)
.save_ona(p_both, "ona_ona_both")

message("ona ONA panels done.")


# ── qeviz ONA panels (directed tapered edges) ─────────────────────────────────

ona_plot <- qe_plot(ona_set)
ona_grps <- qe_groups(ona_plot)

.save_qe <- function(p, name) {
  path <- file.path(panels_dir, paste0(name, ".html"))
  qe_export_html(p, path, open = FALSE)
  path
}

message("Rendering qeviz ONA panels...")
.save_qe(ona_plot |> qe_group(ona_grps[1]) |> qe_edges(ona_grps[1]) |>
           qe_axes() |> qe_labels(nodes = "on"), "qe_ona_fg")
.save_qe(ona_plot |> qe_group(ona_grps[2]) |> qe_edges(ona_grps[2]) |>
           qe_axes() |> qe_labels(nodes = "on"), "qe_ona_sg")
.save_qe(ona_plot |> qe_group() |> qe_edges(ona_grps[1], compare = ona_grps[2]) |>
           qe_axes() |> qe_labels(nodes = "on"), "qe_ona_sub")
.save_qe(ona_plot |> qe_group() |>
           qe_axes() |> qe_labels(nodes = "on"), "qe_ona_both")   # no qe_edges() → means only

message("qeviz ONA panels done.")


# ── Build comparison HTML ──────────────────────────────────────────────────────

ts <- as.integer(Sys.time())   # cache-buster

.row <- function(title, ona_name, qe_name, notes = "") {
  note_html <- if (nzchar(notes)) sprintf('<p class="note">%s</p>', notes) else ""
  sprintf('
  <section>
    <h2>%s</h2>%s
    <div class="cols">
      <div class="col">
        <h3>ona <span class="tag">plotly &bull; directed arrows</span></h3>
        <iframe src="panels/%s.html?v=%d" class="frame" loading="lazy"></iframe>
      </div>
      <div class="col">
        <h3>qeviz <span class="tag">directed ONA</span></h3>
        <iframe src="panels/%s.html?v=%d" class="frame" loading="lazy"></iframe>
      </div>
    </div>
  </section>', title, note_html, ona_name, ts, qe_name, ts)
}

rows <- paste(
  .row(
    "View 1 — FirstGame: mean network + CI box",
    "ona_ona_fg", "qe_ona_fg",
    "Both renderers show the directed ONA network for FirstGame. &nbsp;|&nbsp;
     <strong>ona</strong>: arrows whose tip encodes direction and length encodes relative weight &nbsp;|&nbsp;
     <strong>qeviz</strong>: <code>qe_group(&quot;FirstGame&quot;) |&gt; qe_edges(&quot;FirstGame&quot;)</code> &mdash; tapered triangles; apex encodes weighted midpoint"
  ),
  .row(
    "View 2 — SecondGame: mean network + CI box",
    "ona_ona_sg", "qe_ona_sg",
    "<strong>ona</strong>: directed ONA &mdash; red arrows &nbsp;|&nbsp;
     <strong>qeviz</strong>: directed ONA &mdash; red tapers"
  ),
  .row(
    "View 3 — Subtraction (FirstGame &minus; SecondGame) + both means",
    "ona_ona_sub", "qe_ona_sub",
    "Blue = stronger in FirstGame, red = stronger in SecondGame &nbsp;|&nbsp;
     Both renderers use signed directed weights; the sign drives colour selection"
  ),
  .row(
    "View 4 — Overlay: both group means + CI (no network)",
    "ona_ona_both", "qe_ona_both",
    "Network edges hidden; nodes shown with average weight for spatial reference &nbsp;|&nbsp;
     ONA SVD separates groups differently from ENA"
  )
)

html <- sprintf('<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ona vs qeviz ONA &mdash; Comparison</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif;
      margin: 0; padding: 1.5rem 2rem;
      background: #f4f4f5; color: #111;
    }
    h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
    .subtitle { color: #555; font-size: .85rem; margin: 0 0 2rem; }
    section {
      background: #fff; border: 1px solid #ddd; border-radius: 8px;
      padding: 1.25rem 1.5rem; margin-bottom: 2rem;
    }
    h2 { font-size: 1rem; margin: 0 0 .4rem; }
    h3 {
      font-size: .8rem; text-transform: uppercase; letter-spacing: .05em;
      color: #666; margin: 0 0 .4rem;
    }
    .tag {
      font-size: .65rem; background: #e5e7eb; color: #374151;
      padding: 1px 6px; border-radius: 4px; vertical-align: middle;
      text-transform: none; letter-spacing: 0;
    }
    .note { font-size: .78rem; color: #555; margin: .2rem 0 .75rem; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .col { min-width: 0; }
    .frame {
      display: block; width: 100%%; height: 460px;
      border: 1px solid #e5e7eb; border-radius: 4px; background: #fafafa;
    }
  </style>
</head>
<body>

<h1>ona vs qeviz &mdash; ONA (Ordered Network Analysis)</h1>
<p class="subtitle">
  RS.data &middot; ONA (ordered accumulation) &middot; SVD rotation &middot;
  6 codes &middot; 2 groups (FirstGame / SecondGame)<br>
  <strong>ona</strong> renders directed ONA using plotly arrow shapes whose
  length and tip encode the dominant direction and relative weight of each
  code pair.
  <strong>qeviz</strong> renders the same directed network using filled tapered
  triangles whose apex marks the weighted midpoint of each directed connection.
</p>

%s

</body>
</html>', rows)

out_file <- file.path("demo", "ona_comparison.html")
writeLines(html, out_file)
message("Saved: ", normalizePath(out_file))
message("Panels in: ", normalizePath(panels_dir))
