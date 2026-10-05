# Cross-language golden fixtures

`golden.json` holds, for each named scenario, the `<qe-graph>` markup and the
full ModelData that the **R package** produces from the shared CSV fixture in
`fixture/`. The Python and Julia test suites rebuild every scenario by name
with their own API and must match it: markup attribute for attribute (plot
`width` / `height` aside), model data to 1e-9.

- Python: `py/tests/test_golden.py` (`cd py && python3 -m pytest`)
- Julia: `julia/test/golden.jl` (`cd julia && julia --project=. -e 'using Pkg; Pkg.test()'`)

Regenerate after any change to the R API, then add the scenario to both test
files (each checks that it covers every scenario in `golden.json`):

```sh
Rscript tests/golden/gen_golden.R
```
