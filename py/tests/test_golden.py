"""
Cross-language parity: every scenario in tests/golden/golden.json (built with
the R package by tests/golden/gen_golden.R) rebuilt with the Python API must
produce the same <qe-graph> markup (attribute for attribute) and the same
ModelData (numbers to 1e-9).
"""
import json
import math
import os
import re

import pandas as pd
import pytest

import qeviz

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "tests", "golden")
GOLDEN = json.load(open(os.path.join(ROOT, "golden.json")))
read = lambda f: pd.read_csv(os.path.join(ROOT, "fixture", f))
nodes, edges, points = read("nodes.csv"), read("edges.csv"), read("points.csv")

m = qeviz.model_data(nodes, edges, points, id_col="ENA_UNIT", x_col="x", y_col="y",
                     group_col="Condition")
m0 = qeviz.model_data(nodes, edges, points[["ENA_UNIT", "x", "y"]], id_col="ENA_UNIT",
                      x_col="x", y_col="y", group_col=None)
ecols = [c for c in edges.columns if c not in ("ENA_UNIT", "Condition")]
oa = edges["Condition"] == "OA"
w_oa = edges.loc[oa, ecols].mean()                      # named Series


def base(**kw):
    return qeviz.plot(m, width="100%", height=440, **kw)


SCENARIOS = {
    "base":             lambda: base(),
    "edges_group":      lambda: base().edges("OA"),
    "edges_compare":    lambda: base().edges("OA", compare="OB"),
    "edges_also_mag":   lambda: base().edges("OA", also="OB", magnify=2,
                                             color_scale="plot", edge_width=0.05),
    "points_all":       lambda: base().points(size=3, fixed_size=True),
    "axes_labels":      lambda: base().axes(x=True, y="Second"),

    "w_vector":         lambda: base().edges(weights=w_oa, colors=["#228833", "#AA3377"],
                                             threshold=(0.05, 0.3), name="net A"),
    "w_unnamed":        lambda: base().edges(weights=list(w_oa.values), colors="#228833",
                                             threshold=0.1),
    "w_matrix_compare": lambda: base().edges(weights=edges.loc[oa, ecols],
                                             compare=edges.loc[~oa, ecols]),
    "w_two_layers":     lambda: base().edges(weights=w_oa, name="first")
                                          .edges(weights=w_oa * 0.5, name="second", magnify=1.5),
    "w_replace":        lambda: base().edges(weights=w_oa, name="n")
                                          .edges(weights=w_oa * 2, name="n"),
    "w_then_hide":      lambda: base().edges(weights=w_oa).edges(show=False),

    "ps_units":         lambda: base().points(units=["OA.alice", "OB.eve"], color="#228833",
                                              shape="triangle", labels=["A", "E"], name="picked"),
    "ps_points":        lambda: base().points(points=points.iloc[0:3], size=4, shape="diamond"),
    "ps_two_sets":      lambda: base().points(points=points.iloc[0:2], name="one")
                                          .points(points=points.iloc[4:6], color="#EE6677"),

    "g_named":          lambda: base().group("OA", intervals="crosshairs"),
    "g_named_outlier":  lambda: base().group(conf_level=0.9, outlier=True),
    "g_explicit":       lambda: base().group(points=points.iloc[0:4], label="sub",
                                             color="#CCBB44", shape="diamond", intervals="box",
                                             outlier=True, conf_level=0.9),
    "g_explicit_two":   lambda: base().group(points=points.iloc[0:4], label="a")
                                          .group(points=points.iloc[4:8], label="b",
                                                 intervals="crosshairs"),
    "g_hidden":         lambda: base().edges("OA").group(show=False),

    "n_positions":      lambda: base().nodes(positions=pd.DataFrame(
                                    {"code": ["Data", "Tech"], "x": [0.5, -0.5],
                                     "y": [0.5, -0.5]})).edges("OA"),
    "n_labels":         lambda: base().nodes("always", unconnected="hide",
                                             labels={"Data": "D", "Collab": "C"}),

    "plot_settings":    lambda: base(title="Settings", range="points", scale_points=False,
                                     palette=["#111111", "#222222"], center="content",
                                     point_scale=2).edges("OA"),
    "range_number":     lambda: base().range(1.5),
    "colors_labels":    lambda: base().colors(OA="#000000")
                                          .labels(nodes="off", means="click")
                                          .labels(font_size=12, font_family="Georgia",
                                                  font_color="#333333"),

    "nogroup_explicit": lambda: qeviz.plot(m0, width="100%", height=440)
                                     .group(show=False)
                                     .edges(weights=w_oa)
                                     .points(points=points.iloc[0:4][["ENA_UNIT", "x", "y"]])
                                     .group(points=points.iloc[0:4][["ENA_UNIT", "x", "y"]],
                                            label="subset"),
}


# ── Comparison ────────────────────────────────────────────────────────────────

_TAG = re.compile(r"<(qe-[a-z-]+)([^>]*)>")
_ATTR = re.compile(r'([a-z-]+)(?:="([^"]*)")?')
_NUMS = re.compile(r"^-?\d+(\.\d+)?(e-?\d+)?(,-?\d+(\.\d+)?(e-?\d+)?)*$")


def parse_graph(markup: str) -> list:
    """[(tag, {attr: value})] in document order; width / height dropped (the
    renderer sizes the plot by CSS); numeric values compared as numbers."""
    out = []
    for tag, attrs in _TAG.findall(markup):
        d = {}
        for k, v in _ATTR.findall(attrs):
            if tag == "qe-graph" and k in ("width", "height"):
                continue
            d[k] = tuple(float(x) for x in v.split(",")) if _NUMS.match(v or "x") else v
        out.append((tag, d))
    return out


def same(a, b, path="model"):
    """Golden (R) vs Python, recursively: NA == None == NaN, integer and
    numeric types are equivalent, numbers to 1e-9."""
    na = lambda v: v is None or (isinstance(v, float) and math.isnan(v)) or v == "NA"
    if na(a) and na(b):
        return
    if isinstance(a, dict) and isinstance(b, dict):
        keys = set(a) | set(b)
        for k in sorted(keys):
            assert k in a and k in b or na(a.get(k)) and na(b.get(k)), f"{path}.{k}: missing on one side"
            same(a.get(k), b.get(k), f"{path}.{k}")
    elif isinstance(a, list) and isinstance(b, list):
        assert len(a) == len(b), f"{path}: {len(a)} vs {len(b)} items"
        for i, (x, y) in enumerate(zip(a, b)):
            same(x, y, f"{path}[{i}]")
    elif isinstance(a, bool) or isinstance(b, bool):
        assert a == b, f"{path}: {a!r} vs {b!r}"
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
        assert abs(a - b) <= 1e-9 * max(1.0, abs(a)), f"{path}: {a!r} vs {b!r}"
    elif {a, b} <= {"integer", "numeric"}:
        return
    else:
        assert a == b, f"{path}: {a!r} vs {b!r}"


def test_every_golden_scenario_is_covered():
    assert set(SCENARIOS) == set(GOLDEN)


@pytest.mark.parametrize("name", sorted(GOLDEN))
def test_golden_markup(name):
    p = SCENARIOS[name]()
    assert parse_graph(p._build_graph_element()) == parse_graph(GOLDEN[name]["graph"])


@pytest.mark.parametrize("name", sorted(GOLDEN))
def test_golden_model(name):
    model = dict(SCENARIOS[name]().model)
    model.pop("updated", None)
    same(GOLDEN[name]["model"], json.loads(json.dumps(model)))
