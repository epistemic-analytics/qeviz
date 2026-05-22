"""
qeviz — Python adapter for the qeviz visualization library.

Converts pandas DataFrames to the qeviz ModelData format and provides
utilities for rendering in Jupyter and exporting standalone HTML.

Quick start
-----------
    import pandas as pd
    import qeviz

    # Minimal example — nodes + edges only (no unit points)
    model = qeviz.model_data(
        nodes = nodes_df,       # columns: code, SVD1, SVD2
        edges = edges_df,       # columns: QEUNIT, A.B, A.C, ...
    )
    qeviz.plot(model)           # display in Jupyter
    qeviz.export_html(model, "output.html")   # write standalone HTML

ENA workflow
------------
    # After running your Python ENA accumulation / rotation step you'll have:
    #   nodes_df  — one row per code, columns: code, SVD1, SVD2
    #   edges_df  — one row per unit, columns: QEUNIT, group, <code.code pairs>
    #   points_df — one row per unit, columns: QEUNIT, group, SVD1, SVD2

    model = qeviz.model_data(
        nodes     = nodes_df,
        edges     = edges_df,
        points    = points_df,
        group_col = "group",
    )
    qeviz.plot(model, options={"group": "Treatment"})

Dependencies
------------
    Required : pandas
    Optional : scipy  (for exact t-distribution CI; falls back to z=1.96 otherwise)
               IPython (for inline Jupyter display)
"""

import json
import math
import os
import time
from typing import Optional

import pandas as pd


# ── Internal helpers ──────────────────────────────────────────────────────────

def _qe_frame(df: pd.DataFrame) -> dict:
    """Convert a pandas DataFrame to a QEFrame dict ``{data: [...], types: {...}}``."""
    _type_map = {
        "object":   "character",
        "string":   "character",
        "int64":    "integer",
        "int32":    "integer",
        "int16":    "integer",
        "int8":     "integer",
        "float64":  "numeric",
        "float32":  "numeric",
        "bool":     "logical",
    }
    types = {
        col: _type_map.get(str(df[col].dtype), "character")
        for col in df.columns
    }
    data = []
    for _, row in df.iterrows():
        row_dict = {}
        for col, val in row.items():
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                row_dict[col] = None
            elif hasattr(val, "item"):          # numpy scalar → Python native
                row_dict[col] = val.item()
            else:
                row_dict[col] = val
        data.append(row_dict)
    return {"data": data, "types": types}


def _t_quantile(p: float, df: int) -> float:
    """Upper t-quantile, with scipy if available and a lookup table fallback."""
    try:
        from scipy import stats as _stats
        return float(_stats.t.ppf(p, df=df))
    except ImportError:
        pass
    # Rough lookup: good to ±0.02 for df >= 2
    lut = {1: 12.706, 2: 4.303, 3: 3.182, 5: 2.571, 10: 2.228,
           20: 2.086, 30: 2.042, 60: 2.000, 120: 1.980}
    for threshold in sorted(lut):
        if df <= threshold:
            return lut[threshold]
    return 1.960  # large df → z


def _group_summaries(
    points_df: pd.DataFrame,
    group_col: str,
    dim_cols: list,
    conf_level: float = 0.95,
    include_ci: bool = True,
) -> pd.DataFrame:
    """
    Compute per-group mean positions and optional CI bounds.

    Returns a DataFrame with columns:
        group, {dim_cols[0]}, {dim_cols[1]},
        and (if include_ci) {dim}.low, {dim}.high for each dim.
    """
    rows = []
    for g in points_df[group_col].unique():
        sub = points_df[points_df[group_col] == g][dim_cols].apply(pd.to_numeric, errors="coerce")
        n = len(sub)
        means = sub.mean()
        row = {"group": str(g)}
        for d in dim_cols:
            row[d] = float(means[d])
        if include_ci and n >= 2:
            t_val = _t_quantile((1 + conf_level) / 2, df=n - 1)
            for d in dim_cols:
                se = float(sub[d].std(ddof=1)) / math.sqrt(n)
                row[f"{d}.low"]  = row[d] - t_val * se
                row[f"{d}.high"] = row[d] + t_val * se
        rows.append(row)
    return pd.DataFrame(rows)


# ── Public API ────────────────────────────────────────────────────────────────

def model_data(
    nodes:   pd.DataFrame,
    edges:   pd.DataFrame,
    points:  Optional[pd.DataFrame] = None,
    *,
    id_col:       str = "QEUNIT",
    node_id_col:  str = "code",
    x_col:        str = "SVD1",
    y_col:        str = "SVD2",
    group_col:    Optional[str] = None,
    directed:     bool = False,
    conf_level:   float = 0.95,
    include_ci:   bool = True,
) -> dict:
    """
    Build a qeviz ModelData dict from pandas DataFrames.

    Parameters
    ----------
    nodes         DataFrame with one row per code node. Must contain
                  ``node_id_col`` (default ``"code"``) plus ``x_col`` and
                  ``y_col`` position columns.
    edges         DataFrame with one row per unit. First column should be the
                  unit identifier (``id_col``). Remaining columns are edge
                  weights with dot-separated code-pair names (``"A.B"``).
    points        Optional DataFrame of unit projection positions. Must contain
                  ``id_col``, ``x_col``, ``y_col``, and optionally ``group_col``.
    id_col        Unit-identifier column in ``edges`` and ``points``. Default ``"QEUNIT"``.
    node_id_col   Node-identifier column in ``nodes``. Default ``"code"``.
    x_col         X-position column name. Default ``"SVD1"``.
    y_col         Y-position column name. Default ``"SVD2"``.
    group_col     Grouping column in ``points``. When provided, pre-computed
                  group means and CI bounds are added to the ``groups`` frame.
    directed      ``True`` for ONA / directed networks (arrowheads). Default ``False``.
    conf_level    Confidence level for CI boxes in the groups frame. Default 0.95.
    include_ci    Include CI bounds in the groups frame. Default ``True``.

    Returns
    -------
    dict  A ModelData dict ready to pass to ``plot()`` or ``export_html()``.
    """
    dim_cols = [x_col, y_col]

    result: dict = {
        "nodes":       _qe_frame(nodes),
        "edges":       _qe_frame(edges),
        "updated":     int(time.time() * 1000),
        "directed":    directed,
        "id_col":      id_col,
        "node_id_col": node_id_col,
        "x_col":       x_col,
        "y_col":       y_col,
        "group_col":   group_col,
    }

    if points is not None:
        result["points"] = _qe_frame(points)

        if group_col and group_col in points.columns:
            groups_df = _group_summaries(
                points, group_col, dim_cols,
                conf_level=conf_level,
                include_ci=include_ci,
            )
            result["groups"] = _qe_frame(groups_df)

    return result


def _html_template(
    model: dict,
    options: Optional[dict] = None,
    width: int = 700,
    height: int = 600,
) -> str:
    """Render model data into a self-contained HTML string."""
    opts = options or {}
    model_json = json.dumps(model, default=str)

    # Inline the qeviz UMD bundle from the same directory as this file.
    bundle_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qeviz.umd.js")
    if os.path.exists(bundle_path):
        with open(bundle_path, "r", encoding="utf-8") as fh:
            bundle_js = fh.read()
        script_tag = f"<script>{bundle_js}</script>"
    else:
        # Fallback: assume qeviz.umd.js is served alongside the HTML file
        script_tag = '<script src="qeviz.umd.js"></script>'

    def _attr(name: str, val) -> str:
        return f' {name}="{val}"' if val is not None else ""

    extra_attrs = (
        _attr("group",        opts.get("group"))         +
        _attr("unit",         opts.get("unit"))          +
        _attr("compare",      opts.get("compare"))       +
        _attr("also",         opts.get("also"))          +
        _attr("label-nodes",  opts.get("label_nodes", "on"))  +
        _attr("label-means",  opts.get("label_means",  "on"))  +
        _attr("label-points", opts.get("label_points", "off")) +
        ("" if opts.get("scale_points", True) else ' scale-points="false"') +
        ("" if opts.get("outlier",       True) else ' outlier="false"')      +
        (" points" if opts.get("show_points", False) else "")
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: system-ui, sans-serif; background: #fff; }}
    qe-visual {{ display: block; width: {width}px; height: {height}px; }}
    qe-graph  {{ display: block; width: 100%; height: 100%; }}
  </style>
  {script_tag}
</head>
<body>
  <qe-visual id="vis" style="display:none"></qe-visual>
  <qe-graph id="graph" for="vis"
    style="width:{width}px;height:{height}px"
    nodes{extra_attrs}>
  </qe-graph>
  <script>
    (function() {{
      document.getElementById('vis').setModelData({model_json});
    }})();
  </script>
</body>
</html>"""


def plot(
    model: dict,
    options: Optional[dict] = None,
    width: int = 700,
    height: int = 600,
):
    """
    Display the qeviz plot inline in a Jupyter / IPython notebook.

    Falls back to returning the HTML string if IPython is not available.

    Parameters
    ----------
    model   ModelData dict from :func:`model_data`.
    options Display options:
              ``group``        — group name to display (default: first group)
              ``unit``         — unit ID for a single-unit network
              ``compare``      — second group/unit for subtraction view
              ``also``         — second group for overlay view
              ``label_nodes``  — ``"on"`` | ``"off"`` | ``"auto"`` | ``"click"``
              ``label_means``  — same; default ``"on"``
              ``label_points`` — same; default ``"off"``
              ``show_points``  — ``True`` to render unit scatter points
              ``scale_points`` — ``False`` to disable point coordinate scaling
              ``outlier``      — ``False`` to hide outlier boxes
    width, height  Plot dimensions in pixels.
    """
    html = _html_template(model, options, width, height)
    try:
        from IPython.display import HTML, display  # type: ignore
        display(HTML(f'<div style="width:{width}px;height:{height}px">{html}</div>'))
    except ImportError:
        return html


def export_html(
    model: dict,
    path: str,
    options: Optional[dict] = None,
    width: int = 700,
    height: int = 600,
) -> str:
    """
    Write a self-contained HTML file with the qeviz plot.

    The qeviz bundle is inlined — no external dependencies required to open the
    file.  Share it with collaborators, attach it to a paper submission, or open
    it in any web browser without a server.

    Parameters
    ----------
    model   ModelData dict from :func:`model_data`.
    path    Output file path, e.g. ``"model.html"``.
    options See :func:`plot` for available keys.
    width, height  Plot dimensions in pixels.

    Returns
    -------
    str  The resolved absolute path of the written file.
    """
    html = _html_template(model, options, width, height)
    abs_path = os.path.abspath(path)
    with open(abs_path, "w", encoding="utf-8") as fh:
        fh.write(html)
    return abs_path


# ── ENA-namespaced convenience wrappers ───────────────────────────────────────
# These mirror the rENA function names for a consistent cross-language API.

def ena_plot_interactive(
    nodes:   pd.DataFrame,
    edges:   pd.DataFrame,
    points:  Optional[pd.DataFrame] = None,
    *,
    group_col:   Optional[str] = None,
    options:     Optional[dict] = None,
    width:       int = 700,
    height:      int = 600,
    **model_kwargs,
):
    """
    Build a ModelData dict and display an interactive qeviz plot.

    Convenience wrapper that combines :func:`model_data` and :func:`plot`.
    Mirrors ``ena.plot.interactive()`` in rENA.

    Parameters
    ----------
    nodes, edges, points
        See :func:`model_data`.
    group_col
        Grouping column in ``points``.
    options
        Display options dict — see :func:`plot`.
    width, height
        Plot dimensions in pixels.
    **model_kwargs
        Additional keyword arguments forwarded to :func:`model_data`
        (e.g. ``id_col``, ``x_col``, ``conf_level``, ``directed``).

    Returns
    -------
    dict  The ModelData dict (also displays inline when in Jupyter).
    """
    m = model_data(nodes, edges, points, group_col=group_col, **model_kwargs)
    plot(m, options=options, width=width, height=height)
    return m


def ena_export_html(
    nodes:   pd.DataFrame,
    edges:   pd.DataFrame,
    path:    str = "ena_plot.html",
    points:  Optional[pd.DataFrame] = None,
    *,
    group_col:   Optional[str] = None,
    options:     Optional[dict] = None,
    width:       int = 700,
    height:      int = 600,
    **model_kwargs,
) -> str:
    """
    Build a ModelData dict and write a self-contained HTML file.

    Convenience wrapper that combines :func:`model_data` and :func:`export_html`.
    Mirrors ``ena.export.html()`` in rENA.

    Parameters
    ----------
    nodes, edges, points
        See :func:`model_data`.
    path
        Output file path. Default ``"ena_plot.html"``.
    group_col
        Grouping column in ``points``.
    options
        Display options dict — see :func:`plot`.
    width, height
        Plot dimensions in pixels.
    **model_kwargs
        Additional keyword arguments forwarded to :func:`model_data`.

    Returns
    -------
    str  The resolved absolute path of the written file.
    """
    m = model_data(nodes, edges, points, group_col=group_col, **model_kwargs)
    return export_html(m, path, options=options, width=width, height=height)
