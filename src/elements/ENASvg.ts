import { DefaultGraphOptions, Graph } from "../objects/Graph";
import { DrawableElement } from "./DrawableElement";
import { ENAArray, ENAElement, ENALayer } from "./ENALayer";
import VizENAElement from "./VizENA";
import { DataFrame, DataFrameColumn, DataFrameRow } from "../types/DataFrame";
import { ENAPoint } from "./ENAPoint";
import { ENALine } from "./ENALine";
import { AxisPoint } from "../objects/AxisPoint";
import { Edge } from "../objects/Edges";
import { Label, Line, Point } from "../objects/PlottedObject";
import { Color } from "../objects/Color";
import { ENALabel } from "./ENALabel";

// Accessible color palette for group assignment (Paul Tol's bright scheme)
const GROUP_PALETTE = [
  '#4477AA', '#EE6677', '#228833', '#CCBB44',
  '#66CCEE', '#AA3377', '#BBBBBB', '#000000',
];

/**
 * Parse an edge column name into the two code IDs it connects.
 * Edge columns use "." as separator between the two codes, but codes can
 * themselves contain "." (e.g. "Technical.Constraints"). We resolve the
 * ambiguity by trying every prefix that matches a known code.
 */
function parseEdgePair(colName: string, codes: string[]): [string, string] | null {
  for (const c1 of codes) {
    if (colName.startsWith(c1 + '.')) {
      const c2 = colName.slice(c1.length + 1);
      if (codes.includes(c2)) return [c1, c2];
    }
  }
  return null;
}

/**
 * Compute half-width and half-height for a 95% CI rectangle on the group mean.
 *
 * Each axis is treated independently: half-extent = t(df,0.975) × SE,
 * where SE = sqrt(variance / n) and df = n − 1.  This matches the standard
 * ENA rectangular CI displayed in the rENA / Web ENA tools.
 *
 * Inputs are the *raw* (un-scaled) variances; pointScale is applied here so
 * the returned values are in SVG coordinate space.
 */
function computeCIRect(
  varX: number, varY: number, n: number, pointScale: number
): { halfW: number; halfH: number } {
  // t(df, 0.975) — rough approximation good to ±0.02 for df ≥ 3
  const df = Math.max(1, n - 1);
  const t95 = df >= 120 ? 1.960
            : df >=  60 ? 2.000
            : df >=  30 ? 2.042
            : df >=  20 ? 2.086
            : df >=  10 ? 2.228
            : df >=   5 ? 2.571
            :             4.303; // df = 1
  const seX = Math.sqrt(Math.max(0, varX) / n) * pointScale;
  const seY = Math.sqrt(Math.max(0, varY) / n) * pointScale;
  return { halfW: t95 * seX, halfH: t95 * seY };
}

function readIntervalBounds(
  row: DataFrameRow, dim0: string, dim1: string
): { x_low: number; x_high: number; y_low: number; y_high: number } | null {
  const get = (col: string) => {
    const i = row.names.indexOf(col);
    return i >= 0 ? Number(row[i]) : undefined;
  };
  const xLow  = get(`${dim0}.low`)  ?? get(`${dim0}_low`);
  const xHigh = get(`${dim0}.high`) ?? get(`${dim0}_high`);
  const yLow  = get(`${dim1}.low`)  ?? get(`${dim1}_low`);
  const yHigh = get(`${dim1}.high`) ?? get(`${dim1}_high`);
  if (xLow == null || xHigh == null || yLow == null || yHigh == null) return null;
  return { x_low: xLow, x_high: xHigh, y_low: yLow, y_high: yHigh };
}

/**
 * Parse a label-mode attribute string into a Label.DISPLAY_TYPES integer.
 *   "on"    → 3 (ON)
 *   "off"   → 0 (OFF)
 *   "click" → 2 (CLICK)
 *   "auto"  → 1 (AUTO)
 * Returns `defaultMode` for any unrecognized value or null.
 */
function parseLabelMode(attr: string | null, defaultMode: number): number {
  switch (attr?.toLowerCase()) {
    case 'on':    return 3;
    case 'off':   return 0;
    case 'click': return 2;
    case 'auto':  return 1;
    default:      return defaultMode;
  }
}

export class ENASvgElement extends DrawableElement implements ENAElement {
  static tagName: string = "ena-graph";

  static style: string = `
    ${DrawableElement.style}

    :host {
      display: block;
    }

    .wrapper {
      width: 100%;
      height: 100%;
    }

    svg {
      width: 100%;
      height: 100%;
      aspect-ratio: 1 / 1;
      background-color: #FFF;
    }
  `;

  svg_element: SVGElement;
  graph: ENASvgElement;
  parent: SVGElement | null;
  zoom_level: number = 1;

  __data__: Graph;
  __children__: ENAArray = new ENAArray();
  __name__: string;
  

  private _vizena!: VizENAElement;
  get vizena() {
    return this._vizena;
  }

  // SVG <rect> elements for per-group CI boxes, keyed by group name.
  // Managed directly (not via ENALayer) so they render behind unit points.
  private _ciRects: Map<string, SVGRectElement> = new Map();
  private _outlierRects: Map<string, SVGRectElement> = new Map();

  // Cached reference to the labels <g> layer — set once in connectedCallback()
  // after draw() so it is guaranteed to be in the SVG DOM.
  private _labelsGroup: SVGGElement | null = null;

  // SVG <text> label elements for nodes, mean points, and unit points.
  private _nodeLabels:  Map<string, ENALabel> = new Map();
  private _meanLabels:  Map<string, ENALabel> = new Map();
  private _pointLabels: Map<string, ENALabel> = new Map();

  // Cached model received from the most recent model-updated event.
  // Using event.detail decouples ena-graph from the parent-element assumption.
  private _currentModel: any = null;

  private _points: any = {
    add: (points: DataFrame) => {
      points.rows().forEach((row: DataFrameRow, i: number) => {
        this.__data__.add_point(row);
      });

      this.__data__.__state__.setVariable("graph_updated_points", this.__data__.points );
    }
  }

  constructor() {
    super();

    this.graph = this;
    this.parent = null;

    this.__data__ = new Graph(DefaultGraphOptions);
    this.__name__ = this.__data__.name || "unnamed-graph";
    this.svg_element = this.create();

    console.log("Created ena-graph svg element: ", this.svg_element);

    // Listen for the model-updated CustomEvent dispatched by VisualENAElement.
    // The Model object is carried in event.detail, so ena-graph works whether it
    // is a child, sibling, or anywhere else relative to ena-visual.
    document.addEventListener('model-updated', (e: Event) => {
      const model = (e as CustomEvent).detail;
      if (!model) return;
      this._currentModel = model;

      const dims = model.dimensions as string[];

      // ── Group color map ──────────────────────────────────────────────────────
      // Detect the group column: the first character-typed column in points that
      // is not the unit ID column ('QEUNIT').
      const groupColorMap: Record<string, string> = {};
      let groupColName: string | null = null;
      if (model.points?.names) {
        groupColName = model.points.names.find((n: string) => {
          if (n === 'QEUNIT') return false;
          const col = model.points.col(n);
          return col && col.type === 'character';
        }) ?? null;
        if (groupColName) {
          const groupCol = model.points.col(groupColName);
          const uniqueGroups: string[] = [...new Set([...groupCol].map(String))];
          uniqueGroups.forEach((g, i) => {
            groupColorMap[g] = GROUP_PALETTE[i % GROUP_PALETTE.length];
          });
        }
      }

      // ── Point-to-node coordinate scaling ────────────────────────────────────
      // Unit point coordinates are in a different (typically much smaller) range
      // than code node coordinates. When scale-points is enabled (default true),
      // we rescale all unit/mean point coordinates so the outermost point lands
      // at the same radius as the outermost node, spreading the cloud to fill the
      // network rather than collapsing it near the origin.
      const scalePointsEnabled = this.getAttribute('scale-points') !== 'false';

      const getExtent = (rows: DataFrameRow[]): number => {
        let max = 0;
        rows.forEach(row => {
          const xIdx = row.names.indexOf(dims[0]);
          const yIdx = dims.length > 1 ? row.names.indexOf(dims[1]) : -1;
          if (xIdx >= 0) max = Math.max(max, Math.abs(Number(row[xIdx])));
          if (yIdx >= 0) max = Math.max(max, Math.abs(Number(row[yIdx])));
        });
        return max;
      };

      const maxNodeExtent  = model.nodes?.rows  ? getExtent(model.nodes.rows())  : 0;
      const maxPointExtent = model.points?.rows ? getExtent(model.points.rows()) : 0;
      const pointScale = (scalePointsEnabled && maxPointExtent > 0 && maxNodeExtent > 0)
        ? maxNodeExtent / maxPointExtent
        : 1;

      // ── Label display modes ──────────────────────────────────────────────────
      // Attributes: label-nodes, label-means, label-points
      // Values: "on" | "off" | "click" | "auto"   (case-insensitive)
      // Defaults: nodes=ON, means=ON, points=OFF
      const labelNodes  = parseLabelMode(this.getAttribute('label-nodes'),  Label.DISPLAY_TYPES.ON);
      const labelMeans  = parseLabelMode(this.getAttribute('label-means'),  Label.DISPLAY_TYPES.ON);
      const labelPoints = parseLabelMode(this.getAttribute('label-points'), Label.DISPLAY_TYPES.OFF);

      // Use the cached labels <g> reference (set once in connectedCallback).
      const labelSvg = this._labelsGroup;

      // ── Helper: build a Point from a DataFrame row ───────────────────────────
      // Looks up dimension values by column name so it works with any data format.
      // Y is negated because SVG y-axis points down while ENA convention is y-up.
      // `scale` multiplies x/y — use pointScale for unit/mean points, 1 for nodes.
      const rowToPoint = (row: DataFrameRow, idCol: string, colorStr?: string, scale = 1): Point => {
        const idIdx = row.names.indexOf(idCol);
        const xIdx  = row.names.indexOf(dims[0]);
        const yIdx  = dims.length > 1 ? row.names.indexOf(dims[1]) : -1;
        const pt = new Point({
          ID: idIdx >= 0 ? String(row[idIdx]) : (row.rowName || `pt-${Math.random().toString(36).slice(2)}`),
          dimensions: [
            xIdx >= 0 ? Number(row[xIdx]) * scale : 0,
            yIdx >= 0 ? -Number(row[yIdx]) * scale : 0,   // negate Y: SVG y-down vs ENA y-up
          ],
          meta: {},
        });
        if (colorStr) pt.color = new Color(colorStr);
        return pt;
      };

      // ── Unit points + group means ────────────────────────────────────────────
      // groupSums is used later for mean edges and CI ellipses.
      // x2/y2/xy accumulate Σ(raw²) for variance computation.
      const groupSums: Record<string, {
        x: number; y: number; x2: number; y2: number; xy: number;
        n: number; color: string;
      }> = {};

      if (this.hasAttribute('points') && model.points?.rows) {
        const pointsLayer = this.__children__.search('__children__', 'points') as ENALayer;
        if (pointsLayer) {
          model.points.rows().forEach((row: DataFrameRow) => {
            // Determine this point's group color
            const groupColIdx = groupColName ? row.names.indexOf(groupColName) : -1;
            const group = groupColIdx >= 0 ? String(row[groupColIdx]) : null;
            const colorStr = group ? (groupColorMap[group] ?? '#888888') : '#888888';

            const pt = rowToPoint(row, 'QEUNIT', colorStr, pointScale);
            this.__data__.points.set(pt.ID, pt);
            pointsLayer.__data__.objects.set(pt.ID, pt);

            // Accumulate for mean + variance (raw values — scale/negate applied later)
            if (group) {
              const xIdx = row.names.indexOf(dims[0]);
              const yIdx = dims.length > 1 ? row.names.indexOf(dims[1]) : -1;
              if (!groupSums[group]) groupSums[group] = { x: 0, y: 0, x2: 0, y2: 0, xy: 0, n: 0, color: colorStr };
              const rx = xIdx >= 0 ? Number(row[xIdx]) : 0;
              const ry = yIdx >= 0 ? Number(row[yIdx]) : 0;
              groupSums[group].x  += rx;
              groupSums[group].y  += ry;
              groupSums[group].x2 += rx * rx;
              groupSums[group].y2 += ry * ry;
              groupSums[group].xy += rx * ry;
              groupSums[group].n  += 1;
            }
          });

          // Add one mean point per group — larger (size=1.5) and same group color
          Object.entries(groupSums).forEach(([group, { x, y, n, color }]) => {
            const meanPt = new Point({
              ID: `mean-${group}`,
              dimensions: [x / n * pointScale, -(y / n) * pointScale],  // scale + negate Y
              meta: { group },
            });
            meanPt.color = new Color(color);
            meanPt.size  = 1.5;
            meanPt.shape = 'rect';   // group means render as squares
            this.__data__.points.set(meanPt.ID, meanPt);
            pointsLayer.__data__.objects.set(meanPt.ID, meanPt);
          });

          // ── 95% CI boxes on group means ────────────────────────────────────
          // On by default; disable with confidence="false" on <ena-graph>.
          // Each box spans ±t(df,0.975)×SE independently per axis — the
          // standard rectangular CI shown in the rENA / Web ENA tools.
          const showCI = this.getAttribute('confidence') !== 'false';
          if (showCI) {
            const pointsLayerSvg = pointsLayer.svg_element as SVGGElement | null;
            const sw = (maxNodeExtent > 0 ? maxNodeExtent : 1) * 0.008;

            // Remove rects for groups no longer present
            this._ciRects.forEach((el, g) => {
              if (!groupSums[g]) { el.remove(); this._ciRects.delete(g); }
            });

            if (model.confidence?.rows) {
              // Pre-computed path: use libqe interval frame
              model.confidence.rows().forEach((row: DataFrameRow) => {
                const groupIdx = row.names.indexOf('group');
                const group = groupIdx >= 0 ? String(row[groupIdx]) : (row.rowName ?? null);
                if (!group) return;
                const color = groupColorMap[group] ?? '#888888';
                const bounds = readIntervalBounds(row, dims[0] as string, dims[1] as string);
                if (!bounds) return;

                const rect_x      = bounds.x_low  * pointScale;
                const rect_y      = -bounds.y_high * pointScale;
                const rect_width  = (bounds.x_high - bounds.x_low) * pointScale;
                const rect_height = (bounds.y_high - bounds.y_low) * pointScale;

                let el = this._ciRects.get(group);
                if (!el) {
                  el = document.createElementNS('http://www.w3.org/2000/svg', 'rect') as SVGRectElement;
                  el.setAttribute('data-ci-group', group);
                  this._ciRects.set(group, el);
                }

                el.setAttribute('x',              rect_x.toString());
                el.setAttribute('y',              rect_y.toString());
                el.setAttribute('width',          rect_width.toString());
                el.setAttribute('height',         rect_height.toString());
                el.setAttribute('fill',           'none');
                el.setAttribute('stroke',         color);
                el.setAttribute('stroke-width',   sw.toString());
                el.setAttribute('stroke-opacity', '0.8');
                el.setAttribute('stroke-dasharray', `${sw * 4} ${sw * 3}`);

                if (pointsLayerSvg && !el.parentElement) {
                  pointsLayerSvg.insertBefore(el, pointsLayerSvg.firstChild);
                }
              });
            } else {
              // JS fallback: compute CI from groupSums
              Object.entries(groupSums).forEach(([group, { x, y, x2, y2, n, color }]) => {
                if (n < 2) return;

                const μx = x / n;
                const μy = y / n;

                // Raw (un-scaled) sample variances
                const rawVarX = x2 / n - μx * μx;
                const rawVarY = y2 / n - μy * μy;

                // CI half-extents in display space (pointScale applied inside)
                const { halfW, halfH } = computeCIRect(rawVarX, rawVarY, n, pointScale);

                // Display-space mean (y negated for SVG)
                const cx = μx * pointScale;
                const cy = -(μy) * pointScale;

                // Get or create <rect>
                let el = this._ciRects.get(group);
                if (!el) {
                  el = document.createElementNS('http://www.w3.org/2000/svg', 'rect') as SVGRectElement;
                  el.setAttribute('data-ci-group', group);
                  this._ciRects.set(group, el);
                }

                el.setAttribute('x',              (cx - halfW).toString());
                el.setAttribute('y',              (cy - halfH).toString());
                el.setAttribute('width',          (halfW * 2).toString());
                el.setAttribute('height',         (halfH * 2).toString());
                el.setAttribute('fill',           'none');
                el.setAttribute('stroke',         color);
                el.setAttribute('stroke-width',   sw.toString());
                el.setAttribute('stroke-opacity', '0.8');
                el.setAttribute('stroke-dasharray', `${sw * 4} ${sw * 3}`);

                // Insert before existing children → renders behind unit points
                if (pointsLayerSvg && !el.parentElement) {
                  pointsLayerSvg.insertBefore(el, pointsLayerSvg.firstChild);
                }
              });
            }
          }

          // ── Outlier boxes ─────────────────────────────────────────────────────
          // On by default; disable with outlier="false" on <ena-graph>.
          // Uses model.outlier (pre-computed by libqe::lq_outlier_ci()) only;
          // no JS fallback — outlier calculation is purely libqe's responsibility.
          const showOutlier = this.getAttribute('outlier') !== 'false';
          if (showOutlier && model.outlier?.rows) {
            const pointsLayerSvg = pointsLayer.svg_element as SVGGElement | null;
            const sw = (maxNodeExtent > 0 ? maxNodeExtent : 1) * 0.008;

            // Remove rects for groups no longer present
            this._outlierRects.forEach((el, g) => {
              if (!groupColorMap[g]) { el.remove(); this._outlierRects.delete(g); }
            });

            model.outlier.rows().forEach((row: DataFrameRow) => {
              const groupIdx = row.names.indexOf('group');
              const group = groupIdx >= 0 ? String(row[groupIdx]) : (row.rowName ?? null);
              if (!group) return;
              const color = groupColorMap[group] ?? '#888888';
              const bounds = readIntervalBounds(row, dims[0] as string, dims[1] as string);
              if (!bounds) return;

              const rect_x      = bounds.x_low  * pointScale;
              const rect_y      = -bounds.y_high * pointScale;
              const rect_width  = (bounds.x_high - bounds.x_low) * pointScale;
              const rect_height = (bounds.y_high - bounds.y_low) * pointScale;

              let el = this._outlierRects.get(group);
              if (!el) {
                el = document.createElementNS('http://www.w3.org/2000/svg', 'rect') as SVGRectElement;
                el.setAttribute('data-outlier-group', group);
                this._outlierRects.set(group, el);
              }

              el.setAttribute('x',              rect_x.toString());
              el.setAttribute('y',              rect_y.toString());
              el.setAttribute('width',          rect_width.toString());
              el.setAttribute('height',         rect_height.toString());
              el.setAttribute('fill',           'none');
              el.setAttribute('stroke',         color);
              el.setAttribute('stroke-width',   sw.toString());
              el.setAttribute('stroke-opacity', '0.5');
              el.setAttribute('stroke-dasharray', `${sw * 2} ${sw * 2}`);

              if (pointsLayerSvg && !el.parentElement) {
                pointsLayerSvg.insertBefore(el, pointsLayerSvg.firstChild);
              }
            });
          }

          // ── Labels ──────────────────────────────────────────────────────────
          if (labelSvg) {
            // Remove labels for objects that no longer exist
            this._pointLabels.forEach((lbl, id) => {
              if (!pointsLayer.__data__.objects.get(id)) { lbl.remove(); this._pointLabels.delete(id); }
            });
            this._meanLabels.forEach((lbl, id) => {
              if (!pointsLayer.__data__.objects.get(`mean-${id}`)) { lbl.remove(); this._meanLabels.delete(id); }
            });

            // Unit point labels
            if (labelPoints !== 0) {
              model.points.rows().forEach((row: DataFrameRow) => {
                const qIdx = row.names.indexOf('QEUNIT');
                const unitId = qIdx >= 0 ? String(row[qIdx]) : null;
                if (!unitId) return;
                const pt = pointsLayer.__data__.objects.get(unitId) as Point | undefined;
                if (!pt) return;
                // Trim "::GroupName" suffix for brevity
                const displayText = unitId.includes('::') ? unitId.split('::')[0] : unitId;
                let lbl = this._pointLabels.get(unitId);
                if (!lbl) {
                  lbl = new ENALabel(displayText, pt, labelSvg, this, labelPoints);
                  this._pointLabels.set(unitId, lbl);
                } else {
                  labelPoints === Label.DISPLAY_TYPES.ON ? lbl.show() : lbl.hide();
                }
              });
            }

            // Mean labels
            if (labelMeans !== 0) {
              Object.entries(groupSums).forEach(([group]) => {
                const meanId = `mean-${group}`;
                const pt = pointsLayer.__data__.objects.get(meanId) as Point | undefined;
                if (!pt) return;
                let lbl = this._meanLabels.get(group);
                if (!lbl) {
                  lbl = new ENALabel(group, pt, labelSvg, this, labelMeans);
                  this._meanLabels.set(group, lbl);
                } else {
                  labelMeans === Label.DISPLAY_TYPES.ON ? lbl.show() : lbl.hide();
                }
              });
            }
          }

          pointsLayer.__data__.__state__.setVariable('layer_updated', pointsLayer.__data__);
        }
      }

      // ── Mean network edges ───────────────────────────────────────────────────
      // For each group, compute the mean weight of every edge column across its
      // unit rows, then draw a Line for pairs whose mean weight is non-zero.
      const networkLayer = this.__children__.search('__children__', 'network') as ENALayer;
      const edgeLayer    = networkLayer?.__children__.search('__children__', 'edges') as ENALayer;
      const nodeLayer    = networkLayer?.__children__.search('__children__', 'nodes') as ENALayer;

      if (model.nodes?.rows && nodeLayer) {
        // ── Step 1: Populate node positions first (edges need to look them up) ─
        // Sizes will be overwritten after edge weights are computed.
        model.nodes.rows().forEach((row: DataFrameRow) => {
          const pt = rowToPoint(row, 'code', '#444444');
          pt.size = 3; // temporary default; overwritten below if edges are available
          nodeLayer.__data__.objects.set(pt.ID, pt);
        });

        if (edgeLayer && model.edges?.rows) {
          // ── Step 2: Build unit→group lookup from points data ─────────────────
          const unitGroupMap: Record<string, string> = {};
          if (groupColName && model.points?.rows) {
            model.points.rows().forEach((row: DataFrameRow) => {
              const qIdx = row.names.indexOf('QEUNIT');
              const gIdx = row.names.indexOf(groupColName!);
              if (qIdx >= 0 && gIdx >= 0) unitGroupMap[String(row[qIdx])] = String(row[gIdx]);
            });
          }

          // ── Step 3: Collect valid edge-column → code-pair mappings ───────────
          const codeNames: string[] = model.nodes.rows().map((r: DataFrameRow) => {
            const idx = r.names.indexOf('code');
            return idx >= 0 ? String(r[idx]) : '';
          }).filter(Boolean);

          const edgePairs: Array<{ col: string; pair: [string, string] }> = [];
          (model.edges.names ?? []).forEach((col: string) => {
            const pair = parseEdgePair(col, codeNames);
            if (pair) edgePairs.push({ col, pair });
          });

          // ── Step 4: Edge-weight helpers ───────────────────────────────────────
          type EdgeWeights = Record<string, number>;

          /** Raw weights for a single unit row. */
          const getUnitEdges = (unitId: string): EdgeWeights => {
            const result: EdgeWeights = {};
            model.edges.rows().forEach((row: DataFrameRow) => {
              const qIdx = row.names.indexOf('QEUNIT');
              if (qIdx < 0 || String(row[qIdx]) !== unitId) return;
              edgePairs.forEach(({ col }) => {
                const colIdx = row.names.indexOf(col);
                if (colIdx >= 0) result[col] = Number(row[colIdx]) || 0;
              });
            });
            return result;
          };

          /** Mean weights across all units in a group. */
          const getGroupEdges = (groupName: string): EdgeWeights => {
            const sums: EdgeWeights = {};
            let count = 0;
            model.edges.rows().forEach((row: DataFrameRow) => {
              const qIdx  = row.names.indexOf('QEUNIT');
              const unitId = qIdx >= 0 ? String(row[qIdx]) : null;
              const gColIdx = groupColName ? row.names.indexOf(groupColName) : -1;
              const group   = gColIdx >= 0 ? String(row[gColIdx]) : (unitId ? unitGroupMap[unitId] : null);
              if (group !== groupName) return;
              count++;
              edgePairs.forEach(({ col }) => {
                const colIdx = row.names.indexOf(col);
                if (colIdx >= 0) { const v = Number(row[colIdx]); if (!isNaN(v)) sums[col] = (sums[col] ?? 0) + v; }
              });
            });
            if (count === 0) return {};
            const result: EdgeWeights = {};
            edgePairs.forEach(({ col }) => { result[col] = (sums[col] ?? 0) / count; });
            return result;
          };

          /** Resolve an identifier to edge weights + color.
           *  Checks group names first, then treats the value as a unit ID. */
          const resolve = (id: string): { weights: EdgeWeights; color: string; label: string } => {
            if (groupColorMap[id]) {
              return { weights: getGroupEdges(id), color: groupColorMap[id], label: id };
            }
            // Unit: color from its group, or neutral grey
            const groupOfUnit = unitGroupMap[id] ?? null;
            const color = groupOfUnit ? (groupColorMap[groupOfUnit] ?? '#888888') : '#888888';
            return { weights: getUnitEdges(id), color, label: id };
          };

          // ── Step 5: Determine display mode from attributes ────────────────────
          //
          //  Modes (controlled by HTML attributes on <ena-graph>):
          //
          //    group mean (default)   — no attrs, or group="FirstGame"
          //    single unit            — unit="steven z::FirstGame"
          //    group subtraction      — group="FirstGame" compare="SecondGame"
          //    unit subtraction       — unit="A" compare="B"
          //    two groups overlaid    — group="FirstGame" also="SecondGame"
          //
          const unitAttr    = this.getAttribute('unit');
          const groupAttr   = this.getAttribute('group');
          const compareAttr = this.getAttribute('compare');
          const alsoAttr    = this.getAttribute('also');

          const allGroupNames = Object.keys(groupColorMap);

          // Primary target
          const primaryId = unitAttr ?? groupAttr ?? allGroupNames[0] ?? null;
          const primary   = primaryId ? resolve(primaryId) : null;

          // Optional secondary target
          const secondaryId = compareAttr ?? alsoAttr ?? null;
          const secondary   = secondaryId ? resolve(secondaryId) : null;
          const isSubtract  = !!compareAttr;
          const isOverlay   = !!alsoAttr;

          // ── Step 6: Build the set of edges to draw ────────────────────────────
          // Each entry: { weight, color } — weight is always ≥ 0.
          // For subtraction, negative diffs get the secondary color.
          const drawEdges: Array<{ col: string; pair: [string, string]; weight: number; color: string }> = [];

          if (primary && (isSubtract || isOverlay) && secondary) {
            if (isSubtract) {
              // A − B: positive → primary color, negative → secondary color
              edgePairs.forEach(({ col, pair }) => {
                const diff = (primary.weights[col] ?? 0) - (secondary.weights[col] ?? 0);
                if (Math.abs(diff) < 1e-6) return;
                drawEdges.push({ col, pair, weight: Math.abs(diff), color: diff > 0 ? primary.color : secondary.color });
              });
            } else {
              // Overlay: draw both networks independently
              edgePairs.forEach(({ col, pair }) => {
                const wA = primary.weights[col] ?? 0;
                const wB = secondary.weights[col] ?? 0;
                if (wA > 0) drawEdges.push({ col: col + '-a', pair, weight: wA, color: primary.color });
                if (wB > 0) drawEdges.push({ col: col + '-b', pair, weight: wB, color: secondary.color });
              });
            }
          } else if (primary) {
            // Single group mean or single unit
            edgePairs.forEach(({ col, pair }) => {
              const w = primary.weights[col] ?? 0;
              if (w > 0) drawEdges.push({ col, pair, weight: w, color: primary.color });
            });
          }

          // ── Step 7: Draw Line objects + accumulate node weights ───────────────
          const maxEdgeWeight = Math.max(1, ...drawEdges.map(e => e.weight));
          const nodeWeightSum: Record<string, number> = {};

          drawEdges.forEach(({ col, pair, weight, color }) => {
            const fromNode = nodeLayer.__data__.objects.get(pair[0]);
            const toNode   = nodeLayer.__data__.objects.get(pair[1]);
            if (!fromNode || !toNode) return;

            const opacity  = Math.min(1, weight / maxEdgeWeight);
            const edgeLine = new Line(
              {},
              new Point({ ID: `${pair[0]}-src`, dimensions: [fromNode.x, fromNode.y], meta: {} }),
              new Point({ ID: `${pair[1]}-dst`, dimensions: [toNode.x,   toNode.y],   meta: {} }),
            );
            edgeLine.ID    = `edge-${col}`;
            edgeLine.color = new Color(color);
            (edgeLine as any).meta = { isMeanEdge: true, weight, maxWeight: maxEdgeWeight, opacity };
            edgeLayer.__data__.objects.set(edgeLine.ID, edgeLine);

            nodeWeightSum[pair[0]] = (nodeWeightSum[pair[0]] ?? 0) + weight;
            nodeWeightSum[pair[1]] = (nodeWeightSum[pair[1]] ?? 0) + weight;
          });

          edgeLayer.__data__.__state__.setVariable('layer_updated', edgeLayer.__data__);

          // ── Step 8: Resize nodes by total connection weight ───────────────────
          const maxNodeWeight = Math.max(1, ...Object.values(nodeWeightSum));
          model.nodes.rows().forEach((row: DataFrameRow) => {
            const codeIdx = row.names.indexOf('code');
            const id = codeIdx >= 0 ? String(row[codeIdx]) : '';
            const pt = nodeLayer.__data__.objects.get(id) as Point | undefined;
            if (!pt) return;
            const w = nodeWeightSum[id] ?? 0;
            pt.size = 2 + (w / maxNodeWeight) * 3; // range [2, 5]
          });
        }

        // ── Node labels ──────────────────────────────────────────────────────
        if (labelSvg && labelNodes !== 0) {
          // Clean up stale node labels
          this._nodeLabels.forEach((lbl, id) => {
            if (!nodeLayer.__data__.objects.get(id)) { lbl.remove(); this._nodeLabels.delete(id); }
          });
          model.nodes.rows().forEach((row: DataFrameRow) => {
            const codeIdx = row.names.indexOf('code');
            const id = codeIdx >= 0 ? String(row[codeIdx]) : '';
            if (!id) return;
            const pt = nodeLayer.__data__.objects.get(id) as Point | undefined;
            if (!pt) return;
            let lbl = this._nodeLabels.get(id);
            if (!lbl) {
              lbl = new ENALabel(id, pt, labelSvg, this, labelNodes);
              this._nodeLabels.set(id, lbl);
            } else {
              labelNodes === Label.DISPLAY_TYPES.ON ? lbl.show() : lbl.hide();
            }
          });
        }

        // Fire after both positions and sizes are set
        nodeLayer.__data__.__state__.setVariable('layer_updated', nodeLayer.__data__);
      }

      // ── Axis lines / points ──────────────────────────────────────────────────
      const axisPointsLayer = this.__children__.search('__children__', 'axis_points');
      const axisLinesLayer  = this.__children__.search('__children__', 'axis_lines');
      if (axisPointsLayer) this.__data__.__state__.setVariable('graph_updated_axis_points', axisPointsLayer.__data__.objects);
      if (axisLinesLayer)  this.__data__.__state__.setVariable('graph_updated_axis_lines',  axisLinesLayer.__data__.objects);

      this.update();
    });
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    // reserved for future reactive attribute handling
  }

  connectedCallback(): void {
    // Apply width/height HTML attributes as CSS dimensions on the host element
    // so the shadow-DOM wrapper's height:100% resolves to a real pixel value.
    const w = this.getAttribute('width');
    const h = this.getAttribute('height');
    if (w) this.style.width  = isNaN(Number(w)) ? w : `${w}px`;
    if (h) this.style.height = isNaN(Number(h)) ? h : `${h}px`;

    this.appendChild(this.svg_element);
    // Find the associated ena-visual: check 'for' attribute first, then nearest
    // ancestor, then first one on the page. This lets ena-graph work as a child,
    // a sibling, or anywhere else in the document.
    const forId = this.getAttribute('for');
    this._vizena = (
      (forId ? document.getElementById(forId) : null) ??
      this.closest('ena-visual') ??
      this.parentElement?.closest('ena-visual') ??
      document.querySelector('ena-visual')
    ) as VizENAElement;
    this.draw();

    // Cache the labels <g> after draw() has connected all layer elements to
    // the SVG DOM. We do this once here rather than searching on every
    // model-updated event to guarantee we always have a valid reference.
    const labelsLayer = this.__children__.search('__children__', 'labels') as ENALayer;
    if (labelsLayer?.svg_element) {
      this._labelsGroup = labelsLayer.svg_element as SVGGElement;
    } else {
      // Fallback: create a new <g> directly inside the outermost graph layer.
      console.warn('[ena-graph] labels layer not found in layer tree; creating fallback <g>');
      const graphLayer = this.__children__[0] as ENALayer;
      if (graphLayer?.svg_element) {
        this._labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
        this._labelsGroup.setAttribute('data-layer-name', 'labels-fallback');
        graphLayer.svg_element.appendChild(this._labelsGroup);
      }
    }
  }

  create(): SVGElement {
    const 
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    ;
    svg.classList.add("graph");
    svg.setAttribute("viewBox", (this.__data__ as Graph).extremes.as_viewBox());
    svg.setAttribute("transform", (this.__data__ as Graph).transform.toString());
    svg.setAttribute("role", "figure");
    svg.setAttribute("data-graph-size", `${Math.min((this.__data__ as Graph).extremes.width, (this.__data__ as Graph).extremes.height)}`);
    this.svg_element = svg;

    this.__data__.layers.forEach((layer: LayerLike) => {
      let 
        layer_g: ENALayer = new ENALayer(layer, this.svg_element, this)
      ;

      this.__children__.push(layer_g);
    });

    // point_layer.__children__.push(new_ena_point);
    let 
      // axisPointLayer: LayerLike | undefined = this.__data__.layers.search("layers", "axis_points"),
      axisLineLayer: LayerLike | undefined =  this.__data__.layers.search("layers", "axis_lines")
    ;
    // if(axisPointLayer) {
    //   [...axisPointLayer.objects.entries()].forEach(([id, point]: [string, AxisPoint]) => {
    //     let new_ena_point = new ENAPoint(point, this.svg_element, this);
    //     console.log("Adding axis point: ", axisPointLayer, new_ena_point);
    //     // this.__children__.push(new_ena_point);
    //   });
    // }
    if(axisLineLayer) {
      [...axisLineLayer.objects.entries()].forEach(([id, line]: [string, Line]) => {
        let new_ena_line = new ENALine(line, this.svg_element, this);
        axisLineLayer.objects.set(id, line); 
      });
    }
    this.__data__.__state__.setVariable("graph_updated", this.__data__ );

    this.attach_events();

    return svg;
  }

  attach_events() {
    // Attach event for zooming
    this.svg_element.addEventListener("wheel", (ev: WheelEvent) => {
      console.log("Wheel event: ", ev);
      ev.preventDefault();
      const delta = Math.sign(ev.deltaY);
      if (delta < 0) {
        this.zoom_level *= 1.1;
      } else {
        this.zoom_level /= 1.1;
      }
      this.__data__.transform.zoom(this.zoom_level);
      this.update(true);
    });

    // Attach event for panning
    let isPanning = false;
    let startX: number, startY: number;

    this.svg_element.addEventListener("mousedown", (ev: MouseEvent) => {
      isPanning = true;
      startX = ev.clientX;
      startY = ev.clientY;
    });
    let panAnimationFrame: number | null = null;
    let pendingPan: { dx: number, dy: number } | null = null;

    const panUpdate = () => {
      if (pendingPan) {
        this.__data__.transform.pan(pendingPan.dx, pendingPan.dy);
        this.__children__[0].svg_element.setAttribute("transform", this.__data__.transform.toString());
        pendingPan = null;
      }
      panAnimationFrame = null;
    };

    this.svg_element.addEventListener("mousemove", (ev: MouseEvent) => {
      if (!isPanning) return;
      const 
        dx = ev.clientX - startX,
        dy = ev.clientY - startY
      ;
      pendingPan = { dx: dx / 100, dy: dy / 100 };
      startX = ev.clientX;
      startY = ev.clientY;
      
      if (panAnimationFrame === null) {
        panAnimationFrame = requestAnimationFrame(panUpdate);
      }
    });

    this.svg_element.addEventListener("mouseup", (ev: MouseEvent) => {
      isPanning = false;
    });

    this.svg_element.addEventListener("point-clicked", (ev: CustomEvent) => {
      const model = this._currentModel ?? this.vizena?.model;
      console.log("Model: ", model);
      let
        networkLayer = this.__children__.search("__children__", "network") as ENALayer,
        nodeLayer = networkLayer?.__children__.search("__children__", "nodes") as ENALayer,
        edgeLayer = networkLayer?.__children__.search("__children__", "edges") as ENALayer,
        activatedEdge: DataFrameRow | undefined = model?.edges.row(ev.detail.pointData.ID)
      ;

      if(networkLayer && activatedEdge) {
        let
          indices: number[] = activatedEdge.classes?.map( (c, i) => c === "ena.co.occurrence" ? i : null).filter(c => c) as number[],
          columns: string[][] = indices?.map( (ind: number, j: number) =>  activatedEdge.names[ind].split(/\s&\s/) ),
          nodes: [Point, Point][] = columns.map( (c, i) => c.map( (col, j) => nodeLayer.__data__.objects.get(col) ) ),
          edges = nodes.map((n: [Point, Point], i: number) => {
            let edge = new Edge(activatedEdge, n[0], n[1] );
            edge.ID = activatedEdge.names[indices[i]];
            edge.weight = activatedEdge.values[indices[i]];
            edgeLayer?.__data__.objects.set(edge.ID, edge);
            return edge;
          })
          edgeLayer.__data__.__state__.setVariable("layer_updated", edgeLayer.__data__);
        ;
        console.log("Columns: ", edges);
        this.update_extremes();
      }
    });

    // ── Label interactions ───────────────────────────────────────────────────
    // CLICK mode: toggle label on point-clicked event
    this.svg_element.addEventListener('point-clicked', (ev: CustomEvent) => {
      const id = ev.detail?.pointData?.ID;
      if (!id) return;
      // Try all label maps
      const lbl = this._pointLabels.get(id)
               ?? this._meanLabels.get(id.replace('mean-', ''))
               ?? this._nodeLabels.get(id);
      if (lbl && lbl.displayMode === Label.DISPLAY_TYPES.CLICK) lbl.toggle();
    });

    // AUTO mode: show/hide labels via event delegation on the SVG.
    // We look for the nearest ancestor (or the target itself) that has
    // data-point-id so the hit-area works even on complex shapes.
    const findPointId = (el: SVGElement | null): string | null => {
      while (el && el !== this.svg_element) {
        const id = el.getAttribute?.('data-point-id');
        if (id) return id;
        el = el.parentElement as SVGElement | null;
      }
      return null;
    };

    const getAutoLabel = (id: string): ENALabel | undefined => {
      return this._pointLabels.get(id)
          ?? this._meanLabels.get(id.replace(/^mean-/, ''))
          ?? this._nodeLabels.get(id);
    };

    this.svg_element.addEventListener('mouseover', (ev: MouseEvent) => {
      const id = findPointId(ev.target as SVGElement);
      if (!id) return;
      const lbl = getAutoLabel(id);
      if (lbl?.displayMode === Label.DISPLAY_TYPES.AUTO) lbl.show();
    });

    this.svg_element.addEventListener('mouseout', (ev: MouseEvent) => {
      // Only hide when the mouse leaves the point element entirely,
      // not when it enters a child (e.g., a nested SVG element).
      const id = findPointId(ev.target as SVGElement);
      if (!id) return;
      // relatedTarget is where the mouse went — if it's still inside
      // the same point element, don't hide.
      const related = ev.relatedTarget as SVGElement | null;
      const relatedId = findPointId(related);
      if (relatedId === id) return; // still inside the same point
      const lbl = getAutoLabel(id);
      if (lbl?.displayMode === Label.DISPLAY_TYPES.AUTO) lbl.hide();
    });
  }

  draw() {
    if(!this.svg_element) {
      console.error("No element to draw to: ", this);
      return;
    }
    
    this.wrapper?.appendChild(this.svg_element);

    this.__children__.forEach((enaLayer: ENALayer) => {
      enaLayer.draw();
    });
  }

  update() {
    // Two-pass update: first pass lays out elements and computes extremes;
    // second pass re-syncs the viewBox now that all element positions are final.
    this.update_extremes();
    this.update_layers();
    this.update_labels();   // positions labels using the freshly-computed extent
    this.update_extremes(); // re-apply viewBox after label/layer repositioning
  }

  update_labels(): void {
    this._nodeLabels.forEach(lbl  => lbl.update());
    this._meanLabels.forEach(lbl  => lbl.update());
    this._pointLabels.forEach(lbl => lbl.update());
  }

  update_extremes() {
    this.__data__.update_extremes();

    const svgRect = this.svg_element?.getBoundingClientRect();
    if(this.svg_element && svgRect) {
      console.log("SVG rect: ", svgRect);
      let w, h;
      if(svgRect.width === 0 || svgRect.height === 0) {
        w = 1;
        h = 1;
      }
      else {
        w = svgRect.width;
        h = svgRect.height;
      }
      this.__data__.scale_x = 1 / (w /  (4 * this.__data__.extremes.x_max));
      this.__data__.scale_y = 1 / (h / (4 * this.__data__.extremes.y_max));

      // this.svg_element.setAttribute("transform", this.__data__.transform.toString());
      this.__children__[0].svg_element.setAttribute("transform", this.__data__.transform.toString());

      this.svg_element.setAttribute("viewBox", (this.__data__ as Graph).extremes.as_viewBox());

      let axisLineLayer: LayerLike | undefined = this.__data__.layers.search("layers", "axis_lines");
      if (axisLineLayer) {
        let 
          axis_x = axisLineLayer.objects.get("axis-x") as Line,
          axis_y = axisLineLayer.objects.get("axis-y") as Line
        ;
        if (axis_x && axis_y) {
          axis_x.from = new Point({ ID: "axis-x-start", dimensions: [-this.__data__.extremes.x_max, 0], classes: ["ena.dimension", "ena.dimension"] });
          axis_x.to = new Point({ ID: "axis-x-end", dimensions: [this.__data__.extremes.x_max, 0], classes: ["ena.dimension", "ena.dimension"] });
          axis_y.from = new Point({ ID: "axis-y-start", dimensions: [0, -this.__data__.extremes.y_max], classes: ["ena.dimension", "ena.dimension"] });
          axis_y.to = new Point({ ID: "axis-y-end", dimensions: [0, this.__data__.extremes.y_max], classes: ["ena.dimension", "ena.dimension"] });
        }
      }
    }
  }

  update_layers() {
    this.__children__.forEach((enaLayer: ENALayer) => {
      enaLayer.update();
    });
  }
}
customElements.define(ENASvgElement.tagName, ENASvgElement);