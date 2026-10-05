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
Optional : IPython (Jupyter inline display)
           pyENA  (for :func:`from_pyena`)
"""

from __future__ import annotations

import copy
import json
import math
import os
import re
import time
from typing import Any, Optional, Sequence, Union

import pandas as pd


# The chain methods below follow the R package (R/R/render.R) line for line:
# the same option names, the same validation and the same <qe-graph> markup,
# so a plot built in Python matches one built in R (tests/golden/).

_UNSET: Any = object()   # "argument not supplied" (qe_labels() semantics)

#: Paul Tol's "bright" scheme, the renderer's default palette.
_PALETTE = ["#4477AA", "#EE6677", "#228833", "#CCBB44",
            "#66CCEE", "#AA3377", "#BBBBBB", "#000000"]


def palette() -> list:
    """The default qeviz colour palette (Paul Tol "bright"), as in R's ``qe_palette()``."""
    return list(_PALETTE)


# ── Internal helpers ───────────────────────────────────────────────────────────

def _is_na(v: Any) -> bool:
    return v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v)))


def _native(v: Any) -> Any:
    """numpy scalar → Python native; NaN / inf → None."""
    if hasattr(v, "item") and not isinstance(v, (list, dict, str)):
        v = v.item()
    return None if _is_na(v) else v


def _value_type(values: list) -> str:
    """R's qe_frame() column type, inferred from the non-missing values."""
    vals = [v for v in values if not _is_na(v)]
    if not vals:
        return "logical"            # an all-NA column, as R types it
    if all(isinstance(v, bool) for v in vals):
        return "logical"
    if all(isinstance(v, int) and not isinstance(v, bool) for v in vals):
        return "integer"
    if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in vals):
        return "numeric"
    return "character"


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
        data.append({col: _native(val) for col, val in row.items()})
    return {"data": data, "types": types}


def _frame_from_rows(rows: list, cols: Optional[list] = None) -> dict:
    """A QEFrame from row dicts; missing values are padded as None."""
    if cols is None:
        cols = []
        for r in rows:
            cols += [k for k in r if k not in cols]
    data = [{k: _native(r.get(k)) for k in cols} for r in rows]
    types = {k: _value_type([r[k] for r in data]) for k in cols}
    return {"data": data, "types": types}


def _frame_rows(frame: Optional[dict]) -> list:
    return [dict(r) for r in (frame or {}).get("data", [])]


def _upsert_rows(frame: Optional[dict], rows: list, key: Optional[str] = None,
                 drop=None) -> dict:
    """R's .qe_upsert_rows(): replace rows sharing ``key`` (or matching
    ``drop``), append ``rows``, pad missing columns."""
    old = _frame_rows(frame)
    if old:
        if drop is not None:
            old = [r for r in old if not drop(r)]
        else:
            new_keys = {r.get(key) for r in rows}
            old = [r for r in old if r.get(key) not in new_keys]
    cols = list((frame or {}).get("types", {}).keys()) if old else []
    for r in rows:
        cols += [k for k in r if k not in cols]
    return _frame_from_rows(old + rows, cols)


def _fmt(v: Any) -> str:
    """Format an attribute value as R's as.character() does."""
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else f"{v:.15g}"
    return str(v)


def _esc(v: Any) -> str:
    return _fmt(v).replace("&", "&amp;").replace("<", "&lt;").replace('"', "&quot;")


# ── Student t quantile (exact, no scipy) ──────────────────────────────────────

def _betacf(a: float, b: float, x: float) -> float:
    """Continued fraction for the regularized incomplete beta (Lentz)."""
    tiny, eps = 1e-300, 1e-16
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    d = 1.0 / (d if abs(d) > tiny else tiny)
    h = d
    for m in range(1, 1000):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d; d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c; c = c if abs(c) > tiny else tiny
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d; d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c; c = c if abs(c) > tiny else tiny
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < eps:
            break
    return h


def _betainc(a: float, b: float, x: float) -> float:
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    lbt = (math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
           + a * math.log(x) + b * math.log1p(-x))
    if x < (a + 1.0) / (a + b + 2.0):
        return math.exp(lbt) * _betacf(a, b, x) / a
    return 1.0 - math.exp(lbt) * _betacf(b, a, 1.0 - x) / b


def _t_cdf(t: float, df: float) -> float:
    x = df / (df + t * t)
    tail = 0.5 * _betainc(df / 2.0, 0.5, x)
    return 1.0 - tail if t > 0 else tail


def _t_quantile(p: float, df: int) -> float:
    """Quantile of Student's t, as R's ``qt(p, df)`` (to ~1e-14)."""
    if not 0.0 < p < 1.0:
        raise ValueError("_t_quantile(): p must be in (0, 1).")
    if p == 0.5:
        return 0.0
    if p < 0.5:
        return -_t_quantile(1.0 - p, df)
    lo, hi = 0.0, 1.0
    while _t_cdf(hi, df) < p:
        hi *= 2.0
    for _ in range(200):                     # bisection to machine precision
        mid = 0.5 * (lo + hi)
        if _t_cdf(mid, df) < p:
            lo = mid
        else:
            hi = mid
        if hi - lo <= 1e-15 * max(1.0, hi):
            break
    return 0.5 * (lo + hi)


def _quantile7(v: list, q: float) -> float:
    """R's default quantile (type 7)."""
    s = sorted(v)
    h = (len(s) - 1) * q
    lo = math.floor(h)
    return s[lo] + (h - lo) * (s[min(lo + 1, len(s) - 1)] - s[lo])


def _group_summary(rows: list, x_col: str, y_col: str, group_col: str,
                   conf_level: float = 0.95, outlier: bool = False) -> list:
    """R's group_summary(): per-group mean, t CI and (optionally) the outlier
    interval Q1 − 1.5·IQR … Q3 + 1.5·IQR, one row dict per sorted group."""
    groups = sorted({str(r[group_col]) for r in rows if not _is_na(r.get(group_col))})
    out = []
    for g in groups:
        sub = [r for r in rows if str(r.get(group_col)) == g]
        n = len(sub)
        t_v = _t_quantile((1 + conf_level) / 2, max(1, n - 1))
        row: dict = {group_col: g}
        stats = {}
        for d in (x_col, y_col):
            v = [float(r[d]) for r in sub if not _is_na(r.get(d))]
            m = sum(v) / len(v) if v else float("nan")
            sd = (math.sqrt(sum((a - m) ** 2 for a in v) / (len(v) - 1))
                  if len(v) > 1 else float("nan"))
            stats[d] = (v, m, sd / math.sqrt(n))
            row[d] = m
        for d in (x_col, y_col):
            _, m, se = stats[d]
            row[f"{d}.low"] = m - t_v * se
            row[f"{d}.high"] = m + t_v * se
        if outlier:
            for d in (x_col, y_col):
                v = stats[d][0]
                q1, q3 = _quantile7(v, 0.25), _quantile7(v, 0.75)
                row[f"{d}.olow"] = q1 - 1.5 * (q3 - q1)
                row[f"{d}.ohigh"] = q3 + 1.5 * (q3 - q1)
        out.append(row)
    return out


def _group_summaries(points_df: pd.DataFrame, group_col: str, dim_cols: list,
                     conf_level: float = 0.95, include_ci: bool = True,
                     outlier: bool = False) -> pd.DataFrame:
    """Per-group means with t CI bounds (and outlier fences), as a DataFrame."""
    rows = _group_summary(points_df.to_dict("records"), dim_cols[0], dim_cols[1],
                          group_col, conf_level=conf_level, outlier=outlier)
    df = pd.DataFrame(rows)
    if not include_ci:
        df = df[[c for c in df.columns if not c.endswith((".low", ".high"))]]
    return df


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


def _check_range(range_: Any, fn: str) -> None:
    if isinstance(range_, (list, tuple, dict)):
        raise ValueError(f'{fn}(): only symmetric ranges are supported: "network", "points" or a number.')
    if range_ is not None and not (
        range_ in ("network", "points")
        or (isinstance(range_, (int, float)) and not isinstance(range_, bool)
            and math.isfinite(range_) and range_ > 0)
    ):
        raise ValueError(f'{fn}(): range must be "network", "points" or a positive number.')


_SHAPES = {"circle": "circle", "square": "rect", "rect": "rect", "triangle": "triangle",
           "triangle-up": "triangle", "diamond": "diamond"}


def _shape(shape: Union[str, Sequence[str]], fn: str) -> Union[str, list]:
    vals = [shape] if isinstance(shape, str) else list(shape)
    bad = [s for s in vals if s not in _SHAPES]
    if bad:
        raise ValueError(f'{fn}(): shape must be "circle", "square", "triangle" or "diamond".')
    out = [_SHAPES[s] for s in vals]
    return out[0] if isinstance(shape, str) else out


def _norm_names(names: list) -> list:
    return [str(n).replace(" & ", ".") for n in names]


def _numeric_frame(x: Any) -> pd.DataFrame:
    df = x if isinstance(x, pd.DataFrame) else pd.DataFrame(x)
    return df.select_dtypes("number")


# ── QEPlot ─────────────────────────────────────────────────────────────────────

class QEPlot:
    """
    A lazily-rendered qeviz plot.

    Created by :func:`plot` or :func:`from_pyena`. Chain :meth:`edges`,
    :meth:`points`, :meth:`group`, :meth:`nodes`, :meth:`labels` and friends
    to build the view; they mirror the R package's ``qe_*()`` functions.

    Display options:

    * Evaluate the object as the last expression in a Jupyter cell — the
      ``_repr_html_`` hook triggers automatic inline display.
    * Call :meth:`show` explicitly to display in IPython / Jupyter.
    * Call :meth:`export_html` to write a self-contained ``.html`` file.

    All chain methods return a *new* ``QEPlot``: the original is unchanged, so
    several views can branch from a common base. Methods that add data (an
    explicit network, point set or mean) copy the model frames they change.
    """

    def __init__(
        self,
        model: dict,
        title: Optional[str] = None,
        width: Union[int, str] = 700,
        height: Union[int, str] = 500,
        *,
        range: Union[str, float, None] = None,
        scale_points: bool = True,
        point_scale: Optional[float] = None,
        center: str = "origin",
        palette: Optional[Sequence[str]] = None,
    ) -> None:
        if center not in ("origin", "content"):
            raise ValueError('plot(): center must be "origin" or "content".')
        if point_scale is not None and not (
            isinstance(point_scale, (int, float)) and math.isfinite(point_scale) and point_scale > 0
        ):
            raise ValueError("plot(): point_scale must be a positive number.")
        _check_range(range, "plot")
        if palette is not None and (isinstance(palette, str) or not len(palette)):
            raise ValueError("plot(): palette must be a list of colours.")
        self._model = dict(model)
        if palette is not None:
            self._model["palette"] = [str(c) for c in palette]
        # Window / file title; the drawn plot title only when one is given.
        self._title = title if title is not None else "qeviz"
        self._width = str(width) if isinstance(width, str) else f"{width}px"
        self._height = str(height) if isinstance(height, str) else f"{height}px"
        self._opts: dict = {}
        if title is not None:
            self._opts["plot-title"] = title
        if range is not None:
            self._opts["range"] = range
        if scale_points is False:
            self._opts["scale-points"] = "false"
        if center == "content":
            self._opts["center"] = "content"
        if point_scale is not None:
            self._opts["point-scale"] = point_scale

    # ── Model access ───────────────────────────────────────────────────────────

    @property
    def model(self) -> dict:
        """The raw ModelData dict (nodes, edges, points, groups, …)."""
        return self._model

    def _copy(self) -> "QEPlot":
        """A copy with independent options. The model dict is copied shallowly:
        frames are replaced, never edited in place, so copies stay separate."""
        p = QEPlot.__new__(QEPlot)
        p._model = dict(self._model)
        p._title = self._title
        p._width = self._width
        p._height = self._height
        p._opts = copy.deepcopy(self._opts)
        return p

    # ── Introspection ──────────────────────────────────────────────────────────

    def _group_key(self) -> str:
        return self._model.get("group_col") or "group"

    def groups(self) -> list:
        """Group names in the model's groups frame (named and explicit means)."""
        frame = self._model.get("groups")
        if not frame:
            return []
        key = self._group_key()
        result = []
        for row in frame.get("data", []):
            val = row.get(key)
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
        return [str(row[id_col]) for row in frame.get("data", []) if id_col in row]

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

    # ── Internal: data helpers ─────────────────────────────────────────────────

    def _edge_columns(self) -> list:
        m = self._model
        node_id = m.get("node_id_col") or "code"
        codes = [str(r[node_id]) for r in m["nodes"]["data"]]
        pairs = {f"{a}.{b}" for a in codes for b in codes}
        return [c for c in m["edges"]["types"] if c in pairs]

    def _resolve_weights(self, x: Any, cols: list, arg: str) -> dict:
        """Weights as {edge column: value} over every model edge column."""
        if isinstance(x, pd.Series):
            named = dict(zip(_norm_names(list(x.index)), [float(v) for v in x.values]))
        elif isinstance(x, dict):
            named = dict(zip(_norm_names(list(x.keys())), [float(v) for v in x.values()]))
        elif isinstance(x, pd.DataFrame) or getattr(x, "ndim", 1) == 2:
            df = _numeric_frame(x)
            means = df.mean(axis=0)
            if isinstance(x, pd.DataFrame):
                named = dict(zip(_norm_names(list(df.columns)), [float(v) for v in means]))
            elif df.shape[1] == len(cols):
                named = dict(zip(cols, [float(v) for v in means]))
            else:
                raise ValueError(
                    f"edges(): unnamed '{arg}' has {df.shape[1]} columns; "
                    f"the model has {len(cols)} edge columns.")
        else:
            vals = [float(v) for v in x]
            if len(vals) != len(cols):
                raise ValueError(
                    f"edges(): unnamed '{arg}' has {len(vals)} values; "
                    f"the model has {len(cols)} edge columns.")
            named = dict(zip(cols, vals))
        unknown = [k for k in named if k not in cols]
        if unknown:
            raise ValueError(
                f"edges(): '{arg}' has edges not in the model: {', '.join(unknown[:3])}\n"
                f"Examples of valid names: {', '.join(cols[:3])}")
        return {c: named.get(c, 0.0) for c in cols}

    def _group_network(self, group: str, cols: list) -> dict:
        gcol = self._model.get("group_col")
        rows = [r for r in self._model["edges"]["data"] if str(r.get(gcol)) == group]
        if not rows:
            raise ValueError(f"edges(): compare = {group!r} not found in model.")
        return {c: sum(float(r[c]) for r in rows) / len(rows) for c in cols}

    def _point_frame(self, x: Any) -> list:
        """R's .qe_point_frame(): id + the model's x / y (+ group) per row."""
        m = self._model
        id_col, x_col, y_col = m.get("id_col") or "QEUNIT", m["x_col"], m["y_col"]
        df = x if isinstance(x, pd.DataFrame) else pd.DataFrame(x)
        df = df.loc[:, ~df.columns.duplicated()]
        num = list(df.select_dtypes("number").columns)
        dims = [x_col, y_col] if x_col in num and y_col in num else num[:2]
        if len(num) < 2:
            raise ValueError("need at least two numeric (dimension) columns in 'points'.")
        if id_col in df.columns:
            ids = [str(v) for v in df[id_col]]
        elif isinstance(df.index, pd.RangeIndex):
            ids = [str(i + 1) for i in range(len(df))]
        else:
            ids = [str(v) for v in df.index]
        gcol = m.get("group_col")
        rows = []
        for i in range(len(df)):
            r = {id_col: ids[i], x_col: float(df[dims[0]].iloc[i]), y_col: float(df[dims[1]].iloc[i])}
            if gcol and gcol in df.columns:
                r[gcol] = str(df[gcol].iloc[i])
            rows.append(r)
        return rows

    def _update_groups_filter(self) -> None:
        named = self._opts.get("groups-named")
        expl = self._opts.get("groups-explicit") or []
        if not expl:
            groups = ",".join(named) if named else None
        elif named is None:
            groups = ",".join(expl)
        elif not named:
            groups = None
        else:
            groups = ",".join(list(named) + list(expl))
        self._set("groups", groups)

    def _set(self, key: str, value: Any) -> None:
        """Set an option; ``None`` removes it (as assigning NULL does in R)."""
        if value is None:
            self._opts.pop(key, None)
        else:
            self._opts[key] = value

    # ── Chain methods ──────────────────────────────────────────────────────────

    def group(
        self,
        *names: str,
        points: Any = None,
        label: Optional[str] = None,
        color: Optional[str] = None,
        shape: Optional[str] = None,
        by: Optional[str] = None,
        intervals: Union[str, bool] = "box",
        conf_level: float = 0.95,
        outlier: bool = False,
        fixed_size: bool = False,
        show: bool = True,
    ) -> "QEPlot":
        """
        Group means: by name, or the mean of any subset of points.

        Pass group names to show only those groups' means; omit names to show
        every group. ``points`` (a DataFrame / array of positions) instead adds
        the mean of that subset, with its own t interval, as a mean named
        ``label`` (default ``"mean 1"``, ``"mean 2"``, …); each such mean keeps
        its own ``intervals`` / ``outlier`` setting. ``show=False`` hides all
        means. Mirrors R's ``qe_group()``.

        Parameters
        ----------
        intervals   ``"box"`` (default), ``"crosshairs"`` or ``"none"``;
                    ``True`` / ``False`` mean ``"box"`` / ``"none"``.
        conf_level  Confidence level of the t interval. Default 0.95.
        outlier     Also draw the outlier interval (Q1 − 1.5·IQR … Q3 + 1.5·IQR).
        color, shape
                    Colour and marker shape (``"square"``, ``"circle"``,
                    ``"triangle"``, ``"diamond"``) of an explicit mean.
        fixed_size  Keep mean markers a constant on-screen pixel size.
        """
        p = self._copy()
        if not show:
            p._opts["means-show"] = False
            return p
        p._opts.pop("means-show", None)

        if by is not None:
            gcol = p._model.get("group_col")
            if gcol is not None and by != gcol:
                raise ValueError(
                    f"group(): by = {by!r} does not match the model's group column ({gcol!r}).")
        if isinstance(intervals, bool):
            intervals = "box" if intervals else "none"
        if intervals not in ("box", "crosshairs", "none"):
            raise ValueError('group(): intervals must be "box", "crosshairs" or "none".')
        if not (isinstance(conf_level, (int, float)) and 0 < conf_level < 1):
            raise ValueError("group(): conf_level must be a number in (0, 1).")
        if points is not None and names:
            raise ValueError("group(): supply group names or 'points', not both.")

        p._opts["intervals"] = intervals
        p._opts["confidence"] = intervals != "none"
        p._opts["mean-outlier"] = bool(outlier) or bool(p._opts.get("mean-outlier"))
        p._opts["mean-fixed-size"] = bool(fixed_size)

        m = p._model
        if points is not None:
            # ── Explicit: the mean (+ t CI, outlier fences) of a subset ──────
            rows = p._point_frame(points)
            expl = p._opts.get("groups-explicit") or []
            lbl = label if label is not None else f"mean {len(expl) + 1}"
            if lbl in p.groups() and lbl not in expl:
                raise ValueError(f"group(): label {lbl!r} is already a group in the model.")
            gkey = p._group_key()
            for r in rows:
                r[gkey] = lbl
            row = _group_summary(rows, m["x_col"], m["y_col"], gkey,
                                 conf_level=conf_level, outlier=outlier)[0]
            if color is not None:
                row["color"] = color
            if shape is not None:
                row["shape"] = _shape(shape, "group")
            row["intervals"] = intervals
            row["outlier"] = bool(outlier)
            m["groups"] = _upsert_rows(m.get("groups"), [row], key=gkey)
            p._opts["groups-explicit"] = expl + ([lbl] if lbl not in expl else [])
        else:
            # ── By name ──────────────────────────────────────────────────────
            if names:
                available = p.groups()
                bad = [n for n in names if n not in available]
                if bad:
                    raise ValueError(
                        f"group(): group(s) not found in model: {bad!r}\n"
                        f"Available: {available!r}")
            p._opts["groups-named"] = [str(n) for n in names]   # [] = all
            if (conf_level != 0.95 or outlier) and m.get("points"):
                rows = _group_summary(_frame_rows(m["points"]), m["x_col"], m["y_col"],
                                      m.get("group_col"), conf_level=conf_level,
                                      outlier=outlier)
                m["groups"] = _upsert_rows(m.get("groups"), rows, key=m.get("group_col"))
        p._update_groups_filter()
        return p

    def edges(
        self,
        group: Optional[str] = None,
        *,
        unit: Optional[str] = None,
        weights: Any = None,
        compare: Any = None,
        also: Optional[str] = None,
        colors: Union[str, Sequence[str], None] = None,
        threshold: Union[float, Sequence[float], None] = None,
        name: Optional[str] = None,
        show: bool = True,
        color_scale: str = "model",
        edge_width: Optional[float] = None,
        magnify: Optional[float] = None,
    ) -> "QEPlot":
        """
        Draw an edge network: a group's or unit's (by name), or explicit weights.

        By name, ``group`` (a group's mean network) or ``unit`` (one unit's
        network), with ``compare`` (subtract a second group) or ``also``
        (overlay it); a second call replaces it. ``weights`` instead draws a
        network from data: a Series / dict of edge weights, an unnamed list in
        the model's edge-column order, a DataFrame / 2-D array (averaged over
        rows), or a list of those (one layer each); ``compare`` then subtracts a
        group name or a second set of weights. Every ``weights`` call adds a
        layer; one with the same ``name`` replaces it. ``show=False`` removes
        all networks. Mirrors R's ``qe_edges()``.

        Parameters
        ----------
        colors      One or two colours (positive, negative); with one, negative
                    weights use its complement.
        threshold   ``min`` or ``(min, max)``: |weight| < min is not drawn,
                    |weight| > max is drawn at max (sign kept).
        name        Name for this network (reported in edge events).
        color_scale ``"model"`` (default), ``"plot"`` or ``"absolute"``: how
                    weights map onto webENA's colour ramps.
        edge_width  Width of a weight-1 edge as a fraction of the plot width
                    (qeviz default 0.04).
        magnify     Multiply this plot's edge widths and node sizes (not
                    colour); labelled "(scaled N.Nx)" whenever set.
        """
        if group is not None and unit is not None:
            raise ValueError("edges(): supply either 'group' or 'unit', not both.")
        if weights is not None and (group is not None or unit is not None):
            raise ValueError("edges(): supply 'weights' or a 'group' / 'unit' name, not both.")

        p = self._copy()
        if not show:
            p._opts["edges"] = "false"
            for k in ("group", "unit", "compare", "also", "edge-named", "edge-layers"):
                p._opts.pop(k, None)
            p._model.pop("networks", None)
            return p

        if color_scale not in ("model", "plot", "absolute"):
            raise ValueError('edges(): color_scale must be "model", "plot", or "absolute".')
        if edge_width is not None and not (0 < edge_width <= 1):
            raise ValueError("edges(): edge_width must be a number in (0, 1].")
        if magnify is not None and not (math.isfinite(magnify) and magnify > 0):
            raise ValueError("edges(): magnify must be a positive number.")
        layer_attrs = _layer_attrs(colors, threshold)

        p._opts["edges"] = True
        p._set("edge-color-scale", None if color_scale == "model" else color_scale)
        if edge_width is not None:
            p._opts["edge-width"] = edge_width
        if magnify is not None:
            p._opts["edge-magnify"] = magnify

        # ── Explicit data: append one layer per network ──────────────────────
        if weights is not None:
            if also is not None:
                raise ValueError("edges(): 'also' takes group names; for data, pass a list to 'weights'.")
            cols = p._edge_columns()
            many = isinstance(weights, (list, tuple)) and weights and not isinstance(
                weights[0], (int, float))
            nets = list(weights) if many else [weights]
            base = len(p._opts.get("edge-layers") or [])
            for k, net in enumerate(nets, start=1):
                w = p._resolve_weights(net, cols, "weights")
                if compare is not None:
                    c = (p._group_network(compare, cols) if isinstance(compare, str)
                         else p._resolve_weights(compare, cols, "compare"))
                    w = {e: w[e] - c[e] for e in cols}
                lname = name if (name is not None and len(nets) == 1) else f"network {base + k}"
                p._model["networks"] = _append_network(p._model.get("networks"), lname, w)
                p._opts["edge-layers"] = (p._opts.get("edge-layers") or []) + [
                    {"network": lname, **layer_attrs}]
            return p

        # ── By name: replace the named network ───────────────────────────────
        available_groups = p.groups()

        def _check_group(nm: Optional[str], arg: str) -> None:
            if nm is not None and nm not in available_groups:
                raise ValueError(
                    f"edges(): {arg} = {nm!r} not found in model.\n"
                    f"Available groups: {available_groups!r}")

        if compare is not None and not isinstance(compare, str):
            raise ValueError("edges(): 'compare' as data needs 'weights'; with 'group' it takes a group name.")
        _check_group(group, "group")
        _check_group(compare, "compare")
        _check_group(also, "also")
        if unit is not None and unit not in p.units():
            raise ValueError(
                f"edges(): unit = {unit!r} not found in model.\n"
                "Use .units() to see available unit IDs.")
        if compare is not None and also is not None:
            raise ValueError("edges(): supply either 'compare' or 'also', not both.")
        if unit is not None and (compare is not None or also is not None):
            raise ValueError("edges(): 'compare' and 'also' cannot be combined with 'unit'.")

        p._set("group", group)
        p._set("unit", unit)
        p._set("compare", compare)
        p._set("also", also)
        named = ({"name": name} if name is not None else {}) | layer_attrs
        p._set("edge-named", named or None)
        return p

    def points(
        self,
        show: bool = True,
        *,
        units: Optional[Sequence[str]] = None,
        points: Any = None,
        color: Union[str, Sequence[str], None] = None,
        shape: Union[str, Sequence[str], None] = None,
        labels: Union[str, Sequence[str], None] = None,
        name: Optional[str] = None,
        size: Optional[Union[int, float]] = None,
        fixed_size: bool = False,
    ) -> "QEPlot":
        """
        Unit points: all of them (coloured by group), or an explicit point set.

        With no ``units`` / ``points``, shows every unit point. ``units`` (unit
        IDs) or ``points`` (a DataFrame / array of positions) instead adds a
        point set with optional ``color``, ``shape`` (``"circle"``,
        ``"square"``, ``"triangle"``, ``"diamond"``) and ``labels``, one value
        or one per point. Each set adds a layer; one with the same ``name``
        replaces it. ``show=False`` hides all points. ``size`` overrides the
        dot size (default 2.5); ``fixed_size`` keeps dots a constant on-screen
        size. Mirrors R's ``qe_points()``.
        """
        p = self._copy()
        if not show:
            p._opts["points"] = False
            p._opts.pop("point-sets", None)
            p._model.pop("pointsets", None)
            return p
        if units is None and points is None:
            p._opts["points"] = True
            p._set("point-size", size)
            p._opts["point-fixed-size"] = bool(fixed_size)
            return p
        if units is not None and points is not None:
            raise ValueError("points(): supply 'units' or 'points', not both.")

        m = p._model
        id_col = m.get("id_col") or "QEUNIT"
        gcol = m.get("group_col")
        if units is not None:
            units = [units] if isinstance(units, str) else list(units)
            all_rows = {str(r.get(id_col)): r for r in _frame_rows(m.get("points"))}
            bad = [u for u in units if u not in all_rows]
            if bad:
                raise ValueError(f"points(): unit(s) not in model: {bad[:3]!r}")
            rows = [all_rows[u] for u in units]
        else:
            rows = p._point_frame(points)

        n = len(rows)
        sets = p._opts.get("point-sets") or []
        set_name = name if name is not None else f"points {len(sets) + 1}"

        def per_point(v: Any, arg: str) -> Optional[list]:
            if v is None:
                return None
            vals = [v] if isinstance(v, str) else list(v)
            if len(vals) not in (1, n):
                raise ValueError(f"points(): '{arg}' must have length 1 or {n}.")
            return [str(x) for x in (vals * n if len(vals) == 1 else vals)]

        cols = per_point(color, "color")
        shapes = per_point(None if shape is None else _shape(shape, "points"), "shape")
        labs = per_point(labels, "labels")
        new = []
        for i, r in enumerate(rows):
            row = {"set": set_name, "id": str(r[id_col]),
                   m["x_col"]: r[m["x_col"]], m["y_col"]: r[m["y_col"]]}
            if gcol and gcol in r:
                row["group"] = str(r[gcol])
            if cols:
                row["color"] = cols[i]
            if shapes:
                row["shape"] = shapes[i]
            if labs:
                row["label"] = labs[i]
            new.append(row)
        m["pointsets"] = _upsert_rows(m.get("pointsets"), new,
                                      drop=lambda r: r.get("set") == set_name)
        p._opts["point-sets"] = [s for s in sets if s["set"] != set_name] + [
            {"set": set_name, "size": size, "fixed": bool(fixed_size)}]
        return p

    def nodes(
        self,
        show: Union[bool, str] = "auto",
        unconnected: str = "dot",
        *,
        positions: Any = None,
        labels: Optional[dict] = None,
    ) -> "QEPlot":
        """
        Code nodes: when to draw them, and where.

        ``"auto"`` (default) draws nodes only with an edge network, matching
        rENA; ``"always"`` / ``True`` and ``"never"`` / ``False`` override that.
        ``unconnected="hide"`` hides nodes with no drawn edges. ``positions``
        (a DataFrame with a code column or index, and x / y columns) moves
        nodes; ``labels`` (``{code: text}``) relabels them. Mirrors R's
        ``qe_nodes()``.
        """
        if show is True:
            show = "always"
        elif show is False:
            show = "never"
        if show not in ("auto", "always", "never"):
            raise ValueError('nodes(): show must be "auto", "always", or "never".')
        if unconnected not in ("dot", "hide"):
            raise ValueError('nodes(): unconnected must be "dot" or "hide".')
        p = self._copy()
        p._opts["nodes-show"] = show
        p._set("nodes-unconnected", "hide" if unconnected == "hide" else None)

        if positions is not None or labels is not None:
            m = p._model
            idc = m.get("node_id_col") or "code"
            rows = _frame_rows(m["nodes"])
            codes = [str(r[idc]) for r in rows]

            def check(got: list, arg: str) -> None:
                bad = [g for g in got if g not in codes]
                if bad:
                    raise ValueError(
                        f"nodes(): '{arg}' has codes not in the model: {bad[:3]!r}\n"
                        f"Model codes: {codes[:4]!r}")

            if positions is not None:
                pos = positions if isinstance(positions, pd.DataFrame) else pd.DataFrame(positions)
                if idc in pos.columns:
                    pc = [str(v) for v in pos[idc]]
                elif "code" in pos.columns:
                    pc = [str(v) for v in pos["code"]]
                elif not isinstance(pos.index, pd.RangeIndex):
                    pc = [str(v) for v in pos.index]
                else:
                    raise ValueError("nodes(): 'positions' needs a code column or index.")
                num = list(pos.select_dtypes("number").columns)
                dims = [m["x_col"], m["y_col"]] if m["x_col"] in num and m["y_col"] in num else num[:2]
                if len(num) < 2:
                    raise ValueError("nodes(): 'positions' needs two numeric (x, y) columns.")
                check(pc, "positions")
                for i, code in enumerate(pc):
                    r = rows[codes.index(code)]
                    r[m["x_col"]] = float(pos[dims[0]].iloc[i])
                    r[m["y_col"]] = float(pos[dims[1]].iloc[i])
            if labels is not None:
                if not isinstance(labels, dict):
                    raise ValueError("nodes(): 'labels' must be a dict (code -> text).")
                check(list(labels), "labels")
                for r in rows:
                    r.setdefault("label", None)
                for code, text in labels.items():
                    rows[codes.index(str(code))]["label"] = str(text)
            m["nodes"] = _frame_from_rows(rows, list(m["nodes"]["types"]) + (
                ["label"] if labels is not None and "label" not in m["nodes"]["types"] else []))
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
            p._opts["axes"] = False
            return p
        p._opts["axes"] = True
        p._opts["axis-x"] = x
        p._opts["axis-y"] = y
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
            p._opts["trajectories"] = False
            return p
        if smooth not in {"none", "poly"}:
            raise ValueError("trajectories(): smooth must be 'none' or 'poly'.")
        if degree_selection not in {"loocv_2d", "fixed"}:
            raise ValueError("trajectories(): degree_selection must be 'loocv_2d' or 'fixed'.")
        if line_style not in {"uniform", "tapered"}:
            raise ValueError("trajectories(): line_style must be 'uniform' or 'tapered'.")
        selected = None if units is None else ([units] if isinstance(units, str) else [str(u) for u in units])
        if selected:
            available = self.trajectory_units()
            bad = [u for u in selected if u not in available]
            if bad:
                raise ValueError(
                    f"trajectories(): unit(s) not found in model: {bad!r}\n"
                    f"Available: {available!r}")
        p._opts["trajectories"] = True
        p._set("trajectory-units", None if selected is None else ",".join(selected))
        p._opts["trajectory-smooth"] = smooth
        p._opts["trajectory-max-degree"] = int(max_degree)
        p._opts["trajectory-degree-selection"] = degree_selection
        p._opts["trajectory-points"] = bool(points)
        p._opts["trajectory-tips"] = bool(tips)
        p._set("trajectory-playhead", playhead)
        p._opts["trajectory-line-style"] = line_style
        p._opts["trajectory-stroke-width"] = stroke_width
        p._opts["trajectory-stroke-width-range"] = ",".join(_fmt(v) for v in stroke_width_range)
        p._opts["trajectory-opacity-range"] = ",".join(_fmt(v) for v in opacity_range)
        return p

    def labels(
        self,
        nodes: str = _UNSET,
        means: str = _UNSET,
        points: str = _UNSET,
        *,
        font_size: Optional[float] = _UNSET,
        font_family: Optional[str] = _UNSET,
        font_color: Optional[str] = _UNSET,
    ) -> "QEPlot":
        """
        Label visibility and font.

        ``nodes`` / ``means`` / ``points`` take ``"on"``, ``"off"``,
        ``"click"`` or ``"auto"``; ``font_size`` is in pixels (the title is
        drawn at 1.35×), ``font_family`` and ``font_color`` apply to labels and
        the title. Only the arguments supplied change; a bare ``labels()``
        applies the defaults (``"on"``, ``"on"``, ``"auto"``). Mirrors R's
        ``qe_labels()``.
        """
        if font_size is not _UNSET and font_size is not None and not (
            isinstance(font_size, (int, float)) and font_size > 0
        ):
            raise ValueError("labels(): font_size must be a positive number of pixels.")
        p = self._copy()
        bare = all(v is _UNSET for v in (nodes, means, points, font_size, font_family, font_color))
        for key, val, default in (("label-nodes", nodes, "on"), ("label-means", means, "on"),
                                  ("label-points", points, "auto")):
            if val is not _UNSET:
                p._set(key, val)
            elif bare:
                p._opts[key] = default
        for key, val in (("label-font-size", font_size), ("label-font-family", font_family),
                         ("label-font-color", font_color)):
            if val is not _UNSET:
                p._set(key, val)
        return p

    def colors(self, mapping: Optional[dict] = None, **colors: str) -> "QEPlot":
        """
        Pin groups to colours: ``.colors(FirstGame="#E69F00")`` or
        ``.colors({"First Game": "#E69F00"})``. Each group's mean, unit points
        and networks use it; unlisted groups keep the palette colour. Mirrors
        R's ``qe_colors()``.
        """
        cols = {**(mapping or {}), **colors}
        if not cols:
            raise ValueError('colors(): give named colours, e.g. .colors(FirstGame="#E69F00").')
        bad = [g for g in cols if g not in self.groups()]
        if bad:
            raise ValueError(f"colors(): group(s) not found in model: {bad!r}")
        p = self._copy()
        rows = _frame_rows(p._model.get("groups"))
        gcol = p._model.get("group_col")
        for r in rows:
            r.setdefault("color", None)
            if str(r.get(gcol)) in cols:
                r["color"] = cols[str(r.get(gcol))]
        names = list(p._model["groups"]["types"])
        p._model["groups"] = _frame_from_rows(rows, names + ([] if "color" in names else ["color"]))
        return p

    def range(self, range: Union[str, float, None]) -> "QEPlot":
        """
        Set the symmetric axis range: ``"network"`` (node extent × 1.2),
        ``"points"`` (unit points' extent × 1.2), a positive number, or ``None``
        for the default. Mirrors R's ``qe_range()``.
        """
        _check_range(range, "range")
        p = self._copy()
        p._set("range", range)
        return p

    # ── HTML rendering ─────────────────────────────────────────────────────────

    def _build_graph_element(self) -> str:
        """``<qe-graph …>…</qe-graph>`` with child layer elements (R's
        ``.build_graph_element()``, line for line)."""
        opts = self._opts
        children: list[str] = []

        # <qe-means>: present unless qe_group(show = FALSE).
        means_parts: list[str] = []
        if opts.get("groups") is not None:
            means_parts.append(f'groups="{opts["groups"]}"')
        if opts.get("confidence") is not False:
            means_parts.append("confidence")
        if opts.get("intervals") is not None and opts["intervals"] != "box":
            means_parts.append(f'intervals="{opts["intervals"]}"')
        if opts.get("mean-outlier") is True:
            means_parts.append("outlier")
        means_parts.append(f'label="{opts.get("label-means", "on")}"')
        if opts.get("mean-fixed-size") is True:
            means_parts.append("fixed-size")
        if opts.get("means-show") is not False:
            children.append(f'    <qe-means {" ".join(means_parts)}></qe-means>')

        # <qe-points>: all unit points, then explicit point sets.
        pt_label = opts.get("label-points", "auto")
        if opts.get("points") is True:
            pt_parts = [f'label="{pt_label}"']
            if opts.get("point-size") is not None:
                pt_parts.append(f'size="{_fmt(opts["point-size"])}"')
            if opts.get("point-fixed-size") is True:
                pt_parts.append("fixed-size")
            children.append(f'    <qe-points {" ".join(pt_parts)}></qe-points>')
        for ps in opts.get("point-sets") or []:
            pt_parts = [f'set="{ps["set"]}"', f'label="{pt_label}"']
            if ps.get("size") is not None:
                pt_parts.append(f'size="{_fmt(ps["size"])}"')
            if ps.get("fixed"):
                pt_parts.append("fixed-size")
            children.append(f'    <qe-points {" ".join(pt_parts)}></qe-points>')

        # <qe-edges>: the named network, then one per explicit layer.
        if opts.get("edges") != "false":
            edge_parts = [f'{k}="{opts[k]}"' for k in ("group", "unit", "compare", "also")
                          if opts.get(k) is not None]
            attr_parts = lambda a: [f'{k}="{_fmt(v)}"' for k, v in a.items()]
            layers: list[list[str]] = []
            if edge_parts:
                layers.append(edge_parts + attr_parts(opts.get("edge-named") or {}))
            for L in opts.get("edge-layers") or []:
                layers.append(attr_parts(L))
            # Plot-wide settings ride on the first layer.
            if layers:
                if opts.get("edge-magnify") is not None:
                    layers[0].append(f'magnify="{_fmt(opts["edge-magnify"])}"')
                if opts.get("edge-color-scale") is not None:
                    layers[0].append(f'color-scale="{opts["edge-color-scale"]}"')
            for parts in layers:
                children.append(f'    <qe-edges {" ".join(parts)}></qe-edges>')
        has_network = any(c.startswith("    <qe-edges") for c in children)

        # <qe-trajectories>
        if opts.get("trajectories") is True:
            tp: list[str] = []
            if opts.get("trajectory-units") is not None:
                tp.append(f'units="{opts["trajectory-units"]}"')
            tp += [
                f'smooth="{opts.get("trajectory-smooth", "none")}"',
                f'max-degree="{_fmt(opts.get("trajectory-max-degree", 3))}"',
                f'degree-selection="{opts.get("trajectory-degree-selection", "loocv_2d")}"',
                f'points="{"false" if opts.get("trajectory-points") is False else "true"}"',
                f'tips="{"false" if opts.get("trajectory-tips") is False else "true"}"',
            ]
            if opts.get("trajectory-playhead") is not None:
                tp.append(f'playhead="{_fmt(opts["trajectory-playhead"])}"')
            tp += [
                f'line-style="{opts.get("trajectory-line-style", "uniform")}"',
                f'stroke-width="{_fmt(opts.get("trajectory-stroke-width", 2))}"',
                f'stroke-width-range="{opts.get("trajectory-stroke-width-range", "1,6")}"',
                f'opacity-range="{opts.get("trajectory-opacity-range", "0.3,1")}"',
            ]
            children.append(f'    <qe-trajectories {" ".join(tp)}></qe-trajectories>')

        # <qe-axes>: lines, plus a label per axis when asked.
        if opts.get("axes") is True:
            axis_parts: list[str] = []
            for attr in ("x", "y"):
                val = opts.get(f"axis-{attr}")
                if val is True:
                    axis_parts.append(attr)
                elif isinstance(val, str):
                    axis_parts.append(f'{attr}="{val}"')
            children.append("    <qe-axes" + (" " + " ".join(axis_parts) if axis_parts else "")
                            + "></qe-axes>")

        # <qe-nodes>: "auto" draws them only with an edge network, as rENA does.
        node_show = opts.get("nodes-show", "auto")
        if node_show == "always" or (node_show == "auto" and has_network):
            unconn = ' unconnected="hide"' if opts.get("nodes-unconnected") == "hide" else ""
            children.insert(0, f'    <qe-nodes label="{opts.get("label-nodes", "on")}"{unconn}></qe-nodes>')

        gattr = ("edge-width", "plot-title", "range", "center", "scale-points", "point-scale",
                 "label-font-size", "label-font-family", "label-font-color")
        ga = "".join(f' {k}="{_esc(opts[k])}"' for k in gattr if opts.get(k) is not None)
        return (f'<qe-graph width="{self._width}" height="{self._height}"{ga}>\n'
                + "\n".join(children) + "\n  </qe-graph>")

    def _model_json(self) -> str:
        return json.dumps(self._model, default=str)

    def _build_fragment(self) -> str:
        """HTML fragment for Jupyter inline display (no ``<html>``/``<head>``)."""
        uid = f"qeviz-{int(time.time() * 1000) % 100_000}"
        return (
            f"{_bundle_script_tag()}\n"
            f'<qe-visual id="{uid}">\n'
            f"  {self._build_graph_element()}\n"
            f"</qe-visual>\n"
            f"<script>\n"
            f"  (function(){{\n"
            f"    document.getElementById('{uid}').setModelData({self._model_json()});\n"
            f"  }})();\n"
            f"</script>"
        )

    def _build_html_doc(self) -> str:
        """Complete self-contained HTML document."""
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
            f"  {_bundle_script_tag()}\n"
            f"</head>\n"
            f"<body>\n"
            f'  <qe-visual id="vis">\n'
            f"    {self._build_graph_element()}\n"
            f"  </qe-visual>\n"
            f"  <script>\n"
            f"    (function(){{\n"
            f"      document.getElementById('vis').setModelData({self._model_json()});\n"
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
        Write a self-contained HTML file (the bundle is inlined).

        Returns the resolved absolute path of the written file.
        """
        abs_path = os.path.abspath(path)
        with open(abs_path, "w", encoding="utf-8") as fh:
            fh.write(self._build_html_doc())
        return abs_path

    def __repr__(self) -> str:
        opts = {k: v for k, v in self._opts.items() if v is not None}
        return f"<QEPlot groups={self.groups()!r} units={len(self.units())} opts={opts!r}>"


def _layer_attrs(colors: Any, threshold: Any) -> dict:
    """R's .qe_layer_attrs(): validated colors / threshold layer attributes."""
    out: dict = {}
    if colors is not None:
        cols = [colors] if isinstance(colors, str) else list(colors)
        if len(cols) not in (1, 2) or not all(isinstance(c, str) for c in cols):
            raise ValueError("edges(): colors must be one or two colours.")
        out["colors"] = ",".join(cols)
    if threshold is not None:
        thr = [threshold] if isinstance(threshold, (int, float)) else list(threshold)
        if len(thr) not in (1, 2) or not all(
            isinstance(t, (int, float)) and math.isfinite(t) and t >= 0 for t in thr
        ):
            raise ValueError("edges(): threshold must be (min, max) or min, non-negative.")
        out["threshold"] = ",".join(_fmt(float(t)) for t in thr)
    return out


def _append_network(frame: Optional[dict], name: str, w: dict) -> dict:
    """R's .qe_append_network(): add (or replace) one explicit network row."""
    row = {"name": name, **w}
    if not frame:
        return {"data": [row], "types": {"name": "character", **{k: "numeric" for k in w}}}
    return {"data": [r for r in frame["data"] if r.get("name") != name] + [row],
            "types": frame["types"]}


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
                  and t CI bounds are added as the ``groups`` frame; ``None``
                  gives a model with no groups (explicit means still work).
    directed      ``True`` for ONA / directed networks (arrowheads).
    conf_level    Confidence level for CI boxes.  Default 0.95.
    include_ci    Include CI bounds in the groups frame.  Default ``True``.

    Returns
    -------
    dict  ModelData dict suitable for :func:`plot` or :func:`export_html`.
    """
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
    if group_col is None:
        del result["group_col"]
    if points is not None:
        result["points"] = _qe_frame(points)
        if group_col and group_col in points.columns:
            result["groups"] = _qe_frame(_group_summaries(
                points, group_col, [x_col, y_col],
                conf_level=conf_level, include_ci=include_ci))
    if trajectories is not None:
        result["trajectories"] = _qe_frame(trajectories)
    return result


def plot(
    x: Union[pd.DataFrame, dict],
    edges:  Optional[pd.DataFrame] = None,
    points: Optional[pd.DataFrame] = None,
    trajectories: Optional[pd.DataFrame] = None,
    *,
    title:     Optional[str] = None,
    width:     Union[int, str] = 700,
    height:    Union[int, str] = 500,
    group_col: Optional[str] = None,
    range:     Union[str, float, None] = None,
    scale_points: bool = True,
    point_scale:  Optional[float] = None,
    center:    str = "origin",
    palette:   Optional[Sequence[str]] = None,
    **model_kwargs,
) -> QEPlot:
    """
    Create a :class:`QEPlot` (R's ``qe_plot()``).

    Accepts either a pre-built ModelData dict **or** raw DataFrames
    (``nodes``, ``edges``, ``points``).

    Parameters
    ----------
    x           A ModelData dict from :func:`model_data`, **or** a nodes
                DataFrame (in which case ``edges`` must also be supplied).
    edges       Edge-weights DataFrame (only when ``x`` is a nodes DataFrame).
    points      Unit-positions DataFrame (optional, only with DataFrames).
    trajectories Ordered trajectory-state DataFrame (optional, only with DataFrames).
    title       Plot title, drawn above the plot when given; also the window /
                file title (default ``"qeviz"``).
    width, height
                Plot dimensions.  Integers are treated as pixels; strings
                are passed through as CSS (e.g. ``"100%"``).
    group_col   Grouping column (only when building from DataFrames).
    range       Symmetric axis range: ``"network"`` (default renderer
                behaviour), ``"points"`` or a positive number.
    scale_points
                ``False`` draws unit points and means at their raw
                coordinates instead of rescaling them to the node extent.
    point_scale Explicit factor for unit points and means (overrides
                ``scale_points``).
    center      ``"origin"`` (default) or ``"content"`` (centre the view on the
                nodes' and points' bounding box).
    palette     Colours for groups / sets / networks with none given
                (default: :func:`palette`).
    **model_kwargs
                Additional keyword arguments forwarded to :func:`model_data`
                (e.g. ``id_col``, ``x_col``, ``directed``).
    """
    if isinstance(x, dict):
        m = x
    else:
        if edges is None:
            raise TypeError("plot(): 'edges' is required when 'x' is a DataFrame.")
        m = model_data(x, edges, points, trajectories=trajectories,
                       group_col=group_col, **model_kwargs)
    return QEPlot(m, title=title, width=width, height=height, range=range,
                  scale_points=scale_points, point_scale=point_scale,
                  center=center, palette=palette)


def from_pyena(
    model,
    group_col: Optional[str] = None,
    directed:  bool = False,
    id_col:    str = "QEUNIT",
    title:     Optional[str] = None,
    width:     Union[int, str] = 700,
    height:    Union[int, str] = 500,
    dims:      tuple[int, int] = (0, 1),
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
    dims      The two dimensions to plot, as column indices of the model's
              positions (as R's ``qe_extract(dims =)``). Default ``(0, 1)``.
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
        "x":    model.positions_[:, dims[0]],
        "y":    model.positions_[:, dims[1]],
    })

    # Edges: normalised connection weights, "&" → "." separator
    conn_cols = [c.replace("&", ".") for c in model.connection_names_]
    edges_df  = pd.DataFrame(model.normed_networks_, columns=conn_cols)
    edges_df.insert(0, id_col, model.units_)

    # Points: projected (x, y) per unit
    points_df = pd.DataFrame({
        id_col: model.units_,
        "x":    model.points_[:, dims[0]],
        "y":    model.points_[:, dims[1]],
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
    "palette",
    "from_pyena",
    "export_html",
]
