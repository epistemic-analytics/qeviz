# rENA vs pyENA side by side

Runs the same ENA analysis in rENA and in pyENA (RS.data · units Condition +
UserName · conversations Condition + GroupName · 6 codes · window 4 · SVD),
draws both models with the same qeviz calls, and compares the numbers: line
weights, node positions, unit points, group means and variance explained,
matched by unit / code / connection name.

```sh
RENA_SRC=~/Workspaces/RStudio/rENA Rscript tools/rena-pyena/rena.R   # rENA + RS.data.csv
python tools/rena-pyena/compare.py                                 # pyENA + out/index.html
```

`compare.py` needs `pyena` and `pylibqe` (from `rENA/python` and
`libqe/python`) and imports this checkout's qeviz. rENA and pyENA should use
the same libqe version. Open `out/index.html` through a local server
(`python -m http.server` at the repo root): the plots are iframes.
