# rENA / ona vs qeviz accuracy harness

Plots **one** `ena.set` with a reference renderer and qeviz, and checks each
against values computed directly from the set. Nothing in rENA or ona is modified.

| Reference | Script | Model | Output |
|---|---|---|---|
| rENA (`ena.plot.*`) | `run.R` | undirected ENA | `out/` |
| ona (`plot() \|> edges() \|> nodes()`) | `run_ona.R` | ordered ONA | `out-ona/` |

For ONA, edges are matched by direction (column `"A & B"` is A → B, drawn with its
wide end on B), node diameter is checked against Σ incoming edge widths + the
self-connection, and self-connection glyphs against the self weight. `ona::units()`
cannot draw means or points for models from the current `accumulate()` (it filters
on `ENA_DIRECTION`, which those models no longer carry), so the ONA views are
networks only.

```bash
npm run build                                  # refresh R/inst/qeviz.umd.js
RENA_SRC=~/Workspaces/RStudio/rENA Rscript tools/rena-compare/run.R
ONA_SRC=~/Workspaces/RStudio/ona RENA_SRC=~/Workspaces/RStudio/rENA Rscript tools/rena-compare/run_ona.R
npx serve . -l 7801                            # then open the URLs below
```

Open `http://localhost:7801/tools/rena-compare/out/` or `.../out-ona/` (note the
trailing slash).

| Column | Source of the numbers | Where it's checked |
|---|---|---|
| rENA render | `plotly_build()` traces from `ena.plot.network/group/points` | R (console + report) |
| qeviz adapter | `qe_extract()` ModelData | R (console + report) |
| qeviz render | `getNodes/getPoints`, rendered SVG, points layer (`qe_probe.js`) | browser (`report.js`) |

Truth is taken from the set: `rotation$nodes`, `colMeans(line.weights)` per group (the difference
of those means for subtraction), group means, and `t.test` 95% CIs on `points`. Comparisons use model space.
qeviz's y-flip is undone, and qeviz is rendered with `scale-points="false"` because rENA doesn't
rescale points.

Each plot's code is generated from its view spec as text, then `eval()`'d, and that same text is shown
under the plot in the report. The page therefore always shows the code that actually ran.
The model setup code from `run.R` is shown at the top.

`WARN` rows describe how the plot is drawn, not the data (edge width ∝ |weight|; rENA
draws code nodes only when a network is plotted).

## Edge width / colour demo

`edge_width.R` writes `out/edge-width.html`: ENA and ONA FirstGame, SecondGame and
subtraction plots with live controls for `<qe-graph edge-width>`, the colour mode
(`color-scale` model / plot / absolute) and `magnify` on the subtraction plots.

```bash
ONA_SRC=~/Workspaces/RStudio/ona RENA_SRC=~/Workspaces/RStudio/rENA Rscript tools/rena-compare/edge_width.R
```

## Your own model

```r
QEC_DIR <- "tools/rena-compare"; source(file.path(QEC_DIR, "harness.R"))
qec_compare(set, group_col = "Condition")                 # rENA reference
qec_compare(ona_set, reference = "ona", group_col = "Condition")
qec_compare(set, views = list(
  qec_view("sub", "A − B", network = list(group = "A", compare = "B"), means = c("A", "B"))
))
```
