"""
Smoke tests for the qeviz package — no scipy, no IPython required.

Run with:
    cd py && python -m pytest tests/ -v
or (from project root):
    python -m pytest py/tests/ -v
"""
import json
import math
import os
import tempfile

import pandas as pd
import pytest

import qeviz


# ── Synthetic ENA-shaped data ─────────────────────────────────────────────────

CODES = ["P", "D", "T", "C"]
R = 0.7


def _angle(i):
    return 2 * math.pi * i / len(CODES) - math.pi / 2


nodes_df = pd.DataFrame([
    {"code": c,
     "SVD1": round(R * math.cos(_angle(i)), 4),
     "SVD2": round(R * math.sin(_angle(i)), 4)}
    for i, c in enumerate(CODES)
])


def _make_unit(uid, group, seed):
    import random
    rng = random.Random(seed)
    row = {"QEUNIT": uid, "group": group}
    for c1 in CODES:
        for c2 in CODES:
            if c1 == c2:
                row[f"{c1}.{c2}"] = round(rng.random() * 0.3, 4)
            elif CODES.index(c1) < CODES.index(c2):
                row[f"{c1}.{c2}"] = round(rng.random() * (0.8 if group == "A" else 0.2), 4)
            else:
                row[f"{c1}.{c2}"] = round(rng.random() * (0.2 if group == "A" else 0.8), 4)
    return row


edges_data = [
    _make_unit("alice",  "A", 1),
    _make_unit("bob",    "A", 7),
    _make_unit("carol",  "A", 13),
    _make_unit("dan",    "A", 19),
    _make_unit("eve",    "B", 25),
    _make_unit("frank",  "B", 31),
    _make_unit("grace",  "B", 37),
    _make_unit("henry",  "B", 43),
]
edges_df = pd.DataFrame(edges_data)


def _project(unit_row):
    sx, sy, total = 0, 0, 0
    for c1 in CODES:
        for c2 in CODES:
            w = unit_row.get(f"{c1}.{c2}", 0)
            i1, i2 = CODES.index(c1), CODES.index(c2)
            sx += w * (math.cos(_angle(i1)) + math.cos(_angle(i2))) / 2
            sy += w * (math.sin(_angle(i1)) + math.sin(_angle(i2))) / 2
            total += w
    if total > 0:
        sx /= total
        sy /= total
    return {"QEUNIT": unit_row["QEUNIT"], "group": unit_row["group"],
            "SVD1": round(sx, 4), "SVD2": round(sy, 4)}


points_df = pd.DataFrame([_project(u) for u in edges_data])


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_qe_frame_types():
    frame = qeviz._qe_frame(nodes_df)
    assert frame["types"]["code"]  == "character"
    assert frame["types"]["SVD1"]  == "numeric"
    assert frame["types"]["SVD2"]  == "numeric"
    assert len(frame["data"]) == len(CODES)


def test_group_summaries_with_ci():
    groups_df = qeviz._group_summaries(points_df, "group", ["SVD1", "SVD2"])
    assert set(groups_df["group"]) == {"A", "B"}
    assert "SVD1.low"  in groups_df.columns
    assert "SVD1.high" in groups_df.columns
    assert "SVD2.low"  in groups_df.columns
    assert "SVD2.high" in groups_df.columns
    for _, r in groups_df.iterrows():
        assert r["SVD1.low"] < r["SVD1"] < r["SVD1.high"], f"SVD1 CI broken for {r['group']}"
        assert r["SVD2.low"] < r["SVD2"] < r["SVD2.high"], f"SVD2 CI broken for {r['group']}"


def test_group_summaries_no_ci():
    groups_df = qeviz._group_summaries(points_df, "group", ["SVD1", "SVD2"], include_ci=False)
    assert "SVD1.low" not in groups_df.columns


def test_model_data_minimal():
    m = qeviz.model_data(nodes=nodes_df, edges=edges_df)
    assert "nodes" in m and "edges" in m
    assert "updated" in m
    assert "groups" not in m     # no points → no groups
    assert m["node_id_col"] == "code"
    assert m["id_col"] == "QEUNIT"


def test_model_data_full():
    m = qeviz.model_data(
        nodes=nodes_df, edges=edges_df, points=points_df,
        group_col="group",
    )
    assert "points" in m
    assert "groups" in m
    groups_data = m["groups"]["data"]
    assert len(groups_data) == 2
    for row in groups_data:
        assert "SVD1.low"  in row, f"Missing SVD1.low in {row}"
        assert "SVD1.high" in row


def test_model_data_directed():
    m = qeviz.model_data(nodes=nodes_df, edges=edges_df, directed=True)
    assert m["directed"] is True


def test_export_html():
    m = qeviz.model_data(
        nodes=nodes_df, edges=edges_df, points=points_df, group_col="group"
    )
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as f:
        tmp_path = f.name
    try:
        out = qeviz.export_html(m, tmp_path)
        assert os.path.exists(out)
        with open(out, "r", encoding="utf-8") as fh:
            content = fh.read()
        assert "qe-visual"    in content, "Missing qe-visual element"
        assert "qe-graph"     in content, "Missing qe-graph element"
        assert "setModelData" in content, "Missing setModelData call"
        assert '"nodes"'      in content, "Model JSON not embedded"
    finally:
        os.unlink(tmp_path)


def test_json_serializable():
    m = qeviz.model_data(
        nodes=nodes_df, edges=edges_df, points=points_df, group_col="group"
    )
    serialized = json.dumps(m)
    assert len(serialized) > 100


# ── from_pyena ────────────────────────────────────────────────────────────────
# Uses a duck-typed mock so pyENA is not a test dependency.

import numpy as np

def _make_mock_pyena(n_units=8, n_codes=4, group_col="Condition"):
    """Build a minimal object that quacks like a fitted pyena.ENA."""
    rng = np.random.default_rng(42)
    code_names = [f"Code{i}" for i in range(n_codes)]
    conn_names = [
        f"{code_names[i]}&{code_names[j]}"
        for j in range(1, n_codes)
        for i in range(j)
    ]
    n_conn  = len(conn_names)
    units   = [f"G{g}::U{u}" for g in range(2) for u in range(n_units // 2)]
    groups  = ["G0"] * (n_units // 2) + ["G1"] * (n_units // 2)

    meta = pd.DataFrame({group_col: groups}, index=units)

    class MockAccum:
        pass

    accum = MockAccum()
    accum.meta             = meta
    accum.units_           = units
    accum.codes_           = code_names
    accum.connection_names_= conn_names
    accum.networks_        = rng.random((n_units, n_conn))

    class MockENA:
        pass

    m = MockENA()
    m.units_            = units
    m.codes_            = code_names
    m.connection_names_ = conn_names
    m.networks_         = accum.networks_
    m.normed_networks_  = rng.random((n_units, n_conn))
    m.positions_        = rng.uniform(-1, 1, (n_codes, 2))
    m.points_           = rng.uniform(-1, 1, (n_units, 2))
    m.accum_            = accum
    return m


def test_from_pyena_basic_structure():
    mock = _make_mock_pyena()
    qm = qeviz.from_pyena(mock, group_col="Condition")
    assert "nodes"   in qm
    assert "edges"   in qm
    assert "points"  in qm
    assert "groups"  in qm
    assert qm["directed"] is False


def test_from_pyena_node_count():
    mock = _make_mock_pyena(n_codes=4)
    qm = qeviz.from_pyena(mock)
    assert len(qm["nodes"]["data"]) == 4


def test_from_pyena_unit_count():
    mock = _make_mock_pyena(n_units=8)
    qm = qeviz.from_pyena(mock, group_col="Condition")
    assert len(qm["points"]["data"]) == 8


def test_from_pyena_separator_normalised():
    """Connection names must use '.' not '&'."""
    mock = _make_mock_pyena()
    qm = qeviz.from_pyena(mock)
    edge_cols = list(qm["edges"]["types"].keys())
    non_id_cols = [c for c in edge_cols if c != "QEUNIT"]
    assert all("." in c for c in non_id_cols), "Expected '.' separator in edge columns"
    assert not any("&" in c for c in non_id_cols), "Unexpected '&' in edge columns"


def test_from_pyena_group_col_in_points():
    mock = _make_mock_pyena()
    qm = qeviz.from_pyena(mock, group_col="Condition")
    assert qm["group_col"] == "Condition"
    assert "Condition" in qm["points"]["types"]


def test_from_pyena_two_groups():
    mock = _make_mock_pyena()
    qm = qeviz.from_pyena(mock, group_col="Condition")
    group_vals = {row["Condition"] for row in qm["groups"]["data"]}
    assert group_vals == {"G0", "G1"}


def test_from_pyena_directed_flag():
    mock = _make_mock_pyena()
    assert qeviz.from_pyena(mock, directed=True)["directed"]  is True
    assert qeviz.from_pyena(mock, directed=False)["directed"] is False


def test_from_pyena_missing_group_col_raises():
    mock = _make_mock_pyena()
    with pytest.raises(ValueError, match="not found in model metadata"):
        qeviz.from_pyena(mock, group_col="NonExistentCol")


def test_from_pyena_no_group():
    """from_pyena without group_col should still produce nodes + edges."""
    mock = _make_mock_pyena()
    qm = qeviz.from_pyena(mock)
    assert "nodes"  in qm
    assert "edges"  in qm
    assert "points" in qm
    assert "groups" not in qm
