# qeviz — capabilities needed for webENA integration

**Audience:** the qeviz project (this repo). **Author:** the rENA-webtool ("webENA") side.
**Goal:** make qeviz able to power webENA's **interactive ENA/ONA network plots**, replacing/augmenting its current sigma.js v1 (SVG) renderer.

This document lists **only what is missing or needs changing in qeviz.** qeviz's
rendering is already a strong match (SVG web components; nodes / means / points /
edges / confidence & outlier intervals / compare+overlay / axes / directed edges).
The gap is the **interaction / event surface** and a few **host-facing APIs**.

---

## Context (why these are needed)

webENA is an AngularJS app that today renders up to three coordinated network plots
(a primary, a secondary, and an overlaid comparison plot) with custom sigma.js v1
SVG renderers. Users **interact** with the plots, and those interactions drive app
behavior:

- **Click an edge** → webENA opens a "conversation" data view for that code pair.
- **Click a node** (code / unit / group mean) → select/highlight, pin its label, or
  plot that unit's individual network.
- **Hover a node** → transiently overlay that unit's network; **hover an edge** →
  show a weight tooltip.
- Multiple plots are looked up by a **plot-group key** so a click handler can reach
  "its" plot instance.

qeviz currently exposes almost none of this to a host app: edges have no
interaction at all, and the only host-observable events are `model-updated` and an
internal `point-clicked` (dispatched on the inner `svg_element`, not the public
element). Closing the gaps below makes qeviz a drop-in for the interactive network.

**Guiding principle:** stay framework-agnostic. Expose interactions as **DOM
`CustomEvent`s on the public `<qe-graph>` / `<qe-visual>` element** with
`bubbles: true, composed: true` and a rich `detail`. The host reacts and pushes
state back declaratively (ModelData + layer attributes) — do **not** add any
Angular/React coupling.

---

## P0 — Interaction events (blockers for the interactive network)

### P0.1 Edge click
- **Now:** `QELine` / `objects/Edges.ts` render edges with **no event handlers**.
- **Need:** clicking an edge dispatches, on the public element,
  `qe-edge-click` with `detail: { source, target, weight, directed, group?, unit?, originalEvent }`
  where `source`/`target` are node ids/names and `weight` is the displayed value.
- **Notes:** thin edges need a hit target — render an invisible wide "hit stroke"
  (e.g. `stroke-width: 12; stroke: transparent; pointer-events: stroke`) behind each
  visible edge, or set `pointer-events` appropriately. Self-connection glyphs (drawn
  as node-like marks in directed/ONA mode) should click as edges too.
- **Acceptance:** in the demo, `graph.addEventListener('qe-edge-click', …)` fires with
  correct `source`/`target`/`weight` for both undirected and directed edges.

### P0.2 Node click (code nodes and group means, not just unit points)
- **Now:** `QEPoint` dispatches an internal `point-clicked` for **unit points** only,
  used to toggle labels; code nodes/means participate in label delegation but emit no
  host event.
- **Need:** clicking any node dispatches `qe-node-click` with
  `detail: { id, kind: 'node' | 'mean' | 'point', name, group?, unit?, x, y, originalEvent }`.
  `kind:'node'` = code node, `'mean'` = group mean, `'point'` = unit point.
- **Notes:** you already tag elements with `data-point-id` and delegate via
  `findPointId`; extend that delegation to emit this host event for all three kinds.

### P0.3 Expose the existing point click on the public element
- **Now:** `point-clicked` is dispatched on the inner `svg_element`.
- **Need:** it must reach a host `addEventListener` on `<qe-graph>`/`<qe-visual>`
  (either fold into P0.2's `qe-node-click` with `kind:'point'`, or re-dispatch on the
  public element with `composed: true`). Either is fine; document which.

### P0.4 Hover in/out for nodes AND edges
- **Now:** only label auto-show on point mouseover; the source comments call
  hover-highlight a "future hook"; edges have no hover.
- **Need:** dispatch `qe-node-hover` / `qe-node-unhover` and `qe-edge-hover` /
  `qe-edge-unhover` on the public element, with the same `detail` shapes as the click
  events. The host debounces and decides what to draw (network overlay, tooltip), so
  qeviz just needs to emit reliable enter/leave with the resolved node/edge.
- **Acceptance:** hovering an edge fires `qe-edge-hover` with `source/target/weight`;
  leaving fires `qe-edge-unhover`.

### P0.5 Public event surface + schema doc
- All P0.1–P0.4 events fire on the **public custom element**, `bubbles: true,
  composed: true`, so an outer app can subscribe regardless of shadow DOM.
- Publish the **event names + `detail` schemas** in the README (a short "Events"
  section). Treat these as the stable integration API.

### P0.6 Per-instance handle / lookup
- **Now:** no way to distinguish or fetch a specific graph instance.
- **Need:** webENA runs multiple plots and must target one. Provide **both**:
  1. an identity attribute (e.g. `<qe-graph plot-group="comparison">` or reuse `id`), and
  2. a lookup (`qeviz.getGraph(idOrGroup)` and/or a documented `instances()` registry),
     plus confirm the element ref itself is a usable handle.
- Also expose **read access** to the currently resolved model: nodes with their
  screen/data coordinates and edges with weights (`graph.getNodes()`, `graph.getEdges()`),
  for host-side hit-testing and export.

---

## P1 — Interaction parity (needed to match current UX)

### P1.1 Programmatic highlight / selection styling
webENA recolors the clicked edge (and pins/highlights nodes) to show selection.
Provide a **host-drivable** way to mark an edge/node as highlighted and to clear it —
either an attribute/state on the layer (preferred, declarative) or a method
(`graph.setHighlight({ edges:[{source,target}], nodes:[id] })`). The host must not
have to reach into qeviz's internal DOM to do this.

### P1.2 Draggable + pinnable labels, with a move event
webENA lets users **drag** node/unit labels to reposition and **pin** them open, and
persists the transform. Add:
- draggable labels (persist a per-label transform), pin-on-click,
- a `qe-label-move` event `detail: { id, transform }` so the host can persist/mirror
  the position across coordinated plots.

### P1.3 Edge tooltip data (or opt-in built-in tooltip)
The `qe-edge-hover` payload must include enough to render `"<source> – <target>
(weight)"`. An opt-in built-in tooltip layer would be a bonus but is not required if
the event carries the data.

### P1.4 Rectangle/lasso hit-testing for points
webENA supports drag-select of unit points (bulk selection). You already put
`data-point-id` on point elements; either keep that guarantee **and** expose resolved
point coordinates (P0.6), or provide a helper `graph.pointsInRect({x,y,w,h}) → id[]`.

---

## P2 — Nice-to-have / paradigm bridges

### P2.1 Transition animations on ModelData change
webENA animates node moves and edge growth on transitions (sigma tween: live value
vs `tox/toy/tosize`). qeviz currently re-renders without animation. Optional tweening
when `ModelData` changes (nodes lerp to new positions, edges grow) would preserve the
current feel. Not a blocker.

### P2.2 Efficient incremental updates
Confirm that pushing frequent `setModelData` + `updated`-timestamp changes **diffs and
re-renders efficiently** (no full teardown/flicker), since the host will drive updates
by rebuilding ModelData rather than mutating a live graph.

### P2.3 Export hooks
Provide `graph.toSVG(): string` and/or `graph.toPNG(): Promise<string /* dataURL */>`
that snapshot the current layers, so hosts don't serialize internal DOM by hand.
(webENA today clones the inline `<svg>`, injects fonts, and rasterizes to PNG.)

---

## Data-contract confirmations (please verify against `ModelData`)

webENA will feed a `ModelData` adapter built from rENA/rena-wasm output. Please
confirm (or flag gaps) that ModelData already supports all of:

- **Node positions** for code nodes from a rotation matrix (x/y per chosen dimensions).
- **Unit points** and **group means** with a group column.
- **Edges** as adjacency-matrix rows keyed by code-pair (webENA's native shape) — you
  document both adjacency and edge-list; confirm adjacency auto-detection.
- **Confidence intervals** per group as per-dimension `[low, high]`, and **outlier
  bounds** — you list these on the `groups` frame; confirm they render as boxes.
- **Comparison**: signed **subtraction** (`compare`, `group − compare`, sign-colored)
  and **overlay** (`also`) — confirm both, including sign→color.
- **Directed / ONA** edges with arrowheads and **self-connections** — confirm both.
- **Size decoupling**: unit/group markers stay a **fixed on-screen size** while code
  nodes and edges **scale with weight/zoom**. Confirm this is controllable per layer.

Anything on this list that ModelData can't yet express is an additional gap.

---

## Non-goals / constraints
- Keep qeviz **framework-agnostic** — no Angular/React/webENA-specific code.
- Keep the **declarative layer model** and the R/Python/Julia adapters working.
- These requirements are for the **static/interactive network** only. Trajectory and
  3D are out of scope for this integration (webENA has no trajectory view yet).

## Suggested priority order for the qeviz project
1. **P0.1 edge click**, **P0.2 node click**, **P0.3 point click** on the public element with schemas (P0.5).
2. **P0.4 hover in/out** (nodes + edges).
3. **P0.6 instance handle/lookup + read APIs.**
4. **P1.1 highlight API**, **P1.3 tooltip data**.
5. **P1.2 draggable/pinnable labels + move event**, **P1.4 rect hit-test.**
6. **P2** items as capacity allows.

When P0 is done, webENA can wire a proof-of-concept single network plot; P1 reaches
UX parity with the current sigma plots; P2 polishes.
