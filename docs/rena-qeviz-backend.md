# rENA plotting backend switch (qeviz)

**Status:** phase 1 (plumbing) and phase 2 (layer functions) implemented; phases 3–6 to do · **Repo / branch:** rENA
`qeviz-widget` · **Depends on:** qeviz ≥ 0.5.0 (see `qeviz-0.5.0-spec.md`)

rENA's existing plotting API (`ena.plot()`, `plot.ena.set()`, the
`ena.plot.*()` layer functions and everything built on them) gains a
`backend` switch. The plotly path stays the default and is unchanged. Under
`backend = "qeviz"` the same calls build a qeviz plot, so existing scripts
switch renderer with one option.

```r
options(rENA.plot.backend = "qeviz")          # or ena.plot(set, backend = "qeviz")
p <- ena.plot(set, title = "FirstGame")
p <- ena.plot.network(p, network = colMeans(first_lw))
p <- ena.plot.group(p, first_points, colors = "red", confidence.interval = "box")
p$plot                                         # an htmlwidget on either backend
```

## Where it plugs in

- **`ENAplot` (R6)** holds the plotly figure in `$plot`, the axis settings and
  the palette. It's created by `ena.plot()`, which `plot.ena.set()` calls.
- **Layer functions** `ena.plot.network()`, `ena.plot.points()`,
  `ena.plot.group()` and `ena.plot.trajectory()` add traces to `$plot`.
- **Built on those:** `ena.plotter()`, `ena.plot.subtraction()` and the pipe
  API (`add_network`, `add_points`, `add_group`, `with_means`, `add_nodes`).
  They switch backend with no changes of their own once the layer functions
  branch.
- **Out of scope:** ona. It builds its own plotly figures (`ona::base_plot()`
  and friends) and doesn't use `ENAplot`.

## Plan

1. **Plumbing**
   - `ena.plot(..., backend = getOption("rENA.plot.backend", "plotly"))`;
     `plot.ena.set()` passes it through.
   - Under qeviz, `ENAplot` holds a `qe_plot` built from
     `qe_extract(set, group_col = NULL)`. It starts empty (rENA plots start
     empty) but keeps the model-wide scales from the full set: edge colour
     ramps and width per weight.
   - `$plot` becomes an active binding: the plotly object as before, or
     `qeviz::qe_widget()` under qeviz. `print()` behaves the same on both.
2. **Layers.** Each of the three layer functions starts with
   `if (<qeviz backend>) return(<qeviz version>(...))`, mapping arguments as
   in the table below. The plotly code underneath is untouched.
3. **Composites**
   - `ena.plotter()`: its subtraction multiplier maps to `magnify`, with
     `magnify = 1` on the side plots.
   - `clear()`: needs a qeviz branch.
   - `scale.ENAplot()` and `check_range()`: they call `plotly::layout()`
     directly, so each gets a small qeviz branch mapping onto `range`.
4. **Not available on the qeviz backend**
   - `ena.plot.trajectory()`, `add_trajectory()`, `with_trajectory()` and
     `ena.plot.movie()`: trajectories are deferred (0.5.0 spec §5), and the
     movie functions are plotly animations.
   - These fail with a clear error pointing to `backend = "plotly"`.
5. **Harness.** `tools/rena-compare` runs each view's single piece of
   `ena.plot()` code through both backends. The hand-written `qe_*()` code on
   the qeviz side goes away; the model-space readback checks are unchanged.
6. **Tests and docs.** Tests for every mapped, ignored and unsupported
   argument (qeviz tests skip without qeviz ≥ 0.5.0); a NEWS entry; a backend
   section in the plotting docs.

## Argument mapping

| rENA | qeviz backend |
|---|---|
| **`ena.plot()`**: `title`, `dimension.labels`, `font.size` / `font.color` / `font.family`, `scale.to` | `qe_plot(title, range)`, `qe_axes(x, y)`, `qe_labels(font_*)`. The `scale.to = list(x =, y =)` form is an error: ranges are symmetric only. |
| `ena.plot(multiplier)` | `magnify` |
| `ena.plot(point.size)` | `qe_points(size)` |
| `showticklabels`, `ticks`, `axispadding`, `autosize`, `automargin`, `displayModeBar` | ignored silently (plotly layout only) |
| **`ena.plot.network()`**: `network`, `colors`, `threshold` | `qe_edges(weights, colors, threshold)` |
| `threshold = c(min, max)` | `qe_edges(threshold = c(min, max))`: \|w\| < min not drawn, \|w\| > max drawn at max, sign kept. Already in qeviz 0.5.0 (§1). |
| `thin.lines.in.front` | qeviz default (thin lines on top) |
| `node.positions`, `labels`, `show.all.nodes` | `qe_nodes(positions, labels, unconnected)` |
| `label.font.*` | `qe_labels(font_*)`, plot-wide not per layer |
| `thickness`, `opacity`, `saturation`, `scale.range`, `node.size`, `scale.weights` | ignored, warns once. qeviz's model-wide scaling rules replace them. |
| `legend.name` | the layer's `name` (reported in edge events; qeviz has no legend) |
| `edge_type` dash / dot, `label.offset`, `legend.include.edges` | ignored, warns once (non-goals) |
| `layers`, `labels.hide` (in `...`) | `qe_nodes(show = "always" / "never")` / no edges layer; `qe_labels(nodes = "off")` |
| `adjacency.key`, unnamed `network` | weights named from the key (or the one implied by `node.positions`), exactly as the plotly path reads them; same length check |
| `ena.plot(multiplier)` | `magnify = multiplier / 5` (rENA's default multiplier is 5) |
| **`ena.plot.points()`**: `points`, `colors`, `shape`, `texts`, `labels` | `qe_points(points, color, shape, labels = texts)`; `labels` (hover names) become the point ids |
| `point.size` | `size = point.size / 2` (rENA's default 5 ↔ qeviz's 2.5) |
| `confidence.interval.values`, `outlier.interval.values` | ignored, warns once (per-point intervals are a non-goal) |
| `label.offset`, `show.legend`, `legend.name` | ignored, warns once |
| **`ena.plot.group()`**: `points`, `labels`, `colors`, `shape`, `confidence.interval`, `outlier.interval` | `qe_group(points, label, color, shape, intervals, outlier)`, per call (each mean keeps its own intervals / outlier) |
| per-point `colors` with several values | one mean per distinct colour, as on plotly |
| `outlier.interval = "crosshairs"` | drawn as a box, warns once |
| `method` other than `"mean"` | error |
| `label.offset`, `show.legend`, `legend.name` | ignored, warns once |

## What changes for users on the qeviz backend

- **`$plot`** is a qeviz htmlwidget. Code that modifies it with
  `plotly::layout(p$plot, …)` no longer works. That's inherent to the switch.
- **Default palette** is Paul Tol "bright" (0.5.0 decision), not ColorBrewer
  "Accent". Colours passed explicitly are used as given.
- **Line widths and colour intensity** follow qeviz's rules: absolute width
  per weight, webENA ramps rescaled across the whole model, and node size
  equal to the sum of its edge widths. rENA's `thickness` / `saturation`
  arguments don't apply, so plots look different even with identical code.
- **The rENA plotting bugs** listed in the 0.5.0 spec (crosshair size, outlier
  box centred on the origin, CI box dropped when the outlier interval is also
  a box) don't carry over. Those plots will differ from plotly, correctly.

## Decisions

1. **Arguments that can't be honoured:** warn once per argument per session
   when they change the picture. Stay silent for plotly-only layout options.
2. **Trajectories and movies:** error on the qeviz backend. No silent fallback
   to plotly (mixing renderers is confusing).
3. **`threshold` maximum:** supported, not warned. It turned out to be in
   qeviz 0.5.0 already (§1, R and TS). The cap is now verified in
   `tools/rena-compare` (view `w_clamp`, `threshold = c(0.05, 0.15)`: rENA,
   the adapter and the qeviz render all agree).
4. **Order:** the pending qeviz work and the widget replacement are committed
   (qeviz `dd4353b`, rENA `f67089b`). The switch goes on rENA `qeviz-widget`
   after them.

## qeviz additions (made for the switch)

- `qe_palette()`: exported default palette (phase 1).
- `qe_labels()` changes only the arguments supplied, so a layer call setting
  fonts doesn't reset the label modes (phase 2).
- Models with no group column (`qe_extract(group_col = NULL)`, which the backend
  uses) take explicit points and means; the groups frame is keyed by `group`
  (phase 2).
- Per-mean `intervals` / `outlier` columns in the groups frame, overriding the
  plot-wide `<qe-means>` settings, since rENA sets them per `ena.plot.group()`
  call (phase 2, R + TS).
- `qe_edges(threshold = c(min, max))` was already in 0.5.0.
