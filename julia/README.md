# QEViz.jl

Julia adapter for the [qeviz](https://gitlab.com/epistemic-analytics/qe-packages/qeviz) visualization library. Converts DataFrames to the qeviz ModelData format and provides a chainable plot API for Jupyter / Pluto inline display and standalone HTML export.

## Installation

```julia
] add QEViz
```

Or from a local development checkout:

```julia
] dev /path/to/qeviz/julia
```

## Quick start

```julia
using QEViz

# ── From a fitted model (DataFrames) ───────────────────────────────────────
m = model_data(nodes_df, edges_df, points_df; group_col = "Condition")
p = qe_plot(m; title = "My ENA")

# Auto-displays in Jupyter / Pluto when returned from a cell:
p

# ── Introspect the model ────────────────────────────────────────────────────
qe_groups(p)   # => ["FirstGame", "SecondGame"]
qe_units(p)    # => ["FirstGame::alice", "FirstGame::bob", ...]

# ── Chain API ───────────────────────────────────────────────────────────────
# Show one group's mean network
qe_edges(p; group = "FirstGame")

# Show both group means, one group's network
p2 = qe_group(p, "FirstGame", "SecondGame")
p2 = qe_edges(p2; group = "FirstGame")

# Individual unit network
qe_edges(p; unit = "FirstGame::alice")

# Subtraction plot
qe_edges(p; group = "FirstGame", compare = "SecondGame")

# Show unit scatter dots
qe_points(p)

# Combine steps
p |> (x -> qe_group(x)) |> (x -> qe_edges(x; group = "FirstGame")) |> (x -> qe_points(x))

# ── Export ──────────────────────────────────────────────────────────────────
qe_export_html(p, "output.html")
```

## Chain API

All chain functions accept a `QEPlot` as their first argument, copy it internally, and return the copy — the original is never mutated.  Multiple views can branch from a common base.

| Function | Description |
|---|---|
| `qe_group(p, names...; intervals=true)` | Which group means (and CI boxes) to display. Omit `names` to show all groups. |
| `qe_edges(p; group, unit, compare, also, show)` | Which edge network to draw. `group` and `unit` are mutually exclusive. `show=false` suppresses all edges. |
| `qe_points(p; show=true)` | Show or hide individual unit scatter dots. |
| `qe_labels(p; nodes, means, points)` | Label visibility — `"on"`, `"off"`, `"click"`, or `"auto"`. |

## Introspection

```julia
qe_groups(p)   # Vector{String} — group names from the model's groups frame
qe_units(p)    # Vector{String} — unit IDs from the model's points frame
```

## Output

```julia
qe_export_html(p, "output.html")  # self-contained HTML file (returns abs path)
qe_html(p)                         # complete HTML document as a String
qe_fragment(p)                     # embeddable fragment (no <html> wrapper)
```

## Building a model from DataFrames

```julia
using DataFrames, QEViz

nodes_df  = DataFrame(
    code = ["A", "B", "C"],
    SVD1 = [0.5, -0.4, 0.1],
    SVD2 = [0.3,  0.6, -0.5],
)
edges_df  = DataFrame(
    QEUNIT    = ["FG::alice", "FG::bob", "SG::alice", "SG::bob"],
    Condition = ["FG", "FG", "SG", "SG"],
    AB        = [0.2, 0.3, 0.1, 0.5],
    AC        = [0.1, 0.2, 0.4, 0.1],
    BC        = [0.4, 0.1, 0.2, 0.3],
)
points_df = DataFrame(
    QEUNIT    = ["FG::alice", "FG::bob", "SG::alice", "SG::bob"],
    Condition = ["FG", "FG", "SG", "SG"],
    SVD1      = [ 0.2,  0.4, -0.3, -0.1],
    SVD2      = [ 0.1, -0.1,  0.2, -0.2],
)

m = model_data(nodes_df, edges_df, points_df;
               group_col = "Condition",
               id_col    = "QEUNIT",
               x_col     = "SVD1",
               y_col     = "SVD2")

p = qe_plot(m; title = "ENA Example", width = 800, height = 600)
qe_export_html(p, "example.html")
```

`model_data` keyword arguments:

| Argument | Default | Description |
|---|---|---|
| `id_col` | `"QEUNIT"` | Unit-identifier column in `edges` / `points` |
| `node_id_col` | `"code"` | Node-identifier column in `nodes` |
| `x_col` | `"SVD1"` | X-position column |
| `y_col` | `"SVD2"` | Y-position column |
| `group_col` | `nothing` | Grouping column; enables group means and CI boxes |
| `directed` | `false` | `true` for ONA / directed networks |
| `conf_level` | `0.95` | Confidence level for CI rectangles |

## Jupyter / Pluto display

`QEViz` implements `Base.show(io, MIME"text/html", p)`, so returning a `QEPlot` from a cell automatically renders the interactive visualization.  No explicit `show()` call is needed.

## Running tests

```julia
] test QEViz
```

## Development

After editing `src/QEViz.jl`, rebuild the TypeScript bundle from the repo root to refresh `assets/qeviz.umd.js`:

```sh
npm run build   # copies dist/qeviz.umd.js → julia/assets/qeviz.umd.js
```
