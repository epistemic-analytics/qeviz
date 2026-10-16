import { Label, Point } from "../objects/PlottedObject";
import { QEGraphElement } from "./QEGraph";

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
export class QELabel {
  svg_element: SVGTextElement;
  private _visible: boolean = false;
  // Offset from the computed spot (graph-space units: the zoom group's, y
  // down), set by a drag or by the host (setOffset). `pinned` is set by a
  // drag; `hostPinned` by the host (setHostPinned). Either keeps the label
  // shown whatever its display mode.
  private _offsetX = 0;
  private _offsetY = 0;
  pinned = false;
  private _hostPinned = false;
  /** SVG font-weight; null = the default 500. */
  fontWeight: string | null = null;

  private _point: Point;
  /** The mark this label follows. Rebound by setPoint() on every render. */
  get point(): Point { return this._point; }

  constructor(
    public readonly text:        string,
    point:                       Point,
    public readonly parent:      SVGElement,
    public readonly graph:       QEGraphElement,
    public readonly displayMode: number = Label.DISPLAY_TYPES.ON,
    public readonly position:    number = Label.POSITION.OBJECT,
    public customX?: number,
    public customY?: number,
  ) {
    this._point = point;
    this.svg_element = this._create();

    // Set initial visibility without calling update() yet.
    // The QEGraphElement calls update_labels() after update_extremes() so that
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
    el.setAttribute('pointer-events', 'auto');   // draggable
    el.style.cursor = 'grab';
    this._attachDrag(el);
    this.parent.appendChild(el);
    return el;
  }

  /**
   * Follow a new Point for the same mark. Each render builds fresh Point
   * objects, so a label reused across renders must be rebound or it keeps the
   * old coordinates. A dragged label keeps its offset from the mark.
   */
  setPoint(point: Point): void {
    this._point = point;
    this.svg_element.setAttribute('data-label-for', point.ID);
  }

  /** Host-set offset (graph units, y down), as qe-label-move reports it. */
  setOffset(x: number, y: number): void {
    this._offsetX = Number.isFinite(x) ? x : 0;
    this._offsetY = Number.isFinite(y) ? y : 0;
  }

  /** Keep the label shown whatever its display mode (or stop doing so). */
  setHostPinned(pinned: boolean): void {
    if (pinned === this._hostPinned) return;
    this._hostPinned = pinned;
    if (pinned) this.show();
    else if (this.displayMode !== Label.DISPLAY_TYPES.ON) this.hide();
  }

  /** Drag to reposition (mouse, or a finger); pins the label open and
   *  emits qe-label-move on drop. */
  private _attachDrag(el: SVGTextElement): void {
    el.addEventListener('mousedown', (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();                       // don't start a graph pan
      this._drag(el, ev.clientX, ev.clientY, 'mouse');
    });
    // Touch only: mouse and pen arrive through mousedown above.
    el.addEventListener('pointerdown', (ev: PointerEvent) => {
      if (ev.pointerType !== 'touch') return;
      ev.preventDefault();                        // no emulated mouse drag as well
      ev.stopPropagation();                       // no touch pan / pinch of the graph
      this._drag(el, ev.clientX, ev.clientY, ev.pointerId);
    });
  }

  private _drag(el: SVGTextElement, clientX: number, clientY: number, who: 'mouse' | number): void {
    // Measure in the label's parent (inside the zoom / pan group), where
    // the offset is applied: in root-svg units a drag at zoom k moved the
    // label k times as far as the pointer.
    const frame = (el.parentNode as SVGGraphicsElement | null) ?? el.ownerSVGElement;
    const svg = el.ownerSVGElement;
    if (!svg || !frame) return;
    const toUser = (cx: number, cy: number) => {
      const p = svg.createSVGPoint(); p.x = cx; p.y = cy;
      const m = frame.getScreenCTM();
      return m ? p.matrixTransform(m.inverse()) : ({ x: 0, y: 0 } as DOMPoint);
    };
    const start = toUser(clientX, clientY);
    const baseX = this._offsetX, baseY = this._offsetY;
    el.style.cursor = 'grabbing';

    const move = (x: number, y: number) => {
      const p = toUser(x, y);
      this._offsetX = baseX + (p.x - start.x);
      this._offsetY = baseY + (p.y - start.y);
      this.pinned = true;                         // keep it shown once moved
      this._visible = true;
      this.svg_element.setAttribute('display', 'block');
      this.update();
    };
    const done = () => {
      el.style.cursor = 'grab';
      // Public event so the host can persist / mirror across coordinated plots.
      this.graph.dispatchEvent(new CustomEvent('qe-label-move', {
        detail: { id: this.point.ID, transform: { x: this._offsetX, y: this._offsetY } },
        bubbles: true, composed: true,
      }));
    };

    if (who === 'mouse') {
      const onMove = (e: MouseEvent) => move(e.clientX, e.clientY);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        done();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    } else {
      const onMove = (e: PointerEvent) => { if (e.pointerId === who) move(e.clientX, e.clientY); };
      const onUp = (e: PointerEvent) => {
        if (e.pointerId !== who) return;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        done();
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    }
  }

  /**
   * Recompute position and font-size from current graph extents.
   * No-ops when the label is hidden (AUTO/CLICK modes while not hovered/clicked).
   */
  update(): void {
    if (!this._visible) return;

    const extent = this.graph.__data__.extremes.x_max;
    if (extent <= 0) return; // graph not initialised yet

    // qe_labels(font_size =) is in CSS pixels (constant on screen); default
    // scales with the plot extent.
    const font       = (this.graph as any)._labelFont ?? {};
    const fontSize   = font.size ? font.size * (this.graph as any).unitsPerPixel() : extent * 0.06;
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
        // Project from the view's centre (the origin, unless center="content")
        // through the point onto the viewBox boundary. Labels ring the outer
        // edge of the plot, one per code/group direction.
        const { cx, cy } = this.graph.__data__.extremes;
        const px = this.point.x - cx;
        const py = this.point.y - cy;
        const dist = Math.sqrt(px * px + py * py) || 1;
        const scale = (extent * 0.93) / dist;
        x      = cx + px * scale;
        y      = cy + py * scale - offset * 0.3;
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
    // Drag / host offset (graph-space units) composes on top of the computed
    // spot; a zero offset clears a previous one.
    if (this._offsetX || this._offsetY) {
      this.svg_element.setAttribute('transform', `translate(${this._offsetX}, ${this._offsetY})`);
    } else {
      this.svg_element.removeAttribute('transform');
    }
    this.svg_element.setAttribute('font-size',   fontSize.toString());
    this.svg_element.setAttribute('font-family', font.family ?? 'system-ui, sans-serif');
    this.svg_element.setAttribute('font-weight', this.fontWeight ?? '500');
    this.svg_element.setAttribute('text-anchor', anchor);
    this.svg_element.setAttribute('fill',        font.color ?? this.point.color?.toString() ?? '#333333');

    // Keep the label inside the plot. A label the host placed (dragged, or
    // custom coordinates) stays where it was put.
    if (!this._offsetX && !this._offsetY && this.position !== Label.POSITION.CUSTOM) {
      this.fitInside(x, y, anchor, offset, fontSize * 0.3);
    }
  }

  /** The visible plot area in this label's coordinates (so zoom, pan and the
   *  viewBox's letterboxing are accounted for), or null if not laid out. */
  private visibleBounds(): { left: number; right: number; top: number; bottom: number } | null {
    const el = this.svg_element as SVGTextElement;
    const root = el.ownerSVGElement;
    const ctm = el.getScreenCTM?.();
    if (!root || !ctm) return null;
    const r = root.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    const inv = ctm.inverse();
    const a = new DOMPoint(r.left, r.top).matrixTransform(inv);
    const b = new DOMPoint(r.right, r.bottom).matrixTransform(inv);
    return { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x),
             top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) };
  }

  private bbox(): DOMRect | null {
    try {
      const b = (this.svg_element as SVGTextElement).getBBox();
      return b.width > 0 ? b : null;
    } catch { return null; }   // not rendered (e.g. detached)
  }

  /** If the label runs past an edge: put an outward label on the other side
   *  of its point, and if it still doesn't fit, slide it back inside. */
  private fitInside(x: number, y: number, anchor: string, offset: number, margin: number): void {
    const view = this.visibleBounds();
    let box = this.bbox();
    if (!view || !box) return;
    const left = view.left + margin, right = view.right - margin;
    const top = view.top + margin, bottom = view.bottom - margin;
    const over = (b: DOMRect) => Math.max(0, left - b.x) + Math.max(0, b.x + b.width - right);
    const el = this.svg_element;

    if (over(box) > 0 && this.position === Label.POSITION.OBJECT && anchor !== 'middle') {
      const flipAnchor = anchor === 'end' ? 'start' : 'end';
      const flipX = anchor === 'end' ? this.point.x + offset : this.point.x - offset;
      el.setAttribute('text-anchor', flipAnchor);
      el.setAttribute('x', flipX.toString());
      const flipped = this.bbox();
      if (flipped && over(flipped) < over(box)) { box = flipped; x = flipX; }
      else { el.setAttribute('text-anchor', anchor); el.setAttribute('x', x.toString()); }
    }
    let dx = 0, dy = 0;
    if (box.x < left) dx = left - box.x;
    else if (box.x + box.width > right) dx = Math.max(right - (box.x + box.width), left - box.x);
    if (box.y < top) dy = top - box.y;
    else if (box.y + box.height > bottom) dy = Math.max(bottom - (box.y + box.height), top - box.y);
    if (dx) el.setAttribute('x', (x + dx).toString());
    if (dy) el.setAttribute('y', (y + dy).toString());
  }

  /** Make the label visible and position it immediately. */
  show(): void {
    this._visible = true;
    this.svg_element.setAttribute('display', 'block');
    this.update();
  }

  hide(): void {
    if (this.pinned || this._hostPinned) return;   // a dragged / pinned label stays visible
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
