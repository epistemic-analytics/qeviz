#!/usr/bin/env Rscript
# tools/rena-compare/edge_width.R — slider page for choosing qeviz's default
# <qe-graph edge-width>: the width of an edge of weight 1 as a fraction of the
# plot width. Width is absolute (raw weight × edge-width), as in webENA; node
# diameter = Σ edge widths. Colour uses webENA's ramps, rescaled per model.
#
#   ONA_SRC=... RENA_SRC=... Rscript tools/rena-compare/edge_width.R
#
# Writes tools/rena-compare/out/edge-width.html (serve the repo, open it there).

QEC_DIR <- local({
  args <- commandArgs(trailingOnly = FALSE)
  f <- sub("^--file=", "", grep("^--file=", args, value = TRUE))
  if (length(f)) dirname(normalizePath(f)) else normalizePath("tools/rena-compare")
})
repo <- normalizePath(file.path(QEC_DIR, "..", ".."))

suppressPackageStartupMessages({
  load_src <- function(env, pkg) {
    src <- Sys.getenv(env, "")
    if (nzchar(src)) pkgload::load_all(src, quiet = TRUE, export_all = FALSE)
    else library(pkg, character.only = TRUE)
  }
  load_src("RENA_SRC", "rENA")
  load_src("ONA_SRC", "ona")
  pkgload::load_all(file.path(repo, "R"), quiet = TRUE, export_all = FALSE)
})

data(RS.data)
codes <- c("Data", "Technical.Constraints", "Performance.Parameters",
           "Client.and.Consultant.Requests", "Design.Reasoning", "Collaboration")
ena_set <- rENA::ena.make.set(rENA::ena.accumulate.data(
  units = RS.data[, c("Condition", "UserName")],
  conversation = RS.data[, c("Condition", "GroupName")],
  codes = RS.data[, codes], window.size.back = 4))
ona_set <- RS.data |>
  accumulate(c("UserName", "Condition", "GroupName"), codes,
             c("Condition", "GroupName"), default_window = 4, ordered = TRUE) |>
  ona::model()

# Where the previous qeviz scale and ona's own scale fall on the slider, so the
# choice can be read against them. Both are "reference node diameter ÷ plot
# width", with qeviz's plot width = 2 × extent and extent = 1.3 × max |coord|.
equivalents <- function(set, directed) {
  lw   <- as.data.frame(set$line.weights)
  cols <- grep(" & ", names(lw), fixed = TRUE, value = TRUE)
  m    <- as.matrix(lw[, cols]); storage.mode(m) <- "double"
  grp  <- as.character(as.data.frame(set$meta.data)$Condition)
  pr   <- do.call(rbind, strsplit(cols, " & ", fixed = TRUE))
  sums <- function(w) {
    w <- abs(w); keep <- if (directed) TRUE else pr[, 1] != pr[, 2]
    s <- if (directed) tapply(w[keep], pr[keep, 2], sum)
         else tapply(c(w[keep], w[keep]), c(pr[keep, 1], pr[keep, 2]), sum)
    max(s)
  }
  node_ref <- max(vapply(unique(grp), function(g) sums(colMeans(m[grp == g, , drop = FALSE])), 0))
  nodes  <- as.data.frame(set$rotation$nodes)
  dims   <- names(nodes)[vapply(nodes, is.numeric, logical(1))][1:2]
  extent <- 1.3 * max(abs(as.matrix(nodes[, dims])))
  max_w  <- max(abs(m[, pr[, 1] != pr[, 2]]))
  old_frac <- (if (directed) 4 else 1) * 0.011 / max_w          # 0.4.0 width per weight (extent units)
  out <- c(previous = old_frac / 2,                              # as edge-width (plot-width units)
           marksize = 0.06 / node_ref)                           # the earlier mark-size 0.06 setting
  if (directed) out <- c(out, ona = 1 / (2 * extent))           # ona: width = weight (model units)
  round(out, 4)
}
eq <- list(ena = equivalents(ena_set, FALSE), ona = equivalents(ona_set, TRUE))

graph_html <- function(set, id, edges, compare = NULL) {
  p <- qe_plot(set, width = "100%", height = "100%") |> qe_group()
  p <- if (is.null(compare)) qe_edges(p, edges) else qe_edges(p, edges, compare = compare)
  el <- qeviz:::.build_graph_element(p$graph_opts)
  sub("<qe-graph ", sprintf('<qe-graph id="%s" edge-width="0.04" ', id), el, fixed = TRUE)
}
model_json <- function(set) jsonlite::toJSON(qe_extract(set), auto_unbox = TRUE, digits = 6, null = "null")

cells <- list(
  list(model = "ena", id = "ena_fg",  title = "ENA · FirstGame",  set = ena_set, e = "FirstGame"),
  list(model = "ena", id = "ena_sg",  title = "ENA · SecondGame", set = ena_set, e = "SecondGame"),
  list(model = "ena", id = "ena_sub", title = "ENA · FirstGame − SecondGame", set = ena_set, e = "FirstGame", c = "SecondGame"),
  list(model = "ona", id = "ona_fg",  title = "ONA · FirstGame",  set = ona_set, e = "FirstGame"),
  list(model = "ona", id = "ona_sg",  title = "ONA · SecondGame", set = ona_set, e = "SecondGame"),
  list(model = "ona", id = "ona_sub", title = "ONA · FirstGame − SecondGame", set = ona_set, e = "FirstGame", c = "SecondGame")
)
cell_html <- vapply(cells, function(k) sprintf(
  '<figure><figcaption>%s</figcaption><qe-visual id="vis_%s">%s</qe-visual><p class="stat" id="stat_%s"></p></figure>',
  k$title, k$id, graph_html(k$set, k$id, k$e, k$c), k$id), "")
init_js <- vapply(cells, function(k) sprintf(
  'document.getElementById("vis_%s").setModelData(MODELS.%s);', k$id, k$model), "")

html <- sprintf('<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>qeviz edge width</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{font-family:system-ui,sans-serif;margin:0;padding:1.25rem 1.5rem;background:#f4f4f5;color:#111}
  h1{font-size:1.25rem;margin:0 0 .3rem} p.lead{margin:0 0 1rem;color:#444;font-size:.85rem;max-width:62rem;line-height:1.45}
  .panel{position:sticky;top:0;z-index:5;background:#fff;border:1px solid #ddd;border-radius:8px;padding:.75rem 1rem;margin-bottom:1rem}
  .row{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
  input[type=range]{flex:1;min-width:16rem}
  .val{font:600 1.1rem ui-monospace,Menlo,monospace;min-width:4.5rem}
  .marks{position:relative;height:4.4rem;margin:.1rem 0 0;font-size:.7rem;color:#555}
  .marks span{position:absolute;transform:translateX(-50%%);white-space:nowrap}
  .marks span::before{content:"▲ "}
  h2{font-size:.95rem;margin:1rem 0 .4rem}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem}
  @media(max-width:900px){.grid{grid-template-columns:1fr}}
  figure{margin:0;min-width:0;overflow:hidden;background:#fff;border:1px solid #ddd;border-radius:6px;padding:.5rem}
  figcaption{font-size:.75rem;font-weight:600;color:#444;margin-bottom:.25rem}
  qe-visual{display:block;width:100%%;height:340px} qe-graph{display:block;width:100%%;height:100%%}
  .stat{font:.72rem ui-monospace,Menlo,monospace;color:#555;margin:.3rem 0 0}
</style></head><body>
<h1>qeviz edge width &amp; colour</h1>
<p class="lead">The slider sets <code>&lt;qe-graph edge-width&gt;</code>: the width of an edge of weight 1
as a fraction of the plot width. Width is absolute &mdash; raw weight &times; edge-width, as in webENA &mdash;
so equal weights draw equally wide in every plot below, ENA or ONA (unless <b>Scale subtraction</b> magnifies
the subtraction plots, which then say so); each node&rsquo;s diameter is the sum of
its edges&rsquo; widths (ONA: incoming + self). Colour uses webENA&rsquo;s ramps (saturation 0.25&ndash;1,
opacity 0.3&ndash;1), rescaled across the whole model by default. Triangles mark qeviz 0.4.0 and the
mark-size 0.06 setting.</p>
<div class="panel">
  <div class="row"><label for="ms"><b>edge-width</b></label>
    <input id="ms" type="range" min="0.005" max="0.12" step="0.0025" value="0.04">
    <span class="val" id="msv">0.0400</span></div>
  <div class="marks" id="marks"></div>
  <div class="row" style="margin-top:.35rem">
    <label for="mg"><b>Scale subtraction</b> <small>(<code>magnify</code>)</small></label>
    <input id="mg" type="range" min="0.1" max="4" step="0.1" value="1">
    <span class="val" id="mgv">off</span>
    <label style="font-size:.8rem"><input type="checkbox" id="mgside" checked>
      label side plots &ldquo;(scaled 1.0x)&rdquo;</label>
  </div>
  <div class="row" style="margin-top:.35rem;font-size:.8rem">
    <b>Colour</b>
    <label><input type="radio" name="cs" value="model" checked> model-wide ramps (default)</label>
    <label><input type="radio" name="cs" value="plot"> per plot (webENA, <code>color-scale="plot"</code>)</label>
    <label><input type="radio" name="cs" value="absolute"> absolute (<code>color-scale="absolute"</code>)</label>
  </div>
</div>
<h2>ENA (undirected) · ena.make.set</h2><div class="grid">%s</div>
<h2>ONA (directed) · ona::model</h2><div class="grid">%s</div>
<script>%s</script>
<script>
const MODELS = { ena: %s, ona: %s };
const EQ = %s;
%s
const ms = document.getElementById("ms"), msv = document.getElementById("msv");
// Reference marks under the slider
const marks = document.getElementById("marks");
[["ENA 0.4.0", EQ.ena.previous], ["ONA 0.4.0", EQ.ona.previous],
 ["ENA mark-size 0.06", EQ.ena.marksize], ["ONA mark-size 0.06", EQ.ona.marksize]].forEach(([l, v], i) => {
  if (v == null) return;
  const pos = (Math.min(v, 0.12) - 0.005) / 0.115;
  const s = document.createElement("span"); s.style.left = (pos * 100) + "%%"; s.style.top = (i * 1.1) + "rem";
  s.textContent = l + " " + v.toFixed(4) + (v > 0.12 ? " →" : ""); marks.appendChild(s);
});
function stats() {
  QEViz.getGraphs().forEach(g => {
    const vb = g.svg_element.viewBox.baseVal, px = g.svg_element.getBoundingClientRect().width / (vb.width || 1);
    const nodes = [...g.svg_element.querySelectorAll("circle[data-kind=node]")].map(c => 2 * +c.getAttribute("r"));
    const nums = d => (d.match(/-?\\d*\\.?\\d+(?:e[-+]?\\d+)?/gi) || []).map(Number);
    const widths = [...g.svg_element.querySelectorAll("line[data-edge-source]")].filter(l => l.getAttribute("stroke") !== "transparent").map(l => +l.getAttribute("stroke-width"))
      .concat([...g.svg_element.querySelectorAll("path[data-edge-source]:not([data-edge-self])")].map(p => { const n = nums(p.getAttribute("d")); return n.length >= 6 ? Math.hypot(n[2]-n[4], n[3]-n[5]) : 0; }));
    const el = document.getElementById("stat_" + g.id);
    const objs = [...g.__children__.search("__children__", "edges").__data__.objects.values()].filter(o => !o.meta?.isSelf);
    const sat = objs.map(o => o.meta.saturation).sort((a, b) => b - a);
    const med = sat.length ? sat[Math.floor(sat.length / 2)] : 0;
    const perW = objs.length ? objs[0].meta.widthFrac * g.__data__.extremes.x_max * px : 0;
    if (el) el.textContent = `node ${(Math.max(0, ...nodes) * px).toFixed(1)} px · edge ${(Math.max(0, ...widths) * px).toFixed(1)} px · ${perW.toFixed(1)} px per weight · saturation max ${(sat[0] || 0).toFixed(2)} / median ${med.toFixed(2)}`;
  });
}
ms.addEventListener("input", () => {
  msv.textContent = (+ms.value).toFixed(4);
  QEViz.getGraphs().forEach(g => g.setAttribute("edge-width", ms.value));
  clearTimeout(window.__t); window.__t = setTimeout(stats, 250);
});
document.querySelectorAll("input[name=cs]").forEach(r => r.addEventListener("change", () => {
  const mode = document.querySelector("input[name=cs]:checked").value;
  document.querySelectorAll("qe-edges").forEach(e =>
    mode === "model" ? e.removeAttribute("color-scale") : e.setAttribute("color-scale", mode));
  clearTimeout(window.__t); window.__t = setTimeout(stats, 250);
}));
// Scale subtraction: magnify on the FirstGame − SecondGame plots, like the webENA
// "Scale edge weights" does for its comparison plot. At 1.0 the control is
// off (no attribute, no label); otherwise the side plots can carry
// magnify="1" so every plot states its scaling, as webENA labels them.
const mg = document.getElementById("mg"), mgv = document.getElementById("mgv"),
      mgside = document.getElementById("mgside");
function applyMagnify() {
  const v = +mg.value, on = Math.abs(v - 1) > 1e-9;
  mgv.textContent = on ? v.toFixed(1) + "x" : "off";
  document.querySelectorAll("qe-graph").forEach(g => {
    const e = g.querySelector("qe-edges"); if (!e) return;
    if (g.id.endsWith("_sub")) on ? e.setAttribute("magnify", v.toFixed(1)) : e.removeAttribute("magnify");
    else (on && mgside.checked) ? e.setAttribute("magnify", "1") : e.removeAttribute("magnify");
  });
  clearTimeout(window.__t); window.__t = setTimeout(stats, 250);
}
mg.addEventListener("input", applyMagnify);
mgside.addEventListener("change", applyMagnify);
setTimeout(stats, 800);
</script></body></html>',
  paste(cell_html[1:3], collapse = "\n"), paste(cell_html[4:6], collapse = "\n"),
  qeviz:::.bundle_js(), model_json(ena_set), model_json(ona_set),
  jsonlite::toJSON(lapply(eq, as.list), auto_unbox = TRUE),
  paste(init_js, collapse = "\n"))

out <- file.path(QEC_DIR, "out", "edge-width.html")
dir.create(dirname(out), showWarnings = FALSE, recursive = TRUE)
writeLines(html, out)
message("Equivalent edge-width — ENA: ", paste(names(eq$ena), eq$ena, collapse = ", "),
        " | ONA: ", paste(names(eq$ona), eq$ona, collapse = ", "))
message("Wrote ", normalizePath(out))
