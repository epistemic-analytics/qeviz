// Pure, DOM-free polynomial trajectory fitting.
//
// Ported from `ena.plot.trajectory()` in the ETM Explorer (RescuShell) R kit:
//   - near-origin filtering of the fit set (points at the cumulative origin are
//     drawn but excluded from the fit),
//   - `loocv_2d` degree selection (joint 2D leave-one-out CV via the hat-matrix
//     shortcut), with a `fixed` escape hatch,
//   - least-squares polynomial fit solved by QR for numerical parity with R's
//     `lm(y ~ poly(t, deg))`.
//
// Leverages and residuals depend only on the column space of the design, so a
// raw monomial basis solved by QR reproduces R's selected degree and fitted
// curve to floating-point tolerance despite R using orthogonal `poly()`.

/** Near-origin tolerance; hardcoded to match the R kit's `zero_eps` default. */
export const TRAJECTORY_ZERO_EPS = 1e-8;

export interface XY {
  x: number;
  y: number;
}

export type DegreeSelection = 'loocv_2d' | 'fixed';

export interface TrajectoryFit {
  degree: number;
  coeffsX: number[];
  coeffsY: number[];
}

/** Drop near-origin points (both coords within eps of 0) from the fit set. */
export function nearOriginFilter(pts: XY[], eps: number = TRAJECTORY_ZERO_EPS): XY[] {
  return pts.filter(p => Math.abs(p.x) > eps || Math.abs(p.y) > eps);
}

/** Evenly spaced parameter t in [0,1] by index — matches R's seq(0,1,length.out=n). */
function normalizedT(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const t = new Array(n);
  for (let i = 0; i < n; i++) t[i] = i / (n - 1);
  return t;
}

/** Vandermonde design [1, t, t^2, ..., t^deg], n×(deg+1). */
function design(t: number[], degree: number): number[][] {
  return t.map(ti => {
    const row = new Array(degree + 1);
    let p = 1;
    for (let k = 0; k <= degree; k++) {
      row[k] = p;
      p *= ti;
    }
    return row;
  });
}

/**
 * Modified Gram-Schmidt QR. `A` is n×m (n >= m). Returns Q (n×m, orthonormal
 * columns) and R (m×m upper triangular). More stable than raw normal equations,
 * matching what R's `lm` does internally.
 */
function qr(A: number[][]): { Q: number[][]; R: number[][] } {
  const n = A.length;
  const m = A[0].length;
  const Q = A.map(row => row.slice());
  const R = Array.from({ length: m }, () => new Array(m).fill(0));
  for (let j = 0; j < m; j++) {
    let norm = 0;
    for (let i = 0; i < n; i++) norm += Q[i][j] * Q[i][j];
    norm = Math.sqrt(norm);
    R[j][j] = norm;
    if (norm > 1e-300) {
      for (let i = 0; i < n; i++) Q[i][j] /= norm;
    }
    for (let k = j + 1; k < m; k++) {
      let dot = 0;
      for (let i = 0; i < n; i++) dot += Q[i][j] * Q[i][k];
      R[j][k] = dot;
      for (let i = 0; i < n; i++) Q[i][k] -= dot * Q[i][j];
    }
  }
  return { Q, R };
}

/** Qᵀy (length m). */
function qtY(Q: number[][], y: number[]): number[] {
  const n = Q.length;
  const m = Q[0].length;
  const out = new Array(m).fill(0);
  for (let j = 0; j < m; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Q[i][j] * y[i];
    out[j] = s;
  }
  return out;
}

/** Back-substitution for R c = b, R upper triangular m×m. */
function backSolve(R: number[][], b: number[]): number[] {
  const m = b.length;
  const c = new Array(m).fill(0);
  for (let i = m - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < m; j++) s -= R[i][j] * c[j];
    c[i] = Math.abs(R[i][i]) > 1e-12 ? s / R[i][i] : 0;
  }
  return c;
}

/** Leverages h_ii = sum_j Q[i][j]^2 (diagonal of the hat matrix). */
function leverages(Q: number[][]): number[] {
  return Q.map(row => {
    let s = 0;
    for (let j = 0; j < row.length; j++) s += row[j] * row[j];
    return s;
  });
}

/** Least-squares monomial coefficients for y ~ poly(t, degree). */
function fitCoeffs(t: number[], y: number[], degree: number): number[] {
  const X = design(t, degree);
  const { Q, R } = qr(X);
  return backSolve(R, qtY(Q, y));
}

/** Evaluate a monomial polynomial (ascending coeffs) at t. */
export function evalPoly(coeffs: number[], t: number): number {
  let v = 0;
  let p = 1;
  for (let k = 0; k < coeffs.length; k++) {
    v += coeffs[k] * p;
    p *= t;
  }
  return v;
}

/**
 * Joint 2D leave-one-out CV PRESS for a candidate degree. x(t) and y(t) share
 * one design (hence one hat matrix), so LOO residuals are e_i / (1 - h_ii).
 * Returns Infinity for a degenerate (saturated) fit so it is never selected.
 */
function loocv2d(t: number[], x: number[], y: number[], degree: number): number {
  const X = design(t, degree);
  const { Q, R } = qr(X);
  const h = leverages(Q);
  const cx = backSolve(R, qtY(Q, x));
  const cy = backSolve(R, qtY(Q, y));
  let press = 0;
  for (let i = 0; i < t.length; i++) {
    const denom = 1 - h[i];
    if (denom <= 0) return Infinity;
    const ex = x[i] - evalPoly(cx, t[i]);
    const ey = y[i] - evalPoly(cy, t[i]);
    press += (ex / denom) ** 2 + (ey / denom) ** 2;
  }
  return press;
}

/**
 * Select a degree in 1..min(maxDegree, n-1). For `loocv_2d`, minimises the joint
 * 2D LOOCV PRESS; ties resolve to the smallest degree (matching R's which.min).
 * For `fixed`, or when there are too few points to run CV, returns the cap.
 */
export function selectDegree(fitPts: XY[], maxDegree: number, mode: DegreeSelection): number {
  const n = fitPts.length;
  const cap = Math.min(Math.max(1, Math.floor(maxDegree)), Math.max(1, n - 1));
  if (mode === 'fixed' || n < 3) return cap;
  const t = normalizedT(n);
  const x = fitPts.map(p => p.x);
  const y = fitPts.map(p => p.y);
  let best = 1;
  let bestVal = Infinity;
  for (let deg = 1; deg <= cap; deg++) {
    const v = loocv2d(t, x, y, deg);
    if (v < bestVal) {
      bestVal = v;
      best = deg;
    }
  }
  return best;
}

/**
 * Fit a trajectory polynomial. The near-origin filter is applied to both the
 * per-frame points and the (optional) full-trajectory `selectionSet`. The degree
 * is chosen on `selectionSet` when given — so it stays constant as a playhead
 * scrubs a growing prefix — then clamped to what the current frame can support,
 * and the coefficients are re-fit on the current frame's points.
 *
 * Returns null when fewer than three non-origin points are available (matching
 * the R kit's n_fit < 3 guard); callers should fall back to raw steps.
 */
export function fitTrajectory(
  activePts: XY[],
  opts: { maxDegree: number; degreeSelection: DegreeSelection; selectionSet?: XY[] | null }
): TrajectoryFit | null {
  const fitPts = nearOriginFilter(activePts);
  if (fitPts.length < 3) return null;

  const selBasis = opts.selectionSet ? nearOriginFilter(opts.selectionSet) : fitPts;
  const basis = selBasis.length >= 3 ? selBasis : fitPts;
  let degree = selectDegree(basis, opts.maxDegree, opts.degreeSelection);

  // A growing playhead prefix may hold fewer points than the held degree needs.
  degree = Math.min(degree, Math.max(1, fitPts.length - 1));

  const t = normalizedT(fitPts.length);
  const coeffsX = fitCoeffs(t, fitPts.map(p => p.x), degree);
  const coeffsY = fitCoeffs(t, fitPts.map(p => p.y), degree);
  return { degree, coeffsX, coeffsY };
}

/** Sample the fitted curve at steps+1 evenly spaced points over t in [0,1]. */
export function sampleCurve(fit: TrajectoryFit, steps = 100): XY[] {
  const out: XY[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    out.push({ x: evalPoly(fit.coeffsX, t), y: evalPoly(fit.coeffsY, t) });
  }
  return out;
}
