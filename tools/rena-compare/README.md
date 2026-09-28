# rENA vs qeviz accuracy harness

Plots **one** rENA `ena.set` with both renderers and checks each against values
computed directly from the set. Nothing in rENA is modified.

```bash
npm run build                                  # refresh R/inst/qeviz.umd.js
RENA_SRC=~/Workspaces/RStudio/rENA Rscript tools/rena-compare/run.R
npx serve . -l 7801                            # then open the URL below
```

Open `http://localhost:7801/tools/rena-compare/out/` (note the trailing slash).

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

## Your own model

```r
QEC_DIR <- "tools/rena-compare"; source(file.path(QEC_DIR, "harness.R"))
qec_compare(set, group_col = "Condition")                 # default 5 views
qec_compare(set, views = list(
  qec_view("sub", "A − B", network = list(group = "A", compare = "B"), means = c("A", "B"))
))
```
