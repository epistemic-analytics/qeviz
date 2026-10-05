# qeviz

Interactive [Epistemic Network Analysis](https://www.epistemicnetwork.org/) (ENA) and Ordered Network Analysis (ONA) visualizations, implemented as framework-agnostic web components and wrapped for R, Python, and Julia.

## Architecture

qeviz is a language-agnostic TypeScript web component library with thin adapter packages for each language:

```
┌─────────────────────────────────────────────┐
│  <qe-visual> / <qe-graph>                   │  TypeScript / browser
│  SVG rendering, edge networks, means, CI     │  src/
└────────────────────┬────────────────────────┘
                     │  ModelData JSON
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
  R adapter      Python adapter  Julia adapter
  R/             py/             julia/
```

Each adapter serialises model data to the qeviz `ModelData` format and produces self-contained HTML.  The TypeScript layer has no knowledge of R, Python, or Julia.

## Language bindings

### R

```r
library(qeviz)

# From a fitted rENA / tma set
qe_plot(set) |>
  qe_group() |>
  qe_edges("FirstGame", also = "SecondGame")

# Introspect
qe_groups(p)   #> ["FirstGame", "SecondGame"]
qe_units(p)    #> ["FirstGame::alice", ...]

# Individual unit network
qe_plot(set) |> qe_group() |> qe_edges(unit = "FirstGame::alice")

# Export
qe_export_html(p, "output.html")
```

Install from [cran.qe-libs.org](https://cran.qe-libs.org):

```r
install.packages("qeviz", repos = c("https://cran.qe-libs.org", "https://cloud.r-project.org"))
```

### Python

```python
import qeviz

# From a fitted pyENA model
p = qeviz.from_pyena(model, group_col="Condition")

# Chain API
p.group("FirstGame").edges("FirstGame", also="SecondGame").points()

# Individual unit network
p.group().edges(unit="FirstGame::alice")

# Introspect
p.groups()   # ["FirstGame", "SecondGame"]
p.units()    # ["FirstGame::alice", ...]

# Jupyter inline display — just return p from a cell
p

# Export
p.export_html("output.html")
```

Install from [py.qe-libs.org](https://py.qe-libs.org):

```sh
pip install qeviz --extra-index-url https://py.qe-libs.org/simple
```

### Julia

```julia
using QEViz

m = model_data(nodes_df, edges_df, points_df; group_col = "Condition")
p = qe_plot(m)

# Chain API
qe_group(p, "FirstGame") |> (x -> qe_edges(x; group = "FirstGame", also = "SecondGame"))

# Individual unit network
qe_edges(qe_group(p); unit = "FirstGame::alice")

# Introspect
qe_groups(p)   # ["FirstGame", "SecondGame"]
qe_units(p)    # ["FirstGame::alice", ...]

# Jupyter / Pluto — return p from a cell
p

# Export
qe_export_html(p, "output.html")
```

## Chain API

All three languages share the same chain operations, with the same argument
names; a plot built in any of them produces the same `<qe-graph>` markup and
model data (checked by the shared fixtures in `tests/golden/`):

| Operation | R | Python | Julia |
|---|---|---|---|
| Create | `qe_plot(set, title=, range=, scale_points=, point_scale=, center=, palette=)` | `qeviz.plot(model, title=, range=, ...)` | `qe_plot(model; title=, range=, ...)` |
| Group means | `qe_group(p, ...)` | `p.group(...)` | `qe_group(p, ...)` |
| Mean of a subset | `qe_group(p, points=, label=, color=, shape=, intervals=, outlier=)` | `p.group(points=, ...)` | `qe_group(p; points=, ...)` |
| Edge network | `qe_edges(p, group=, unit=, compare=, also=)` | `p.edges(group=, unit=, ...)` | `qe_edges(p; group=, unit=, ...)` |
| Network from data | `qe_edges(p, weights=, compare=, colors=, threshold=, name=)` | `p.edges(weights=, ...)` | `qe_edges(p; weights=, ...)` |
| Unit points | `qe_points(p)` | `p.points()` | `qe_points(p)` |
| Point set | `qe_points(p, units=/points=, color=, shape=, labels=, name=)` | `p.points(units=/points=, ...)` | `qe_points(p; units=/points=, ...)` |
| Nodes | `qe_nodes(p, show, unconnected=, positions=, labels=)` | `p.nodes(show, positions=, labels=)` | `qe_nodes(p; show=, positions=, labels=)` |
| Axes | `qe_axes(p, x=, y=)` | `p.axes(x=, y=)` | `qe_axes(p; x=, y=)` |
| Labels | `qe_labels(p, nodes=, means=, points=, font_size=, font_family=, font_color=)` | `p.labels(...)` | `qe_labels(p; ...)` |
| Group colours | `qe_colors(p, A = "#hex")` | `p.colors(A="#hex")` | `qe_colors(p, "A" => "#hex")` |
| Axis range | `qe_range(p, range)` | `p.range(range)` | `qe_range(p, range)` |
| Default palette | `qe_palette()` | `qeviz.palette()` | `qe_palette()` |
| Export | `qe_export_html(p, path)` | `p.export_html(path)` | `qe_export_html(p, path)` |
| Introspect | `qe_groups(p)` / `qe_units(p)` | `p.groups()` / `p.units()` | `qe_groups(p)` / `qe_units(p)` |

### `qe_edges` / `.edges()` parameters

| Parameter | Description |
|---|---|
| `group` | Group name whose **mean** edge network to draw |
| `unit` | Unit ID for an **individual** network (e.g. `"FirstGame::alice"`). Mutually exclusive with `group`. |
| `compare` | Second group to subtract (`group − compare`). Positive differences use the primary colour. |
| `also` | Second group to overlay alongside `group`. |
| `weights` | A network from data instead of a name: a named vector / Series / Dict of edge weights, an unnamed vector in the model's edge-column order, or a matrix / data frame (averaged over rows). Each call adds a layer. |
| `colors` | One or two colours (positive, negative); with one, negative weights use its complement. |
| `threshold` | `min` or `c(min, max)`: \|weight\| < min is not drawn, \|weight\| > max is drawn at max (sign kept). |
| `name` | Name of the network (reported in edge events); a later call with the same name replaces it. |
| `show` / `show=false` | Suppress all edges. |
| `color_scale` | Colour mapping (webENA ramps: saturation 0.25–1, opacity 0.3–1). `"model"` (default) rescales across the whole model, so plots of one model share a colour scale; `"plot"` rescales within the plot (webENA); `"absolute"` uses saturation = opacity = weight. |
| `edge_width` | Width of a weight-1 edge as a fraction of the plot width (default 0.04). Width is absolute — equal weights draw equally wide — and each node's diameter is the sum of its edges' widths. |
| `magnify` | Multiply this plot's widths and node sizes (not colour), e.g. for a faint subtraction. When set (even `1`), the plot is labelled "(scaled N.Nx)". |

Label modes: `"on"`, `"off"`, `"click"`, `"auto"`.

### `qe_axes` / `.axes()` parameters

Axes are **opt-in**: a plot draws the x/y axis cross only when `qe_axes()` is in the
chain (or a `<qe-axes>` element is present). Axis labels are opt-in too: `qe_axes()` alone
draws the lines with no labels. Each label is controlled independently:

| Parameter | Description |
|---|---|
| `x` | `FALSE` (default) omits the x-axis label, `TRUE` labels it with its dimension name (e.g. `SVD1`), a string sets custom text. |
| `y` | Same as `x`, for the y-axis. |
| `show` / `show=false` | Suppress the axes entirely. |

```r
qe_plot(set) |> qe_edges("FirstGame") |> qe_axes(x = "Task focus", y = TRUE)
```

## TypeScript / web component

The `<qe-visual>` and `<qe-graph>` elements can be used directly in any HTML page. Mark sizes and colour follow webENA: `<qe-graph edge-width>` sets the width of a weight-1 edge (absolute, as a fraction of the plot width), `<qe-edges color-scale>` picks the colour rescaling (`model` / `plot` / `absolute`), and `<qe-edges magnify>` scales one plot and labels it.  Layer configuration uses declarative child elements; each layer draws only when its element is present. Code-node positions always come from the model and set the plot extent, but the nodes are drawn only when `<qe-nodes>` is present. The R / Python / Julia wrappers emit `<qe-nodes>` alongside an edge network by default (`qe_nodes()` / `.nodes()` override that).

```html
<script src="qeviz.umd.js"></script>

<qe-visual id="vis">
  <qe-graph width="100%" height="440">
    <qe-nodes label="on"></qe-nodes>
    <qe-means confidence label="on"></qe-means>
    <qe-points label="auto"></qe-points>
    <qe-edges group="FirstGame" also="SecondGame"></qe-edges>
    <qe-axes x y></qe-axes>
  </qe-graph>
</qe-visual>

<script>
  document.getElementById("vis").setModelData(modelJSON);
</script>
```

By default, all marks (nodes, mean markers, unit dots) size in graph-coordinate
units and scale with the data extent and wheel-zoom. Add `fixed-size` to
`<qe-points>` or `<qe-means>` to keep those markers a constant on-screen pixel
size instead — useful when embedding coordinated plots at different scales (the
webENA use case):

```html
<qe-points fixed-size></qe-points>
<qe-means fixed-size></qe-means>
```

In the language adapters this is `fixed_size = TRUE` on `qe_points()` / `qe_group()`
(R), `fixed_size=True` on `.points()` / `.group()` (Python), and
`fixed_size=true` on `qe_points` / `qe_group` (Julia).

#### Point scaling and centring

Unit points and means sit much closer to the origin than the code nodes, so
by default qeviz rescales them to fill the plot. Two `<qe-graph>` attributes
change how points are scaled and where the view is centred; both are optional
and unset by default:

| `<qe-graph>` attributes | Points are multiplied by |
|---|---|
| neither (default) | qeviz's fit: farthest node ÷ farthest point, so the outermost point meets the outermost node (the ENA Web Tool's default) |
| `scale-points="false"` | 1: raw coordinates, where each point sits at its network's centroid |
| `point-scale="N"` | N, overriding both, e.g. to match another tool's scaling |

`center="content"` centres the view on the middle of the nodes' and points'
bounding box instead of the origin (0, 0), so a network that sits off to one
side of the origin fills the plot; `range="network"` is then measured from that
centre. The default is the origin, the ENA convention.

```html
<qe-graph scale-points="false" center="content"></qe-graph>
```

In R these are `qe_plot(scale_points =, point_scale =, center =)`; in Python
`qeviz.plot(..., scale_points=, point_scale=, center=)` and in Julia
`qe_plot(model; scale_points=, point_scale=, center=)`.

Child element presence controls layer visibility — add `<qe-points>` to show unit dots, omit it to hide them.  A `MutationObserver` watches for child additions, removals, and attribute changes, so interactive controls can manipulate the DOM directly:

```js
// Switch to a subtraction plot
const edges = graph.querySelector("qe-edges");
edges.setAttribute("compare", "SecondGame");
edges.removeAttribute("also");
```

### Events

`<qe-graph>` dispatches interaction events on the public element with
`bubbles: true, composed: true`, so a host app can subscribe regardless of shadow
DOM. Each event's `detail` also carries the `originalEvent`.

| Event | `detail` |
|---|---|
| `qe-edge-click` / `qe-edge-hover` / `qe-edge-unhover` | `{ source, target, weight, directed, self, group?, unit? }` |
| `qe-node-click` / `qe-node-hover` / `qe-node-unhover` | `{ id, kind: "node" \| "mean" \| "point", name, x, y, group?, unit? }` |
| `qe-label-move` | `{ id, transform: { x, y } }` — a label was dragged (offset in graph-space units) |

Labels are **draggable** (drag to reposition; the label pins open and stays
visible), emitting `qe-label-move` on drop so the host can persist the position
or mirror it across coordinated plots.

For a quick built-in tooltip on hover — `source – target (weight)` over edges,
the mark name over nodes — add the `tooltip` attribute to `<qe-graph>`. It is
opt-in; most hosts render their own from the hover events instead.

```html
<qe-graph tooltip>…</qe-graph>
```

`source`/`target` are code-node names; `x`/`y` are graph-space coordinates. Unhover
events carry `{ key }` identifying the mark/edge that was left. The host reacts and
pushes state back declaratively (ModelData + layer attributes) — qeviz adds no
framework coupling.

```js
graph.addEventListener("qe-edge-click", (e) => {
  const { source, target, weight } = e.detail;   // e.g. open a conversation view
});
graph.addEventListener("qe-node-click", (e) => {
  if (e.detail.kind === "point") plotUnit(e.detail.id);
});
```

### Instance access & read APIs

Give coordinated plots an identity and look them up, and read the resolved model
for host-side hit-testing or export:

```js
import { getGraph, getGraphs } from "@qe-libs/qeviz";

getGraph("comparison");            // by id or plot-group attribute
getGraphs();                       // all connected <qe-graph> instances

const graph = getGraph("comparison");
graph.getNodes();                  // [{ id, name, x, y }, …]
graph.getEdges();                  // [{ source, target, weight, directed, self }, …]
graph.getPoints();                 // [{ id, group, x, y }, …] (unit points)
graph.pointsInRect({ x, y, w, h }); // ids of unit points in a graph-space rect
```

### Transitions & export

Opt into animated transitions with the `animate` attribute — on the next
`setModelData`, marks glide from their old positions to the new ones instead of
snapping (default 300 ms; `animate="500"` sets the duration):

```html
<qe-graph animate>…</qe-graph>
```

Snapshot the current plot for download or embedding:

```js
graph.toSVG();          // standalone SVG string
await graph.toPNG(2);   // PNG data URL (2× resolution)
```

### Selection / highlight

Drive selection styling from the host without touching qeviz's internal DOM. The
highlight is an overlay that survives model updates:

```js
graph.setHighlight({ edges: [{ source: "Data", target: "Design" }], nodes: ["Data"] });
graph.clearHighlight();
```

```html
<qe-graph id="primary" plot-group="comparison" …></qe-graph>
```

### Build

```sh
npm install
npm run build       # outputs dist/qeviz.umd.js and dist/qeviz.es.js
                    # postbuild copies the UMD bundle to R/inst/, py/qeviz/, julia/assets/
```

## Development

```sh
# TypeScript
npm run dev         # watch mode

# R (from project root)
pkgload::load_all("R")
testthat::test_local("R")

# Python
cd py && pip install -e ".[dev]" && pytest

# Julia
cd julia && julia --project=. -e 'using Pkg; Pkg.test()'
```
