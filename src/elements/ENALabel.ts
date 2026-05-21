import { Label, Point } from "../objects/PlottedObject";
import { ENASvgElement } from "./ENASvg";

/**
 * SVG <text> drawable for a single ENA label.
 *
 * ── Display modes (Label.DISPLAY_TYPES) ──────────────────────────────────────
 *   OFF   (0) — never shown
 *   AUTO  (1) — shown on mouseover of the associated point, hidden on mouseout
 *   CLICK (2) — toggled by clicking the associated point
 *   ON    (3) — always shown
 *
 * ── Position modes (Label.POSITION) ─────────────────────────────────────────
 *   OBJECT    (1) — offset near the point (quadrant-aware, default)
 *   STATIC    (2) — centered directly on the point (no offset; label overlaps point)
 *   CONTAINER (3) — projected to the viewBox boundary in the point's direction;
 *                   useful for code-node labels that appear at the outer ring
 *   CUSTOM    (4) — caller provides explicit (customX, customY) coordinates
 */
export class ENALabel {
  svg_element: SVGTextElement;
  private _visible: boolean = false;

  constructor(
    public readonly text:        string,
    public readonly point:       Point,
    public readonly parent:      SVGElement,
    public readonly graph:       ENASvgElement,
    public readonly displayMode: number = Label.DISPLAY_TYPES.ON,
    public readonly position:    number = Label.POSITION.OBJECT,
    public customX?: number,
    public customY?: number,
  ) {
    this.svg_element = this._create();

    // Set initial visibility without calling update() yet.
    // The ENASvgElement calls update_labels() after update_extremes() so that
    // the first real positioning uses the correct graph extent, not the default 1.
    if (displayMode === Label.DISPLAY_TYPES.ON) {
      this._visible = true;
      this.svg_element.setAttribute('display', 'block');
    } else {
      this._visible = false;
      this.svg_element.setAttribute('display', 'none');
    }
  }

  private _create(): SVGTextElement {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text') as SVGTextElement;
    el.textContent = this.text;
    el.setAttribute('data-label-for', this.point.ID);
    el.setAttribute('pointer-events', 'none'); // labels never intercept mouse events
    this.parent.appendChild(el);
    return el;
  }

  /**
   * Recompute position and font-size from current graph extents.
   * No-ops when the label is hidden (AUTO/CLICK modes while not hovered/clicked).
   */
  update(): void {
    if (!this._visible) return;

    const extent = this.graph.__data__.extremes.x_max;
    if (extent <= 0) return; // graph not initialised yet

    const fontSize   = extent * 0.06;
    const offset     = fontSize * 1.2;

    let x: number, y: number, anchor: string;

    switch (this.position) {

      case Label.POSITION.STATIC: {
        // Centered on the point — label sits at exactly the point's coordinates.
        // Useful when the caller wants to control offset manually via customX/Y.
        x      = this.point.x;
        y      = this.point.y - offset * 0.3;
        anchor = 'middle';
        break;
      }

      case Label.POSITION.CONTAINER: {
        // Project from origin through the point onto the viewBox boundary.
        // Labels ring the outer edge of the plot, one per code/group direction.
        const px = this.point.x;
        const py = this.point.y;
        const dist = Math.sqrt(px * px + py * py) || 1;
        const scale = (extent * 0.93) / dist;
        x      = px * scale;
        y      = py * scale - offset * 0.3;
        anchor = px >= 0 ? 'start' : 'end';
        break;
      }

      case Label.POSITION.CUSTOM: {
        // Caller-provided coordinates; fall back to OBJECT behaviour if unset.
        if (this.customX != null && this.customY != null) {
          x      = this.customX;
          y      = this.customY;
          anchor = 'start';
          break;
        }
        // fall through to OBJECT
      }

      default:
      case Label.POSITION.OBJECT: {
        // Quadrant-aware offset: push label away from origin.
        const dx = this.point.x >= 0 ? offset : -offset;
        anchor   = this.point.x >= 0 ? 'start' : 'end';
        x        = this.point.x + dx;
        y        = this.point.y - offset * 0.4;
        break;
      }
    }

    this.svg_element.setAttribute('x',           x.toString());
    this.svg_element.setAttribute('y',           y.toString());
    this.svg_element.setAttribute('font-size',   fontSize.toString());
    this.svg_element.setAttribute('font-family', 'system-ui, sans-serif');
    this.svg_element.setAttribute('font-weight', '500');
    this.svg_element.setAttribute('text-anchor', anchor);
    this.svg_element.setAttribute('fill',        this.point.color?.toString() ?? '#333333');
  }

  /** Make the label visible and position it immediately. */
  show(): void {
    this._visible = true;
    this.svg_element.setAttribute('display', 'block');
    this.update();
  }

  hide(): void {
    this._visible = false;
    this.svg_element.setAttribute('display', 'none');
  }

  toggle(): void {
    this._visible ? this.hide() : this.show();
  }

  get visible(): boolean { return this._visible; }

  remove(): void {
    this.svg_element.remove();
  }
}
