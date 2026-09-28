# Changelog

All notable changes to qeviz are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/) (in 0.x, breaking changes bump
the minor version). The TypeScript core and the R / Python / Julia adapters are
versioned together.

## [0.4.0] - 2026-09-28

Rendering fixes found by side-by-side accuracy testing against rENA's plotly
plots (`tools/rena-compare/`), aligning qeviz defaults with rENA.

### Changed (breaking)
- **Code nodes draw only when `<qe-nodes>` is present**, like every other layer
  element. Node positions still come from the model and anchor the plot extent,
  so the scale does not change when nodes are hidden. The R / Python / Julia
  wrappers emit `<qe-nodes>` only alongside an edge network (rENA draws nodes as
  part of `ena.plot.network()`); override with `qe_nodes(p, "always" | "never")`
  (R), `.nodes()` (Python), or `qe_nodes(p; show=...)` (Julia).
- **Axis labels are opt-in.** `qe_axes()` / `.axes()` now draws the axis lines
  only; `x = TRUE` / `y = TRUE` label an axis with its dimension name and a string
  sets custom text.
- **`qe_extract()` keeps the set's dimension names** (e.g. `SVD1` / `SVD2`) instead
  of renaming them to `x` / `y`, so dimension-name axis labels read `SVD1` rather
  than `x`. `x_col` / `y_col` are set accordingly, and `group_summary()` now names
  its columns after the dimensions (`SVD1`, `SVD1.low`, `SVD1.high`, ...).

### Added
- `qe_nodes()` (R, Julia) and `.nodes()` (Python) to force code nodes on or off.

### Fixed
- **Group mean markers no longer hide small confidence intervals.** The marker's
  half-side is capped at half the CI box's shorter half-side
  (`MEAN_MAX_FRACTION_OF_INTERVAL`); markers keep their normal size when the CI is
  large, and when the interval is degenerate.
- **`qe_group(intervals = FALSE)` now hides CI boxes** when the model carries a
  groups frame (always the case with `qe_extract()`); previously the boxes were
  drawn regardless.

## [0.3.0] - 2026-09-23

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
