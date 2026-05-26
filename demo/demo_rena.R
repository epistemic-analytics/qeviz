# demo/demo_rena.R
#
# Fit a standard ENA model and an ONA model from RS.data (rENA package) and
# export a standalone HTML file that displays both side-by-side in qeviz.
#
# Run from the project root:
#   Rscript demo/demo_rena.R
#
# Requirements:
#   install.packages(c("rENA", "jsonlite"))
#
# ONA section requires the `ona` package:
#   install.packages("remotes")
#   remotes::install_github("epistemic-analytics/qe-packages/ona/R/ona@main")

suppressPackageStartupMessages({
  library(rENA)
  library(jsonlite)
})


# ── Data ───────────────────────────────────────────────────────────────────────

data(RS.data)

# RS.data columns used as the unit and conversation delimiters:
#   ENA_UNIT  — unique unit identifier (e.g. "FirstGame/steven z")
#   Condition — group label ("FirstGame" or "SecondGame")
#   GroupName — conversation delimiter (stanza boundary)

codeNames <- c(
  "Data", "Collaboration", "Justification",
  "Mechanical.Reasoning", "Negotiation",
  "Agency", "Systems.Thinking"
)


# ── Accumulate co-occurrence data ──────────────────────────────────────────────

accum <- ena.accumulate.data(
  units        = RS.data[, c("ENA_UNIT", "Condition")],
  conversation = RS.data[, c("ENA_UNIT", "GroupName")],
  codes        = RS.data[, codeNames],
  window.size.back = 4
)


# ── ENA set — SVD rotation ─────────────────────────────────────────────────────

ena_set <- ena.make.set(
  enadata     = accum,
  rotation.by = ena.svd
)


# ── Helper functions ───────────────────────────────────────────────────────────

# Convert a data.frame to a QEFrame: { data: [...rows...], types: {...} }
qe_frame <- function(df) {
  df <- as.data.frame(df)
  types <- vapply(df, function(col) {
    if (is.character(col) || is.factor(col)) "character"
    else if (is.logical(col))                "logical"
    else if (is.integer(col))                "integer"
    else                                     "numeric"
  }, character(1L))
  rows <- lapply(seq_len(nrow(df)), function(i) {
    r <- as.list(df[i, , drop = FALSE])
    lapply(r, function(v) if (is.factor(v)) as.character(v) else v)
  })
  list(data = rows, types = as.list(types))
}

# 95% CI group summaries — mean ± t(df=n-1, 0.975) * SE on each axis
group_summary <- function(pts, x_col, y_col, group_col) {
  groups <- sort(unique(pts[[group_col]]))
  do.call(rbind, lapply(groups, function(g) {
    sub  <- pts[pts[[group_col]] == g, ]
    n    <- nrow(sub)
    t_v  <- qt(0.975, df = max(1L, n - 1L))
    x    <- sub[[x_col]];  y <- sub[[y_col]]
    mx   <- mean(x, na.rm = TRUE);  my   <- mean(y, na.rm = TRUE)
    se_x <- sd(x,  na.rm = TRUE) / sqrt(n)
    se_y <- sd(y,  na.rm = TRUE) / sqrt(n)
    data.frame(
      group  = g, x = mx, y = my,
      x.low  = mx - t_v * se_x, x.high = mx + t_v * se_x,
      y.low  = my - t_v * se_y, y.high = my + t_v * se_y,
      stringsAsFactors = FALSE
    )
  }))
}

# Names of the first two numeric columns (the rotated dimension axes)
find_dims <- function(df) {
  nm <- names(df)[vapply(df, is.numeric, logical(1L))]
  if (length(nm) < 2L) stop("Expected at least two numeric dimension columns.")
  nm[1:2]
}

# Extract nodes / points / edges / groups frames from an ena.set or ona.set
extract_frames <- function(set, directed = FALSE) {

  # Nodes: code positions in rotated space
  nodes_raw <- as.data.frame(set$rotation.set$nodes)
  dims      <- find_dims(nodes_raw)          # e.g. c("SVD1", "SVD2")
  nodes_df  <- nodes_raw[, c("code", dims)]
  names(nodes_df)[2:3] <- c("x", "y")

  # Points: unit positions in rotated space
  pts_raw   <- as.data.frame(set$points.rotated)
  points_df <- pts_raw[, c("ENA_UNIT", "Condition", dims)]
  names(points_df)[3:4] <- c("x", "y")

  # Edges: normalized line weights, one row per unit.
  # line.weights contains only the weight columns; join with meta.data for IDs.
  meta_df   <- as.data.frame(set$meta.data)[, c("ENA_UNIT", "Condition")]
  edges_raw <- as.data.frame(set$line.weights)
  edges_df  <- cbind(meta_df, edges_raw)
  # qeviz's edge parser expects "." separator (e.g. "Data.Collaboration")
  names(edges_df) <- gsub(" & ", ".", names(edges_df), fixed = TRUE)

  # Groups: pre-computed means + 95% CI bounds
  groups_df <- group_summary(points_df, "x", "y", "Condition")

  list(
    directed    = directed,
    updated     = as.integer(Sys.time()) * 1000L,
    id_col      = "ENA_UNIT",
    node_id_col = "code",
    x_col       = "x",
    y_col       = "y",
    group_col   = "Condition",
    nodes       = qe_frame(nodes_df),
    edges       = qe_frame(edges_df),
    points      = qe_frame(points_df),
    groups      = qe_frame(groups_df)
  )
}


# ── Build ENA model data ───────────────────────────────────────────────────────

ena_model <- extract_frames(ena_set, directed = FALSE)


# ── ONA model (requires `ona` package) ─────────────────────────────────────────
#
# ONA uses the full unfolded adjacency matrix: A→B and B→A are separate columns,
# and self-connections A→A are included.  Set directed = TRUE so qeviz draws
# arrowheads.

if (requireNamespace("ona", quietly = TRUE)) {
  library(ona)
  accum_ona <- ona.accumulate.data(
    units        = RS.data[, c("ENA_UNIT", "Condition")],
    conversation = RS.data[, c("ENA_UNIT", "GroupName")],
    codes        = RS.data[, codeNames],
    window.size.back = 4
  )
  ona_set   <- ona.make.set(enadata = accum_ona)
  ona_model <- extract_frames(ona_set, directed = TRUE)
} else {
  message("Package `ona` not installed — the ONA panel will be empty.")
  message("Install with: remotes::install_github(",
          '"epistemic-analytics/qe-packages/ona/R/ona@main")')
  ona_model <- NULL
}


# ── Inline the qeviz bundle ────────────────────────────────────────────────────
# Look for the built UMD bundle next to the project root.
# Run `npm run build` from the project root before generating HTML.

bundle_js <- local({
  candidates <- c("dist/qeviz.umd.js", "../dist/qeviz.umd.js")
  for (p in candidates) {
    if (file.exists(p)) {
      message("Using bundle: ", normalizePath(p))
      return(paste(readLines(p, warn = FALSE), collapse = "\n"))
    }
  }
  warning("qeviz.umd.js not found — run `npm run build` first.")
  ""
})


# ── Generate HTML ──────────────────────────────────────────────────────────────

ena_json <- toJSON(ena_model, auto_unbox = TRUE, digits = 6, null = "null")
ona_json <- if (!is.null(ona_model))
              toJSON(ona_model, auto_unbox = TRUE, digits = 6, null = "null")
            else "null"

group_names   <- sort(unique(as.data.frame(ena_set$points.rotated)$Condition))
group_options <- paste(
  sprintf('      <option value="group-%s">Group — %s</option>',
          group_names, group_names),
  collapse = "\n"
)

html <- paste0(
'<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>qeviz — RS.data ENA / ONA</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem; background: #f5f5f5; }
    h1   { font-size: 1.2rem; margin: 0 0 .25rem; }
    p.sub { color: #555; font-size: .85rem; margin: 0 0 1rem; }
    .controls { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1rem; align-items: center; }
    label { font-size: .85rem; }
    .layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .card { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: .75rem; }
    .card h2 { font-size: .9rem; margin: 0 0 .5rem; color: #333; }
    qe-visual { display: block; width: 100%; height: 440px; }
    qe-graph  { display: block; width: 100%; height: 100%; }
    .legend   { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; }
    .legend-item { display: flex; align-items: center; gap: 4px; font-size: .8rem; }
    .legend-dot  { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
  </style>
</head>
<body>

<h1>qeviz — RS.data (rENA)</h1>
<p class="sub">
  Standard ENA (undirected) and ONA (directed) models fitted from
  <code>RS.data</code> using the rENA&nbsp;/&nbsp;ona R&nbsp;packages.<br>
  Codes: ', paste(codeNames, collapse = ", "), '.
  Groups: ', paste(group_names, collapse = ", "), '.
</p>

<div class="controls">
  <label>View:
    <select id="sel-mode">
', group_options, '
      <option value="subtract">Subtraction (', group_names[1], ' − ', group_names[2], ')</option>
      <option value="overlay">Overlay (both groups)</option>
    </select>
  </label>
  <label>Labels:
    <select id="sel-labels">
      <option value="auto">Auto</option>
      <option value="on">On</option>
      <option value="off">Off</option>
      <option value="click">Click</option>
    </select>
  </label>
</div>

<div class="layout">
  <div class="card">
    <h2>Standard ENA — <code>directed: false</code></h2>
    <qe-visual id="vis-ena">
      <qe-graph id="graph-ena" width="100%" height="440" points labels="auto"></qe-graph>
    </qe-visual>
    <div class="legend" id="legend-ena"></div>
  </div>
  <div class="card">
    <h2>ONA — <code>directed: true</code></h2>
    <qe-visual id="vis-ona">
      <qe-graph id="graph-ona" width="100%" height="440" points labels="auto"></qe-graph>
    </qe-visual>
    <div class="legend" id="legend-ona"></div>
  </div>
</div>

<script>', bundle_js, '</script>
<script>
const enaModel = ', ena_json, ';
const onaModel = ', ona_json, ';

const PALETTE = ["#4477AA","#EE6677","#228833","#CCBB44","#66CCEE","#AA3377"];
const groups  = enaModel.groups.data.map(r => r.group);

["ena", "ona"].forEach(id => {
  const el = document.getElementById("legend-" + id);
  groups.forEach((g, i) => {
    el.innerHTML += `<span class="legend-item">
      <span class="legend-dot" style="background:${PALETTE[i % PALETTE.length]}"></span>${g}
    </span>`;
  });
});

const visEna   = document.getElementById("vis-ena");
const visOna   = document.getElementById("vis-ona");
const graphEna = document.getElementById("graph-ena");
const graphOna = document.getElementById("graph-ona");

visEna.setModelData(enaModel);
if (onaModel) visOna.setModelData(onaModel);

document.getElementById("sel-mode").addEventListener("change", e => {
  const val = e.target.value;
  [graphEna, graphOna].forEach(g => {
    if (val === "subtract") {
      g.setAttribute("group",   groups[0]);
      g.setAttribute("compare", groups[1]);
      g.removeAttribute("also");
    } else if (val === "overlay") {
      g.setAttribute("group", groups[0]);
      g.setAttribute("also",  groups[1]);
      g.removeAttribute("compare");
    } else {
      g.setAttribute("group", val.replace("group-", ""));
      g.removeAttribute("compare");
      g.removeAttribute("also");
    }
  });
});

document.getElementById("sel-labels").addEventListener("change", e => {
  graphEna.setAttribute("labels", e.target.value);
  graphOna.setAttribute("labels", e.target.value);
});
</script>
</body>
</html>')

out_file <- file.path("demo", "demo_rena.html")
writeLines(html, out_file)
message("Saved: ", normalizePath(out_file))
