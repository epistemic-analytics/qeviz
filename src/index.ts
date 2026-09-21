// QEViz standalone entry point — no arbor/webr dependency.
// Import this bundle directly from rENA or any non-arbor context.

export { QEVisualElement, vizENA } from './elements/QEVisual.js';
export { QEGraphElement } from './elements/QEGraph.js';
export { QENodesElement, QEMeansElement, QEPointsElement, QEEdgesElement, QETrajectoriesElement, QEAxesElement } from './elements/QEChildElements.js';
export { QELayer } from './elements/QELayer.js';
export { QEPoint } from './elements/QEPoint.js';
export { QELine } from './elements/QELine.js';
export { QETrajectory } from './elements/QETrajectory.js';

export type { ModelData, QEFrame, ONAModelData, ENAModelData, ENADataFrame } from './types/ModelData.js';

export { Graph } from './objects/Graph.js';
export { Edge } from './objects/Edges.js';
export { Trajectory } from './objects/Trajectory.js';
export { fitTrajectory, selectDegree, sampleCurve, nearOriginFilter, TRAJECTORY_ZERO_EPS } from './objects/polyfit.js';
export type { XY, DegreeSelection, TrajectoryFit } from './objects/polyfit.js';
export { Color, WeightedColor } from './objects/Color.js';

export { DataFrame, DataFrameRow, DataFrameColumn, DataFrameColumnType } from './types/DataFrame.js'
