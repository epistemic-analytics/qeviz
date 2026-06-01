# demo/comparison.R
#
# Produces demo/comparison.html — a side-by-side visual comparison of
# rENA (plotly) and qeviz for the same four canonical views of RS.data.
#
# Individual plot panels are written to demo/panels/ and referenced via
# <iframe src="..."> so that browser srcdoc size limits don't apply.
#
# Run from the project root:
#   Rscript demo/comparison.R
#
# Requirements: tma, rENA, htmlwidgets, jsonlite, and the qeviz R package.

suppressPackageStartupMessages({
  if (requireNamespace("pkgload", quietly = TRUE)) {
    pkgload::load_all("R", quiet = TRUE)
  } else {
    library(qeviz)
  }
  library(tma)
  library(rENA)
  library(htmlwidgets)
  library(jsonlite)
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

result_ena <- tma::accumulate(
  tensor        = multidim_arr,
  codes         = codes,
  context_model = context_model,
  ordered       = FALSE
)

ena_set  <- rENA::model(result_ena)
ena_plot <- qe_plot(ena_set)

message("Model fitted.")


# ── Group masks ────────────────────────────────────────────────────────────────

pts_df  <- as.data.frame(ena_set$points)
lw_df   <- as.data.frame(ena_set$line.weights)
# keep only numeric edge-weight columns (drop unit-metadata columns)
lw_nums <- lw_df[, sapply(lw_df, is.numeric), drop = FALSE]

fg_mask <- pts_df$Condition == "FirstGame"
sg_mask <- pts_df$Condition == "SecondGame"

# ── Scale unit-point coordinates to node extent (matches qeviz default) ───────
# qeviz rescales point coords so the outermost point aligns with the outermost
# code node (ENA Web Tool default).  rENA has no built-in equivalent, so we
# pre-scale the SVD columns here before passing to ena.plot.group().

nodes_raw  <- as.data.frame(ena_set$rotation$nodes)
node_dims  <- names(nodes_raw)[vapply(nodes_raw, is.numeric, logical(1L))][1:2]
node_extent  <- max(abs(nodes_raw[, node_dims]))
point_extent <- max(abs(pts_df[, node_dims]))
scale_factor <- if (point_extent > 0) node_extent / point_extent else 1L

message(sprintf("Node extent: %.4f | Point extent: %.4f | Scale: %.4f",
                node_extent, point_extent, scale_factor))

# Scaled numeric-only frames for ena.plot.group()
.scale_pts <- function(mask, sf, dims) {
  as.data.frame(ena_set$points)[mask, dims, drop = FALSE] * sf
}
fg_points <- .scale_pts(fg_mask, scale_factor, node_dims)
sg_points <- .scale_pts(sg_mask, scale_factor, node_dims)

fg_net         <- colMeans(lw_nums[fg_mask, ])
sg_net         <- colMeans(lw_nums[sg_mask, ])
subtracted_net <- fg_net - sg_net


# ── Output directories ─────────────────────────────────────────────────────────

panels_dir <- file.path("demo", "panels")
dir.create(panels_dir, showWarnings = FALSE, recursive = TRUE)

COL_FG <- "#4477AA"
COL_SG <- "#EE6677"


# ── rENA plots → panel files ───────────────────────────────────────────────────

.save_rena <- function(plot_obj, name) {
  path <- file.path(panels_dir, paste0(name, ".html"))
  htmlwidgets::saveWidget(plot_obj$plot, normalizePath(path, mustWork = FALSE),
                          selfcontained = TRUE)
  path
}

# View 1 — FirstGame mean network + CI box
message("Rendering rENA view 1 (FirstGame)...")
p_fg <- rENA::ena.plot(ena_set)
p_fg <- rENA::ena.plot.network(p_fg, network = fg_net, colors = COL_FG)
p_fg <- rENA::ena.plot.group(p_fg, fg_points,
          labels = "FirstGame", colors = COL_FG, confidence.interval = "box")
.save_rena(p_fg, "rena_fg")

# View 2 — SecondGame mean network + CI box
message("Rendering rENA view 2 (SecondGame)...")
p_sg <- rENA::ena.plot(ena_set)
p_sg <- rENA::ena.plot.network(p_sg, network = sg_net, colors = COL_SG)
p_sg <- rENA::ena.plot.group(p_sg, sg_points,
          labels = "SecondGame", colors = COL_SG, confidence.interval = "box")
.save_rena(p_sg, "rena_sg")

# View 3 — Subtraction network + both group means
message("Rendering rENA view 3 (Subtraction)...")
p_sub <- rENA::ena.plot(ena_set)
p_sub <- rENA::ena.plot.network(p_sub, network = subtracted_net,
           colors = c(COL_FG, COL_SG))
p_sub <- rENA::ena.plot.group(p_sub, fg_points,
           labels = "FirstGame",  colors = COL_FG, confidence.interval = "box")
p_sub <- rENA::ena.plot.group(p_sub, sg_points,
           labels = "SecondGame", colors = COL_SG, confidence.interval = "box")
.save_rena(p_sub, "rena_sub")

# View 4 — Both group means + CI, no network
message("Rendering rENA view 4 (Overlay means)...")
p_both <- rENA::ena.plot(ena_set)
p_both <- rENA::ena.plot.group(p_both, fg_points,
            labels = "FirstGame",  colors = COL_FG, confidence.interval = "box")
p_both <- rENA::ena.plot.group(p_both, sg_points,
            labels = "SecondGame", colors = COL_SG, confidence.interval = "box")
.save_rena(p_both, "rena_both")

message("rENA plots done.")


# ── qeviz views → panel files ──────────────────────────────────────────────────

.save_qe <- function(p, name) {
  path <- file.path(panels_dir, paste0(name, ".html"))
  qe_export_html(p, path)
  path
}

groups <- qe_groups(ena_plot)

.save_qe(ena_plot |> qe_group(groups[1]) |> qe_edges(groups[1]) |>
           qe_labels(nodes = "on"), "qe_fg")
.save_qe(ena_plot |> qe_group(groups[2]) |> qe_edges(groups[2]) |>
           qe_labels(nodes = "on"), "qe_sg")
.save_qe(ena_plot |> qe_group() |> qe_edges(groups[1], compare = groups[2]) |>
           qe_labels(nodes = "on"), "qe_sub")
.save_qe(ena_plot |> qe_group() |>
           qe_labels(nodes = "on"), "qe_both")   # no qe_edges() → no network

message("qeviz views done.")


# ── Build comparison HTML ──────────────────────────────────────────────────────

.row <- function(title, rena_name, qe_name, notes = "") {
  note_html <- if (nzchar(notes)) sprintf('<p class="note">%s</p>', notes) else ""
  sprintf('
  <section>
    <h2>%s</h2>%s
    <div class="cols">
      <div class="col">
        <h3>rENA <span class="tag">plotly</span></h3>
        <iframe src="panels/%s.html" class="frame" loading="lazy"></iframe>
      </div>
      <div class="col">
        <h3>qeviz <span class="tag">web component</span></h3>
        <iframe src="panels/%s.html" class="frame" loading="lazy"></iframe>
      </div>
    </div>
  </section>', title, note_html, rena_name, qe_name)
}

rows <- paste(
  .row(
    "View 1 — FirstGame: mean network + CI box",
    "rena_fg", "qe_fg",
    "rENA: <code>ena.plot.network(fg_net) |&gt; ena.plot.group(CI=&quot;box&quot;)</code> &nbsp;|&nbsp;
     qeviz: <code>qe_group(&quot;FirstGame&quot;) |&gt; qe_edges(&quot;FirstGame&quot;)</code>"
  ),
  .row(
    "View 2 — SecondGame: mean network + CI box",
    "rena_sg", "qe_sg",
    "rENA: <code>ena.plot.network(sg_net) |&gt; ena.plot.group(CI=&quot;box&quot;)</code> &nbsp;|&nbsp;
     qeviz: <code>qe_group(&quot;SecondGame&quot;) |&gt; qe_edges(&quot;SecondGame&quot;)</code>"
  ),
  .row(
    "View 3 — Subtraction (FirstGame &minus; SecondGame) + both means",
    "rena_sub", "qe_sub",
    "rENA: <code>ena.plot.network(subtracted) |&gt; ena.plot.group(&times;2)</code> &nbsp;|&nbsp;
     qeviz: <code>qe_group() |&gt; qe_edges(&quot;FirstGame&quot;, compare=&quot;SecondGame&quot;)</code>"
  ),
  .row(
    "View 4 — Overlay: both group means + CI (no network)",
    "rena_both", "qe_both",
    "rENA: <code>ena.plot.group(&times;2, no network)</code> &nbsp;|&nbsp;
     qeviz: <code>qe_group()</code> &mdash; omit <code>qe_edges()</code> to show means only"
  )
)

html <- sprintf('<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>rENA vs qeviz — Comparison</title>
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

<h1>rENA vs qeviz — Side-by-side Comparison</h1>
<p class="subtitle">
  RS.data · Standard ENA · SVD rotation · 6 codes · 2 groups (FirstGame / SecondGame)
</p>

%s

</body>
</html>', rows)

out_file <- file.path("demo", "comparison.html")
writeLines(html, out_file)
message("Saved: ", normalizePath(out_file))
message("Panels in: ", normalizePath(panels_dir))
