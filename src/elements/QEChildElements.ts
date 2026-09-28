/**
 * Declarative child layer elements for <qe-graph>.
 *
 * Each element is an inert configuration holder — no shadow DOM, no rendering
 * logic.  <qe-graph> reads their presence and attributes via querySelector() to
 * configure each rendering layer.
 *
 * Presence  = the layer is rendered.
 * Absence   = the layer is hidden.  (Code-node positions come from the
 *             model and anchor the coordinate space whether or not
 *             <qe-nodes> is present; the element only controls drawing.)
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
 * <qe-nodes> — renders the code nodes.
 * Presence = draw nodes; absence = hide them (positions still set the extent).
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
 *   fixed-size  Boolean — keep mean markers a constant on-screen pixel size
 *               regardless of data extent, container size, or zoom (default:
 *               markers scale with the coordinate space, like nodes and edges).
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
 *   size   Numeric dot size (default 2.5), relative to the code-node size.
 *   fixed-size  Boolean — keep unit dots a constant on-screen pixel size
 *               regardless of data extent, container size, or zoom (default:
 *               dots scale with the coordinate space, like nodes and edges).
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
 *   max-degree   Upper bound on polynomial degree if smooth="poly" (default 3)
 *   degree-selection "loocv_2d" | "fixed" (default "loocv_2d"). "loocv_2d"
 *                picks the degree in 1..max-degree by joint 2D leave-one-out CV;
 *                "fixed" always uses max-degree. Near-origin points are excluded
 *                from the fit (still drawn).
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

/**
 * <qe-axes> — renders the x/y axis lines and, per axis, an optional title.
 * Presence = draw axes; absence = no axes.
 *
 * Attributes:
 *   x   Show the x-axis label. A value sets custom text; an empty/boolean
 *       attribute defaults to the x dimension name (e.g. "SVD1").
 *   y   Show the y-axis label. Same rule with the y dimension name.
 *
 * Examples:
 *   <qe-axes></qe-axes>              lines only, no labels
 *   <qe-axes x y></qe-axes>          "SVD1" / "SVD2"
 *   <qe-axes x="Task focus" y>       "Task focus" / "SVD2"
 */
export class QEAxesElement extends HTMLElement {
  static tagName = 'qe-axes' as const;
}

customElements.define(QENodesElement.tagName, QENodesElement);
customElements.define(QEMeansElement.tagName, QEMeansElement);
customElements.define(QEPointsElement.tagName, QEPointsElement);
customElements.define(QEEdgesElement.tagName, QEEdgesElement);
customElements.define(QETrajectoriesElement.tagName, QETrajectoriesElement);
customElements.define(QEAxesElement.tagName, QEAxesElement);
