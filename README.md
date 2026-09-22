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

All three languages share the same chain operations:

| Operation | R | Python | Julia |
|---|---|---|---|
| Create | `qe_plot(set)` | `qeviz.plot(model)` | `qe_plot(model)` |
| Group means | `qe_group(p, ...)` | `p.group(...)` | `qe_group(p, ...)` |
| Edge network | `qe_edges(p, group=, unit=, compare=, also=)` | `p.edges(group=, unit=, ...)` | `qe_edges(p; group=, unit=, ...)` |
| Unit points | `qe_points(p)` | `p.points()` | `qe_points(p)` |
| Axes | `qe_axes(p, x=, y=)` | `p.axes(x=, y=)` | `qe_axes(p; x=, y=)` |
| Labels | `qe_labels(p, nodes=, means=, points=)` | `p.labels(...)` | `qe_labels(p; ...)` |
| Export | `qe_export_html(p, path)` | `p.export_html(path)` | `qe_export_html(p, path)` |
| Introspect | `qe_groups(p)` / `qe_units(p)` | `p.groups()` / `p.units()` | `qe_groups(p)` / `qe_units(p)` |

### `qe_edges` / `.edges()` parameters

| Parameter | Description |
|---|---|
| `group` | Group name whose **mean** edge network to draw |
| `unit` | Unit ID for an **individual** network (e.g. `"FirstGame::alice"`). Mutually exclusive with `group`. |
| `compare` | Second group to subtract (`group − compare`). Positive differences use the primary colour. |
| `also` | Second group to overlay alongside `group`. |
| `show` / `show=false` | Suppress all edges. |

Label modes: `"on"`, `"off"`, `"click"`, `"auto"`.

### `qe_axes` / `.axes()` parameters

Axes are **opt-in**: a plot draws the x/y axis cross only when `qe_axes()` is in the
chain (or a `<qe-axes>` element is present). Each axis label is controlled independently:

| Parameter | Description |
|---|---|
| `x` | `TRUE` labels the x-axis with its dimension name, a string sets custom text, `FALSE` omits the x-axis label. |
| `y` | Same as `x`, for the y-axis. |
| `show` / `show=false` | Suppress the axes entirely. |

```r
qe_plot(set) |> qe_edges("FirstGame") |> qe_axes(x = "Task focus", y = TRUE)
```

## TypeScript / web component

The `<qe-visual>` and `<qe-graph>` elements can be used directly in any HTML page.  Layer configuration uses declarative child elements:

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
