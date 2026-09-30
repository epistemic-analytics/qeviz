"""
qeviz — Python adapter for the qeviz visualization library.

Converts pandas DataFrames to the qeviz ModelData format and provides
a chainable plot object for Jupyter display and standalone HTML export.

Quick start
-----------
::

    import qeviz

    # From DataFrames
    p = qeviz.plot(nodes_df, edges_df, points_df, group_col="Condition")
    p                                       # auto-display in Jupyter
    p.group("FirstGame").points().show()    # chain + explicit display

    # From a fitted pyENA model
    p = qeviz.from_pyena(model, group_col="Condition")
    p.edges("FirstGame", also="SecondGame")
    p.edges(unit="FirstGame::alice")

    # Introspect available groups / units
    p.groups()   # ["FirstGame", "SecondGame"]
    p.units()    # ["FirstGame::alice", ...]

    # Export to file
    p.export_html("output.html")

Chain API
---------
All chain methods return a *new* ``QEPlot`` — the original is unchanged.

``plot_obj.group(*names, intervals=True)``
    Which group means (and CI boxes) to show.  Omit names → all groups.

``plot_obj.edges(group, *, unit, compare, also, show)``
    Which edge network to draw.  Omit → no network rendered.

``plot_obj.points(show=True)``
    Show or hide individual unit scatter dots.

``plot_obj.trajectories(units=None, smooth="none", ...)``
    Show supplied ordered unit trajectories.

``plot_obj.labels(nodes, means, points)``
    Label visibility: ``"on" | "off" | "click" | "auto"``.

Dependencies
------------
Required : pandas
Optional : scipy  (exact t-distribution CIs; falls back to lookup table)
           IPython (Jupyter inline display)
           pyENA  (for :func:`from_pyena`)
"""

from __future__ import annotations

import copy
import json
import math
import os
import re
import time
from typing import Optional, Union

import pandas as pd


# ── Internal helpers ───────────────────────────────────────────────────────────

def _qe_frame(df: pd.DataFrame) -> dict:
    """Convert a pandas DataFrame to a QEFrame ``{data: [...], types: {...}}``."""
    _type_map = {
        "object":  "character",
        "string":  "character",
        "int64":   "integer",
        "int32":   "integer",
        "int16":   "integer",
        "int8":    "integer",
        "float64": "numeric",
        "float32": "numeric",
        "bool":    "logical",
    }
    types = {
        col: _type_map.get(str(df[col].dtype), "character")
        for col in df.columns
    }
    data = []
    for _, row in df.iterrows():
        row_dict: dict = {}
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
    """Upper t-quantile with scipy if available, lookup-table fallback."""
    try:
        from scipy import stats as _stats   # type: ignore
        return float(_stats.t.ppf(p, df=df))
    except ImportError:
        pass
    lut = {1: 12.706, 2: 4.303, 3: 3.182, 5: 2.571, 10: 2.228,
           20: 2.086, 30: 2.042, 60: 2.000, 120: 1.980}
    for threshold in sorted(lut):
        if df <= threshold:
            return lut[threshold]
    return 1.960


def _group_summaries(
    points_df: pd.DataFrame,
    group_col: str,
    dim_cols: list,
    conf_level: float = 0.95,
    include_ci: bool = True,
) -> pd.DataFrame:
    """Per-group means and optional rectangular 95 % CI bounds."""
    rows = []
    for g in points_df[group_col].unique():
        sub = points_df[points_df[group_col] == g][dim_cols].apply(
            pd.to_numeric, errors="coerce"
        )
        n     = len(sub)
        means = sub.mean()
        row: dict = {group_col: str(g)}
        for d in dim_cols:
            row[d] = float(means[d])
        if include_ci and n >= 2:
            t_val = _t_quantile((1 + conf_level) / 2, df=n - 1)
            for d in dim_cols:
                se              = float(sub[d].std(ddof=1)) / math.sqrt(n)
                row[f"{d}.low"]  = row[d] - t_val * se
                row[f"{d}.high"] = row[d] + t_val * se
        rows.append(row)
    return pd.DataFrame(rows)


def _bundle_script_tag() -> str:
    """Return a ``<script>`` tag with the inlined UMD bundle."""
    bundle_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "qeviz.umd.js"
    )
    if os.path.exists(bundle_path):
        with open(bundle_path, "r", encoding="utf-8") as fh:
            js = fh.read()
        # Inlined, the relative source-map URL would resolve against the page.
        js = re.sub(r"\n//# sourceMappingURL=[^\n]*\s*$", "\n", js)
        return f"<script>{js}</script>"
    return '<script src="qeviz.umd.js"></script>'


# ── QEPlot ─────────────────────────────────────────────────────────────────────

class QEPlot:
    """
    A lazily-rendered qeviz plot.

    Created by :func:`plot` or :func:`from_pyena`.  Chain :meth:`group`,
    :meth:`edges`, :meth:`points`, and :meth:`labels` to customise the view.

    Display options:

    * Evaluate the object as the last expression in a Jupyter cell — the
      ``_repr_html_`` hook triggers automatic inline display.
    * Call :meth:`show` explicitly to display in IPython / Jupyter.
    * Call :meth:`export_html` to write a self-contained ``.html`` file.

    All chain methods return a *new* ``QEPlot`` so the original is not
    mutated and multiple views can branch from a common base.
    """

    def __init__(
        self,
        model: dict,
        title: str = "qeviz",
        width: Union[int, str] = 700,
        height: Union[int, str] = 500,
    ) -> None:
        self._model  = model
        self._title  = title
        # Normalise width/height to CSS strings for the <qe-graph> attribute.
        self._width  = str(width)  if isinstance(width,  str) else f"{width}px"
        self._height = str(height) if isinstance(height, str) else f"{height}px"
        self._opts: dict = {}

    # ── Model access ───────────────────────────────────────────────────────────

    @property
    def model(self) -> dict:
        """The raw ModelData dict (nodes, edges, points, groups, …)."""
        return self._model

    # ── Copy helper ────────────────────────────────────────────────────────────

    def _copy(self) -> "QEPlot":
        """Return a shallow copy with an independent ``_opts`` dict."""
        p          = QEPlot.__new__(QEPlot)
        p._model   = self._model       # shared — model data is read-only
        p._title   = self._title
        p._width   = self._width
        p._height  = self._height
        p._opts    = dict(self._opts)  # independent copy
        return p

    # ── Introspection ──────────────────────────────────────────────────────────

    def groups(self) -> list:
        """Return the group names present in the model (from the groups frame)."""
        frame = self._model.get("groups")
        if not frame:
            return []
        group_col = self._model.get("group_col") or "group"
        result = []
        for row in frame.get("data", []):
            val = row.get(group_col)
            if val is None and row:
                val = next(iter(row.values()))
            if val is not None:
                result.append(str(val))
        return result

    def units(self) -> list:
        """Return the unit IDs present in the model's points frame."""
        frame = self._model.get("points")
        if not frame:
            return []
        id_col = self._model.get("id_col") or "QEUNIT"
        return [
            str(row[id_col])
            for row in frame.get("data", [])
            if id_col in row
        ]

    def trajectory_units(self) -> list:
        """
        Return unit IDs present in the trajectories frame.

        Falls back to point rows because qeviz can use points as ordered
        trajectory states when no separate trajectories frame is supplied.
        """
        frame = self._model.get("trajectories") or self._model.get("points")
        if not frame:
            return []
        id_col = self._model.get("id_col") or "QEUNIT"
        seen: list[str] = []
        for row in frame.get("data", []):
            if id_col in row:
                val = str(row[id_col])
                if val not in seen:
                    seen.append(val)
        return seen

    # ── Chain methods ──────────────────────────────────────────────────────────

    def group(self, *names: str, intervals: bool = True, fixed_size: bool = False) -> "QEPlot":
        """
        Select which group means (and optionally CI boxes) to display.

        Pass one or more group names to restrict the view; omit all names to
        show every group in the model (the default).  This is independent of
        edge rendering — use :meth:`edges` to choose whose network to draw.

        Parameters
        ----------
        *names      Group names to display.  Omit to show all groups.
        intervals   Draw 95 % CI rectangles around each mean.  Default ``True``.
        fixed_size  Keep mean markers a constant on-screen pixel size regardless
                    of data extent, container size, or zoom.  Default ``False``
                    (markers scale with the coordinate space).
        """
        p = self._copy()
        available = self.groups()
        if names:
            bad = [n for n in names if n not in available]
            if bad:
                raise ValueError(
                    f"group(): name(s) not found in model: {bad!r}\n"
                    f"Available: {available!r}"
                )
            p._opts["groups"] = ",".join(names)
        else:
            p._opts.pop("groups", None)
        p._opts["confidence"] = intervals
        p._opts["mean_fixed_size"] = bool(fixed_size)
        return p

    def edges(
        self,
        group: Optional[str] = None,
        *,
        unit: Optional[str] = None,
        compare: Optional[str] = None,
        also: Optional[str] = None,
        show: bool = True,
        color_scale: str = "model",
        edge_width: Optional[float] = None,
        magnify: Optional[float] = None,
    ) -> "QEPlot":
        """
        Select which edge network to draw.

        Supply either ``group`` (a group's mean network) or ``unit`` (an
        individual unit's personal network) as the primary edge source.
        Omit both to draw no network.  Pass ``show=False`` to explicitly
        suppress any previously set edges.

        Parameters
        ----------
        group   Group name whose mean edge network to draw.
        unit    Unit ID for an individual network, e.g.
                ``"FirstGame::alice"``.  Mutually exclusive with ``group``.
        compare Second group to subtract (``group − compare``).
        also    Second group to overlay alongside ``group``.
        show    ``False`` suppresses all edges regardless of other args.
        color_scale
                How weights map onto webENA's colour ramps (saturation
                0.25–1, opacity 0.3–1): ``"model"`` (default) rescales from the
                model's smallest to largest non-zero weight, so plots of one
                model share a colour scale; ``"plot"`` rescales within this plot
                (webENA); ``"absolute"`` uses saturation = opacity = |weight|.
        edge_width
                Width of a weight-1 edge as a fraction of the plot width (qeviz
                default 0.04). Width is absolute, so equal weights draw equally
                wide; node diameter is the sum of its edges' widths.
        magnify Multiply this plot's edge widths and node sizes (not colour).
                Whenever set — including ``1`` — the plot is labelled
                "(scaled N.Nx)".
        """
        if color_scale not in ("model", "plot", "absolute"):
            raise ValueError('edges(): color_scale must be "model", "plot", or "absolute".')
        if edge_width is not None and not (0 < edge_width <= 1):
            raise ValueError("edges(): edge_width must be in (0, 1].")
        if magnify is not None and not magnify > 0:
            raise ValueError("edges(): magnify must be a positive number.")
        if group and unit:
            raise ValueError("edges(): supply either 'group' or 'unit', not both.")

        p = self._copy()
        if not show:
            p._opts["show_edges"] = False
            for k in ("group", "unit", "compare", "also"):
                p._opts.pop(k, None)
            return p

        available_groups = self.groups()
        available_units  = self.units()

        def _check_group(name: str, arg: str) -> None:
            if name and name not in available_groups:
                raise ValueError(
                    f"edges(): {arg}={name!r} not found.\n"
                    f"Available groups: {available_groups!r}"
                )

        _check_group(group,   "group")
        _check_group(compare, "compare")
        _check_group(also,    "also")

        if unit and unit not in available_units:
            raise ValueError(
                f"edges(): unit={unit!r} not found.\n"
                "Use .units() to see available unit IDs."
            )
        if compare and also:
            raise ValueError("edges(): supply either 'compare' or 'also', not both.")
        if unit and (compare or also):
            raise ValueError(
                "edges(): 'compare' and 'also' cannot be combined with 'unit'."
            )

        p._opts["show_edges"] = True
        p._opts["group"]   = group
        p._opts["unit"]    = unit
        p._opts["compare"] = compare
        p._opts["also"]    = also
        p._opts["edge_color_scale"] = None if color_scale == "model" else color_scale
        p._opts["edge_width"] = edge_width
        p._opts["edge_magnify"] = magnify
        return p

    def points(
        self,
        show: bool = True,
        *,
        size: Optional[Union[int, float]] = None,
        fixed_size: bool = False,
    ) -> "QEPlot":
        """
        Show or hide individual unit scatter dots.

        ``size`` overrides the default dot size (2.5); larger values draw bigger
        dots, relative to the code-node size.  ``fixed_size`` keeps the dots a
        constant on-screen pixel size regardless of data extent, container size,
        or zoom (default: dots scale with the coordinate space).
        """
        p = self._copy()
        p._opts["show_points"] = show
        p._opts["point_size"] = size
        p._opts["point_fixed_size"] = bool(fixed_size)
        return p

    def nodes(self, show: Union[bool, str] = "auto", unconnected: str = "dot") -> "QEPlot":
        """
        Show or hide the code nodes.

        ``"auto"`` (default) draws nodes only when an edge network is drawn,
        matching rENA. ``"always"`` / ``True`` and ``"never"`` / ``False``
        override that. Node positions always set the plot extent. With an
        edge network a node's diameter equals the summed widths of its edges
        (directed: only edges directed at it, plus its self-connection);
        ``unconnected="hide"`` hides nodes with no drawn edges (default
        ``"dot"`` shows a tiny dot).
        """
        if unconnected not in ("dot", "hide"):
            raise ValueError('nodes(): unconnected must be "dot" or "hide".')
        if show is True:
            show = "always"
        elif show is False:
            show = "never"
        if show not in ("auto", "always", "never"):
            raise ValueError('nodes(): show must be "auto", "always", or "never".')
        p = self._copy()
        p._opts["nodes_show"] = show
        p._opts["nodes_unconnected"] = unconnected
        return p

    def axes(
        self,
        x: Union[bool, str] = False,
        y: Union[bool, str] = False,
        *,
        show: bool = True,
    ) -> "QEPlot":
        """
        Show or hide the axes (a ``<qe-axes>`` layer).

        Axis labels are opt-in. ``x`` / ``y`` default to ``False`` (no label);
        ``True`` uses the dimension name (e.g. ``"SVD1"``), a string sets custom
        text. ``show=False`` suppresses the axes entirely.
        """
        p = self._copy()
        if not show:
            p._opts["show_axes"] = False
            return p
        p._opts["show_axes"] = True
        p._opts["axis_x"] = x
        p._opts["axis_y"] = y
        return p

    def trajectories(
        self,
        units: Optional[Union[str, list[str]]] = None,
        *,
        smooth: str = "none",
        max_degree: int = 3,
        degree_selection: str = "loocv_2d",
        points: bool = True,
        tips: bool = True,
        playhead: Optional[Union[int, float]] = None,
        line_style: str = "uniform",
        stroke_width: Union[int, float] = 2,
        stroke_width_range: tuple[Union[int, float], Union[int, float]] = (1, 6),
        opacity_range: tuple[Union[int, float], Union[int, float]] = (0.3, 1),
        show: bool = True,
    ) -> "QEPlot":
        """
        Show or hide supplied ordered unit trajectory paths.

        qeviz renders rows already present in the model; trajectory modeling,
        accumulation, dooring, and inference remain caller-side work.

        ``max_degree`` bounds the polynomial degree when ``smooth="poly"``.
        ``degree_selection="loocv_2d"`` (default) picks the degree in
        ``1..max_degree`` by joint 2D leave-one-out cross-validation;
        ``"fixed"`` always uses ``max_degree``. Near-origin points are excluded
        from the fit (still drawn), matching ``ena.plot.trajectory()``.
        """
        p = self._copy()
        if not show:
            p._opts["show_trajectories"] = False
            return p

        if smooth not in {"none", "poly"}:
            raise ValueError("trajectories(): smooth must be 'none' or 'poly'.")
        if degree_selection not in {"loocv_2d", "fixed"}:
            raise ValueError(
                "trajectories(): degree_selection must be 'loocv_2d' or 'fixed'."
            )
        if line_style not in {"uniform", "tapered"}:
            raise ValueError(
                "trajectories(): line_style must be 'uniform' or 'tapered'."
            )

        selected_units: Optional[list[str]]
        if units is None:
            selected_units = None
        elif isinstance(units, str):
            selected_units = [units]
        else:
            selected_units = [str(u) for u in units]

        if selected_units:
            available = self.trajectory_units()
            bad = [u for u in selected_units if u not in available]
            if bad:
                raise ValueError(
                    f"trajectories(): unit(s) not found in model: {bad!r}\n"
                    f"Available: {available!r}"
                )

        p._opts["show_trajectories"] = True
        p._opts["trajectory_units"] = (
            None if selected_units is None else ",".join(selected_units)
        )
        p._opts["trajectory_smooth"] = smooth
        p._opts["trajectory_max_degree"] = int(max_degree)
        p._opts["trajectory_degree_selection"] = degree_selection
        p._opts["trajectory_points"] = bool(points)
        p._opts["trajectory_tips"] = bool(tips)
        p._opts["trajectory_playhead"] = playhead
        p._opts["trajectory_line_style"] = line_style
        p._opts["trajectory_stroke_width"] = stroke_width
        p._opts["trajectory_stroke_width_range"] = ",".join(
            str(v) for v in stroke_width_range
        )
        p._opts["trajectory_opacity_range"] = ",".join(
            str(v) for v in opacity_range
        )
        return p

    def labels(
        self,
        nodes:  str = "on",
        means:  str = "on",
        points: str = "auto",
    ) -> "QEPlot":
        """
        Control label visibility.

        Each argument accepts ``"on"``, ``"off"``, ``"click"``, or ``"auto"``.
        """
        p = self._copy()
        p._opts["label_nodes"]  = nodes
        p._opts["label_means"]  = means
        p._opts["label_points"] = points
        return p

    # ── HTML rendering ─────────────────────────────────────────────────────────

    def _build_graph_element(self) -> str:
        """Build ``<qe-graph …>…</qe-graph>`` with declarative child layer elements."""
        opts = self._opts
        children: list[str] = []

        # <qe-nodes> is inserted here once <qe-edges> is decided (below).

        # <qe-means> — always present; groups/confidence control what is shown
        means_parts: list[str] = []
        if opts.get("groups"):
            means_parts.append(f'groups="{opts["groups"]}"')
        if opts.get("confidence", True):
            means_parts.append("confidence")
        means_label = opts.get("label_means", "on")
        means_parts.append(f'label="{means_label}"')
        if opts.get("mean_fixed_size", False):
            means_parts.append("fixed-size")
        children.append(f'    <qe-means {" ".join(means_parts)}></qe-means>')

        # <qe-points> — only when show_points=True
        if opts.get("show_points", False):
            pt_label = opts.get("label_points", "auto")
            pt_parts = [f'label="{pt_label}"']
            if opts.get("point_size") is not None:
                pt_parts.append(f'size="{opts["point_size"]}"')
            if opts.get("point_fixed_size", False):
                pt_parts.append("fixed-size")
            children.append(f'    <qe-points {" ".join(pt_parts)}></qe-points>')

        # <qe-edges> — only when not suppressed and a primary target is set
        if opts.get("show_edges", True):
            edge_parts: list[str] = []
            if opts.get("group"):
                edge_parts.append(f'group="{opts["group"]}"')
            if opts.get("unit"):
                edge_parts.append(f'unit="{opts["unit"]}"')
            if opts.get("compare"):
                edge_parts.append(f'compare="{opts["compare"]}"')
            if opts.get("also"):
                edge_parts.append(f'also="{opts["also"]}"')
            if edge_parts and opts.get("edge_magnify") is not None:
                edge_parts.append(f'magnify="{opts["edge_magnify"]:g}"')
            if edge_parts and opts.get("edge_color_scale"):
                edge_parts.append(f'color-scale="{opts["edge_color_scale"]}"')
            if edge_parts:
                children.append(
                    f'    <qe-edges {" ".join(edge_parts)}></qe-edges>'
                )

        # <qe-nodes> — draw code nodes (positions always come from the model).
        # "auto" draws them only with an edge network, as rENA does.
        node_show = opts.get("nodes_show", "auto")
        has_network = any(c.startswith("    <qe-edges") for c in children)
        if node_show == "always" or (node_show == "auto" and has_network):
            node_label = opts.get("label_nodes", "on")
            unconn = ' unconnected="hide"' if opts.get("nodes_unconnected") == "hide" else ""
            children.insert(0, f'    <qe-nodes label="{node_label}"{unconn}></qe-nodes>')

        # <qe-trajectories> — only when explicitly shown
        if opts.get("show_trajectories", False):
            traj_parts: list[str] = []
            if opts.get("trajectory_units"):
                traj_parts.append(f'units="{opts["trajectory_units"]}"')
            traj_parts.extend([
                f'smooth="{opts.get("trajectory_smooth", "none")}"',
                f'max-degree="{opts.get("trajectory_max_degree", 3)}"',
                f'degree-selection="{opts.get("trajectory_degree_selection", "loocv_2d")}"',
                f'points="{str(opts.get("trajectory_points", True)).lower()}"',
                f'tips="{str(opts.get("trajectory_tips", True)).lower()}"',
            ])
            if opts.get("trajectory_playhead") is not None:
                traj_parts.append(f'playhead="{opts["trajectory_playhead"]}"')
            traj_parts.extend([
                f'line-style="{opts.get("trajectory_line_style", "uniform")}"',
                f'stroke-width="{opts.get("trajectory_stroke_width", 2)}"',
                f'stroke-width-range="{opts.get("trajectory_stroke_width_range", "1,6")}"',
                f'opacity-range="{opts.get("trajectory_opacity_range", "0.3,1")}"',
            ])
            children.append(
                f'    <qe-trajectories {" ".join(traj_parts)}></qe-trajectories>'
            )

        # <qe-axes> — axis lines + optional per-axis labels
        if opts.get("show_axes", False):
            axis_parts: list[str] = []
            for attr, val in (("x", opts.get("axis_x", False)), ("y", opts.get("axis_y", False))):
                if val is True:
                    axis_parts.append(attr)
                elif isinstance(val, str):
                    axis_parts.append(f'{attr}="{val}"')
            children.append(
                "    <qe-axes"
                + (" " + " ".join(axis_parts) if axis_parts else "")
                + "></qe-axes>"
            )

        children_str = "\n".join(children)
        return (
            f'<qe-graph width="{self._width}" height="{self._height}"'
            + (f' edge-width="{opts["edge_width"]:g}"' if opts.get("edge_width") is not None else "")
            + '>\n'
            f'{children_str}\n'
            f'  </qe-graph>'
        )

    def _build_fragment(self) -> str:
        """HTML fragment for Jupyter inline display (no ``<html>``/``<head>``)."""
        uid        = f"qeviz-{int(time.time() * 1000) % 100_000}"
        model_json = json.dumps(self._model, default=str)
        graph_elem = self._build_graph_element()
        return (
            f"{_bundle_script_tag()}\n"
            f'<qe-visual id="{uid}">\n'
            f"  {graph_elem}\n"
            f"</qe-visual>\n"
            f"<script>\n"
            f"  (function(){{\n"
            f"    document.getElementById('{uid}').setModelData({model_json});\n"
            f"  }})();\n"
            f"</script>"
        )

    def _build_html_doc(self) -> str:
        """Complete self-contained HTML document."""
        model_json = json.dumps(self._model, default=str)
        graph_elem = self._build_graph_element()
        bundle     = _bundle_script_tag()
        return (
            f"<!DOCTYPE html>\n"
            f'<html lang="en">\n'
            f"<head>\n"
            f'  <meta charset="UTF-8">\n'
            f'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
            f"  <title>{self._title}</title>\n"
            f"  <style>\n"
            f"    * {{ box-sizing: border-box; margin: 0; padding: 0; }}\n"
            f"    body {{ font-family: system-ui, sans-serif; background: #fff; }}\n"
            f"  </style>\n"
            f"  {bundle}\n"
            f"</head>\n"
            f"<body>\n"
            f'  <qe-visual id="vis">\n'
            f"    {graph_elem}\n"
            f"  </qe-visual>\n"
            f"  <script>\n"
            f"    (function(){{\n"
            f"      document.getElementById('vis').setModelData({model_json});\n"
            f"    }})();\n"
            f"  </script>\n"
            f"</body>\n"
            f"</html>"
        )

    # ── Display ────────────────────────────────────────────────────────────────

    def show(self) -> None:
        """
        Display the plot inline in a Jupyter / IPython notebook.

        In non-interactive environments (plain Python scripts) this falls back
        to printing the HTML document to stdout.
        """
        try:
            from IPython.display import HTML, display  # type: ignore
            display(HTML(self._build_fragment()))
        except ImportError:
            print(self._build_html_doc())

    def _repr_html_(self) -> str:
        """Jupyter rich-display hook — called automatically when a cell returns a QEPlot."""
        return self._build_fragment()

    def export_html(self, path: str) -> str:
        """
        Write a self-contained HTML file.

        The qeviz bundle is inlined — no server or external dependencies
        required.

        Parameters
        ----------
        path    Output file path, e.g. ``"model.html"``.

        Returns
        -------
        str  Resolved absolute path of the written file.
        """
        abs_path = os.path.abspath(path)
        with open(abs_path, "w", encoding="utf-8") as fh:
            fh.write(self._build_html_doc())
        return abs_path

    def __repr__(self) -> str:
        groups = self.groups()
        n_units = len(self.units())
        opts = {k: v for k, v in self._opts.items() if v is not None}
        return (
            f"<QEPlot groups={groups!r} units={n_units} opts={opts!r}>"
        )


# ── Public API ─────────────────────────────────────────────────────────────────

def model_data(
    nodes:   pd.DataFrame,
    edges:   pd.DataFrame,
    points:  Optional[pd.DataFrame] = None,
    trajectories: Optional[pd.DataFrame] = None,
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

    This is the low-level constructor — most users will call :func:`plot`
    directly.  Use ``model_data()`` when you need to inspect or transform the
    serialised dict before rendering.

    Parameters
    ----------
    nodes         One row per code node.  Must contain ``node_id_col`` plus
                  ``x_col`` and ``y_col`` position columns.
    edges         One row per unit.  First column is the unit identifier
                  (``id_col``); remaining columns are dot-separated edge
                  weights (``"A.B"``).
    points        Unit projection positions.  Must contain ``id_col``,
                  ``x_col``, ``y_col``, and (optionally) ``group_col``.
    trajectories  Ordered observations for trajectory rendering.  Must contain
                  ``id_col``, ``x_col``, ``y_col``, and ideally ``time``,
                  ``RowID``, or ``ActivityNumber``.
    id_col        Unit-identifier column in ``edges`` / ``points``.
    node_id_col   Node-identifier column in ``nodes``.
    x_col         X-position column name.
    y_col         Y-position column name.
    group_col     Grouping column in ``points``.  When provided, group means
                  and CI bounds are added as the ``groups`` frame.
    directed      ``True`` for ONA / directed networks (arrowheads).
    conf_level    Confidence level for CI boxes.  Default 0.95.
    include_ci    Include CI bounds in the groups frame.  Default ``True``.

    Returns
    -------
    dict  ModelData dict suitable for :func:`plot` or :func:`export_html`.
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

    if trajectories is not None:
        result["trajectories"] = _qe_frame(trajectories)

    return result


def plot(
    x: Union[pd.DataFrame, dict],
    edges:  Optional[pd.DataFrame] = None,
    points: Optional[pd.DataFrame] = None,
    trajectories: Optional[pd.DataFrame] = None,
    *,
    title:     str = "qeviz",
    width:     Union[int, str] = 700,
    height:    Union[int, str] = 500,
    group_col: Optional[str] = None,
    **model_kwargs,
) -> QEPlot:
    """
    Create a :class:`QEPlot`.

    Accepts either a pre-built ModelData dict **or** raw DataFrames
    (``nodes``, ``edges``, ``points``).

    Parameters
    ----------
    x           A ModelData dict from :func:`model_data`, **or** a nodes
                DataFrame (in which case ``edges`` must also be supplied).
    edges       Edge-weights DataFrame (only when ``x`` is a nodes DataFrame).
    points      Unit-positions DataFrame (optional, only with DataFrames).
    trajectories Ordered trajectory-state DataFrame (optional, only with DataFrames).
    title       Window / tab title for exported files.
    width, height
                Plot dimensions.  Integers are treated as pixels; strings
                are passed through as CSS (e.g. ``"100%"``).
    group_col   Grouping column (only when building from DataFrames).
    **model_kwargs
                Additional keyword arguments forwarded to :func:`model_data`
                (e.g. ``id_col``, ``x_col``, ``directed``).

    Returns
    -------
    QEPlot
    """
    if isinstance(x, dict):
        m = x
    else:
        if edges is None:
            raise TypeError("plot(): 'edges' is required when 'x' is a DataFrame.")
        m = model_data(
            x, edges, points,
            trajectories=trajectories,
            group_col=group_col,
            **model_kwargs,
        )
    return QEPlot(m, title=title, width=width, height=height)


def from_pyena(
    model,
    group_col: Optional[str] = None,
    directed:  bool = False,
    id_col:    str = "QEUNIT",
    title:     str = "qeviz",
    width:     Union[int, str] = 700,
    height:    Union[int, str] = 500,
) -> QEPlot:
    """
    Convert a fitted pyENA model to a :class:`QEPlot`.

    Python equivalent of R's ``qe_extract()`` — reads nodes, unit positions,
    edge weights, and group metadata directly from a fitted ``pyena.ENA``
    instance.

    Parameters
    ----------
    model     A fitted ``pyena.ENA`` instance (after ``.fit()``).
    group_col Grouping column name in ``model.accum_.meta``
              (e.g. ``"Condition"``).
    directed  ``True`` for ONA / directed networks.
    id_col    Name to give the unit-identifier column.
    title, width, height
              Passed to the returned :class:`QEPlot`.

    Returns
    -------
    QEPlot

    Examples
    --------
    ::

        p = qeviz.from_pyena(model, group_col="Condition")
        p.edges("FirstGame", also="SecondGame").points()  # auto-displays in Jupyter
        p.export_html("output.html")
    """
    # Nodes: code name + (x, y)
    nodes_df = pd.DataFrame({
        "code": model.codes_,
        "x":    model.positions_[:, 0],
        "y":    model.positions_[:, 1],
    })

    # Edges: normalised connection weights, "&" → "." separator
    conn_cols = [c.replace("&", ".") for c in model.connection_names_]
    edges_df  = pd.DataFrame(model.normed_networks_, columns=conn_cols)
    edges_df.insert(0, id_col, model.units_)

    # Points: projected (x, y) per unit
    points_df = pd.DataFrame({
        id_col: model.units_,
        "x":    model.points_[:, 0],
        "y":    model.points_[:, 1],
    })

    # Attach group from unit-level metadata
    if group_col is not None:
        meta = model.accum_.meta
        if group_col not in meta.columns:
            raise ValueError(
                f"group_col {group_col!r} not found in model metadata. "
                f"Available columns: {list(meta.columns)}"
            )
        group_vals = meta.reindex(model.units_)[group_col].tolist()
        points_df[group_col] = group_vals
        edges_df[group_col]  = group_vals

    m = model_data(
        nodes       = nodes_df,
        edges       = edges_df,
        points      = points_df,
        id_col      = id_col,
        node_id_col = "code",
        x_col       = "x",
        y_col       = "y",
        group_col   = group_col,
        directed    = directed,
    )
    return QEPlot(m, title=title, width=width, height=height)


def export_html(
    model_or_plot: Union[dict, QEPlot],
    path: str,
    options: Optional[dict] = None,
    width:  Union[int, str] = 700,
    height: Union[int, str] = 500,
) -> str:
    """
    Write a self-contained HTML file.

    Accepts either a :class:`QEPlot` **or** a raw ModelData dict (legacy).
    When a dict is supplied ``options`` / ``width`` / ``height`` are forwarded
    to construct a temporary :class:`QEPlot`.

    Returns the resolved absolute path of the written file.
    """
    if isinstance(model_or_plot, QEPlot):
        return model_or_plot.export_html(path)

    # Legacy: raw dict path
    p = QEPlot(model_or_plot, width=width, height=height)
    if options:
        # Map old flat options dict onto chain methods for backward compat.
        group   = options.get("group")
        unit    = options.get("unit")
        compare = options.get("compare")
        also    = options.get("also")
        if group or unit or compare or also:
            p = p.edges(group=group, unit=unit, compare=compare, also=also)
        if options.get("show_points"):
            p = p.points(True)
    return p.export_html(path)


__all__ = [
    "QEPlot",
    "model_data",
    "plot",
    "from_pyena",
    "export_html",
]
