# demo/demo_rena.R
#
# Fit a standard ENA model and an ONA model from RS.data (rENA/tma packages)
# and export a standalone HTML file that displays both side-by-side in qeviz.
#
# Run from the project root:
#   Rscript demo/demo_rena.R
#
# Requirements: tma, rENA, jsonlite, and the qeviz R package.
# Load qeviz from source if not installed:
#   pkgload::load_all("R")

suppressPackageStartupMessages({
  if (requireNamespace("pkgload", quietly = TRUE)) {
    pkgload::load_all("R", quiet = TRUE)   # load from source in project root
  } else {
    library(qeviz)
  }
  library(tma)
  library(rENA)
  library(jsonlite)
})


# ── Data ───────────────────────────────────────────────────────────────────────

data(RS.data)

units_by  <- c("Condition", "UserName")
hoo_rules <- tma::conversation_rules(
  (Condition %in% UNIT$Condition) & (GroupName %in% UNIT$GroupName)
)
codes <- c(
  "Data", "Technical.Constraints", "Performance.Parameters",
  "Client.and.Consultant.Requests", "Design.Reasoning", "Collaboration"
)

context_model <- tma::contexts(
  RS.data,
  units_by  = make.names(units_by),
  hoo_rules = hoo_rules
)

multidim_arr <- tma::context_tensor(
  RS.data,
  sender_cols   = NULL,
  receiver_cols = NULL,
  default_window = 8,
  default_weight = 1
)

result_ena <- tma::accumulate(
  tensor        = multidim_arr,
  codes         = codes,
  context_model = context_model,
  ordered       = FALSE
)

result_ona <- tma::accumulate(
  tensor        = multidim_arr,
  codes         = codes,
  context_model = context_model,
  ordered       = TRUE
)


# ── Build plot objects ─────────────────────────────────────────────────────────

ena_set <- rENA::model(result_ena)
ona_set <- rENA::model(result_ona, directed = TRUE)

qe_ena  <- qe_plot(ena_set)
qe_ona  <- qe_plot(ona_set)

group_names   <- qe_groups(qe_ena)
group_options <- paste(
  sprintf('      <option value="group-%s">Group — %s</option>',
          group_names, group_names),
  collapse = "\n"
)


# ── Inline the qeviz bundle ────────────────────────────────────────────────────

bundle_js <- local({
  pkg_path <- system.file("qeviz.umd.js", package = "qeviz")
  if (nzchar(pkg_path) && file.exists(pkg_path)) {
    message("Using bundle: ", normalizePath(pkg_path))
    return(paste(readLines(pkg_path, warn = FALSE), collapse = "\n"))
  }
  for (p in c("dist/qeviz.umd.js", "../dist/qeviz.umd.js")) {
    if (file.exists(p)) {
      message("Using bundle: ", normalizePath(p))
      return(paste(readLines(p, warn = FALSE), collapse = "\n"))
    }
  }
  warning("qeviz.umd.js not found — run `npm run build` first.")
  ""
})


# ── Serialize model data ───────────────────────────────────────────────────────

ena_json <- jsonlite::toJSON(qe_ena$model, auto_unbox = TRUE, digits = 6, null = "null")
ona_json <- jsonlite::toJSON(qe_ona$model, auto_unbox = TRUE, digits = 6, null = "null")


# ── Generate HTML ──────────────────────────────────────────────────────────────

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
  <code>RS.data</code> using the rENA&nbsp;/&nbsp;tma R&nbsp;packages.<br>
  Codes: ', paste(codes, collapse = ", "), '.
  Groups: ', paste(group_names, collapse = ", "), '.
</p>

<div class="controls">
  <label>View:
    <select id="sel-mode">
', group_options, '
      <option value="subtract">Subtraction (', group_names[1], ' − ', group_names[2], ')</option>
      <option value="overlay">Overlay (both groups)</option>
      <option value="means">Means only (no network)</option>
    </select>
  </label>
  <label>Code labels:
    <select id="sel-node-labels">
      <option value="on" selected>On</option>
      <option value="auto">Auto</option>
      <option value="click">Click</option>
      <option value="off">Off</option>
    </select>
  </label>
  <label>Point labels:
    <select id="sel-point-labels">
      <option value="auto" selected>Auto</option>
      <option value="on">On</option>
      <option value="click">Click</option>
      <option value="off">Off</option>
    </select>
  </label>
</div>

<div class="layout">
  <div class="card">
    <h2>Standard ENA &mdash; <code>directed: false</code></h2>
    <qe-visual id="vis-ena">
      <qe-graph id="graph-ena" width="100%" height="440">
        <qe-nodes label="on"></qe-nodes>
        <qe-means confidence label="on"></qe-means>
        <qe-points label="auto"></qe-points>
      </qe-graph>
    </qe-visual>
    <div class="legend" id="legend-ena"></div>
  </div>
  <div class="card">
    <h2>ONA &mdash; <code>directed: true</code></h2>
    <qe-visual id="vis-ona">
      <qe-graph id="graph-ona" width="100%" height="440">
        <qe-nodes label="on"></qe-nodes>
        <qe-means confidence label="on"></qe-means>
        <qe-points label="auto"></qe-points>
      </qe-graph>
    </qe-visual>
    <div class="legend" id="legend-ona"></div>
  </div>
</div>

<script>', bundle_js, '</script>
<script>
const enaModel = ', ena_json, ';
const onaModel = ', ona_json, ';

const PALETTE = ["#4477AA","#EE6677","#228833","#CCBB44","#66CCEE","#AA3377"];
const groups  = enaModel.groups.data.map(r => r[enaModel.group_col]);

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
visOna.setModelData(onaModel);

// Manipulate <qe-edges> child elements — add/remove/update to change the
// active edge network.  The MutationObserver in <qe-graph> triggers a
// re-render whenever child elements are added, removed, or have attributes
// changed.
function applyMode(graph, val) {
  const existing = graph.querySelector("qe-edges");
  if (existing) existing.remove();

  if (val === "means") return;   // no edges — means/points only

  const el = document.createElement("qe-edges");
  if (val === "subtract") {
    el.setAttribute("group",   groups[0]);
    el.setAttribute("compare", groups[1]);
  } else if (val === "overlay") {
    el.setAttribute("group", groups[0]);
    el.setAttribute("also",  groups[1]);
  } else {
    // "group-<name>"
    el.setAttribute("group", val.replace("group-", ""));
  }
  graph.appendChild(el);
}

document.getElementById("sel-mode").addEventListener("change", e => {
  applyMode(graphEna, e.target.value);
  applyMode(graphOna, e.target.value);
});

document.getElementById("sel-node-labels").addEventListener("change", e => {
  graphEna.querySelector("qe-nodes").setAttribute("label", e.target.value);
  graphOna.querySelector("qe-nodes").setAttribute("label", e.target.value);
});

document.getElementById("sel-point-labels").addEventListener("change", e => {
  graphEna.querySelector("qe-points")?.setAttribute("label", e.target.value);
  graphOna.querySelector("qe-points")?.setAttribute("label", e.target.value);
});

// Apply initial selection
applyMode(graphEna, document.getElementById("sel-mode").value);
applyMode(graphOna, document.getElementById("sel-mode").value);
</script>
</body>
</html>')

out_file <- file.path("demo", "demo_rena.html")
writeLines(html, out_file)
message("Saved: ", normalizePath(out_file))
