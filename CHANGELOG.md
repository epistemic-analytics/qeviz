# Changelog

All notable changes to qeviz are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/) (in 0.x, breaking changes bump
the minor version). The TypeScript core and the R / Python / Julia adapters are
versioned together.

## [0.6.0] - 2026-10-16

Everything webENA needs to draw its network plots with qeviz instead of
sigma.js: per-row label control, zoom and pan like sigma's camera, fixed
on-screen sizes, whole-plot transitions, and in-place re-renders.

### Added
- **Zoom and recentre from your own controls.** `<qe-graph>` has
  `zoomBy(factor)`, `zoomTo(level)` and `resetView()` (zoom 1, no pan), so a
  host's zoom buttons no longer have to reach into qeviz's internals. Zoom is
  about the centre of the view.
- **`<qe-graph view-padding>`** sets how far the view extends beyond `range`
  (default `1.2`, as before). `view-padding="1"` makes the view match the range
  exactly, for a host that frames the plot itself.
- **A network can come from the `networks` frame alone.** `<qe-edges
  network="…">` reads its edge columns from the `networks` frame, so a model
  with just `nodes` and `networks` draws the network, and a network may include
  edges the `edges` frame doesn't have. Without an `edges` frame, the default
  `color-scale="model"` takes its range from the `networks` rows. Plots of
  groups and units (`group`, `unit`, `compare`, `also`) are unchanged.
- **Clickable marks show a pointing-hand cursor.** Code nodes, group means,
  unit and point-set points, and edges (including self-connection dots) are
  what `qe-node-click` / `qe-edge-click` report, and now look clickable.
  Labels keep their grab cursor. A host can change it with the
  `--qe-mark-cursor` CSS property on `<qe-graph>`. Clicking a directed
  edge's arrow chevron now counts as clicking the edge.
- **Per-row label control.** Rows of the `nodes`, `pointsets` and `groups`
  frames can set their label: `label` (`""` now means no label for that row),
  `label.dx` / `label.dy` (an offset in the units `qe-label-move` reports, so
  a host can restore or mirror a dragged label) and `label.pinned` (always
  shown, whatever the label mode, across re-renders).
- **Point sets have labels.** `<qe-points set="…">` rows are labelled from
  their `label` column (else the id), in the set's own `label` mode or
  `<qe-graph label-points>`. In R, `qe_points(labels =)` now shows them on
  hover, as documented.
- **Node size from the data.** An optional `size` column on the `nodes` frame
  sets a code node's diameter in CSS pixels at zoom 1; it zooms with the plot.
- **`<qe-edges self-size="node">`** draws ONA self-connection dots at half
  their node's radius (as webENA does), or at a given fraction of it; the self
  weight then only sets the colour.
- **`label-font-weight`** on `<qe-nodes>`, `<qe-means>` and `<qe-points>`,
  e.g. bold code labels. The default is still 500.
- **Edges and code nodes can keep their size while zooming.** With
  `<qe-edges fixed-size>` and `<qe-nodes fixed-size>`, edge widths (lines,
  directed triangles and their chevrons, self-connection dots, hover targets)
  and node diameters stay at their zoom-1 on-screen size at any zoom, as in
  webENA. Highlight rings and glows around them do the same. Without the
  attributes they grow with the zoom as before.
- **Zoom and pan like webENA's sigma plots.** The wheel zooms toward the
  pointer, by an amount that follows the scroll (`<qe-graph zoom-step>`,
  default 1.1 per mouse notch, so a trackpad is smooth), and a trackpad pinch
  zooms through it. A double-click zooms in 2.2× toward the pointer. Touch
  works: drag to pan, pinch to zoom, tap to click, drag labels with a finger.
  `zoom-min` / `zoom-max` limit every kind of zoom, and `view-locked` turns
  user zooming and panning off while the zoom methods keep working.
- **Dragging pans with the pointer.** A mouse drag now keeps the grabbed point
  under the pointer at any zoom, as a finger does; it used to move the plot at
  a fixed rate that didn't match the pointer, and dropped moves that arrived
  within one frame. Releasing the button outside the plot no longer leaves it
  panning.
- **Interval boxes and axes too.** `<qe-means fixed-size>` now also keeps the
  confidence-interval boxes, crosshairs and outlier boxes at their zoom-1
  stroke width and dash pattern, and the new `<qe-axes fixed-size>` does the
  same for the axis lines and axis labels.

- **R, Python and Julia can use the new options.** `qe_plot(view_padding =)`;
  `fixed_size` on `qe_nodes()`, `qe_edges()` and `qe_axes()` (sizes stay
  constant on screen when zoomed); `qe_edges(self_size =)` for ONA
  self-connection dots; `qe_labels(font_weight =)`, one weight or one per
  layer (e.g. bold code labels); and `qe_nodes(sizes =)` for node diameters in
  pixels. Same argument names in all three languages.
- **QEViz.jl is in the QE package registry.** Julia users can now
  `Pkg.Registry.add(RegistrySpec(url =
  "https://gitlab.com/epistemic-analytics/qe-packages/cranqe.git#julia"))` and
  `Pkg.add("QEViz")`, as for ENA.jl and TMA.jl.
### Fixed
- **Labels follow their marks when the model is updated.** After a second
  `setModelData` with new coordinates (e.g. a flipped axis), node, mean and
  point labels stayed where they were while the marks moved. A label the user
  dragged keeps its offset from its mark.
- **Edges and marks that are no longer drawn are removed.** An edge whose
  weight became zero or fell under the threshold, a unit or group that left
  the model, or a whole layer whose `<qe-edges>` / `<qe-points>` /
  `<qe-means>` element was removed stayed on the plot at its old position.
  Edges that switch between undirected and directed (or marks that change
  shape) are redrawn instead of staying put, and a removed edge no longer
  leaves its invisible hover target or direction chevron behind.
- **`animate` transitions move the whole plot, smoothly.** Updating the model
  together with `<qe-graph>` attributes (e.g. a new `range`) used to snap the
  marks instead of animating them, an animated update could show the new
  positions for one frame before starting from the old ones, and labels,
  interval boxes, the highlight and the view extent jumped while the marks
  glided. Now everything — marks, nodes, edges (ONA triangles stay attached),
  interval boxes, labels, the highlight and the view — moves together, the
  first frame is the old plot, and an update that arrives mid-transition
  continues from the current positions. Attribute and child changes made
  just before `setModelData` (in the same task) no longer cause a second
  render.
- **Dragging a label while zoomed follows the pointer.** At zoom 2 a label
  moved twice as far as the mouse. `qe-label-move` still reports graph units.
- **The highlight follows zoom and pan.** `setHighlight()` rings and glows
  stayed where they were drawn when the view was zoomed or dragged.
- **Hover and click labels survive a re-render.** An `"auto"` label shown on
  hover, or a `"click"` label opened, was hidden again by the next render, so
  a host that re-renders on hover could never show one.
- **Turning labels `off` removes them.** Setting a label mode to `"off"` on a
  plot that already showed labels left them on screen; changing the mode
  (e.g. `"on"` to `"click"`) now takes effect too.
- **Panning can be reset to exactly 0.** The view's transform ignored any 0
  (and 0.0075), so a pan could never return to the origin.
- **No more debug output in the browser console.** Messages logged on every
  plot and every render are now shown only with `globalThis.__QEVIZ_DEBUG__ =
  true`.

- **A missing point-set label stays missing in Python and Julia.** A `None` /
  `nothing` in `points(labels =)` was drawn as the text "None" / "nothing";
  like R's `NA`, it now falls back to the point's id.
### Changed (breaking)
- **The mouse wheel zooms toward the pointer** (previously about the plot
  origin), and by an amount that follows the scroll: one mouse notch is still
  1.1×. `zoomBy()` / `zoomTo()` zoom about the centre of the view.
- **A `label` of `""` hides that row's label.** In the `nodes`, `pointsets`
  and `groups` frames an empty label used to fall back to the id; missing or
  `NA` labels still do.

## [0.5.7] - 2026-10-14

### Fixed
- **Labels no longer run off the edge of the plot.** A node, mean or point
  label that would extend past the visible area is placed on the other side of
  its point, and if it still doesn't fit, moved back inside. Labels the host
  has dragged or placed are left where they are.

## [0.5.6] - 2026-10-13

### Fixed
- **Confidence and outlier interval lines are no longer drawn several times
  too thick when the plot is zoomed to its points** (`range = "points"` or a
  number smaller than the network, e.g. rENA's `scale.to = "points"`). Their
  width now follows the displayed range; plots scaled to the network are
  unchanged.
- **Colour names work everywhere a colour is accepted.** `qe_colors(FirstGame =
  "red")` (and other non-hex colours: `"#f00"`, `rgb()`, any CSS colour) used to
  stop the plot rendering with "Unsupported color format"; the browser now
  resolves them. Hex colours behave as before.
- **The Python demo data (`py/data/RS.data.csv`) is rENA's current RS.data.**
  The old copy predated rENA's redaction of a participant's email address and
  its current coding.

### Changed
- The R package's Windows binary is now built on GitHub Actions (dispatched by
  cranqe's nightly run); pushes to `main` and tags build it as a check.

## [0.5.5] - 2026-10-06

### Changed
- **Python package renamed `qeviz` → `qe-viz`** on qe-libs.org (the import is
  still `qeviz`). Install with `pip install qe-viz --extra-index-url
  https://qe-libs.org/py/simple/`; already-published `qeviz` files stay
  installable.
- **`from_pyena()` is now `from_ena()`**, following rENA's Python package
  (`qe-ena`, `import ena`). `from_pyena` remains as an alias.

## [0.5.4] - 2026-10-06

### Added
- **Python README** (`py/README.md`): install, a pyENA-based quick start with a
  rendered plot, the DataFrame route, the chain API, display and export. The
  Python package now declares it (`readme = "README.md"`), so the qe-libs
  project page shows it; before, the page had no description.
- `tools/readme-demo/`: rebuilds the README demo images (qeviz's and pyENA's).

## [0.5.3] - 2026-10-05

Python and Julia parity with the R package's 0.5 API. All three adapters now
take the same arguments and, for the same calls, produce the same
`<qe-graph>` markup and model data, checked by shared fixtures built with the
R package (`tests/golden/`).

### Added
- **Python and Julia: explicit-data inputs and plot settings** (as R gained in
  0.5.0–0.5.1). Networks from data (`weights`, `compare`, `colors`,
  `threshold = (min, max)`, `name`; one layer per call); point sets (`units` /
  `points`, `color`, `shape`, `labels`, `name`); the mean of any subset
  (`points`, `label`, `color`, `shape`, `intervals`, `conf_level`,
  `outlier`), each keeping its own intervals; `show = False` for means; node
  `positions` and `labels`; plot `title`, `range`, `scale_points`,
  `point_scale`, `center` and `palette`; per-group colours (Python
  `.colors()`, Julia `qe_colors()`); `.range()` / `qe_range()`; label fonts
  in pixels; `palette()` / `qe_palette()`; models without a group column.
  Python's `from_pyena()` takes `dims`.
- `tests/golden/`: cross-language parity fixtures (26 scenarios).

### Changed
- Python / Julia: label settings change only the arguments supplied (a bare
  call still applies the defaults), as R's `qe_labels()` does since 0.5.0.
- Python / Julia: `title` is also drawn above the plot, as in R.
- Python: `plot(m).model` is a copy of `m`; chain methods that add data copy
  the frames they change, so branched plots never share layers.

### Fixed
- Python and Julia confidence intervals: both used a t-quantile lookup table
  that ignored `conf_level` and rounded the degrees of freedom up (df = 4 used
  the df = 5 value). Both now compute the exact quantile (R's `qt()`, to about
  1e-14) with no scipy or Distributions.jl.
- Julia: `Project.toml` listed wrong UUIDs for DataFrames, JSON3 and Test, so
  the package could not be installed.
- Python `from_pyena()` failed on real pyENA models: it read attribute names
  pyENA doesn't have (`positions_`, `normed_networks_`, `units_`; pyENA's are
  `rotation_nodes_`, `line_weights_`, `unit_labels_`, with `meta_data_` for
  groups), and turned `"A & B"` connection names into `"A . B"`, which match
  no edge. Its tests used a mock with the same guessed names; they now use
  pyENA's real attributes, plus a fit of a real pyENA model when pyENA is
  installed.

## [0.5.2] - 2026-10-05

### Fixed
- Directed networks overlaid with `<qe-edges group="A" also="B">` drew each
  triangle short of its counterpart, leaving a gap mid-edge: the apex split
  (A→B against B→A) pooled both groups' weights. Each overlaid network now
  places its apexes from its own weights. Single-group and subtraction plots
  are unchanged.

## [0.5.1] - 2026-10-05

### Added
- **`center="content"`** on `<qe-graph>` (`qe_plot(center = "content")`):
  centres the view on the middle of the nodes' and points' bounding box instead
  of the origin, so a network that sits off to one side fills the plot.
  `range="network"` is then measured from that centre; the axis lines, axis
  labels, title and ring labels follow it. The default is still the origin.
- **`point-scale="N"`** on `<qe-graph>` (`qe_plot(point_scale = N)`): an
  explicit factor for unit points and means, overriding `scale-points` (e.g. `1`
  for raw coordinates, or another tool's scaling). Unset by default: points are
  scaled as before.

### Fixed
- A `<qe-graph>` inside another component's shadow DOM ignored its own
  visual's model and drew nothing: it now checks the event's composed path
  rather than its (retargeted) target.

## [0.5.0] - 2026-09-30

Explicit-data inputs and plot output for rENA's qeviz backend
(`docs/qeviz-0.5.0-spec.md`, `docs/rena-qeviz-backend.md`): networks, points and
means can come straight from data, as rENA's `ena.plot.*()` functions take them,
and plots are htmlwidgets for RStudio, R Markdown / Quarto and Shiny. The new
inputs are in the TypeScript core and the R package; Python and Julia ship the
0.5.0 bundle, and their API parity follows in 0.5.x. Verified side by side
against rENA's plotly plots in `tools/rena-compare/`.

### Added
- **Explicit networks:** `qe_edges(weights =, compare =, colors =, threshold =,
  name =)`. `weights` is a vector, matrix or data frame (averaged); `compare`
  subtracts a second network; `threshold = c(min, max)` drops |w| < min and caps
  |w| > max (rENA semantics). Each call adds a network layer, drawn on the
  model's width and colour scales.
- **Explicit points:** `qe_points(units =, points =, color =, shape =, labels =,
  name =)` draws a point set; shapes are circle, square, triangle and diamond.
- **Explicit means:** `qe_group(points =, label =, color =, shape =,
  intervals =, conf_level =, outlier =)` draws the mean of any subset with a box
  or crosshair t interval and an optional outlier interval (Q1 − 1.5·IQR …
  Q3 + 1.5·IQR). Each explicit mean keeps its own interval settings.
  `qe_group(show = FALSE)` hides all means.
- **Node overrides:** `qe_nodes(show =, unconnected =, positions =, labels =)`.
- **Plot settings:** `qe_plot(dims =, range =, title =, scale_points =,
  palette =)`, `qe_range()`, `qe_colors()` (per-group colours),
  `qe_labels(font_size =, font_family =, font_color =)` with font size in pixels,
  and `qe_palette()` (the default Paul Tol "bright" palette).
- **`qe_extract(dims =)`** picks the plotted dimensions by name or index;
  `qe_extract(group_col = NULL)` gives a model with no groups.
- **htmlwidget output:** `qe_widget()`; printing a `qe_plot` shows the widget,
  a plot at the end of a knitr / Quarto chunk renders inline, and
  `qeOutput()` / `renderQe()` are the Shiny bindings.
- **TypeScript / wire format:** ModelData `networks`, `pointsets` and `palette`;
  groups-frame `color`, `shape`, `label`, `{dim}.olow` / `.ohigh`, `intervals`
  and `outlier` columns; multiple `<qe-edges>` with `network`, `colors`,
  `threshold` and `name`; `<qe-points set>`; `<qe-means intervals outlier>`;
  `<qe-graph range plot-title scale-points label-font-size label-font-family
  label-font-color>`.

### Changed
- **The bundle is minified** (203 KB → 104 KB) and ships with its source map
  next to every copy. Where the bundle is inlined into a page (`qe_html()`,
  `qe_fragment()`, Python / Julia inline output) the source-map comment is
  stripped.
- **R:** the bundle moved to `inst/htmlwidgets/lib/qeviz/`; `htmlwidgets` and
  `htmltools` are now imports.
- **`qe_labels()` changes only the arguments supplied** (a bare call still
  applies the defaults), so setting fonts no longer resets the label modes.
- Pixel-sized labels and the title re-lay out when the plot is resized.
- The `rena-demo` vignette ends each chunk in the plot instead of pasting
  `qe_fragment()` HTML, so the bundle is included once.

### Fixed
- A missing interval bound in the groups frame could be read as 0.
- `qe_points()` / `qe_group()` failed on a model without a group column.

## [0.4.0] - 2026-09-28

First release since 0.2.0: it also includes the unreleased 0.3.0 changes below.

Rendering changes found by side-by-side accuracy testing against rENA's and ona's
own plots (`tools/rena-compare/`), bringing qeviz in line with rENA / ona / webENA
conventions and making separate plots of one model comparable by eye.

### Changed (breaking)
- **Edge width is absolute, as in webENA.** Width = raw weight × `<qe-graph
  edge-width>` (the width of a weight-1 edge as a fraction of the plot width,
  default 0.04), so equal weights draw equally wide in graphs of the same size,
  ENA or ONA. Previously each plot was normalized to its own strongest edge, so
  every network's strongest edge looked equally bold and plots of FirstGame,
  SecondGame and their subtraction could not be compared. Directed edges' wide
  ends and self-connection dots use the same width per unit of weight (the old
  fixed ×4 for directed edges is gone).
- **Edge colour uses webENA's ramps, rescaled across the model.** Saturation maps
  onto 0.25–1 and opacity onto 0.3–1, linearly from the smallest to the largest
  non-zero weight in the model's whole edges frame (every unit; self-connections
  have their own range), so plots of one model share one colour scale and weak
  edges stay visible. webENA rescales per network; `<qe-edges color-scale="plot">`
  gives that, and `color-scale="absolute"` uses saturation = opacity = |weight|.
- **Code-node size equals its accumulated edge width.** Each node's diameter is the
  sum of the drawn widths of its edges, so node size is proportional to connection
  weight and comparable across plots (previously `2 + 3 × Σw / max(1, plot max)`).
  Undirected: every edge touching the node. Directed (ONA): only edges directed
  *at* the node — their wide ends are drawn on the target — plus its
  self-connection, matching ona and webENA. Self-connection dots have diameter =
  the self weight's width, so they are proportional to the self weight and always
  fit inside the node. Nodes with no drawn edges show as a tiny dot; `<qe-nodes
  unconnected="hide">` hides them.
- **Code nodes draw only when `<qe-nodes>` is present**, like every other layer
  element. Node positions still come from the model and anchor the plot extent,
  so the scale does not change when nodes are hidden. The R / Python / Julia
  wrappers emit `<qe-nodes>` only alongside an edge network (rENA draws nodes as
  part of `ena.plot.network()`); `qe_nodes()` / `.nodes()` override that.
- **Axis labels are opt-in.** `qe_axes()` / `.axes()` now draws the axis lines
  only; `x = TRUE` / `y = TRUE` label an axis with its dimension name and a string
  sets custom text.
- **`qe_extract()` keeps the set's dimension names** (e.g. `SVD1` / `SVD2`) instead
  of renaming them to `x` / `y`, so dimension-name axis labels read `SVD1` rather
  than `x`. `x_col` / `y_col` are set accordingly, and `group_summary()` now names
  its columns after the dimensions (`SVD1`, `SVD1.low`, `SVD1.high`, ...).

### Added
- **`<qe-edges magnify>`** multiplies a plot's edge widths and node sizes (not
  colour), like webENA's "Scale edge weights" for its comparison plot — e.g. to
  read a faint subtraction. Whenever the attribute is present, including `"1"`,
  the plot is labelled "(scaled N.Nx)" (included in SVG / PNG exports), so a set
  of exported plots states which were magnified; webENA labels its side plots
  "(scaled 1.0x)" for the same reason.
- Wrapper arguments for the above: `qe_edges(color_scale =, edge_width =,
  magnify =)` (R), `.edges(color_scale=, edge_width=, magnify=)` (Python),
  `qe_edges(p; color_scale=, edge_width=, magnify=)` (Julia).
- `qe_nodes(show =, unconnected =)` (R, Julia) and `.nodes()` (Python) to force
  code nodes on or off and to hide unconnected nodes.
- `tools/rena-compare/`: accuracy harness comparing qeviz with rENA (`run.R`) and
  ona (`run_ona.R`) on one shared model, and an edge-width / colour / magnify
  demo page (`edge_width.R`).

### Fixed
- **Directed edges stay legible when long and thin.** Tapered edges get a hairline
  outline (constant on-screen width, same colour as the fill), as ona and webENA
  draw, so a narrow triangle no longer fades out along its length.
- **Direction chevrons keep their shape and read darker.** Their length now
  follows the triangle's local width instead of a fixed share of the edge length
  (long edges stretched them into slivers), the geometry no longer uses
  slope-intercept intersections that broke on near-vertical edges, and they are
  filled with the edge's colour flattened onto white and darkened, with a white
  halo — previously the plain base colour made them *lighter* than strong edges.
- **Group mean markers no longer hide small confidence intervals.** The marker's
  half-side is capped at half the CI box's shorter half-side
  (`MEAN_MAX_FRACTION_OF_INTERVAL`); markers keep their normal size when the CI is
  large, and when the interval is degenerate.
- **`qe_group(intervals = FALSE)` now hides CI boxes** when the model carries a
  groups frame (always the case with `qe_extract()`); previously the boxes were
  drawn regardless.

## [0.3.0] - 2026-09-23 (never released)

> Never tagged or published (only the `0.3.0-dev.9000` prerelease reached npm).
> These changes first ship in **0.4.0**.

Interaction and read surface for embedding qeviz as the interactive network
renderer in the **web ENA** tool (and rENA). All new interaction is exposed as
framework-agnostic DOM `CustomEvent`s and imperative methods on the public
`<qe-graph>` — no framework coupling.

### Added
- **Interaction events** dispatched on `<qe-graph>` (`bubbles`, `composed`):
  `qe-node-click` / `qe-node-hover` / `qe-node-unhover` (nodes, group means, and
  unit points, unified with a `kind` field), `qe-edge-click` / `qe-edge-hover` /
  `qe-edge-unhover` (including self-connection glyphs), and `qe-label-move` when a
  label is dragged. Each `detail` carries resolved identity, coordinates/weights,
  and the `originalEvent`.
- **Instance registry + read APIs**: `getGraph(idOrPlotGroup)` / `getGraphs()`, and
  per-graph `getNodes()` / `getEdges()` / `getPoints()` / `pointsInRect()` for
  host-side hit-testing, drag-select, and export.
- **Selection / highlight API**: `setHighlight({ nodes, edges })` / `clearHighlight()`
  drives selection styling via an overlay that survives model updates.
- **Draggable, pinnable labels** — drag to reposition (the label pins open);
  `qe-label-move` fires on drop so the host can persist or mirror the position.
- **Transitions & export**: the `animate` attribute tweens marks between
  `setModelData` updates (marks, undirected edges, and now directed / self-edge
  triangle paths); `toSVG()` and `toPNG(scale)` snapshot the current plot.
- **Fixed-on-screen marker sizing**: `fixed-size` on `<qe-points>` / `<qe-means>`
  (and `fixed_size=` on `qe_points` / `qe_group` in R, `.points()` / `.group()` in
  Python, `qe_points` / `qe_group` in Julia) keeps those markers a constant pixel
  size regardless of data extent, container size, or zoom. Default is unchanged
  (markers scale with the coordinate space).
- **Opt-in built-in tooltip**: `<qe-graph tooltip>` shows `source – target (weight)`
  over edges and the mark name over nodes. Hosts can still build their own from the
  hover events.

### Changed
- Point clicks no longer stop propagation, so they reach the `<qe-graph>`
  delegation and surface as `qe-node-click`.

### Fixed
- Corrected the `ModelData` docs: the edges frame only supports the **wide
  adjacency matrix** (columns `"{source}.{target}"`, one row per unit); the
  previously documented long/edge-list auto-detection never existed. Removed the
  unused `weight_col` field.

## [0.2.0] - 2026-09-21

### Added
- **Axes layer** — a `<qe-axes>` web-component element and matching chain
  functions `qe_axes()` (R), `.axes()` (Python), `qe_axes()` (Julia). Each axis
  label is independent: `x` / `y` default to the dimension name, take a string
  for custom text, or are omitted with `FALSE`. `show = FALSE` hides the axes.
- **White halo on unit points** so overlapping dots stay distinct in dense
  clusters; scales with the dot radius.

### Changed
- **BREAKING: axes are now opt-in.** A plot draws the x/y axis cross only when
  `qe_axes()` / `<qe-axes>` is present. Previously the cross always rendered, so
  existing plots (including adapter output) now show no axes until `qe_axes()`
  is added to the chain.
- The graph now fills its container and centers the square ENA drawing, instead
  of collapsing to a left-pinned fixed box (`<qe-visual>` was `inline-block`).
- Tighter default plot margins: removed the integer ceiling on the coordinate
  extent and reduced the padding multiplier (1.5 → 1.3), so the network fills
  the canvas while leaving room for peripheral node labels.
- Larger default unit-point size (1 → 2.5), still below the mean markers.

## [0.1.0]

### Added
- Initial release: framework-agnostic TypeScript web components
  (`<qe-visual>` / `<qe-graph>` and child layer elements) for ENA and ONA
  (directed / ordered) network visualizations, with R, Python, and Julia
  adapters over a shared `ModelData` format.
- Chain API across all three languages (`qe_group`, `qe_edges`, `qe_points`,
  `qe_labels`, introspection, HTML export).
- Trajectory rendering (`qe_trajectories()`), including `loocv_2d` polynomial
  degree selection and near-origin filtering ported from
  `ena.plot.trajectory()`.
