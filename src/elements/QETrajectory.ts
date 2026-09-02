import { Trajectory } from '../objects/Trajectory';
import { Drawable } from './Drawable';
import { QEArray, QEElement } from './QELayer';
import { QEGraphElement } from './QEGraph';

export class QETrajectory extends Drawable implements QEElement {
  __name__: string = 'trajectory';
  private _path_el: SVGPathElement | null = null;
  private _segments_group: SVGGElement | null = null;
  private _tip_el: SVGCircleElement | null = null;
  private _points_group: SVGGElement | null = null;

  constructor(
    public __data__: Trajectory,
    public parent: SVGElement,
    public graph: QEGraphElement,
    public __children__: QEArray = new QEArray()
  ) {
    super(__data__, parent, graph, __children__);
    this.svg_element = this.create();
  }

  // Trajectory styling is specified in display pixels, while SVG paths use
  // graph coordinates. Convert at render time so marks stay legible at any scale.
  private graphUnitsForPixels(pixels: number): number {
    const extent = this.graph.__data__.extremes.x_max || 1;
    const width = this.graph.svg_element?.getBoundingClientRect().width || 0;
    return width > 0 ? pixels * (2 * extent / width) : pixels * extent * 0.006;
  }

  create() {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'qe-trajectory-group');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', this.__data__.color.toString());
    path.setAttribute('stroke-width', this.graphUnitsForPixels(this.__data__.strokeWidth).toString());
    group.appendChild(path);
    this._path_el = path;

    const segmentsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    segmentsGroup.setAttribute('class', 'qe-trajectory-segments');
    group.appendChild(segmentsGroup);
    this._segments_group = segmentsGroup;

    const pointsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pointsGroup.setAttribute('class', 'qe-trajectory-points');
    group.appendChild(pointsGroup);
    this._points_group = pointsGroup;

    if (this.__data__.showTips) {
      const tip = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      tip.setAttribute('fill', this.__data__.color.toString());
      tip.setAttribute('r', this.graphUnitsForPixels(4).toString());
      tip.setAttribute('stroke', '#ffffff');
      tip.setAttribute('stroke-width', this.graphUnitsForPixels(1.5).toString());
      group.appendChild(tip);
      this._tip_el = tip;
    }

    this.svg_element = group;
    return group;
  }

  update() {
    if (!this.svg_element) {
      this.create();
    }
    if (!this.svg_element.parentElement) {
      this.parent.appendChild(this.svg_element);
    }

    const dStr = this.__data__.path;
    if (this._path_el) {
      this._path_el.setAttribute('d', dStr);
      this._path_el.setAttribute('stroke', this.__data__.color.toString());
      this._path_el.setAttribute('stroke-width', this.graphUnitsForPixels(this.__data__.strokeWidth).toString());
      this._path_el.style.display = this.__data__.lineStyle === 'tapered' ? 'none' : 'block';
    }

    if (this._segments_group) {
      this._segments_group.innerHTML = '';
      if (this.__data__.lineStyle === 'tapered') {
        const pathPts = this.__data__.pathPoints;
        const nSegments = pathPts.length - 1;
        const [minWidth, maxWidth] = this.__data__.strokeWidthRange;
        const [minOpacity, maxOpacity] = this.__data__.opacityRange;

        for (let i = 0; i < nSegments; i++) {
          const start = pathPts[i];
          const end = pathPts[i + 1];
          const progress = nSegments <= 1 ? 1 : i / (nSegments - 1);
          const width = minWidth + (maxWidth - minWidth) * progress;
          const opacity = minOpacity + (maxOpacity - minOpacity) * progress;
          const segment = document.createElementNS('http://www.w3.org/2000/svg', 'path');

          segment.setAttribute('d', `M${start.x},${start.y} L${end.x},${end.y}`);
          segment.setAttribute('fill', 'none');
          segment.setAttribute('stroke', this.__data__.color.toString());
          segment.setAttribute('stroke-linecap', 'round');
          segment.setAttribute('stroke-linejoin', 'round');
          segment.setAttribute('stroke-width', this.graphUnitsForPixels(width).toString());
          segment.setAttribute('opacity', opacity.toString());
          this._segments_group.appendChild(segment);
        }
        this._segments_group.style.display = 'block';
      } else {
        this._segments_group.style.display = 'none';
      }
    }

    const pts = this.__data__.activePoints;

    if (this._points_group) {
      if (this.__data__.showPoints && pts.length > 0) {
        this._points_group.innerHTML = '';
        pts.forEach(pt => {
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', pt.x.toString());
          dot.setAttribute('cy', pt.y.toString());
          dot.setAttribute('r', this.graphUnitsForPixels(2.5).toString());
          dot.setAttribute('fill', this.__data__.color.toString());
          dot.setAttribute('opacity', '0.7');
          this._points_group?.appendChild(dot);
        });
        this._points_group.style.display = 'block';
      } else {
        this._points_group.style.display = 'none';
      }
    }

    if (this._tip_el && this.__data__.showTips) {
      if (pts.length > 0) {
        const lastPt = pts[pts.length - 1];
        this._tip_el.setAttribute('cx', lastPt.x.toString());
        this._tip_el.setAttribute('cy', lastPt.y.toString());
        this._tip_el.setAttribute('fill', this.__data__.color.toString());
        this._tip_el.setAttribute('r', this.graphUnitsForPixels(4).toString());
        this._tip_el.setAttribute('stroke-width', this.graphUnitsForPixels(1.5).toString());
        this._tip_el.style.display = 'block';
      } else {
        this._tip_el.style.display = 'none';
      }
    }
  }

  draw() {
    if (this.svg_element && !this.svg_element.parentElement) {
      this.parent.appendChild(this.svg_element);
    }
    this.update();
  }
}
