import { DefaultGraphOptions, Graph } from "../objects/Graph";
import { DrawableElement } from "./DrawableElement";
import { QEArray, QEElement, QELayer } from "./QELayer";
import QEVisualElement from "./QEVisual";
import { DataFrameRow } from "../types/DataFrame";
import { NodeEdge, TaperedWeightedMidpointEdge } from "../objects/Edges";
import { Label, Line, Point } from "../objects/PlottedObject";
import { Trajectory } from "../objects/Trajectory";
import { LayerLike } from "../objects/Layers";
import { Color } from "../objects/Color";
import { QELabel } from "./QELabel";
import "./QEChildElements.js";

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
 *
 * Self-connections ("A.A") are detected first — they return [A, A].
 * In directed (ONA) mode the full unfolded matrix is expected, so A→B and
 * B→A are distinct columns; both resolve correctly as ordered pairs.
 */
function parseEdgePair(colName: string, codes: string[]): [string, string] | null {
  // Self-connections first: exact match "code.code"
  for (const c of codes) {
    if (colName === `${c}.${c}`) return [c, c];
  }
  // Directed or undirected pairs: longest-prefix wins to handle dotted code names
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

export class QEGraphElement extends DrawableElement implements QEElement {
  static tagName: string = "qe-graph";

  static get observedAttributes(): string[] {
    // Only layout / shorthand attributes live on <qe-graph> itself.
    // Layer-specific config (group, unit, compare, also, points, edges,
    // confidence, groups) lives on child elements and is observed via
    // MutationObserver in connectedCallback().
    return [
      'width', 'height', 'for',
      'scale-points',
      'labels', 'label-nodes', 'label-means', 'label-points',
    ];
  }

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
  graph: QEGraphElement;
  parent: SVGElement | null;
  zoom_level: number = 1;

  __data__: Graph;
  __children__: QEArray = new QEArray();
  __name__: string;
  

  private _vizena!: QEVisualElement;
  get vizena() {
    return this._vizena;
  }

  private _hasModel      = false;
  private _renderPending = false;
  private _childObserver: MutationObserver | null = null;

  // SVG <rect> elements for per-group CI boxes, keyed by group name.
  // Managed directly (not via QELayer) so they render behind unit points.
  private _ciRects: Map<string, SVGRectElement> = new Map();
  private _outlierRects: Map<string, SVGRectElement> = new Map();

  // Cached reference to the labels <g> layer — set once in connectedCallback()
  // after draw() so it is guaranteed to be in the SVG DOM.
  private _labelsGroup: SVGGElement | null = null;

  // SVG <text> label elements for nodes, mean points, and unit points.
  private _nodeLabels:  Map<string, QELabel> = new Map();
  private _meanLabels:  Map<string, QELabel> = new Map();
  private _pointLabels: Map<string, QELabel> = new Map();

  // Axes (<qe-axes>): whether to show axis lines, and resolved label text
  // (null = no label for that axis). SVG <text> nodes are cached and positioned
  // in update_axis_labels() using the freshly-computed extremes.
  private _showAxes  = false;
  private _axisXText: string | null = null;
  private _axisYText: string | null = null;
  private _axisLabelEls: Map<'x' | 'y', SVGTextElement> = new Map();

  constructor() {
    super();

    this.graph = this;
    this.parent = null;

    this.__data__ = new Graph(DefaultGraphOptions);
    this.__name__ = this.__data__.name || "unnamed-graph";
    this.svg_element = this.create();

    console.log("Created ena-graph svg element: ", this.svg_element);

    // Listen for the model-updated CustomEvent dispatched by VisualQEElement.
    // The Model object is carried in event.detail, so ena-graph works whether it
    // is a child, sibling, or anywhere else relative to ena-visual.
    document.addEventListener('model-updated', (e: Event) => {
      // When multiple qe-visual elements exist on the page, each qe-graph must
      // only react to events from its own associated visual.  _vizena is resolved
      // in connectedCallback(); before that point we accept all events (initial
      // load), but once the association is known we filter strictly.
      if (this._vizena && e.target !== this._vizena) return;

      const model = (e as CustomEvent).detail;
      if (!model) return;
      this._hasModel = true;

      const dims = model.dimensions as string[];

      // Resolved column names from setModelData (auto-detected or caller-supplied)
      const unitIdCol  = model.unit_id_col;
      const nodeIdCol  = model.node_id_col;
      const groupColName = model.group_col;

      // ── Layer config (read once from child elements) ─────────────────────────
      const config = this._readLayerConfig();

      // ── Axes (<qe-axes>) ─────────────────────────────────────────────────────
      // Resolve label text now that dims are known: empty x/y attribute falls
      // back to the dimension name; a value is used verbatim; null = no label.
      this._showAxes  = config.showAxes;
      this._axisXText = config.axisXLabel === null ? null : (config.axisXLabel || String(dims?.[0] ?? 'x'));
      this._axisYText = config.axisYLabel === null ? null : (config.axisYLabel || String(dims?.[1] ?? 'y'));

      // ── Group color map ──────────────────────────────────────────────────────
      // Priority: (1) points groupCol, (2) groups frame row names, (3) empty.
      const groupColorMap: Record<string, string> = {};
      if (groupColName && model.points?.names) {
        const groupCol = model.points.col(groupColName);
        if (groupCol) {
          const uniqueGroups: string[] = [...new Set([...groupCol].map(String))];
          uniqueGroups.forEach((g, i) => {
            groupColorMap[g] = GROUP_PALETTE[i % GROUP_PALETTE.length];
          });
        }
      } else if (model.groups?.rows && model.groups.rows().length > 0) {
        // No points-based groups — assign colors from the groups frame directly.
        model.groups.rows().forEach((row: DataFrameRow, i: number) => {
          const g = row.rowName ?? String(row[0]);
          if (!groupColorMap[g]) groupColorMap[g] = GROUP_PALETTE[i % GROUP_PALETTE.length];
        });
      }

      // ── Active groups for MEANS display ─────────────────────────────────────
      // `groups` attribute: comma-separated list of group names whose means and
      // CI boxes should be rendered.  Default (attribute absent or empty): show
      // means for ALL groups present in the model.
      //
      // Means display is intentionally independent of edge selection.  The edge
      // section below reads `group` / `compare` / `also` to determine which
      // network(s) to draw; those attributes have no effect here.
      const _allGroupNames_ = Object.keys(groupColorMap);
      const activeMeanGroups: Set<string> = (config.activeMeanGroups && config.activeMeanGroups.trim())
        ? new Set(
            config.activeMeanGroups.split(',')
              .map(s => s.trim())
              .filter(g => groupColorMap[g])   // silently drop names not in model
          )
        : new Set(_allGroupNames_);            // default: every group

      // ── Point-to-node coordinate scaling ────────────────────────────────────
      // Unit point coordinates are in a different (typically much smaller) range
      // Unit/mean point coordinates are rescaled by default so the outermost point
      // aligns with the outermost code node — matching the ENA Web Tool default.
      // Set scale-points="false" on <qe-graph> to show raw SVD coordinates
      // (points cluster near origin relative to code nodes).
      const scalePointsEnabled = config.scalePoints;

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
      const maxTrajExtent  = model.trajectories?.rows ? getExtent(model.trajectories.rows()) : 0;
      const effectivePointExtent = maxPointExtent > 0 ? maxPointExtent : maxTrajExtent;
      const pointScale = (scalePointsEnabled && effectivePointExtent > 0 && maxNodeExtent > 0)
        ? maxNodeExtent / effectivePointExtent
        : 1;

      // ── Label display modes — sourced from config (child elements or shorthand) ──
      const labelNodes  = config.labelNodes;
      const labelMeans  = config.labelMeans;
      const labelPoints = config.labelPoints;

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

      // <qe-points> presence controls unit-dot visibility.
      // <qe-means> presence controls mean markers and CI boxes.
      const showUnitPoints = config.showPoints;
      if (model.points?.rows) {
        const pointsLayer = this.__children__.search('__children__', 'points') as QELayer;
        if (pointsLayer) {
          model.points.rows().forEach((row: DataFrameRow) => {
            // Determine this point's group color
            const groupColIdx = groupColName ? row.names.indexOf(groupColName) : -1;
            const group = groupColIdx >= 0 ? String(row[groupColIdx]) : null;
            const colorStr = group ? (groupColorMap[group] ?? '#888888') : '#888888';

            // Only add unit dots to the layer when 'points' attribute is present.
            if (showUnitPoints) {
              const pt = rowToPoint(row, unitIdCol, colorStr, pointScale);
              // Unit-point size: <qe-points size=…> overrides the default 2.5.
              // (Point() defaults to 1, which renders smaller than code nodes.)
              pt.size = config.pointSize ?? 2.5;
              // White halo separates overlapping dots in dense clusters.
              // meta.kind/name/group feed the qe-node-* interaction events.
              (pt as any).meta = {
                ...((pt as any).meta ?? {}),
                stroke: '#ffffff', kind: 'point', name: pt.ID,
                group: group ?? undefined, unit: pt.ID,
              };
              this.__data__.points.set(pt.ID, pt);
              pointsLayer.__data__.objects.set(pt.ID, pt);
            }

            // Always accumulate for mean + variance (needed for Path B even without dots)
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

          // ── Group means + bounds ──────────────────────────────────────────────
          // Two paths:
          //   A) model.groups frame present → use pre-computed means + bounds.
          //      This is the Phase 3+ preferred path. qeviz renders; adapters compute.
          //   B) No groups frame → compute means from unit-point accumulations
          //      (legacy fallback; also used when only points are provided).
          //
          // Deprecated frames (model.confidence, model.outlier) are still respected
          // in path B for backward compatibility with rENA adapters not yet updated.
          //
          // Means rendering is guarded by config.showMeans (<qe-means> presence).
          // When absent, activeGroupRows is kept empty so the labels section below
          // also skips mean labels cleanly.

          const hasGroupsFrame = !!(model.groups?.rows && model.groups.rows().length > 0);

          // Rows from the groups frame that are active in the current view.
          // Empty when <qe-means> is absent so downstream label logic is consistent.
          const activeGroupRows: DataFrameRow[] = (config.showMeans && hasGroupsFrame)
            ? model.groups.rows().filter((r: DataFrameRow) => {
                const g = r.rowName ?? String(r[0]);
                return activeMeanGroups.size === 0 || activeMeanGroups.has(g);
              })
            : [];

          if (config.showMeans) {
          const pointsLayerSvg = pointsLayer.svg_element as SVGGElement | null;
          const sw = (maxNodeExtent > 0 ? maxNodeExtent : 1) * 0.008;

          if (hasGroupsFrame) {
            // ── Path A: groups frame ─────────────────────────────────────────
            // Remove CI/outlier rects for groups no longer active.
            const activeNames = new Set(activeGroupRows.map((r: DataFrameRow) => r.rowName ?? String(r[0])));
            this._ciRects.forEach((el, g) => { if (!activeNames.has(g)) { el.remove(); this._ciRects.delete(g); } });
            this._outlierRects.forEach((el, g) => { if (!activeNames.has(g)) { el.remove(); this._outlierRects.delete(g); } });

            activeGroupRows.forEach((row: DataFrameRow) => {
              const group = row.rowName ?? String(row[0]);
              const color = groupColorMap[group] ?? '#888888';
              const xIdx = row.names.indexOf(dims[0]);
              const yIdx = dims.length > 1 ? row.names.indexOf(dims[1]) : -1;
              const mx = xIdx >= 0 ? Number(row[xIdx]) * pointScale : 0;
              const my = yIdx >= 0 ? -Number(row[yIdx]) * pointScale : 0;

              // Mean marker — square, larger than unit points
              const meanPt = new Point({
                ID: `mean-${group}`,
                dimensions: [mx, my],
                meta: { kind: 'mean', name: group, group },
              });
              meanPt.color = new Color(color);
              meanPt.size  = 4;   // radius = extent × 0.006 × 4 ≈ 0.024 for a unit extent
              meanPt.shape = 'rect';
              this.__data__.points.set(meanPt.ID, meanPt);
              pointsLayer.__data__.objects.set(meanPt.ID, meanPt);

              // Bounds rect (CI, IQR, or any interval) — rendered behind points
              const bounds = readIntervalBounds(row, dims[0] as string, dims[1] as string);
              if (bounds) {
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
              }
            });

          } else {
            // ── Path B: legacy — compute means from groupSums ────────────────
            // Add one mean point per group — larger (size=1.5) and same group color
            Object.entries(groupSums).forEach(([group, { x, y, n, color }]) => {
              const meanPt = new Point({
                ID: `mean-${group}`,
                dimensions: [x / n * pointScale, -(y / n) * pointScale],
                meta: { kind: 'mean', name: group, group },
              });
              meanPt.color = new Color(color);
              meanPt.size  = 4;   // radius = extent × 0.006 × 4 ≈ 0.024 for a unit extent
              meanPt.shape = 'rect';
              this.__data__.points.set(meanPt.ID, meanPt);
              pointsLayer.__data__.objects.set(meanPt.ID, meanPt);
            });

            // ── CI boxes (deprecated confidence frame or JS fallback) ────────
            const showCI = config.showCI;
            if (showCI) {
              this._ciRects.forEach((el, g) => {
                if (!groupSums[g]) { el.remove(); this._ciRects.delete(g); }
              });

              if (model.confidence?.rows) {
                // Pre-computed path: deprecated model.confidence frame
                model.confidence.rows().forEach((row: DataFrameRow) => {
                  const groupIdx = row.names.indexOf(groupColName ?? 'group');
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
                // JS fallback: compute CI from accumulated variance
                Object.entries(groupSums).forEach(([group, { x, y, x2, y2, n, color }]) => {
                  if (n < 2) return;
                  const μx = x / n, μy = y / n;
                  const rawVarX = x2 / n - μx * μx;
                  const rawVarY = y2 / n - μy * μy;
                  const { halfW, halfH } = computeCIRect(rawVarX, rawVarY, n, pointScale);
                  const cx = μx * pointScale, cy = -(μy) * pointScale;
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
                  if (pointsLayerSvg && !el.parentElement) {
                    pointsLayerSvg.insertBefore(el, pointsLayerSvg.firstChild);
                  }
                });
              }
            }

            // ── Outlier boxes (deprecated model.outlier frame) ───────────────
            const showOutlier = true; // legacy frame; presence of model.outlier guards rendering
            if (showOutlier && model.outlier?.rows) {
              this._outlierRects.forEach((el, g) => {
                if (!groupColorMap[g]) { el.remove(); this._outlierRects.delete(g); }
              });
              model.outlier.rows().forEach((row: DataFrameRow) => {
                const groupIdx = row.names.indexOf(groupColName ?? 'group');
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
          } // end Path B
          } // end config.showMeans

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
                const qIdx = row.names.indexOf(unitIdCol);
                const unitId = qIdx >= 0 ? String(row[qIdx]) : null;
                if (!unitId) return;
                const pt = pointsLayer.__data__.objects.get(unitId) as Point | undefined;
                if (!pt) return;
                // Use the raw unit ID as the label text.
                // TODO: support a label-format attribute or callback so callers
                // can supply a custom display string (e.g. strip a prefix,
                // extract a sub-field from a compound ID, etc.)
                const displayText = unitId;
                let lbl = this._pointLabels.get(unitId);
                if (!lbl) {
                  lbl = new QELabel(displayText, pt, labelSvg, this, labelPoints);
                  this._pointLabels.set(unitId, lbl);
                } else {
                  labelPoints === Label.DISPLAY_TYPES.ON ? lbl.show() : lbl.hide();
                }
              });
            }

            // Mean labels — use active groups frame rows if available, else groupSums keys
            if (labelMeans !== 0) {
              const meanGroupNames: string[] = hasGroupsFrame
                ? activeGroupRows.map((r: DataFrameRow) => r.rowName ?? String(r[0]))
                : Object.keys(groupSums);

              meanGroupNames.forEach((group: string) => {
                const meanId = `mean-${group}`;
                const pt = pointsLayer.__data__.objects.get(meanId) as Point | undefined;
                if (!pt) return;
                let lbl = this._meanLabels.get(group);
                if (!lbl) {
                  lbl = new QELabel(group, pt, labelSvg, this, labelMeans);
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

      // ── Cognitive Trajectories Layer ──────────────────────────────────────────
      const trajectoriesLayer = this.__children__.search('__children__', 'trajectories') as QELayer;
      const trajectoriesEnabled = config.showTrajectories;
      if (trajectoriesEnabled && trajectoriesLayer) {
        trajectoriesLayer.__data__.objects.clear();
        this.__data__.trajectories.clear();

        const trajSource = model.trajectories?.rows ? model.trajectories : model.points;
        if (trajSource?.rows) {
          const unitRows: Record<string, Array<{ x: number; y: number; time: number }>> = {};
          const selectedUnits = config.trajectoryUnits ? config.trajectoryUnits.split(',').map(s => s.trim()) : null;

          trajSource.rows().forEach((row: DataFrameRow) => {
            const uIdx = row.names.indexOf(unitIdCol) >= 0 ? row.names.indexOf(unitIdCol) : (row.names.indexOf('unit') >= 0 ? row.names.indexOf('unit') : (row.names.indexOf('ENA_UNIT') >= 0 ? row.names.indexOf('ENA_UNIT') : -1));
            const unit = uIdx >= 0 ? String(row[uIdx]) : (row.rowName || 'unit-1');

            if (selectedUnits && !selectedUnits.includes(unit)) return;

            const xIdx = row.names.indexOf(dims[0]);
            const yIdx = dims.length > 1 ? row.names.indexOf(dims[1]) : -1;
            const tIdx = row.names.indexOf('time') >= 0 ? row.names.indexOf('time') : (row.names.indexOf('ActivityNumber') >= 0 ? row.names.indexOf('ActivityNumber') : (row.names.indexOf('RowID') >= 0 ? row.names.indexOf('RowID') : -1));

            const time = tIdx >= 0 ? Number(row[tIdx]) : (unitRows[unit] ? unitRows[unit].length + 1 : 1);
            // Keep every row: the playhead is applied inside Trajectory via
            // currentTime so degree selection can run on the full trajectory
            // while only the visible prefix is fit and drawn.

            if (xIdx >= 0 && yIdx >= 0) {
              if (!unitRows[unit]) unitRows[unit] = [];
              unitRows[unit].push({
                x: Number(row[xIdx]) * pointScale,
                y: -Number(row[yIdx]) * pointScale,
                time
              });
            }
          });

          const unitKeys = Object.keys(unitRows);
          unitKeys.forEach((unitKey, uIdx) => {
            const rawPts = unitRows[unitKey];
            if (rawPts.length === 0) return;

            const colorStr = GROUP_PALETTE[uIdx % GROUP_PALETTE.length];

            const trajObj = new Trajectory({
              ID: `traj-${unitKey}`,
              unitId: unitKey,
              color: new Color(colorStr),
              lineStyle: config.trajectoryLineStyle,
              strokeWidth: config.trajectoryStrokeWidth,
              strokeWidthRange: config.trajectoryStrokeWidthRange,
              opacityRange: config.trajectoryOpacityRange,
              smooth: config.trajectorySmooth,
              maxDegree: config.trajectoryMaxDegree,
              degreeSelection: config.trajectoryDegreeSelection,
              currentTime: config.trajectoryPlayhead ?? Infinity,
              showPoints: config.trajectoryShowPoints,
              showTips: config.trajectoryShowTips,
              points: rawPts.map(p => ({ x: p.x, y: p.y, time: p.time }))
            });

            this.__data__.trajectories.set(unitKey, trajObj);
            trajectoriesLayer.__data__.objects.set(trajObj.ID, trajObj);
          });
        }
        trajectoriesLayer.__data__.__state__.setVariable('layer_updated', trajectoriesLayer.__data__);
      }

      // ── Mean network edges ───────────────────────────────────────────────────
      // For each group, compute the mean weight of every edge column across its
      // unit rows, then draw a Line for pairs whose mean weight is non-zero.
      const networkLayer  = this.__children__.search('__children__', 'network') as QELayer;
      const edgeLayer     = networkLayer?.__children__.search('__children__', 'edges') as QELayer;
      const nodeLayer     = networkLayer?.__children__.search('__children__', 'nodes') as QELayer;
      // edgenodes sits above `nodes` in the layer tree — self-connections (NodeEdge)
      // must be drawn here so the dot is visible on top of the code node.
      const edgenodeLayer = networkLayer?.__children__.search('__children__', 'edgenodes') as QELayer;

      const edgesEnabled = config.showEdges;
      if (model.nodes?.rows && nodeLayer) {
        // ── Step 1: Populate node positions first ─────────────────────────────
        // Nodes are always placed so they anchor the coordinate space (extremes).
        // Sizes will be overwritten after edge weights are computed; when edges
        // are hidden the default size is used instead.
        model.nodes.rows().forEach((row: DataFrameRow) => {
          const pt = rowToPoint(row, nodeIdCol, '#444444');
          pt.size = 2; // default when no edge weights available
          (pt as any).meta = { ...((pt as any).meta ?? {}), kind: 'node', name: pt.ID };
          nodeLayer.__data__.objects.set(pt.ID, pt);
        });

        if (edgesEnabled && edgeLayer && model.edges?.rows) {
          // ── Step 2: Build unit→group lookup from points data ─────────────────
          const unitGroupMap: Record<string, string> = {};
          if (groupColName && model.points?.rows) {
            model.points.rows().forEach((row: DataFrameRow) => {
              const qIdx = row.names.indexOf(unitIdCol);
              const gIdx = row.names.indexOf(groupColName!);
              if (qIdx >= 0 && gIdx >= 0) unitGroupMap[String(row[qIdx])] = String(row[gIdx]);
            });
          }

          // ── Step 3: Collect valid edge-column → code-pair mappings ───────────
          const codeNames: string[] = model.nodes.rows().map((r: DataFrameRow) => {
            const idx = r.names.indexOf(nodeIdCol);
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
              const qIdx = row.names.indexOf(unitIdCol);
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
              const qIdx  = row.names.indexOf(unitIdCol);
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
          // Edge selection: group / compare / also are edge-only attributes.
          // No `group` → no edge network drawn (only means are shown).
          const unitAttr    = config.edgeUnit;
          const groupAttr   = config.edgeGroup;
          const compareAttr = config.edgeCompare;
          const alsoAttr    = config.edgeAlso;

          // Primary edge target — unit overrides group; no default to first group.
          const primaryId = unitAttr ?? groupAttr ?? null;
          const primary   = primaryId ? resolve(primaryId) : null;

          // Optional secondary target for subtraction or overlay.
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

          // ── Step 7: Compute node sizes BEFORE creating edges ──────────────────
          // NodeEdge dot radii must fit *inside* each code node, so we need the
          // host node's effective radius at edge-creation time.  Pre-tally
          // weights and apply sizes up front.
          const isDirected    = !!(model as any).directed;
          // Normalize against the actual max weight in this render, not a hard
          // floor of 1.  ENA line weights are typically ≪ 1 (e.g. 0.05–0.5);
          // using Math.max(1, ...) would cap saturation/opacity at the raw weight
          // value (e.g. 0.47 max → only 47% vivid), making all edges look faded.
          const nonSelfWeights = drawEdges.filter(e => e.pair[0] !== e.pair[1]).map(e => e.weight);
          const maxEdgeWeight  = nonSelfWeights.length > 0 ? Math.max(...nonSelfWeights) : 1e-9;
          const selfWeights    = drawEdges.filter(e => e.pair[0] === e.pair[1]).map(e => e.weight);
          const maxSelfWeight  = selfWeights.length > 0 ? Math.max(...selfWeights) : 0;
          const nodeWeightSum: Record<string, number> = {};
          drawEdges.forEach(({ pair, weight }) => {
            const isSelf = pair[0] === pair[1];
            if (isSelf && !isDirected) return;  // skip illegal undirected diagonals
            nodeWeightSum[pair[0]] = (nodeWeightSum[pair[0]] ?? 0) + weight;
            if (!isSelf) {
              nodeWeightSum[pair[1]] = (nodeWeightSum[pair[1]] ?? 0) + weight;
            }
          });
          const maxNodeWeight = Math.max(1, ...Object.values(nodeWeightSum));

          // Apply node sizes (range [2, 5]) to the actual Point objects.
          const nodeSizes: Record<string, number> = {};
          model.nodes.rows().forEach((row: DataFrameRow) => {
            const codeIdx = row.names.indexOf(nodeIdCol);
            const id = codeIdx >= 0 ? String(row[codeIdx]) : '';
            if (!id) return;
            const pt = nodeLayer.__data__.objects.get(id) as Point | undefined;
            if (!pt) return;
            const w = nodeWeightSum[id] ?? 0;
            pt.size = 2 + (w / maxNodeWeight) * 3;
            nodeSizes[id] = pt.size;
          });

          // ── Step 8: Create edge objects ───────────────────────────────────────
          // For directed models, TaperedWeightedMidpointEdge needs the combined
          // weight of both directions (A→B + B→A) so the apex can be positioned
          // proportionally along the edge.  Build a lookup keyed by "A.B".
          const totalWeightByPair: Record<string, number> = {};
          if (isDirected) {
            drawEdges.forEach(({ pair, weight }) => {
              const key = `${pair[0]}.${pair[1]}`;
              totalWeightByPair[key] = (totalWeightByPair[key] ?? 0) + weight;
            });
          }

          drawEdges.forEach(({ col, pair, weight, color }) => {
            const fromNode = nodeLayer.__data__.objects.get(pair[0]);
            const toNode   = nodeLayer.__data__.objects.get(pair[1]);
            if (!fromNode || !toNode) return;

            const isSelf  = pair[0] === pair[1];
            if (isSelf && !isDirected) return;  // undirected ENA has zero diagonal

            // Opacity normalizes within each visual class: lines compare against
            // the strongest line, self-loops against the strongest self-loop.
            // Mixing the two scales (everything ÷ maxEdgeWeight) would wash
            // self-loops out, since self-weights are typically smaller.
            const classMax = isSelf ? Math.max(maxSelfWeight, 1e-9) : maxEdgeWeight;
            const opacity  = Math.min(1, weight / classMax);
            const fromPt = new Point({ ID: `${pair[0]}-src`, dimensions: [fromNode.x, fromNode.y], meta: {} });
            const toPt   = new Point({ ID: `${pair[1]}-dst`, dimensions: [toNode.x,   toNode.y],   meta: {} });
            // Pick the edge class by topology:
            //   • self-connection (A→A) → NodeEdge (filled circle at the node)
            //   • directed (A→B)        → TaperedWeightedMidpointEdge (triangle
            //                             whose apex is placed proportionally
            //                             to weight(A→B) / (weight(A→B) + weight(B→A)))
            //   • undirected            → Line (straight stroke)
            let edgeLine: Line;
            if (isSelf) {
              edgeLine = new NodeEdge({}, fromPt as any, toPt as any);
              // Actual display size is deferred to QELine.update() so it uses
              // the live extremes.x_max (which is not yet computed here).
              // Set a placeholder weight; update() will overwrite it.
              (edgeLine as any).weight = 0;
            } else if (isDirected) {
              const fwd = totalWeightByPair[`${pair[0]}.${pair[1]}`] ?? weight;
              const bwd = totalWeightByPair[`${pair[1]}.${pair[0]}`] ?? 0;
              const totalweight = fwd + bwd;
              edgeLine = new TaperedWeightedMidpointEdge(
                { weight, totalweight },
                fromPt as any,
                toPt   as any
              );
            } else {
              edgeLine = new Line({}, fromPt, toPt);
            }
            edgeLine.ID    = `edge-${col}`;
            edgeLine.color = new Color(color);
            (edgeLine as any).meta = {
              isMeanEdge:   true,
              weight,
              // NodeEdge compares within the self-loop class; cross-pair edges
              // compare within their own class.  Store the correct denominator
              // so QELine.update() can compute opacity and display size properly.
              maxWeight:    isSelf ? maxSelfWeight : maxEdgeWeight,
              opacity,
              isDirected,
              isSelf,
              // nodeSize is needed by QELine.update() to compute the NodeEdge
              // display radius at update time (when extremes.x_max is available).
              nodeSize:     isSelf ? (nodeSizes[pair[0]] ?? 2) : undefined,
              // Identity for the qe-edge-* interaction events.
              source:       pair[0],
              target:       pair[1],
              group:        groupAttr ?? undefined,
              unit:         unitAttr ?? undefined,
            };
            // Self-connections go in the `edgenodes` layer (above `nodes` in
            // draw order) so the dot is visible on top of the code node.
            const targetLayer = isSelf ? (edgenodeLayer ?? edgeLayer) : edgeLayer;
            targetLayer.__data__.objects.set(edgeLine.ID, edgeLine);
          });

          edgeLayer.__data__.__state__.setVariable('layer_updated', edgeLayer.__data__);
          if (edgenodeLayer) edgenodeLayer.__data__.__state__.setVariable('layer_updated', edgenodeLayer.__data__);
        }

        // ── Node labels ──────────────────────────────────────────────────────
        if (labelSvg && labelNodes !== 0) {
          // Clean up stale node labels
          this._nodeLabels.forEach((lbl, id) => {
            if (!nodeLayer.__data__.objects.get(id)) { lbl.remove(); this._nodeLabels.delete(id); }
          });
          model.nodes.rows().forEach((row: DataFrameRow) => {
            const codeIdx = row.names.indexOf(nodeIdCol);
            const id = codeIdx >= 0 ? String(row[codeIdx]) : '';
            if (!id) return;
            const pt = nodeLayer.__data__.objects.get(id) as Point | undefined;
            if (!pt) return;
            let lbl = this._nodeLabels.get(id);
            if (!lbl) {
              lbl = new QELabel(id, pt, labelSvg, this, labelNodes);
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

  // ── Shared re-render scheduler ───────────────────────────────────────────────
  // Batches synchronous attribute / child-list changes into a single microtask
  // so that e.g. adding <qe-edges> and setting its attributes in the same tick
  // only triggers one render cycle.
  private _scheduleRerender(): void {
    if (!this._vizena || !this._hasModel) return;
    if (this._renderPending) return;
    this._renderPending = true;
    queueMicrotask(() => {
      this._renderPending = false;
      this._vizena?.dispatchEvent(new CustomEvent('model-updated', {
        detail: this._vizena.model,
        bubbles: true,
        composed: true,
      }));
    });
  }

  // ── Layer configuration reader ────────────────────────────────────────────────
  // Reads child element presence / attributes to determine what each layer
  // should render.  Called once at the top of every model-updated handler so
  // all rendering decisions are derived from a single snapshot.
  private _readLayerConfig(): {
    // Nodes
    labelNodes: number;
    scalePoints: boolean;
    // Means
    showMeans: boolean;
    activeMeanGroups: string | null;
    showCI: boolean;
    labelMeans: number;
    // Points
    showPoints: boolean;
    labelPoints: number;
    pointSize: number | null;
    // Edges
    showEdges: boolean;
    edgeGroup: string | null;
    edgeUnit: string | null;
    edgeCompare: string | null;
    edgeAlso: string | null;

    showTrajectories: boolean;
    trajectoryUnits: string | null;
    trajectorySmooth: 'none' | 'poly';
    trajectoryMaxDegree: number;
    trajectoryDegreeSelection: 'loocv_2d' | 'fixed';
    trajectoryShowPoints: boolean;
    trajectoryShowTips: boolean;
    trajectoryPlayhead: number | null;
    trajectoryLineStyle: 'uniform' | 'tapered';
    trajectoryStrokeWidth: number;
    trajectoryStrokeWidthRange: [number, number];
    trajectoryOpacityRange: [number, number];
    // Axes
    showAxes: boolean;
    axisXLabel: string | null;
    axisYLabel: string | null;
  } {
    const nodesEl  = this.querySelector('qe-nodes');
    const meansEl  = this.querySelector('qe-means');
    const pointsEl = this.querySelector('qe-points');
    const edgesEl  = this.querySelector('qe-edges');
    const trajectoriesEl = this.querySelector('qe-trajectories');
    const axesEl   = this.querySelector('qe-axes');
    const labelsShorthand = this.getAttribute('labels');

    return {
      // Nodes — always rendered (coordinate anchors); <qe-nodes> controls labels.
      labelNodes: parseLabelMode(
        nodesEl?.getAttribute('label') ?? this.getAttribute('label-nodes') ?? labelsShorthand,
        Label.DISPLAY_TYPES.ON
      ),
      scalePoints: this.getAttribute('scale-points') !== 'false',

      // Means — presence of <qe-means> = show; absence = hide.
      showMeans:        !!meansEl,
      activeMeanGroups: meansEl?.getAttribute('groups') ?? null,
      showCI:           !!meansEl && meansEl.hasAttribute('confidence'),
      labelMeans: parseLabelMode(
        meansEl?.getAttribute('label') ?? this.getAttribute('label-means') ?? labelsShorthand,
        Label.DISPLAY_TYPES.ON
      ),

      // Points — presence of <qe-points> = show unit dots.
      showPoints: !!pointsEl,
      labelPoints: parseLabelMode(
        pointsEl?.getAttribute('label') ?? this.getAttribute('label-points') ?? labelsShorthand,
        Label.DISPLAY_TYPES.OFF
      ),
      pointSize: pointsEl?.getAttribute('size') ? parseFloat(pointsEl.getAttribute('size')!) : null,

      // Edges — presence of <qe-edges> = draw a network.
      showEdges:   !!edgesEl,
      edgeGroup:   edgesEl?.getAttribute('group')   ?? null,
      edgeUnit:    edgesEl?.getAttribute('unit')     ?? null,
      edgeCompare: edgesEl?.getAttribute('compare')  ?? null,
      edgeAlso:    edgesEl?.getAttribute('also')     ?? null,

      // Trajectories — presence of <qe-trajectories> = draw cognitive trajectories
      showTrajectories:      !!trajectoriesEl,
      trajectoryUnits:       trajectoriesEl?.getAttribute('units') ?? null,
      trajectorySmooth:      (trajectoriesEl?.getAttribute('smooth') as 'none' | 'poly') ?? 'none',
      trajectoryMaxDegree:   trajectoriesEl?.getAttribute('max-degree') ? parseInt(trajectoriesEl.getAttribute('max-degree')!, 10) : 3,
      trajectoryDegreeSelection: (trajectoriesEl?.getAttribute('degree-selection') as 'loocv_2d' | 'fixed') ?? 'loocv_2d',
      trajectoryShowPoints:  trajectoriesEl?.getAttribute('points') !== 'false',
      trajectoryShowTips:    trajectoriesEl?.getAttribute('tips') !== 'false',
      trajectoryPlayhead:    trajectoriesEl?.getAttribute('playhead') ? parseFloat(trajectoriesEl.getAttribute('playhead')!) : null,
      trajectoryLineStyle:   (trajectoriesEl?.getAttribute('line-style') as 'uniform' | 'tapered') ?? 'uniform',
      trajectoryStrokeWidth: trajectoriesEl?.getAttribute('stroke-width') ? parseFloat(trajectoriesEl.getAttribute('stroke-width')!) : 2,
      trajectoryStrokeWidthRange: this._parseNumberPair(trajectoriesEl?.getAttribute('stroke-width-range'), [1, 6]),
      trajectoryOpacityRange: this._parseNumberPair(trajectoriesEl?.getAttribute('opacity-range'), [0.3, 1]),

      // Axes — presence of <qe-axes> = draw axis lines. The x / y attributes add
      // a per-axis label: a value is used verbatim, an empty attribute falls back
      // to the dimension name (resolved later, where dims are known). null = no
      // label for that axis.
      showAxes:   !!axesEl,
      axisXLabel: axesEl?.hasAttribute('x') ? (axesEl.getAttribute('x') ?? '') : null,
      axisYLabel: axesEl?.hasAttribute('y') ? (axesEl.getAttribute('y') ?? '') : null,
    };
  }

  private _parseNumberPair(value: string | null | undefined, fallback: [number, number]): [number, number] {
    if (!value) return fallback;
    const parts = value.split(',').map(part => Number(part.trim()));
    if (parts.length < 2 || !parts.every(Number.isFinite)) return fallback;
    return [parts[0], parts[1]];
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    this._scheduleRerender();
  }

  connectedCallback(): void {
    // Apply width/height HTML attributes as CSS dimensions on the host element
    // so the shadow-DOM wrapper's height:100% resolves to a real pixel value.
    const w = this.getAttribute('width');
    const h = this.getAttribute('height');
    this.style.display = 'block';   // custom elements are inline by default
    if (w) this.style.width  = isNaN(Number(w)) ? w : `${w}px`;
    if (h) this.style.height = isNaN(Number(h)) ? h : `${h}px`;

    this.appendChild(this.svg_element);
    QEGraphElement._instances.add(this);   // registry for getGraph()/instances()

    // Watch for child layer element additions/removals and attribute changes.
    // Any mutation schedules a re-render via the same microtask batch used by
    // attributeChangedCallback, so synchronous DOM mutations collapse to one pass.
    this._childObserver = new MutationObserver(() => this._scheduleRerender());
    this._childObserver.observe(this, {
      childList:       true,
      attributes:      true,
      subtree:         true,
      attributeFilter: [
        'group', 'unit', 'compare', 'also',
        'groups', 'confidence', 'label',
        'scale-points', 'labels', 'label-nodes', 'label-means', 'label-points',
        'units', 'smooth', 'degree', 'points', 'tips', 'playhead',
        'line-style', 'stroke-width', 'stroke-width-range', 'opacity-range',
        'x', 'y', 'size',
      ],
    });
    // Find the associated ena-visual: check 'for' attribute first, then nearest
    // ancestor, then first one on the page. This lets ena-graph work as a child,
    // a sibling, or anywhere else in the document.
    const forId = this.getAttribute('for');
    this._vizena = (
      (forId ? document.getElementById(forId) : null) ??
      this.closest('qe-visual') ??
      this.parentElement?.closest('qe-visual') ??
      document.querySelector('qe-visual')
    ) as QEVisualElement;
    this.draw();

    // Cache the labels <g> after draw() has connected all layer elements to
    // the SVG DOM. We do this once here rather than searching on every
    // model-updated event to guarantee we always have a valid reference.
    const labelsLayer = this.__children__.search('__children__', 'labels') as QELayer;
    if (labelsLayer?.svg_element) {
      this._labelsGroup = labelsLayer.svg_element as SVGGElement;
    } else {
      // Fallback: create a new <g> directly inside the outermost graph layer.
      console.warn('[ena-graph] labels layer not found in layer tree; creating fallback <g>');
      const graphLayer = this.__children__[0] as QELayer;
      if (graphLayer?.svg_element) {
        this._labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
        this._labelsGroup.setAttribute('data-layer-name', 'labels-fallback');
        graphLayer.svg_element.appendChild(this._labelsGroup);
      }
    }
  }

  disconnectedCallback(): void {
    this._childObserver?.disconnect();
    this._childObserver = null;
    QEGraphElement._instances.delete(this);
  }

  // ── Instance registry + read APIs (webENA integration) ──────────────────────
  private static _instances: Set<QEGraphElement> = new Set();

  /** All connected <qe-graph> instances (newest membership order). */
  static instances(): QEGraphElement[] { return [...QEGraphElement._instances]; }

  /** Look up a graph by its `id` or `plot-group` attribute. */
  static getGraph(key: string): QEGraphElement | null {
    for (const g of QEGraphElement._instances) {
      if (g.id === key || g.getAttribute('plot-group') === key) return g;
    }
    return null;
  }

  /** Resolved code nodes with their current graph-space coordinates. */
  getNodes(): Array<{ id: string; name: string; x: number; y: number }> {
    const layer = this.__children__.search('__children__', 'nodes') as QELayer | undefined;
    if (!layer) return [];
    return [...layer.__data__.objects.values()].map((o: any) => ({
      id: o.ID, name: o.meta?.name ?? o.ID, x: o.x, y: o.y,
    }));
  }

  /** Resolved edges of the current network with weights and direction. */
  getEdges(): Array<{ source: string; target: string; weight: number; directed: boolean; self: boolean }> {
    const collect = (name: string) => {
      const l = this.__children__.search('__children__', name) as QELayer | undefined;
      return l ? [...l.__data__.objects.values()] : [];
    };
    return [...collect('edges'), ...collect('edgenodes')]
      .map((o: any) => {
        const m = o.meta ?? {};
        return { source: m.source, target: m.target, weight: m.weight ?? 0,
                 directed: !!m.isDirected, self: !!m.isSelf };
      })
      .filter(e => e.source != null && e.target != null);
  }

  create(): SVGElement {
    const
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    ;
    svg.classList.add("graph");
    // Fill the host and keep the square ENA drawing centered (equal x/y scaling
    // preserves distances). Without this the SVG collapses to an intrinsic size
    // and pins to the left, leaving dead space in the container.
    svg.style.display = 'block';
    svg.style.width   = '100%';
    svg.style.height  = '100%';
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("viewBox", (this.__data__ as Graph).extremes.as_viewBox());
    svg.setAttribute("transform", (this.__data__ as Graph).transform.toString());
    svg.setAttribute("role", "figure");
    svg.setAttribute("data-graph-size", `${Math.min((this.__data__ as Graph).extremes.width, (this.__data__ as Graph).extremes.height)}`);
    this.svg_element = svg;

    // Pre-generate one arrowhead marker per palette color.  Per-color markers are
    // the most reliable approach: `context-stroke` and `currentColor` inheritance
    // through SVG markers is inconsistent across browsers and shadow-DOM contexts.
    // Reference as url(#qe-arrow-RRGGBB) where RRGGBB is the hex without '#'.
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    // Arrow dimensions in SVG user-space units (viewBox is ~4.8×4.8).
    // AW must be large enough so the body of the arrowhead is visible before it
    // disappears behind the target node circle.  ~5% of the viewport (0.24 units)
    // works well.  markerUnits="userSpaceOnUse" keeps the size fixed regardless
    // of stroke-width, so even thin edges get a readable direction indicator.
    const AW = 0.22, AH = 0.15; // arrow length (along edge) and base width (perp)
    const makeArrow = (id: string, fill: string) => {
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      m.setAttribute('id',          id);
      m.setAttribute('markerWidth', String(AW));
      m.setAttribute('markerHeight',String(AH));
      m.setAttribute('refX',        String(AW));   // tip at reference point
      m.setAttribute('refY',        String(AH / 2));
      m.setAttribute('orient',      'auto');
      m.setAttribute('markerUnits', 'userSpaceOnUse');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d',    `M0,0 L0,${AH} L${AW},${AH/2} z`);
      p.setAttribute('fill', fill);
      m.appendChild(p);
      defs.appendChild(m);
    };
    // One marker per GROUP_PALETTE entry (covers all possible edge colors)
    GROUP_PALETTE.forEach(color => makeArrow(`qe-arrow-${color.slice(1)}`, color));
    svg.appendChild(defs);

    this.__data__.layers.forEach((layer: LayerLike) => {
      const layer_g: QELayer = new QELayer(layer as any, this.svg_element, this);
      this.__children__.push(layer_g);
    });

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
      this.update();
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

    // ── Label interactions ───────────────────────────────────────────────────
    // CLICK mode: toggle label on point-clicked event
    this.svg_element.addEventListener('point-clicked', ((ev: CustomEvent) => {
      const id = ev.detail?.pointData?.ID;
      if (!id) return;
      const lbl = this._pointLabels.get(id)
               ?? this._meanLabels.get(id.replace('mean-', ''))
               ?? this._nodeLabels.get(id);
      if (lbl && lbl.displayMode === Label.DISPLAY_TYPES.CLICK) lbl.toggle();
    }) as EventListener);

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

    const getAutoLabel = (id: string): QELabel | undefined => {
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

    // ── Public interaction events (webENA integration surface) ────────────────
    // Dispatched on the public <qe-graph> element with bubbles+composed so a
    // host app can subscribe regardless of shadow DOM. See README "Events".
    this._attachInteractionEvents();
  }

  /** Emit a namespaced CustomEvent on the public element (bubbles + composed). */
  private _emit(name: string, detail: Record<string, any>): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  /** Walk up from a hit element to the nearest ancestor carrying `attr`. */
  private _closestWith(el: SVGElement | null, attr: string): SVGElement | null {
    while (el && el !== this.svg_element) {
      if (el.getAttribute?.(attr) != null && el.hasAttribute?.(attr)) return el;
      el = el.parentElement as SVGElement | null;
    }
    return null;
  }

  /** Resolve an edge hit element to a qe-edge-* detail, or null. */
  private _edgeDetail(el: SVGElement | null): Record<string, any> | null {
    const e = this._closestWith(el, 'data-edge-source');
    if (!e) return null;
    const d: Record<string, any> = {
      source:   e.getAttribute('data-edge-source'),
      target:   e.getAttribute('data-edge-target'),
      weight:   parseFloat(e.getAttribute('data-edge-weight') || '0'),
      directed: e.getAttribute('data-edge-directed') === 'true',
      self:     e.getAttribute('data-edge-self') === 'true',
    };
    if (e.hasAttribute('data-edge-group')) d.group = e.getAttribute('data-edge-group');
    if (e.hasAttribute('data-edge-unit'))  d.unit  = e.getAttribute('data-edge-unit');
    return d;
  }

  /** Resolve a node/mean/point hit element to a qe-node-* detail, or null. */
  private _nodeDetail(el: SVGElement | null): Record<string, any> | null {
    const n = this._closestWith(el, 'data-point-id');
    if (!n) return null;
    const tag = n.tagName.toLowerCase();
    let x: number, y: number;
    if (tag === 'rect') {
      x = parseFloat(n.getAttribute('x') || '0') + parseFloat(n.getAttribute('width')  || '0') / 2;
      y = parseFloat(n.getAttribute('y') || '0') + parseFloat(n.getAttribute('height') || '0') / 2;
    } else {
      x = parseFloat(n.getAttribute('cx') || '0');
      y = parseFloat(n.getAttribute('cy') || '0');
    }
    const id = n.getAttribute('data-point-id')!;
    const d: Record<string, any> = {
      id,
      kind: n.getAttribute('data-kind') || 'point',
      name: n.getAttribute('data-name') || id,
      x, y,
    };
    if (n.hasAttribute('data-group')) d.group = n.getAttribute('data-group');
    if (n.hasAttribute('data-unit'))  d.unit  = n.getAttribute('data-unit');
    return d;
  }

  private _attachInteractionEvents(): void {
    const svg = this.svg_element;

    svg.addEventListener('click', (ev: MouseEvent) => {
      const target = ev.target as SVGElement;
      const edge = this._edgeDetail(target);
      if (edge) { this._emit('qe-edge-click', { ...edge, originalEvent: ev }); return; }
      const node = this._nodeDetail(target);
      if (node) this._emit('qe-node-click', { ...node, originalEvent: ev });
    });

    // Hover enter/leave, tracked so we emit one unhover→hover pair per change.
    let hovered: { type: 'edge' | 'node'; key: string } | null = null;
    const keyOf = (t: 'edge' | 'node', d: Record<string, any>) =>
      t === 'edge' ? `${d.source} ${d.target}` : String(d.id);

    svg.addEventListener('mousemove', (ev: MouseEvent) => {
      const target = ev.target as SVGElement;
      const edge = this._edgeDetail(target);
      const node = edge ? null : this._nodeDetail(target);
      const next = edge ? { type: 'edge' as const, detail: edge }
                 : node ? { type: 'node' as const, detail: node }
                 : null;
      const nextKey = next ? keyOf(next.type, next.detail) : null;
      if (hovered && (!next || hovered.key !== nextKey)) {
        this._emit(hovered.type === 'edge' ? 'qe-edge-unhover' : 'qe-node-unhover', { key: hovered.key });
        hovered = null;
      }
      if (next && (!hovered || hovered.key !== nextKey)) {
        this._emit(next.type === 'edge' ? 'qe-edge-hover' : 'qe-node-hover', { ...next.detail, originalEvent: ev });
        hovered = { type: next.type, key: nextKey! };
      }
    });

    svg.addEventListener('mouseleave', () => {
      if (hovered) {
        this._emit(hovered.type === 'edge' ? 'qe-edge-unhover' : 'qe-node-unhover', { key: hovered.key });
        hovered = null;
      }
    });
  }

  draw() {
    if(!this.svg_element) {
      console.error("No element to draw to: ", this);
      return;
    }
    
    this.wrapper?.appendChild(this.svg_element);

    (this.__children__ as QELayer[]).forEach((enaLayer: QELayer) => {
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
    this.update_axes();     // axis line visibility + labels (uses final extent)
  }

  /**
   * Axes (<qe-axes>): toggle the axis-line cross by presence, and draw/position
   * per-axis labels at the positive ends using the current extent. Labels are
   * cached SVG <text> nodes in the labels group; null text removes them.
   */
  update_axes(): void {
    // Show or hide the whole axis sub-tree (lines + origin) by <qe-axes> presence.
    const axesLayer = this.__children__.search('__children__', 'axes') as QELayer | undefined;
    if (axesLayer?.svg_element) {
      (axesLayer.svg_element as SVGElement).style.display = this._showAxes ? '' : 'none';
    }

    const parent = this._labelsGroup;
    const extent = this.__data__.extremes.x_max;
    if (!parent || extent <= 0) return;

    const fontSize = extent * 0.06;
    const gap      = fontSize * 0.6;

    const place = (axis: 'x' | 'y', text: string | null) => {
      let el = this._axisLabelEls.get(axis);
      if (!this._showAxes || text == null) {          // remove when hidden / no label
        if (el) { el.remove(); this._axisLabelEls.delete(axis); }
        return;
      }
      if (!el) {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'text') as SVGTextElement;
        el.setAttribute('data-axis-label', axis);
        el.setAttribute('pointer-events', 'none');
        parent.appendChild(el);
        this._axisLabelEls.set(axis, el);
      }
      el.textContent = text;
      el.setAttribute('font-size',   fontSize.toString());
      el.setAttribute('font-family', 'system-ui, sans-serif');
      el.setAttribute('font-weight', '600');
      el.setAttribute('fill',        '#556');
      if (axis === 'x') {
        // At the right (+x) tip, anchored end so any-length text grows inward
        // and never clips past the viewBox edge; nudged just above the axis.
        el.setAttribute('x', (extent - gap).toString());
        el.setAttribute('y', (-gap).toString());
        el.setAttribute('text-anchor', 'end');
      } else {
        // Just below the top (−y) tip, centered on the y-axis, inside the box.
        el.setAttribute('x', (gap).toString());
        el.setAttribute('y', (-extent + fontSize + gap).toString());
        el.setAttribute('text-anchor', 'start');
      }
    };

    place('x', this._axisXText);
    place('y', this._axisYText);
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
    (this.__children__ as QELayer[]).forEach((enaLayer: QELayer) => {
      enaLayer.update();
    });
  }
}
customElements.define(QEGraphElement.tagName, QEGraphElement);
