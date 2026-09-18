#!/usr/bin/env bash
# Trajectory fit parity check: R reference (ena.plot.trajectory algorithm) vs the
# TS port in src/objects/polyfit.ts. Exits non-zero on any mismatch.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="$ROOT/tools/parity"

echo "== Generating R reference =="
Rscript "$DIR/gen_reference.R"

echo "== Bundling TS fitter =="
"$ROOT/node_modules/.bin/esbuild" "$ROOT/src/objects/polyfit.ts" \
  --bundle --format=esm --platform=node --log-level=warning \
  --outfile="$DIR/polyfit.mjs"

echo "== Comparing =="
node "$DIR/check.mjs"
