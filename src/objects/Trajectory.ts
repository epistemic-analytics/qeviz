import { PlottedObject, PlottedObjectOptions, Point } from './PlottedObject';
import { Color } from './Color';
import { DegreeSelection, fitTrajectory, sampleCurve } from './polyfit';

export interface TrajectoryOptions {
  ID?: string;
  unitId?: string;
  points?: Point[] | { x: number; y: number; time?: number; label?: string }[];
  color?: Color | string;
  smooth?: 'none' | 'poly' | 'spline';
  maxDegree?: number;
  degreeSelection?: DegreeSelection;
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

const TRAJECTORY_CURVE_STEPS = 100;

export class Trajectory extends PlottedObject {
  readonly _typeName: string = 'Trajectory';
  trajPoints: Point[] = [];
  smooth: 'none' | 'poly' | 'spline' = 'none';
  maxDegree: number = 3;
  degreeSelection: DegreeSelection = 'loocv_2d';
  /** Degree chosen at the most recent fit; -1 until a poly curve is built. */
  selectedDegree: number = -1;
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
    this.maxDegree = options.maxDegree !== undefined ? options.maxDegree : 3;
    this.degreeSelection = options.degreeSelection || 'loocv_2d';
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
      // Precomputed coefficients override the fit (caller-supplied curve).
      if (this.polyCoeffsX.length > 0 && this.polyCoeffsY.length > 0) {
        return sampleCurve(
          { degree: this.polyCoeffsX.length - 1, coeffsX: this.polyCoeffsX, coeffsY: this.polyCoeffsY },
          TRAJECTORY_CURVE_STEPS
        );
      }

      // Select the degree on the full trajectory so it stays constant while a
      // playhead scrubs a growing prefix; fit coefficients on the visible frame.
      const fit = fitTrajectory(
        pts.map(p => ({ x: p.x, y: p.y })),
        {
          maxDegree: this.maxDegree,
          degreeSelection: this.degreeSelection,
          selectionSet: this.trajPoints.map(p => ({ x: p.x, y: p.y }))
        }
      );
      if (fit) {
        this.selectedDegree = fit.degree;
        return sampleCurve(fit, TRAJECTORY_CURVE_STEPS);
      }
      // Too few non-origin points to fit — fall back to raw steps below.
    }

    return pts.map(pt => ({ x: pt.x, y: pt.y }));
  }
}
