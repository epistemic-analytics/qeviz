// Shared mark-size and colour rules, sizes in units of the coordinate extent.
//
// Width follows webENA: absolute, raw weight × a constant (`edge-width`, as a
// fraction of the plot width), so equal weights draw equally wide in graphs of
// the same size. That one width-per-weight drives undirected strokes, the
// wide ends of directed edges, self-connection dots, and code nodes (whose
// diameter is the sum of their edges' widths).
//
// Colour follows webENA's ramps (saturation 0.25–1, opacity 0.3–1), but the
// rescaling range is taken across the whole model rather than per network.

/** Default `<qe-graph edge-width>`: the width of an edge of weight 1 as a
 *  fraction of the plot width. Width is absolute — raw weight × this — as in
 *  webENA, so equal weights get equal widths in graphs of the same size. */
export const DEFAULT_EDGE_WIDTH = 0.04;

/** webENA's colour ramps: non-zero weights are rescaled linearly from the
 *  reference [min, max] onto these saturation and opacity ranges. */
export const SATURATION_RANGE: [number, number] = [0.25, 1];
export const OPACITY_RANGE: [number, number] = [0.3, 1];

/** Linear map of |w| from [lo, hi] onto `range`; 0 stays 0 (not drawn). */
export function rampFor(w: number, lo: number, hi: number, range: [number, number]): number {
  const a = Math.abs(w);
  if (!(a > 0)) return 0;
  if (!(hi > lo)) return range[1];
  const t = Math.min(1, Math.max(0, (a - lo) / (hi - lo)));
  return range[0] + t * (range[1] - range[0]);
}

/** Edge stroke width for edges drawn outside the network rule (fallback). */
export const EDGE_WIDTH_PER_EXTENT = 0.011;

/** On-screen width (CSS px) of the outline drawn around directed (tapered)
 *  edges so long, thin triangles stay legible along their whole length. */
export const TAPERED_OUTLINE_PX = 0.75;

/** Direction chevrons on directed edges: RGB multiplier applied to the
 *  (opaque, white-flattened) edge colour, and the white halo's on-screen
 *  width in CSS px. */
export const CHEVRON_DARKEN = 0.8;
export const CHEVRON_HALO_PX = 0.75;

/** Point radius per unit of `size` (QEPoint). */
export const POINT_RADIUS_PER_EXTENT = 0.006;

/** `size` for a code node with no drawn edges: a tiny dot that still marks
 *  where the code sits (hide it with <qe-nodes unconnected="hide">). */
export const UNCONNECTED_NODE_SIZE = 0.6;

/** Width per unit of weight in extent units (plot width = 2 × extent). */
export function widthPerWeight(edgeWidth: number): number {
  return 2 * edgeWidth;
}

/** QEPoint `size` for a node whose diameter equals the summed widths of its
 *  edges, `weightSum × widthFrac` (both in extent units). */
export function nodeSizeForEdges(weightSum: number, widthFrac: number): number {
  return (weightSum * widthFrac) / (2 * POINT_RADIUS_PER_EXTENT);
}
