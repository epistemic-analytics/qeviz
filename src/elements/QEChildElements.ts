/**
 * Declarative child layer elements for <qe-graph>.
 *
 * Each element is an inert configuration holder — no shadow DOM, no rendering
 * logic.  <qe-graph> reads their presence and attributes via querySelector() to
 * configure each rendering layer.
 *
 * Presence  = the layer is rendered.
 * Absence   = the layer is hidden.  (Nodes are the exception: the node
 *             layer always renders because it anchors the coordinate space;
 *             <qe-nodes> only controls label behaviour.)
 *
 * HTML authoring example:
 *
 *   <qe-graph width="100%" height="440">
 *     <qe-nodes  label="on"></qe-nodes>
 *     <qe-means  groups="FirstGame,SecondGame" confidence></qe-means>
 *     <qe-points label="auto"></qe-points>
 *     <qe-edges  group="FirstGame" compare="SecondGame"></qe-edges>
 *   </qe-graph>
 */

/**
 * <qe-nodes> — controls code-node label behaviour.
 *
 * Attributes:
 *   label  "on" | "off" | "click" | "auto"   (default "on")
 */
export class QENodesElement extends HTMLElement {
  static tagName = 'qe-nodes' as const;
}

/**
 * <qe-means> — renders group mean markers and optional CI boxes.
 * Presence = show means; absence = hide means.
 *
 * Attributes:
 *   groups      Comma-separated group names to show.  Omit for all groups.
 *   confidence  Boolean — show 95% CI rectangles.
 *   label       "on" | "off" | "click" | "auto"  (default "on")
 */
export class QEMeansElement extends HTMLElement {
  static tagName = 'qe-means' as const;
}

/**
 * <qe-points> — renders individual unit scatter dots.
 * Presence = show unit points; absence = hide unit points.
 *
 * Attributes:
 *   label  "on" | "off" | "click" | "auto"  (default "auto")
 */
export class QEPointsElement extends HTMLElement {
  static tagName = 'qe-points' as const;
}

/**
 * <qe-edges> — renders an edge network.
 * Presence = draw edges; absence = no edge network.
 *
 * Attributes:
 *   group    Group name whose mean network to draw.
 *   unit     Individual unit ID whose personal network to draw
 *            (e.g. "FirstGame::steven z"). Mutually exclusive with `group`.
 *   compare  Second group to subtract (group − compare).
 *   also     Second group to overlay alongside `group`.
 */
export class QEEdgesElement extends HTMLElement {
  static tagName = 'qe-edges' as const;
}

/**
 * <qe-trajectories> — renders epistemic cognitive trajectory curves and steps.
 * Presence = draw trajectories; absence = no trajectories.
 *
 * Attributes:
 *   units        Comma-separated unit IDs to show. Omit for all.
 *   smooth       "none" | "poly" (default "none")
 *   degree       Polynomial degree (1..5) if smooth="poly" (default 3)
 *   points       "true" | "false" — show discrete point markers along trajectory
 *   tips         "true" | "false" — show leading tip marker
 *   playhead     Number — current turn / time index for filtering/animation
 *   line-style   "uniform" | "tapered" (default "uniform")
 *   stroke-width Number (default 2)
 *   stroke-width-range "min,max" for tapered lines (default "1,6")
 *   opacity-range "min,max" for tapered lines (default "0.3,1")
 */
export class QETrajectoriesElement extends HTMLElement {
  static tagName = 'qe-trajectories' as const;
}

customElements.define(QENodesElement.tagName, QENodesElement);
customElements.define(QEMeansElement.tagName, QEMeansElement);
customElements.define(QEPointsElement.tagName, QEPointsElement);
customElements.define(QEEdgesElement.tagName, QEEdgesElement);
customElements.define(QETrajectoriesElement.tagName, QETrajectoriesElement);
