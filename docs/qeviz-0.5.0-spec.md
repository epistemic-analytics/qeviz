# qeviz 0.5.0 — spec: explicit-data inputs for rENA integration

**Status:** decisions made · §1–§4 implemented (`qe_edges`, `qe_points`, `qe_group`, `qe_nodes`; R + TS, verified in `tools/rena-compare`); §5 deferred; §6–§7 to do · **Target:** qeviz 0.5.0 · **Consumer:** rENA (a `qeviz` plot backend), then webENA / Python / Julia

## Why

rENA is getting a qeviz plot backend alongside plotly (see *rENA integration*
below). qeviz is **not** meant to be a drop-in replacement for rENA's
`ena.plot.*` functions, but the inputs have to meet: **rENA plots data, qeviz
plots names.**

- rENA's functions take whatever the caller computed: an arbitrary network
  vector (`colMeans` of any subset, a difference, a scaled network), any matrix
  of points, any subset to average.
- qeviz only resolves **group / unit names** against the model: `qe_edges("FirstGame")`
  computes the group's mean network in the browser from the edges frame;
  `qe_group()` reads pre-computed group rows; `qe_points()` shows every unit.

0.5.0 closes that gap by accepting **explicit data wherever rENA does**, while
keeping name-based selection.

## Principles

1. **Explicit data adds a layer; names select.** Calls that pass data
   (`weights =`, `points =`) append a layer, so plots can be built up the way
   rENA builds them. Name arguments (`group`, `unit`) keep their current
   select-and-replace behaviour.
2. **Explicit data is drawn on the model's scales.** Edge width stays absolute
   (weight × `edge-width`), and colour uses the model-wide range from the
   edges frame, so a custom network is comparable with every other plot of the
   same model. Values outside the range are clamped to it. (The 0.4.0 scaling
   rules are unchanged — see `CHANGELOG.md` and the `qeviz-scaling-principles`
   notes.)
3. **qeviz stays backend-neutral.** rENA-specific conveniences — the
   `Condition$FirstGame` metadata shorthand, `ena.plotter`, plotly arguments —
   are the rENA wrapper's job. qeviz takes plain vectors, matrices and data
   frames.
4. **Additive API.** Every 0.4.0 call keeps working unchanged.

## Scope summary

| Area | rENA input today | qeviz 0.4.0 | qeviz 0.5.0 |
|---|---|---|---|
| Networks | any network vector / matrix | group / unit names | `qe_edges(weights =)` |
| Points | any points matrix / subset | all units or none | `qe_points(units =, points =)` |
| Means | mean of any subset | group names | `qe_group(points =)` |
| Nodes | position overrides | model positions | `qe_nodes(positions =)` |
| Trajectories | any trajectory rows, `by =` | `trajectories` frame only | `qe_trajectories(points =, by =)` |
| Plot | title, range, palette, fonts, dims | HTML title only, fixed | `qe_plot(dims =, range =, palette =, …)` |
| Output | printed / `$plot` / `saveWidget` | HTML file or fragment | htmlwidget + knitr + Shiny |

---

## 1. `qe_edges()` — networks

### Signature

```r
# 0.4.0
qe_edges(p, group = NULL, unit = NULL,
         compare = NULL, also = NULL, show = TRUE,
         color_scale = c("model", "plot", "absolute"),
         edge_width = NULL, magnify = NULL)

# 0.5.0
qe_edges(p,
         group     = NULL,  # name: a group's mean network           (unchanged)
         unit      = NULL,  # name: one unit's network               (unchanged)
         weights   = NULL,  # NEW  explicit data: vector / matrix / data frame / list
         compare   = NULL,  # name, OR explicit data when used with `weights`
         also      = NULL,  # name                                    (unchanged)
         colors    = NULL,  # NEW  c(positive, negative)
         threshold = NULL,  # NEW  c(min, max)
         name      = NULL,  # NEW  layer label (events, tooltips)
         show      = TRUE,
         color_scale = c("model", "plot", "absolute"),
         edge_width  = NULL,
         magnify     = NULL)
```

### Arguments

| Argument | Accepts | Behaviour |
|---|---|---|
| `weights` | A **named numeric vector** (`"A & B"` or `"A.B"`; ONA self-connections `"A & A"`); an **unnamed vector** in the model's edge-column order (length `choose(n, 2)` for ENA, `n²` for ONA); a **matrix / data frame** of rows (column means, as rENA's `ena.plot.network` accepts); or a **list** of any of those (one layer each). | Appends a network layer. Sign picks the colour (≥ 0 → `colors[1]`, < 0 → `colors[2]`). Mutually exclusive with `group` / `unit`. Unknown edge names or a wrong length are an error. |
| `compare` | A group **name** (as now), or — with `weights` — **explicit data** in any `weights` form. | Subtraction: `weights − compare`. A pre-computed signed vector passed as `weights` alone is equally valid; both are supported. |
| `colors` | `c(pos, neg)`, or one colour (negatives use its complement, as in rENA). | Overrides the palette for this layer. Default: the group's palette colour; for a subtraction, the two groups' colours; for unnamed explicit data, the first two palette colours. |
| `threshold` | `c(min, max)`, or `min` alone. | rENA semantics: \|w\| < `min` → not drawn; \|w\| > `max` → capped at `max`, sign kept. |
| `name` | A string. | Layer label, reported in `qe-edge-*` events and tooltips. Default: the group / unit name, else `"network 1"`, `"network 2"`, … (list elements use their names). |
| `color_scale`, `edge_width`, `magnify` | Unchanged. | Explicit layers use the model-wide colour range and are clamped to it. |

### Modes

- `group` / `unit` — replace the plot's named network (0.4.0 behaviour).
- `weights` — append a layer; repeated calls overlay.
- `show = FALSE` — clear all networks (named and explicit).

### Validation

- `weights` names are normalised (`" & "` → `"."`) and matched against the
  model's edge columns; unmatched names are an error listing a few valid ones.
- Unnamed vectors must match the model's edge-column count exactly.
- Matrix / data frame: numeric columns only; metadata columns (character /
  factor) are dropped first, so `set$line.weights[...]` works directly.
- `compare` as data must resolve to the same columns as `weights`.

### Wire format

- ModelData gains a **`networks`** frame: one row per explicit layer,
  `name` + one column per edge (same column names as `edges`), optional
  `color_pos`, `color_neg`.
- The graph gets one child per explicit layer:
  `<qe-edges network="network 1" colors="#386CB0,#F0027F" threshold="0.05,0.8">`.
  Name-based `<qe-edges group=…>` is unchanged; several `<qe-edges>` children
  may now coexist (0.4.0 reads only the first).
- Draw order: thin edges on top of thick ones by default (rENA's
  `thin.lines.in.front = TRUE`).

### Examples

```r
m  <- as.matrix(set$line.weights)
fg <- set$meta.data$Condition == "FirstGame"
sg <- set$meta.data$Condition == "SecondGame"

qe_plot(set) |> qe_edges("FirstGame")                        # by name (0.4.0)
qe_plot(set) |> qe_edges(weights = m[fg, ])                  # same network, from data
qe_plot(set) |> qe_edges(weights = m[fg, ], compare = m[sg, ],
                         colors = c("blue", "red"))           # subtraction from data
qe_plot(set) |> qe_edges(weights = colMeans(m[fg, ]) - colMeans(m[sg, ]))  # pre-computed
qe_plot(set) |> qe_edges(weights = m[high_conf, ], threshold = 0.05,
                         name = "High confidence")            # a non-group subset
qe_plot(set) |> qe_edges(weights = list(FirstGame = m[fg, ], SecondGame = m[sg, ]),
                         colors = c("#4477AA", "#EE6677"))    # overlay
```

### Not carried over from rENA

`multiplier`, `scale.weights`, `thickness`, `opacity`, `saturation`,
`scale.range` (replaced by `edge_width` / `color_scale` / `magnify`; the rENA
wrapper maps `multiplier` → `magnify`, which labels the plot), `edge_type`
(dashes), `layers`, `legend.name`, `legend.include.edges`.

---

## 2. `qe_points()` — unit points

```r
qe_points(p, show = TRUE,
          units  = NULL,  # NEW  character: unit IDs to show
          points = NULL,  # NEW  matrix / data frame of positions (adds a point set)
          color  = NULL,  # NEW  one colour, or one per point
          shape  = NULL,  # NEW  "circle" | "square" | "triangle" | "diamond"
          labels = NULL,  # NEW  per-point text
          name   = NULL,  # NEW  point-set label
          size = NULL, fixed_size = FALSE)
```

| | rENA (`ena.plot.points`, `add_points`) | qeviz 0.4.0 | 0.5.0 |
|---|---|---|---|
| Which points | `points =` any matrix / `ena.points` subset | all units or none | `units =` subset by ID; `points =` arbitrary positions (IDs from `ENA_UNIT` when present) — each call adds a set |
| Colour | `colors` (one or per point) | by group | `color =` |
| Shape | circle / square / triangle-up / diamond | circle | `shape =` |
| Text | `texts` (per point), `labels` (legend name), `label.offset` | label modes | `labels =` per point; `label.offset` is a non-goal |

- `units` and `points` are mutually exclusive; `show = TRUE` with neither keeps
  0.4.0 behaviour (all units, coloured by group).
- **Wire format:** a **`pointsets`** frame (`set, id, x, y, color?, shape?, label?`)
  and `<qe-points set="…">` per set.
- Per-point CI / outlier intervals (`confidence.interval.values`) are a non-goal.

---

## 3. `qe_group()` — means and intervals

```r
qe_group(p, ...,
         points     = NULL,  # NEW  matrix / data frame: mean of an arbitrary subset
         label      = NULL,  # NEW  name for that mean
         color      = NULL,  # NEW
         shape      = NULL,  # NEW  default "square"
         by = NULL,
         intervals  = c("box", "crosshairs", "none"),  # was logical
         conf_level = 0.95,  # NEW
         outlier    = FALSE, # NEW  1.5 × IQR interval
         fixed_size = FALSE)
```

| | rENA (`ena.plot.group`, `add_group`) | qeviz 0.4.0 | 0.5.0 |
|---|---|---|---|
| Which mean | `points =` any subset matrix | names from the groups frame | `points =` → mean + t CI computed in R (`group_summary()`), added as a groups row named `label` |
| Colour / shape | `colors`, `shape` (square) | palette, square | `color =`, `shape =` |
| CI | `"none"` (default) / `"box"` / `"crosshairs"` | box on (`TRUE`) | `intervals =` all three; `TRUE` / `FALSE` still accepted (→ `"box"` / `"none"`) |
| Outlier | `outlier.interval` (1.5 × IQR) | deprecated frame | `outlier = TRUE`: Q1 − 1.5·IQR … Q3 + 1.5·IQR per dimension, stored as `{dim}.olow` / `{dim}.ohigh` in the groups frame. rENA's current offsets are not re-centred on the mean (a bug) and are not copied. |
| Statistic | `method` (mean or any function) | mean | mean only (non-goal) |

- The mean-marker cap (half the CI box's shorter half-side) applies to
  crosshairs too (half the shorter arm).

---

## 4. `qe_nodes()` — code nodes

```r
qe_nodes(p, show = c("auto", "always", "never"),
         unconnected = c("dot", "hide"),
         positions = NULL,  # NEW  data frame: code, x, y — overrides the model's nodes
         labels    = NULL)  # NEW  named character: display text per code
```

| | rENA | qeviz 0.4.0 | 0.5.0 |
|---|---|---|---|
| Positions | `node.positions =`, `adjacency.key =` | model | `positions =` for this plot (also drives the extent); edges follow the new positions |
| Labels | `labels`, `labels.hide` | on / off / click / auto | `labels =` custom text; modes unchanged |
| Unconnected | `show.all.nodes = FALSE` | `unconnected = "hide"` | unchanged |
| Size | `node.size = c(3, 10)` per-plot rescale | diameter = Σ edge widths | unchanged (0.4.0 rule) |

---

## 5. `qe_trajectories()`

> **Deferred** until rENA's trajectory / ETM API settles: the smoothing and
> movie work is new (Sept 2026, tied to libqe trajectory kernels) and
> `ena.plot.trajectory()` / `add_trajectory()` / `with_trajectory()` have open
> bugs, so there is no stable behaviour to match yet. qeviz's existing
> `qe_trajectories()` stays as is.

```r
qe_trajectories(p, units = NULL,
                points = NULL,  # NEW  trajectory rows (positions + ordering + metadata)
                by     = NULL,  # NEW  column: one path per value
                colors = NULL,  # NEW
                labels = NULL,  # NEW
                smooth = c("none", "poly"),
                degree = NULL,  # NEW  fixed degree (≡ degree_selection = "fixed")
                max_degree = 3L,
                degree_selection = c("loocv_2d", "fixed"),
                curve = TRUE,   # NEW  show the fitted curve
                points_show = TRUE, tips = TRUE, playhead = NULL,
                line_style = c("uniform", "tapered"), …)
```

| | rENA (`ena.plot.trajectory`) | qeviz 0.4.0 | 0.5.0 |
|---|---|---|---|
| Data | `points =` rows with metadata; `by =` grouping column | `trajectories` frame only — `qe_extract()` never fills it | `points =`, `by =`; `qe_extract()` fills `trajectories` for trajectory-model sets |
| Styling | `colors`, `names`, `labels`, `shape` | palette | `colors =`, `labels =` |
| Fit | `poly.degree`, `poly.max.degree`, `poly.criterion = loocv / aic`, `poly.n.eval` | `max_degree`, `degree_selection` | `degree =`; `criterion = "aic"` pending (open question 5) |
| Visibility | `show.points`, `show.curve`, `default.hidden` | `points`, `tips` | `curve =`; `default.hidden` is a non-goal |
| Animation | `ena.plot.movie` | playhead | non-goal (movie stays plotly) |

- The existing `points` flag is renamed `points_show` so `points =` can take
  data (the old name is accepted with a deprecation warning when logical).
- Fits keep the parity check in `tools/parity`.

---

## 6. Plot level — `qe_plot()`, `qe_extract()`, `qe_labels()`

| | rENA | qeviz 0.4.0 | 0.5.0 |
|---|---|---|---|
| Dimensions | first two columns of whatever is passed | first two numeric columns | `dims = c("SVD1", "SVD3")` (names or indices) on `qe_extract()` / `qe_plot()` |
| Title | `title`, drawn in the plot | HTML `<title>` only | drawn in the SVG (included in `toSVG()` / `toPNG()`); `qe_plot(title =, show_title = TRUE)` |
| Axis labels | `dimension.labels` | `qe_axes(x =, y =)` | unchanged |
| Axis range | `scale.to = "network"` / `"points"` / number / `list(x, y)` | nodes + points × 1.3 | `qe_plot(range =)` with the same options |
| Point scaling | none | `scale-points` (HTML only) | `qe_plot(scale_points =)` |
| Palette | rENA's 7 colours; per-call `colors` | Paul Tol, fixed | `qe_plot(palette =)`; `qe_colors(p, FirstGame = "#…")` group → colour map |
| Fonts | `font.size`, `font.family`, `font.color` | fixed | `qe_labels(font_size =, font_family =, font_color =)` |

---

## 7. Output — htmlwidget, knitr, Shiny

Required for rENA regardless of the rest:

- `qe_widget(p, width, height)` — an **htmlwidget** (binding in the qeviz R
  package, bundle from `inst/`), so `htmlwidgets::saveWidget()` works.
- `knit_print.qe_plot` — plots render inline in knitr / Quarto / RStudio.
- `qeOutput()` / `renderQe()` — Shiny bindings.
- These replace rENA's own widget (`R/ena_interactive.R`, `inst/htmlwidgets/`),
  which vendors the qeviz **0.1.0** bundle, duplicates `qe_extract()`
  (`.ena_to_model_data`) and uses the pre-0.2 attribute API.

---

## Wire-format summary (TypeScript)

| Addition | Shape |
|---|---|
| `ModelData.networks` | QEFrame: `name`, edge columns, optional `color_pos`, `color_neg` |
| `ModelData.pointsets` | QEFrame: `set`, `id`, `x`, `y`, optional `color`, `shape`, `label` |
| `groups` columns | optional `color`, `shape`, `label`, `{dim}.olow`, `{dim}.ohigh` |
| `ModelData.layout` | optional `title`, `range`, `palette` |
| `<qe-edges>` | multiple children allowed; new `network`, `colors`, `threshold`, `name` attributes |
| `<qe-points>` | new `set` attribute |
| `<qe-means>` | `intervals="box|crosshairs|none"`, `outlier` |
| `<qe-graph>` | `title`, `range` |

Colour ramps for explicit networks use the **model-wide** range computed from
`edges` (not from `networks`), clamped — principle 2.

## rENA integration (context)

- rENA adds `options(rENA.plot.backend = "qeviz")` plus `backend =` on
  `ena.plot()` / `plot.ena.set()`; the `ENAplot` R6 contract is kept, `$plot`
  returns an htmlwidget on either backend, and the plotly path is unchanged.
- The wrapper maps: `ena.plot.network(network, colors, threshold, multiplier)`
  → `qe_edges(weights = network, colors, threshold, magnify = multiplier)`;
  `ena.plot.points(points, colors, shape, texts)` → `qe_points(points =, color =, shape =, labels =)`;
  `ena.plot.group(points, labels, colors, confidence.interval)` → `qe_group(points =, label =, color =, intervals =)`;
  `ena.plot.trajectory(points, by, …)` → `qe_trajectories(points =, by =, …)`;
  `ena.plotter` subtraction multiplier → `magnify` with `magnify = 1` on side plots.
- `ena.plot.movie` and `with_trajectory` stay on plotly.

## rENA plotting bugs found (noted, not fixed)

Found by the harness (`tools/rena-compare`, views `m_cross` / `m_outlier`) in
rENA 0.4.8's plotly code. The qeviz backend does not reproduce them.

1. **Crosshair CIs are wrong** — `ena.plot.group(confidence.interval =
   "crosshairs")` passes the CI's *absolute* bounds as plotly's symmetric
   error-bar `array`, so the arms are sized by a bound, not a half-width
   (≈ 0.18 off on RS.data). `R/ena.plot.points.R` crosshair branch.
2. **Outlier box is centred on the origin** — `ena.plot.group` builds the
   outlier interval as ±1.5·IQR offsets (`R/ena.plot.group.R:116-117`) but
   draws them as absolute coordinates, never adding the mean. The intended
   interval (webENA / `libqe::outlier_ci`) is Q1 − 1.5·IQR … Q3 + 1.5·IQR.
3. **CI box dropped when the outlier interval is also a box** — with
   `confidence.interval = "box", outlier.interval = "box"` only the "Outlier
   Int." trace is drawn; the "Conf. Int." box is lost.

## Non-goals (0.5.0)

Dashed edges; per-edge legends; the `Condition$FirstGame` shorthand (rENA
resolves it); `method` other than the mean; animation; plotly argument
pass-through; per-point intervals; `label.offset`.

## Testing

- **R unit tests** — argument validation and emitted ModelData / graph
  attributes for every new argument.
- **Accuracy harness** (`tools/rena-compare`) — add views that draw explicit
  data on both sides: rENA `ena.plot.network(network = v)` vs
  `qe_edges(weights = v)`; points / means from subsets; threshold; node
  position overrides; `dims = c("SVD1", "SVD3")`. The existing model-space
  checks apply unchanged.
- **Cross-plot scale** — explicit layers must keep the 1.000 width-per-weight
  ratio against name-based plots of the same model.
- **Bindings** — Python / Julia argument parity in 0.5.x (decision 5).

## Decisions

1. **`compare`** accepts a group name **or** explicit data (with `weights`); a
   pre-computed signed `weights` vector is also supported.
2. **Append vs replace:** explicit-data calls (`weights =`, `points =`) append a
   layer; name calls (`group`, `unit`) replace the named selection;
   `show = FALSE` clears everything.
3. **Colour range for explicit data:** always the model-wide range from
   `edges`, clamped — never widened by the plotted data.
4. **Default `intervals`:** keep qeviz's box (rENA's default is `"none"`; the
   rENA wrapper passes rENA's default through explicitly).
5. **Bindings:** R first in 0.5.0; Python / Julia argument parity in 0.5.x.
6. **Trajectory criterion:** `loocv_2d` / fixed only; no AIC port.
