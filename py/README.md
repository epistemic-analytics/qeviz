# qeviz (Python)

Interactive Epistemic Network Analysis (ENA) and Ordered Network Analysis (ONA)
plots for Python: code networks, group means with confidence intervals, unit
points and subtractions, displayed inline in Jupyter or exported as
self-contained HTML. The same library powers the R package and rENA's plots,
and a plot built here produces the same picture as one built in R.

## Install

Install `qe-viz`, import `qeviz`:

```bash
uv add qe-viz --index qe-libs=https://qe-libs.org/py/simple/
# or
pip install qe-viz --extra-index-url https://qe-libs.org/py/simple/
```

Previously published as `qeviz`; existing installs keep working.

## Quick start

From a fitted [qe-ena](https://qe-libs.org/py/project/qe-ena/) model (`import ena`) of rENA's
RS.data:

```python
import pandas as pd
from ena import ENA
import qeviz

rs = pd.read_csv("rs.data.csv")   # rENA's inst/extdata/rs.data.csv
codes = ["Data", "Technical Constraints", "Performance Parameters",
         "Client and Consultant Requests", "Design Reasoning", "Collaboration"]
rs["unit"]  = rs["Condition"] + "::" + rs["UserName"]
rs["convo"] = rs["Condition"] + "::" + rs["GroupName"]
model = ENA().fit(rs, "unit", "convo", codes, window_size=4)

p = (qeviz.from_ena(model, group_col="Condition", title="FirstGame")
       .edges("FirstGame")      # the group's mean network
       .points()                # every unit, coloured by group
       .group("FirstGame"))     # the group mean and its 95% CI
p                               # displays inline in Jupyter
p.export_html("firstgame.html") # or a self-contained HTML file
```

![FirstGame mean network of RS.data with unit points and the group mean](https://gitlab.com/epistemic-analytics/qe-packages/qeviz/-/raw/main/py/docs/qeviz-rs-network.png)

Edge width is proportional to the connection weight, node size to the node's
summed edge widths, and colour intensity is scaled across the whole model, so
separate plots of one model are comparable.

### From DataFrames

Any ENA output works: one row per code node, one row of edge weights per unit
(columns named `"A.B"`), and one row of positions per unit.

```python
p = qeviz.plot(nodes_df, edges_df, points_df, group_col="Condition",
               id_col="ENA_UNIT", x_col="SVD1", y_col="SVD2")
```

## Chain API

Every method returns a new plot, so several views can branch from one base.

| Method | Draws |
|---|---|
| `.edges("A")`, `.edges("A", compare="B")`, `.edges("A", also="B")`, `.edges(unit="...")` | a group's or unit's network; a subtraction; an overlay |
| `.edges(weights=..., compare=..., colors=..., threshold=(min, max), name=...)` | a network from your own weights (Series, dict, or rows to average) |
| `.points()`, `.points(units=[...])`, `.points(points=df, color=, shape=, labels=)` | all unit points, or a chosen set |
| `.group()`, `.group("A", intervals="crosshairs", outlier=True)` | group means with confidence (and outlier) intervals |
| `.group(points=df, label="subset")` | the mean of any subset of points |
| `.nodes("always", positions=df, labels={...})` | when to draw code nodes; move or relabel them |
| `.axes(x=True, y=True)`, `.labels(...)`, `.colors(A="#hex")`, `.range(...)` | axes, labels and fonts, group colours, axis range |

`qeviz.plot(..., title=, range=, scale_points=, center=, palette=)` sets the
plot-wide options. Arguments mirror the R package's `qe_*()` functions; see the
[qeviz repository](https://gitlab.com/epistemic-analytics/qe-packages/qeviz)
for the full reference.

## Display and export

- In Jupyter, VS Code notebooks or Quarto, a plot returned from a cell renders
  inline; `p.show()` displays it explicitly.
- `p.export_html(path)` writes a single self-contained HTML file.
