# Changelog

All notable changes to qeviz are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/) (in 0.x, breaking changes bump
the minor version). The TypeScript core and the R / Python / Julia adapters are
versioned together.

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
