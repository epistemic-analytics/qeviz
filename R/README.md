# qeviz

Interactive [Epistemic Network Analysis](https://www.epistemicnetwork.org/) (ENA) and Ordered Network Analysis (ONA) visualizations for R, built on the qeviz web component library.

## Installation

```r
install.packages("qeviz", repos = c("https://cran.qe-libs.org", "https://cloud.r-project.org"))
```

## Quick start

```r
library(qeviz)
library(tma)
library(rENA)

# Fit a model
ena_set <- rENA::model(result_ena)

# Create a plot object and chain options
p <- qe_plot(ena_set) |>
  qe_group() |>
  qe_edges("FirstGame", also = "SecondGame")

# Prints to viewer / browser
p

# Export a self-contained HTML file
qe_export_html(p, "output.html")
```

## Chain API

All chain functions return the modified `qe_plot` — the original is unchanged, so multiple views can branch from a common base.

| Function | Description |
|---|---|
| `qe_plot(set)` | Create a plot object from a set or ModelData list |
| `qe_group(p, ...)` | Which group means (and CI boxes) to display |
| `qe_edges(p, group, ...)` | Which edge network to draw |
| `qe_points(p)` | Show individual unit scatter dots |
| `qe_nodes(p, show)` | Code nodes: `"auto"` (default) draws them only with an edge network; `"always"` / `"never"` |
| `qe_axes(p, x, y)` | Draw the axes (opt-in); `x`/`y` add per-axis labels (off by default; `TRUE` = dimension name) |
| `qe_labels(p, nodes, means, points)` | Label visibility: `"on"`, `"off"`, `"click"`, `"auto"` |
| `qe_export_html(p, path)` | Write a self-contained HTML file |
| `qe_fragment(p)` | Return an embeddable HTML fragment |

### `qe_edges()` parameters

| Parameter | Description |
|---|---|
| `group` | Group name whose **mean** edge network to draw |
| `unit` | Unit ID for an **individual** network (e.g. `"FirstGame::alice"`). Mutually exclusive with `group`. |
| `compare` | Second group to subtract (`group − compare`) |
| `also` | Second group to overlay alongside `group` |
| `show = FALSE` | Suppress all edges |

## Introspection

```r
qe_groups(p)   #> [1] "FirstGame"  "SecondGame"
qe_units(p)    #> [1] "FirstGame::steven z"  "FirstGame::akash v"  ...
```

## Individual unit networks

```r
unit_id <- qe_units(p)[1]

qe_plot(ena_set) |>
  qe_group() |>                       # show all group means for context
  qe_edges(unit = unit_id)            # individual edge network
```

## Branching from a common base

```r
base <- qe_plot(ena_set) |> qe_group()

qe_export_html(qe_edges(base, "FirstGame"),  "fg.html")
qe_export_html(qe_edges(base, "SecondGame"), "sg.html")
qe_export_html(qe_edges(base, compare = "SecondGame", "sub.html"))
```

## R Markdown / Quarto

Use `qe_fragment()` with `htmltools::HTML()` for inline display:

```r
htmltools::HTML(qe_fragment(
  qe_plot(ena_set) |> qe_group() |> qe_edges("FirstGame")
))
```

## See also

- [Full documentation](https://qe-libs.org/qeviz/) — reference, vignettes
- [Python binding](https://py.qe-libs.org/simple/qeviz/) — `pip install qeviz`
- [Source repository](https://gitlab.com/epistemic-analytics/qe-packages/qeviz)
