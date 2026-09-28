"""
Tests for the qeviz package — no scipy, no IPython required.

Run with:
    cd py && python -m pytest tests/ -v
or (from project root):
    python -m pytest py/tests/ -v
"""
import json
import math
import os
import tempfile

import numpy as np
import pandas as pd
import pytest

import qeviz
from qeviz import QEPlot


# ── Synthetic ENA-shaped data ─────────────────────────────────────────────────

CODES = ["P", "D", "T", "C"]
R     = 0.7


def _angle(i: int) -> float:
    return 2 * math.pi * i / len(CODES) - math.pi / 2


nodes_df = pd.DataFrame([
    {"code": c,
     "SVD1": round(R * math.cos(_angle(i)), 4),
     "SVD2": round(R * math.sin(_angle(i)), 4)}
    for i, c in enumerate(CODES)
])


def _make_unit(uid: str, group: str, seed: int) -> dict:
    import random
    rng = random.Random(seed)
    row: dict = {"QEUNIT": uid, "group": group}
    for c1 in CODES:
        for c2 in CODES:
            if c1 == c2:
                row[f"{c1}.{c2}"] = round(rng.random() * 0.3, 4)
            elif CODES.index(c1) < CODES.index(c2):
                row[f"{c1}.{c2}"] = round(
                    rng.random() * (0.8 if group == "A" else 0.2), 4
                )
            else:
                row[f"{c1}.{c2}"] = round(
                    rng.random() * (0.2 if group == "A" else 0.8), 4
                )
    return row


edges_data = [
    _make_unit("alice",  "A",  1),
    _make_unit("bob",    "A",  7),
    _make_unit("carol",  "A", 13),
    _make_unit("dan",    "A", 19),
    _make_unit("eve",    "B", 25),
    _make_unit("frank",  "B", 31),
    _make_unit("grace",  "B", 37),
    _make_unit("henry",  "B", 43),
]
edges_df = pd.DataFrame(edges_data)


def _project(unit_row: dict) -> dict:
    sx, sy, total = 0.0, 0.0, 0.0
    for c1 in CODES:
        for c2 in CODES:
            w  = unit_row.get(f"{c1}.{c2}", 0)
            i1 = CODES.index(c1)
            i2 = CODES.index(c2)
            sx    += w * (math.cos(_angle(i1)) + math.cos(_angle(i2))) / 2
            sy    += w * (math.sin(_angle(i1)) + math.sin(_angle(i2))) / 2
            total += w
    if total > 0:
        sx /= total
        sy /= total
    return {
        "QEUNIT": unit_row["QEUNIT"],
        "group":  unit_row["group"],
        "SVD1":   round(sx, 4),
        "SVD2":   round(sy, 4),
    }


points_df = pd.DataFrame([_project(u) for u in edges_data])
trajectory_df = pd.concat([
    points_df.assign(
        RowID=t,
        SVD1=points_df["SVD1"] + (t - 2) * 0.03,
        SVD2=points_df["SVD2"] - (t - 2) * 0.02,
    )
    for t in range(1, 4)
], ignore_index=True)


# ── Internal helpers ──────────────────────────────────────────────────────────

def test_qe_frame_types():
    frame = qeviz._qe_frame(nodes_df)
    assert frame["types"]["code"] == "character"
    assert frame["types"]["SVD1"] == "numeric"
    assert frame["types"]["SVD2"] == "numeric"
    assert len(frame["data"]) == len(CODES)


def test_group_summaries_with_ci():
    groups_df = qeviz._group_summaries(points_df, "group", ["SVD1", "SVD2"])
    assert set(groups_df["group"]) == {"A", "B"}
    for col in ("SVD1.low", "SVD1.high", "SVD2.low", "SVD2.high"):
        assert col in groups_df.columns
    for _, r in groups_df.iterrows():
        assert r["SVD1.low"]  < r["SVD1"]  < r["SVD1.high"]
        assert r["SVD2.low"]  < r["SVD2"]  < r["SVD2.high"]


def test_group_summaries_no_ci():
    groups_df = qeviz._group_summaries(
        points_df, "group", ["SVD1", "SVD2"], include_ci=False
    )
    assert "SVD1.low" not in groups_df.columns


# ── model_data() ──────────────────────────────────────────────────────────────

def test_model_data_minimal():
    m = qeviz.model_data(nodes=nodes_df, edges=edges_df)
    assert "nodes"   in m and "edges" in m
    assert "updated" in m
    assert "groups"  not in m          # no points → no groups
    assert m["node_id_col"] == "code"
    assert m["id_col"]      == "QEUNIT"


def test_model_data_full():
    m = qeviz.model_data(
        nodes=nodes_df, edges=edges_df, points=points_df,
        group_col="group",
    )
    assert "points" in m and "groups" in m
    for row in m["groups"]["data"]:
        assert "SVD1.low"  in row
        assert "SVD1.high" in row


def test_model_data_with_trajectories():
    m = qeviz.model_data(
        nodes=nodes_df, edges=edges_df, points=points_df,
        trajectories=trajectory_df, group_col="group",
    )
    assert "trajectories" in m
    assert len(m["trajectories"]["data"]) == len(trajectory_df)


def test_model_data_directed():
    m = qeviz.model_data(nodes=nodes_df, edges=edges_df, directed=True)
    assert m["directed"] is True


def test_json_serializable():
    m = qeviz.model_data(
        nodes=nodes_df, edges=edges_df, points=points_df, group_col="group"
    )
    assert len(json.dumps(m)) > 100


# ── QEPlot construction ───────────────────────────────────────────────────────

def _make_plot(**kwargs) -> QEPlot:
    return qeviz.plot(
        nodes_df, edges_df, points_df, group_col="group", **kwargs
    )


def test_plot_returns_qeplot():
    p = _make_plot()
    assert isinstance(p, QEPlot)


def test_plot_from_dict():
    m = qeviz.model_data(nodes=nodes_df, edges=edges_df, points=points_df,
                         group_col="group")
    p = qeviz.plot(m)
    assert isinstance(p, QEPlot)
    assert p.model is m


def test_plot_missing_edges_raises():
    with pytest.raises(TypeError, match="'edges' is required"):
        qeviz.plot(nodes_df)


def test_plot_width_height_px():
    p = QEPlot({}, width=700, height=500)
    assert p._width  == "700px"
    assert p._height == "500px"


def test_plot_width_height_css():
    p = QEPlot({}, width="100%", height="80vh")
    assert p._width  == "100%"
    assert p._height == "80vh"


# ── Introspection ─────────────────────────────────────────────────────────────

def test_groups():
    p = _make_plot()
    assert set(p.groups()) == {"A", "B"}


def test_units():
    p = _make_plot()
    unit_ids = p.units()
    assert len(unit_ids) == 8
    assert "alice" in unit_ids


def test_trajectory_units_from_trajectories_frame():
    p = qeviz.plot(
        nodes_df, edges_df, points_df,
        trajectories=trajectory_df, group_col="group",
    )
    assert set(p.trajectory_units()) == set(points_df["QEUNIT"])


def test_trajectory_units_falls_back_to_points():
    p = _make_plot()
    assert set(p.trajectory_units()) == set(points_df["QEUNIT"])


def test_groups_empty_without_points():
    p = qeviz.plot(nodes_df, edges_df)
    assert p.groups() == []
    assert p.units()  == []


# ── Chain methods — immutability ──────────────────────────────────────────────

def test_chain_returns_new_object():
    p  = _make_plot()
    p2 = p.group("A")
    assert p2 is not p
    assert "groups" not in p._opts
    assert p2._opts["groups"] == "A"


def test_group_all_groups():
    p = _make_plot().group()
    assert "groups" not in p._opts
    assert p._opts.get("confidence") is True


def test_group_single():
    p = _make_plot().group("A", intervals=False)
    assert p._opts["groups"] == "A"
    assert p._opts["confidence"] is False


def test_group_multiple():
    p = _make_plot().group("A", "B")
    assert p._opts["groups"] == "A,B"


def test_group_invalid_raises():
    with pytest.raises(ValueError, match="not found in model"):
        _make_plot().group("NonExistent")


def test_edges_group():
    p = _make_plot().edges("A")
    assert p._opts["group"] == "A"
    assert p._opts.get("unit") is None


def test_edges_unit():
    p = _make_plot().edges(unit="alice")
    assert p._opts["unit"] == "alice"
    assert p._opts.get("group") is None


def test_edges_compare():
    p = _make_plot().edges("A", compare="B")
    assert p._opts["group"]   == "A"
    assert p._opts["compare"] == "B"


def test_edges_also():
    p = _make_plot().edges("A", also="B")
    assert p._opts["group"] == "A"
    assert p._opts["also"]  == "B"


def test_edges_show_false():
    p = _make_plot().edges(show=False)
    assert p._opts["show_edges"] is False
    for k in ("group", "unit", "compare", "also"):
        assert k not in p._opts


def test_edges_group_and_unit_raises():
    with pytest.raises(ValueError, match="not both"):
        _make_plot().edges("A", unit="alice")


def test_edges_compare_and_also_raises():
    with pytest.raises(ValueError, match="not both"):
        _make_plot().edges("A", compare="B", also="B")


def test_edges_unit_and_compare_raises():
    with pytest.raises(ValueError, match="cannot be combined"):
        _make_plot().edges(unit="alice", compare="B")


def test_edges_invalid_group_raises():
    with pytest.raises(ValueError, match="not found"):
        _make_plot().edges("NoSuchGroup")


def test_edges_invalid_unit_raises():
    with pytest.raises(ValueError, match="not found"):
        _make_plot().edges(unit="nobody")


def test_points_show():
    p = _make_plot().points()
    assert p._opts["show_points"] is True


def test_points_hide():
    p = _make_plot().points(False)
    assert p._opts["show_points"] is False


def test_trajectories_show():
    p = _make_plot().trajectories(
        "alice", smooth="poly", max_degree=4, degree_selection="fixed",
        line_style="tapered",
    )
    assert p._opts["show_trajectories"] is True
    assert p._opts["trajectory_units"] == "alice"
    assert p._opts["trajectory_smooth"] == "poly"
    assert p._opts["trajectory_max_degree"] == 4
    assert p._opts["trajectory_degree_selection"] == "fixed"
    assert p._opts["trajectory_line_style"] == "tapered"


def test_trajectories_defaults_loocv():
    p = _make_plot().trajectories("alice", smooth="poly")
    assert p._opts["trajectory_max_degree"] == 3
    assert p._opts["trajectory_degree_selection"] == "loocv_2d"


def test_trajectories_hide():
    p = _make_plot().trajectories(show=False)
    assert p._opts["show_trajectories"] is False


def test_trajectories_invalid_unit_raises():
    with pytest.raises(ValueError, match="unit\\(s\\) not found"):
        _make_plot().trajectories("missing")


def test_trajectories_invalid_degree_selection_raises():
    with pytest.raises(ValueError, match="degree_selection"):
        _make_plot().trajectories(smooth="poly", degree_selection="bogus")


def test_labels():
    p = _make_plot().labels(nodes="off", means="click", points="on")
    assert p._opts["label_nodes"]  == "off"
    assert p._opts["label_means"]  == "click"
    assert p._opts["label_points"] == "on"


# ── HTML output — child element structure ─────────────────────────────────────

def _vis_block(html: str) -> str:
    """Extract lines inside <qe-visual>...</qe-visual>."""
    lines = html.splitlines()
    buf, inside = [], False
    for line in lines:
        if "<qe-visual" in line:
            inside = True
        if inside:
            buf.append(line)
        if "</qe-visual>" in line:
            break
    return "\n".join(buf)


def test_html_default_has_means_only():
    # No network by default, so no <qe-nodes> either.
    html = _vis_block(_make_plot()._build_html_doc())
    assert "<qe-nodes"  not in html
    assert "<qe-means"  in html
    assert "<qe-points" not in html
    assert "<qe-edges"  not in html


def test_html_with_points():
    html = _vis_block(_make_plot().points()._build_html_doc())
    assert "<qe-points" in html


def test_points_size():
    html = _vis_block(_make_plot().points(size=5)._build_html_doc())
    assert 'size="5"' in html


def test_points_no_size_by_default():
    html = _vis_block(_make_plot().points()._build_html_doc())
    assert "<qe-points" in html
    assert "size=" not in html


def test_points_fixed_size():
    html = _vis_block(_make_plot().points(fixed_size=True)._build_html_doc())
    assert "<qe-points" in html and "fixed-size" in html


def test_points_no_fixed_size_by_default():
    html = _vis_block(_make_plot().points()._build_html_doc())
    assert "fixed-size" not in html


def test_means_fixed_size():
    html = _vis_block(_make_plot().group(fixed_size=True)._build_html_doc())
    means_line = next(l for l in html.splitlines() if "<qe-means" in l)
    assert "fixed-size" in means_line


def test_means_no_fixed_size_by_default():
    html = _vis_block(_make_plot().group()._build_html_doc())
    means_line = next(l for l in html.splitlines() if "<qe-means" in l)
    assert "fixed-size" not in means_line


def test_nodes_only_with_network_by_default():
    assert "<qe-nodes" not in _vis_block(_make_plot()._build_html_doc())
    html = _vis_block(_make_plot().edges("A")._build_html_doc())
    assert '<qe-nodes label="on"></qe-nodes>' in html
    assert html.index("<qe-nodes") < html.index("<qe-means")


def test_nodes_override():
    assert "<qe-nodes" in _vis_block(_make_plot().nodes("always")._build_html_doc())
    assert "<qe-nodes" in _vis_block(_make_plot().nodes(True)._build_html_doc())
    assert "<qe-nodes" not in _vis_block(_make_plot().edges("A").nodes("never")._build_html_doc())
    with pytest.raises(ValueError):
        _make_plot().nodes("sometimes")


def test_nodes_unconnected_hide():
    assert "unconnected" not in _vis_block(_make_plot().edges("A")._build_html_doc())
    html = _vis_block(_make_plot().edges("A").nodes(unconnected="hide")._build_html_doc())
    assert '<qe-nodes label="on" unconnected="hide">' in html
    with pytest.raises(ValueError):
        _make_plot().nodes(unconnected="fade")


def test_edges_color_scale_edge_width_magnify():
    base = _vis_block(_make_plot().edges("A")._build_html_doc())
    assert "color-scale" not in base and "edge-width" not in base and "magnify" not in base
    html = _vis_block(_make_plot().edges("A", color_scale="plot", edge_width=0.05, magnify=1.5)._build_html_doc())
    assert 'color-scale="plot"' in html
    assert 'edge-width="0.05"' in html
    assert 'magnify="1.5"' in html
    assert 'magnify="1"' in _vis_block(_make_plot().edges("A", magnify=1)._build_html_doc())
    for bad in ({"color_scale": "big"}, {"edge_width": 2}, {"magnify": 0}):
        with pytest.raises(ValueError):
            _make_plot().edges("A", **bad)


def test_axes_lines_only_by_default():
    # Axis labels are opt-in.
    html = _vis_block(_make_plot().axes()._build_html_doc())
    assert "<qe-axes>" in html


def test_axes_dimension_name_labels():
    html = _vis_block(_make_plot().axes(x=True, y=True)._build_html_doc())
    assert "<qe-axes x y>" in html


def test_axes_custom_x_only():
    html = _vis_block(_make_plot().axes(x="Task focus")._build_html_doc())
    assert '<qe-axes x="Task focus">' in html


def test_axes_lines_only():
    html = _vis_block(_make_plot().axes(x=False, y=False)._build_html_doc())
    assert "<qe-axes>" in html


def test_axes_hidden():
    html = _vis_block(_make_plot().axes(show=False)._build_html_doc())
    assert "<qe-axes" not in html


def test_no_axes_by_default():
    html = _vis_block(_make_plot()._build_html_doc())
    assert "<qe-axes" not in html


def test_html_with_trajectories():
    html = _vis_block(
        _make_plot()
        .trajectories(
            "alice",
            smooth="poly",
            max_degree=3,
            line_style="tapered",
            stroke_width_range=(1, 8),
            opacity_range=(0.3, 1),
        )
        ._build_html_doc()
    )
    assert "<qe-trajectories" in html
    assert 'units="alice"' in html
    assert 'smooth="poly"' in html
    assert 'max-degree="3"' in html
    assert 'degree-selection="loocv_2d"' in html
    assert 'line-style="tapered"' in html
    assert 'stroke-width-range="1,8"' in html


def test_html_group_edges():
    html = _vis_block(_make_plot().edges("A", compare="B")._build_html_doc())
    assert 'group="A"'   in html
    assert 'compare="B"' in html


def test_html_unit_edges():
    html = _vis_block(_make_plot().edges(unit="alice")._build_html_doc())
    assert 'unit="alice"' in html


def test_html_edges_suppressed_no_element():
    html = _vis_block(_make_plot().edges(show=False)._build_html_doc())
    assert "<qe-edges" not in html


def test_html_group_filter():
    html = _vis_block(_make_plot().group("A")._build_html_doc())
    assert 'groups="A"' in html


def test_html_confidence():
    html = _vis_block(_make_plot().group(intervals=True)._build_html_doc())
    assert "confidence" in html


def test_html_no_confidence():
    html = _vis_block(_make_plot().group(intervals=False)._build_html_doc())
    assert "confidence" not in html


def test_html_width_height_in_qe_graph():
    html = _vis_block(_make_plot()._build_html_doc())
    assert 'width="700px"'  in html
    assert 'height="500px"' in html


def test_html_contains_setmodeldata():
    html = _make_plot()._build_html_doc()
    assert "setModelData" in html


def test_html_fragment_has_bundle():
    frag = _make_plot()._build_fragment()
    assert "<script>" in frag
    assert "setModelData" in frag


def test_repr_html_returns_string():
    p = _make_plot()
    html = p._repr_html_()
    assert isinstance(html, str)
    assert "<qe-visual" in html


# ── export_html ───────────────────────────────────────────────────────────────

def test_export_html_from_qeplot():
    p = _make_plot().edges("A")
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as f:
        tmp = f.name
    try:
        out = p.export_html(tmp)
        assert os.path.exists(out)
        content = open(out).read()
        assert "qe-visual"    in content
        assert "qe-graph"     in content
        assert "setModelData" in content
        assert '"nodes"'      in content
    finally:
        os.unlink(tmp)


def test_export_html_legacy_dict():
    """Module-level export_html still accepts a raw ModelData dict."""
    m = qeviz.model_data(nodes=nodes_df, edges=edges_df, points=points_df,
                         group_col="group")
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as f:
        tmp = f.name
    try:
        out = qeviz.export_html(m, tmp)
        assert os.path.exists(out)
        assert "setModelData" in open(out).read()
    finally:
        os.unlink(tmp)


# ── from_pyena ────────────────────────────────────────────────────────────────

def _make_mock_pyena(n_units: int = 8, n_codes: int = 4,
                     group_col: str = "Condition"):
    rng        = np.random.default_rng(42)
    code_names = [f"Code{i}" for i in range(n_codes)]
    conn_names = [
        f"{code_names[i]}&{code_names[j]}"
        for j in range(1, n_codes)
        for i in range(j)
    ]
    n_conn = len(conn_names)
    units  = [f"G{g}::U{u}" for g in range(2) for u in range(n_units // 2)]
    groups = ["G0"] * (n_units // 2) + ["G1"] * (n_units // 2)

    meta = pd.DataFrame({group_col: groups}, index=units)

    class _Accum:
        pass

    accum            = _Accum()
    accum.meta       = meta
    accum.units_     = units
    accum.codes_     = code_names
    accum.connection_names_ = conn_names
    accum.networks_  = rng.random((n_units, n_conn))

    class _ENA:
        pass

    m                    = _ENA()
    m.units_             = units
    m.codes_             = code_names
    m.connection_names_  = conn_names
    m.networks_          = accum.networks_
    m.normed_networks_   = rng.random((n_units, n_conn))
    m.positions_         = rng.uniform(-1, 1, (n_codes, 2))
    m.points_            = rng.uniform(-1, 1, (n_units, 2))
    m.accum_             = accum
    return m


def test_from_pyena_returns_qeplot():
    p = qeviz.from_pyena(_make_mock_pyena(), group_col="Condition")
    assert isinstance(p, QEPlot)


def test_from_pyena_model_structure():
    p = qeviz.from_pyena(_make_mock_pyena(), group_col="Condition")
    assert "nodes"  in p.model
    assert "edges"  in p.model
    assert "points" in p.model
    assert "groups" in p.model
    assert p.model["directed"] is False


def test_from_pyena_node_count():
    p = qeviz.from_pyena(_make_mock_pyena(n_codes=4))
    assert len(p.model["nodes"]["data"]) == 4


def test_from_pyena_unit_count():
    p = qeviz.from_pyena(_make_mock_pyena(n_units=8), group_col="Condition")
    assert len(p.units()) == 8


def test_from_pyena_groups():
    p = qeviz.from_pyena(_make_mock_pyena(), group_col="Condition")
    assert set(p.groups()) == {"G0", "G1"}


def test_from_pyena_separator_normalised():
    p = qeviz.from_pyena(_make_mock_pyena())
    non_id = [c for c in p.model["edges"]["types"] if c != "QEUNIT"]
    assert all("." in c for c in non_id), "Expected '.' separator in edge columns"
    assert not any("&" in c for c in non_id)


def test_from_pyena_group_col_in_points():
    p = qeviz.from_pyena(_make_mock_pyena(), group_col="Condition")
    assert p.model["group_col"] == "Condition"
    assert "Condition" in p.model["points"]["types"]


def test_from_pyena_directed():
    assert qeviz.from_pyena(_make_mock_pyena(), directed=True).model["directed"]  is True
    assert qeviz.from_pyena(_make_mock_pyena(), directed=False).model["directed"] is False


def test_from_pyena_missing_group_col_raises():
    with pytest.raises(ValueError, match="not found in model metadata"):
        qeviz.from_pyena(_make_mock_pyena(), group_col="NoSuchCol")


def test_from_pyena_no_group():
    p = qeviz.from_pyena(_make_mock_pyena())
    assert "nodes"  in p.model
    assert "edges"  in p.model
    assert "points" in p.model
    assert "groups" not in p.model


def test_from_pyena_chain():
    """Chain methods work on a QEPlot returned by from_pyena."""
    p = qeviz.from_pyena(_make_mock_pyena(), group_col="Condition")
    view = p.group("G0").edges("G0", compare="G1").points()
    assert view._opts["groups"]   == "G0"
    assert view._opts["group"]    == "G0"
    assert view._opts["compare"]  == "G1"
    assert view._opts["show_points"] is True
    # Original unmodified
    assert "groups" not in p._opts
