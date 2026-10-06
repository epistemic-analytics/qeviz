"""tools/readme-demo/generate.py — the demo images for the Python READMEs.

Fits RS.data with pyENA, draws two plots with qeviz and screenshots them with
headless Chrome (2x, white background):

  out/pyena-rs-subtraction.png   → rENA/python/docs/  (pyENA README)
  out/qeviz-rs-network.png       → qeviz/py/docs/     (qeviz Python README)

    python tools/readme-demo/generate.py ~/Workspaces/RStudio/rENA/inst/extdata/rs.data.csv

needs pyena + pylibqe. rs.data.csv is rENA's inst/extdata/rs.data.csv (code
columns named with spaces); the code shown in the READMEs is the code below.
"""
import os
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
sys.path.insert(0, os.path.join(HERE, "..", "..", "py"))      # this checkout's qeviz
os.makedirs(OUT, exist_ok=True)

import pandas as pd                                             # noqa: E402
from pyena import ENA                                           # noqa: E402
import qeviz                                                    # noqa: E402

CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
W, H = 640, 480

rs = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "rs.data.csv")
codes = ["Data", "Technical Constraints", "Performance Parameters",
         "Client and Consultant Requests", "Design Reasoning", "Collaboration"]
rs["unit"] = rs["Condition"] + "::" + rs["UserName"]
rs["convo"] = rs["Condition"] + "::" + rs["GroupName"]
model = ENA().fit(rs, "unit", "convo", codes, window_size=4)

base = dict(group_col="Condition", width=W, height=H)
plots = {
    # pyENA README: the two conditions compared.
    "pyena-rs-subtraction": qeviz.from_pyena(model, title="FirstGame − SecondGame", **base)
        .edges("FirstGame", compare="SecondGame", color_scale="plot", magnify=3).group(),
    # qeviz README: one condition's network, its units and mean.
    "qeviz-rs-network": qeviz.from_pyena(model, title="FirstGame", **base)
        .edges("FirstGame").points().group("FirstGame"),
}



def screenshot(page: str, png: str, profile: str, timeout: float = 60.0) -> None:
    """Headless Chrome keeps running after the screenshot while the page
    animates, so wait for the PNG to be written and stop growing, then end it."""
    if os.path.exists(png):
        os.remove(png)
    proc = subprocess.Popen(
        [CHROME, "--headless=new", f"--user-data-dir={profile}", "--hide-scrollbars",
         f"--window-size={W},{H}", "--force-device-scale-factor=2",
         "--virtual-time-budget=4000", "--default-background-color=ffffffff",
         f"--screenshot={png}", f"file://{page}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    start, last = time.time(), -1
    try:
        while time.time() - start < timeout:
            if proc.poll() is not None and os.path.exists(png):
                return
            size = os.path.getsize(png) if os.path.exists(png) else -1
            if size > 0 and size == last:
                return
            last = size
            time.sleep(1)
        raise TimeoutError(f"no screenshot from Chrome for {page}")
    finally:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()


with tempfile.TemporaryDirectory(prefix="qeviz-readme-chrome-") as profile:
    for name, p in plots.items():
        page = os.path.join(OUT, f"{name}.html")
        p.export_html(page)
        png = os.path.join(OUT, f"{name}.png")
        screenshot(page, png, profile)
        print("wrote", png)
