// Parity checker: runs the TS trajectory fitter (bundled from src/objects/polyfit.ts)
// on the same fixture points as gen_reference.R and compares the selected degree
// (exact) and sampled curve (within tolerance) against reference.json.
//
// Usage: node tools/parity/check.mjs   (run.sh bundles polyfit first)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { fitTrajectory, sampleCurve } = await import(join(here, 'polyfit.mjs'));

const ref = JSON.parse(readFileSync(join(here, 'reference.json'), 'utf8'));

const CURVE_TOL = 1e-6;
let failures = 0;

for (const unit of ref.units) {
  const pts = unit.points.map(p => ({ x: p.x, y: p.y }));
  const fit = fitTrajectory(pts, {
    maxDegree: unit.max_degree,
    degreeSelection: 'loocv_2d',
    selectionSet: pts,
  });

  if (!fit) {
    console.error(`FAIL ${unit.unit}: TS returned no fit`);
    failures++;
    continue;
  }

  const degreeOk = fit.degree === unit.degree;

  const curve = sampleCurve(fit, ref.samples - 1);
  let maxDiff = 0;
  for (let i = 0; i < curve.length; i++) {
    maxDiff = Math.max(
      maxDiff,
      Math.abs(curve[i].x - unit.curve_x[i]),
      Math.abs(curve[i].y - unit.curve_y[i]),
    );
  }
  const curveOk = maxDiff < CURVE_TOL;

  if (degreeOk && curveOk) {
    console.log(`PASS ${unit.unit}: degree=${fit.degree}, max curve Δ=${maxDiff.toExponential(2)}`);
  } else {
    failures++;
    if (!degreeOk) console.error(`FAIL ${unit.unit}: degree TS=${fit.degree} R=${unit.degree}`);
    if (!curveOk) console.error(`FAIL ${unit.unit}: max curve Δ=${maxDiff.toExponential(2)} > ${CURVE_TOL}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} unit(s) failed parity.`);
  process.exit(1);
}
console.log(`\nAll ${ref.units.length} units match R within tolerance.`);
