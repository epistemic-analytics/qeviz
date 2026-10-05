"""tools/rena-pyena/compare.py — the pyENA half, and the side-by-side page.

Fits the same RS.data rows (out/RS.data.csv, written by rena.R) with pyENA,
draws the same three views with qeviz, compares the numbers with rENA's
(out/rena.json) and writes out/index.html.

    Rscript tools/rena-pyena/rena.R          # first
    python tools/rena-pyena/compare.py       # needs pyena, pylibqe, qeviz
"""
import html
import json
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
sys.path.insert(0, os.path.join(HERE, "..", "..", "py"))      # this checkout's qeviz

import pyena                                                    # noqa: E402
import qeviz                                                    # noqa: E402

CODE = '''import pandas as pd
from pyena import ENA

rs = pd.read_csv("RS.data.csv")            # rENA's RS.data, as written by rena.R
codes = ["Data", "Technical.Constraints", "Performance.Parameters",
         "Client.and.Consultant.Requests", "Design.Reasoning", "Collaboration"]
rs["unit"]  = rs["Condition"] + "::" + rs["UserName"]     # rENA's unit key
rs["convo"] = rs["Condition"] + "::" + rs["GroupName"]
model = ENA().fit(rs, "unit", "convo", codes, window_size=4)'''

env: dict = {}
cwd = os.getcwd()
os.chdir(OUT)
exec(CODE, env)
os.chdir(cwd)
model = env["model"]

VIEWS = {
    "FirstGame":  lambda p: p.edges("FirstGame").group("FirstGame"),
    "SecondGame": lambda p: p.edges("SecondGame").group("SecondGame"),
    "subtract":   lambda p: p.edges("FirstGame", compare="SecondGame").group(),
}
QE_CODE = {
    "rena": {
        "FirstGame":  'qe_plot(set, group_col = "Condition") |> qe_edges("FirstGame") |> qe_group("FirstGame")',
        "SecondGame": 'qe_plot(set, group_col = "Condition") |> qe_edges("SecondGame") |> qe_group("SecondGame")',
        "subtract":   'qe_plot(set, group_col = "Condition") |>\n  qe_edges("FirstGame", compare = "SecondGame") |> qe_group()',
    },
    "pyena": {
        "FirstGame":  'qeviz.from_pyena(model, group_col="Condition").edges("FirstGame").group("FirstGame")',
        "SecondGame": 'qeviz.from_pyena(model, group_col="Condition").edges("SecondGame").group("SecondGame")',
        "subtract":   'qeviz.from_pyena(model, group_col="Condition") \\\n    .edges("FirstGame", compare="SecondGame").group()',
    },
}
for v, f in VIEWS.items():
    p = f(qeviz.from_pyena(model, group_col="Condition", title=f"pyENA: {v}", width="100%", height=420))
    p.export_html(os.path.join(OUT, "panels", f"pyena_{v}.html"))

# ── Numbers: rENA vs pyENA, matched by unit / code / connection name ──────────
R = json.load(open(os.path.join(OUT, "rena.json")))
r_units = R["units"]
p_units = [str(u) for u in model.unit_labels_]
ui = [p_units.index(u) for u in r_units]                       # pyENA rows in rENA order
r_pts, p_pts = np.array(R["points"]), np.asarray(model.points_)[ui, :2]
ci = [list(model.codes_).index(c) for c in R["nodes"]["code"]]
r_nodes, p_nodes = np.array(R["nodes"]["xy"]), np.asarray(model.rotation_nodes_)[ci, :2]
ki = [list(model.connection_names_).index(c) for c in R["connections"]]
r_lw, p_lw = np.array(R["line_weights"]), np.asarray(model.line_weights_)[ui][:, ki]

# SVD axes are defined up to sign; report a flip rather than hide it.
flip = np.sign([np.dot(r_nodes[:, d], p_nodes[:, d]) or 1 for d in range(2)])
groups = np.array(R["groups"])


def means(pts):
    return {g: pts[groups == g].mean(axis=0) for g in sorted(set(groups))}


r_means, p_means = means(r_pts), means(p_pts * flip)
p_var = getattr(model, "variance_", None)
p_var = list(np.asarray(p_var)[:2]) if p_var is not None else None
rows = [
    ("Units", f"{len(r_units)}", f"{len(p_units)}", len(r_units) == len(p_units) and set(r_units) == set(p_units)),
    ("Codes", ", ".join(R["nodes"]["code"]), ", ".join(model.codes_), set(R["nodes"]["code"]) == set(model.codes_)),
    ("Connections", f"{len(R['connections'])}", f"{len(model.connection_names_)}",
     set(R["connections"]) == set(model.connection_names_)),
    ("Line weights (normalised)", "", "", float(np.abs(r_lw - p_lw).max())),
    ("Node positions", "", "", float(np.abs(r_nodes - p_nodes * flip).max())),
    ("Unit points", "", "", float(np.abs(r_pts - p_pts * flip).max())),
    ("Group means", "", "", float(max(np.abs(r_means[g] - p_means[g]).max() for g in r_means))),
]
if p_var is not None:
    rows.append(("Variance explained (dims 1–2)", ", ".join(f"{v:.4f}" for v in R["variance"]),
                 ", ".join(f"{v:.4f}" for v in p_var), float(np.abs(np.array(R["variance"]) - np.array(p_var)).max())))
var_note = ""
if p_var is not None:
    rv = np.array(R["variance"])
    if np.abs(rv / rv.sum() - np.array(p_var)).max() < 1e-9 and abs(rv.sum() - 1) > 1e-9:
        var_note = (f" Variance explained: rENA gives each dimension's share of the total variance over all "
                    f"dimensions ({rv.sum():.1%} for these two); pyENA's variance_ is renormalised over the "
                    f"{len(p_var)} retained dimensions only, so it sums to 1. pyENA's values equal rENA's "
                    "divided by their sum.")
axis_note = ("Axis signs agree." if (flip > 0).all() else
             f"pyENA's axis {', '.join(str(d + 1) for d in range(2) if flip[d] < 0)} is flipped relative to rENA "
             "(SVD axes are defined only up to sign); positions are compared after flipping it.")

# ── Page ──────────────────────────────────────────────────────────────────────
esc = html.escape


def status(v):
    if isinstance(v, bool):
        return ("PASS", "match") if v else ("FAIL", "differ")
    return ("PASS", f"max |Δ| = {v:.2e}") if v <= 1e-9 else (
        ("WARN", f"max |Δ| = {v:.2e}") if v <= 1e-6 else ("FAIL", f"max |Δ| = {v:.2e}"))


table = "".join(
    f"<tr><td>{esc(n)}</td><td>{esc(a)}</td><td>{esc(b)}</td>"
    f"<td><span class='st st-{status(v)[0].lower()}'>{status(v)[0]}</span> {esc(status(v)[1])}</td></tr>"
    for n, a, b, v in rows)
sections = "".join(f"""
<section><h2>{esc({'FirstGame': 'FirstGame mean network', 'SecondGame': 'SecondGame mean network', 'subtract': 'FirstGame − SecondGame'}[v])}</h2>
<div class="cols">
  <div><h3>rENA {esc(R['version'])} <span class="tag">R</span></h3><iframe src="panels/rena_{v}.html"></iframe>
    <pre><code>{esc(QE_CODE['rena'][v])}</code></pre></div>
  <div><h3>pyENA <span class="tag">Python</span></h3><iframe src="panels/pyena_{v}.html"></iframe>
    <pre><code>{esc(QE_CODE['pyena'][v])}</code></pre></div>
</div></section>""" for v in VIEWS)

page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>rENA vs pyENA</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; }}
  body {{ font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem 2rem; background: #f4f4f5; color: #111; }}
  h1 {{ font-size: 1.35rem; margin: 0 0 .25rem; }} .sub {{ color: #555; font-size: .85rem; margin: 0 0 1.25rem; }}
  section {{ background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; }}
  h2 {{ font-size: 1rem; margin: 0 0 .6rem; }} h3 {{ font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: #666; margin: 0 0 .4rem; }}
  .tag {{ font-size: .65rem; background: #e5e7eb; padding: 1px 6px; border-radius: 4px; text-transform: none; letter-spacing: 0; }}
  .cols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }} .cols > div {{ min-width: 0; }}
  iframe {{ width: 100%; height: 440px; border: 1px solid #e5e7eb; border-radius: 4px; background: #fff; }}
  pre {{ background: #f6f8fa; border: 1px solid #e5e7eb; border-radius: 4px; padding: .6rem .75rem; font-size: .74rem;
         line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; margin: .4rem 0 0; }}
  table {{ width: 100%; border-collapse: collapse; font-size: .8rem; }} th, td {{ text-align: left; padding: .3rem .45rem; border-bottom: 1px solid #eee; vertical-align: top; }}
  th {{ color: #666; font-weight: 500; }}
  .st {{ font-weight: 600; font-size: .7rem; padding: 1px 6px; border-radius: 3px; }}
  .st-pass {{ background: #e8f5e9; color: #2e7d32; }} .st-warn {{ background: #fff8e1; color: #8d6e00; }} .st-fail {{ background: #ffebee; color: #c62828; }}
  .note {{ font-size: .8rem; color: #444; margin: .5rem 0 0; }}
  @media (max-width: 900px) {{ .cols {{ grid-template-columns: 1fr; }} body {{ padding: 1rem; }} }}
</style></head><body>
<h1>rENA vs pyENA — the same ENA analysis</h1>
<p class="sub">RS.data · units Condition + UserName · conversations Condition + GroupName · 6 codes · window 4 · SVD ·
rENA {esc(R['version'])} (libqe {esc(R['libqe'])}) · pyENA {esc(getattr(pyena, '__version__', '0.1.2'))} · both drawn with qeviz {esc(qeviz.__dict__.get('__version__', '0.5.3'))}</p>
<section><h2>Model comparison</h2>
<table><thead><tr><th>Quantity</th><th>rENA</th><th>pyENA</th><th>Result</th></tr></thead><tbody>{table}</tbody></table>
<p class="note">{esc(axis_note)} Units, codes and connections are matched by name.{esc(var_note)}</p></section>
<section><h2>Code</h2><div class="cols">
  <div><h3>rENA</h3><pre><code>{esc(R['code'])}</code></pre></div>
  <div><h3>pyENA</h3><pre><code>{esc(CODE)}</code></pre></div></div></section>
{sections}
</body></html>"""
open(os.path.join(OUT, "index.html"), "w").write(page)
for n, a, b, v in rows:
    print(f"{n:32s} {status(v)[0]:5s} {status(v)[1]}")
print(axis_note + var_note)
print("Wrote", os.path.join(OUT, "index.html"))
