import { PlottedObject, PlottedObjectOptions, Point } from './PlottedObject';
import { Color } from './Color';

export interface TrajectoryOptions {
  ID?: string;
  unitId?: string;
  points?: Point[] | { x: number; y: number; time?: number; label?: string }[];
  color?: Color | string;
  smooth?: 'none' | 'poly' | 'spline';
  polyCoeffsX?: number[];
  polyCoeffsY?: number[];
  currentTime?: number;
  showPoints?: boolean;
  showTips?: boolean;
  lineStyle?: 'uniform' | 'tapered';
  strokeWidth?: number;
  strokeWidthRange?: [number, number];
  opacityRange?: [number, number];
  size?: number;
  active?: boolean;
  meta?: any;
  [key: string]: any;
}

function fitPolynomial(t: number[], y: number[], deg: number): number[] {
  const n = t.length;
  const degree = Math.min(deg, Math.max(1, n - 1));
  if (n <= 1) return [y[0] || 0];

  const m = degree + 1;
  const ATA: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  const ATy: number[] = new Array(m).fill(0);

  const powers = new Array(2 * degree + 1).fill(0);
  for (let i = 0; i < n; i++) {
    let p = 1;
    for (let k = 0; k <= 2 * degree; k++) {
      powers[k] += p;
      p *= t[i];
    }
    let yp = y[i];
    let tp = 1;
    for (let k = 0; k <= degree; k++) {
      ATy[k] += yp * tp;
      tp *= t[i];
    }
  }

  for (let r = 0; r < m; r++) {
    for (let c = 0; c < m; c++) {
      ATA[r][c] = powers[r + c];
    }
  }

  for (let i = 0; i < m; i++) {
    let maxRow = i;
    for (let k = i + 1; k < m; k++) {
      if (Math.abs(ATA[k][i]) > Math.abs(ATA[maxRow][i])) {
        maxRow = k;
      }
    }
    const tempRow = ATA[i];
    ATA[i] = ATA[maxRow];
    ATA[maxRow] = tempRow;
    const tempY = ATy[i];
    ATy[i] = ATy[maxRow];
    ATy[maxRow] = tempY;

    const pivot = ATA[i][i];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let k = i + 1; k < m; k++) {
      const factor = ATA[k][i] / pivot;
      for (let j = i; j < m; j++) {
        ATA[k][j] -= factor * ATA[i][j];
      }
      ATy[k] -= factor * ATy[i];
    }
  }

  const coeffs = new Array(m).fill(0);
  for (let i = m - 1; i >= 0; i--) {
    let sum = ATy[i];
    for (let j = i + 1; j < m; j++) {
      sum -= ATA[i][j] * coeffs[j];
    }
    coeffs[i] = Math.abs(ATA[i][i]) > 1e-12 ? sum / ATA[i][i] : 0;
  }

  return coeffs;
}

export class Trajectory extends PlottedObject {
  readonly _typeName: string = 'Trajectory';
  trajPoints: Point[] = [];
  smooth: 'none' | 'poly' | 'spline' = 'none';
  degree: number = 3;
  polyCoeffsX: number[] = [];
  polyCoeffsY: number[] = [];
  currentTime: number = Infinity;
  showPoints: boolean = true;
  showTips: boolean = true;
  lineStyle: 'uniform' | 'tapered' = 'uniform';
  strokeWidth: number = 2;
  strokeWidthRange: [number, number] = [1, 6];
  opacityRange: [number, number] = [0.3, 1];

  constructor(options: TrajectoryOptions = {}) {
    const defaultColor = options.color instanceof Color ? options.color : new Color(typeof options.color === 'string' ? options.color : '#000000');
    super([], {
      ID: options.ID || `traj-${Math.random().toString(36).substring(2, 9)}`,
      size: options.size || 1,
      color: defaultColor,
      highlight: null,
      active: options.active || false,
      meta: options.meta || {},
      ...options
    } as PlottedObjectOptions);

    this.smooth = options.smooth || 'none';
    this.degree = options.degree !== undefined ? options.degree : 3;
    this.polyCoeffsX = options.polyCoeffsX || [];
    this.polyCoeffsY = options.polyCoeffsY || [];
    this.currentTime = options.currentTime !== undefined ? options.currentTime : Infinity;
    this.showPoints = options.showPoints !== undefined ? options.showPoints : true;
    this.showTips = options.showTips !== undefined ? options.showTips : true;
    this.lineStyle = options.lineStyle || 'uniform';
    this.strokeWidth = options.strokeWidth || 2;
    this.strokeWidthRange = options.strokeWidthRange || [1, 6];
    this.opacityRange = options.opacityRange || [0.3, 1];

    if (options.points && Array.isArray(options.points)) {
      this.trajPoints = options.points.map(p => {
        if (p instanceof Point) return p;
        const pt = new Point({ dimensions: [p.x, p.y], meta: { time: p.time, label: p.label } });
        pt.x = p.x;
        pt.y = p.y;
        return pt;
      });
    }
  }

  get activePoints(): Point[] {
    if (this.currentTime === Infinity) {
      return this.trajPoints;
    }
    return this.trajPoints.filter(p => {
      const t = (p.meta && typeof p.meta.time === 'number') ? p.meta.time : 0;
      return t <= this.currentTime;
    });
  }

  get path(): string {
    return this.pathPoints.reduce((acc, pt, idx) => {
      return idx === 0 ? `M${pt.x},${pt.y}` : `${acc} L${pt.x},${pt.y}`;
    }, '');
  }

  get pathPoints(): Array<{ x: number; y: number }> {
    const pts = this.activePoints;
    if (pts.length < 2) return [];

    if (this.smooth === 'poly') {
      let cx = this.polyCoeffsX;
      let cy = this.polyCoeffsY;

      if (cx.length === 0 || cy.length === 0) {
        const tNorm = pts.map((_, i) => i / (pts.length - 1 || 1));
        const xs = pts.map(p => p.x);
        const ys = pts.map(p => p.y);
        cx = fitPolynomial(tNorm, xs, this.degree);
        cy = fitPolynomial(tNorm, ys, this.degree);
      }

      const nSteps = 100;
      const degX = cx.length - 1;
      const degY = cy.length - 1;
      const pathPts: Array<{ x: number; y: number }> = [];

      for (let s = 0; s <= nSteps; s++) {
        const t = s / nSteps;
        let px = 0;
        let py = 0;

        let tPow = 1;
        for (let k = 0; k <= degX; k++) {
          px += cx[k] * tPow;
          tPow *= t;
        }

        tPow = 1;
        for (let k = 0; k <= degY; k++) {
          py += cy[k] * tPow;
          tPow *= t;
        }

        pathPts.push({ x: px, y: py });
      }
      return pathPts;
    }

    return pts.map(pt => ({ x: pt.x, y: pt.y }));
  }
}
