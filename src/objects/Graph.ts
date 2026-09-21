import { Color } from "./Color";
import { Layer, LayerArray, LayerLike } from "./Layers";
import { DimensionVector, Label, Line, Point } from "./PlottedObject";
import { Transform } from "./Transform";
import { Extremes } from "./Extremes";
import { Node } from "./Points";
import { Edge } from "./Edges";
import { AxisPoint } from "./AxisPoint";
import { DataFrame, DataFrameRow } from "../types/DataFrame";
import { EventBus as StateManager } from "../types/EventBus";

export let DefaultGraphOptions = {
  GRAPH: {
    ratio: 1,
    x_max: 1,
    y_max: 1,
    selector: "body",
    width: 1,
    height: 1,
    axes: true,
    SIZE_EFFECT: 1,
    dimensions: [ 0, 1 ]
  },
  NODE: {
    size: 1,
    highlight: {
      color: 'yellow',
      labels: Label.DISPLAY_TYPES.ON,
    },
    labels: Label.DISPLAY_TYPES.ON,
    labelposition: Label.POSITION.OBJECT
  },
  POINT: {
    active: 2,
    size: 0.05,
    color: "#000",
    shape: Point.SHAPES.CIRCLE,
    labels: Label.DISPLAY_TYPES.AUTO,
    labelposition: Label.POSITION.OBJECT
  },
  MEAN: {
    shape: Point.SHAPES.SQUARE,
    labels: Label.DISPLAY_TYPES.AUTO,
  },
  LABEL: {
    highlight: Label.HIGHLIGHT.OFF,
    position: ['top', 'left'],
    container: "#label-container"
  },
  EDGE: {
    multiplier: 1
  }
};

export class Graph {
  __state__: StateManager = new StateManager();

  name: string = "unnamed-graph";
  origin: AxisPoint | undefined = undefined;

  options: typeof DefaultGraphOptions;

  points: Map<string, Point | AxisPoint> = new Map();
  nodes: Map<string, Node> = new Map();
  edges: Map<string, Edge> = new Map();
  trajectories: Map<string, any> = new Map();
  labels: Map<string, Label> = new Map();
  transform: Transform = new Transform();

  scale_x: number = 1;
  scale_y: number = 1;

  _extremes!: Extremes;
  SIZE_EFFECT: number = 1;
  _mirror_y: boolean = true;
  _mirror_x: boolean = false;

  layers: LayerArray;
  _layers: LayerArray = new LayerArray(
    { name: "graph", tabindex: 0, layers: [
      { 
        name: "axes",
        layers: [
          { 
            name: "axis_lines", tabindex: 0, layers: [], 
            objects: [

            ]
          },
          { 
            name: "axis_labels", tabindex: 0, layers: [], objects: []
          },
          {
            name: "axis_points", 
            tabindex: 0, 
            layers: [], 
            objects: [
              this.origin
            ]
          }
        ]
      },

      {
        name: "network",
        layers: [
          { name: "edges", layers: [], tabindex: 0 },
          { name: "nodes", layers: [], tabindex: 0 },
          { name: "edgenodes", layers: [], tabindex: 0 },
        ]
      },
      { name: "trajectories", layers: [], tabindex: 0 },
      { name: "points", layers: [], tabindex: 0 },

      { name: "labels", layers: [], tabindex: 0 },
    ] },
  );

  constructor(
    options: typeof DefaultGraphOptions = { ...DefaultGraphOptions }
  ) {
    this.options = options;
    
    this.origin = new AxisPoint(
      new DimensionVector(0, 0),
      {
        ID: "origin",
        x: 0, y: 0,
        size: 0,
        meta: {},
        graph: this,
        color: new Color("#FFFFFF"),
        highlight: new Color("#FFFFFF"),
        active: false
      }
    );

    let layer_id = 1;
    function buildLayerTree(layerData: any, parent: Layer | null, graph: Graph): Layer {
      const new_layer = new Layer(`${layer_id}`, layerData, graph);
      layer_id += 1;
      new_layer.parent = parent || undefined;
      if (layerData.layers && Array.isArray(layerData.layers)) {
        new_layer.layers = new LayerArray(...layerData.layers.map((child: any) => buildLayerTree(child, new_layer, graph)));
      }
      return new_layer;
    }

    this.layers = new LayerArray(...this._layers.map((l: any) => buildLayerTree(l, null, this)));

    let axisPointLayer: LayerLike | undefined = this.layers.search("layers", "axis_points");
    if (axisPointLayer) {
      axisPointLayer.objects.set(this.origin.ID, this.origin);
    }
    
    let axisLineLayer: LayerLike | undefined = this.layers.search("layers", "axis_lines");
    if (axisLineLayer) {
      let extremes = this.extremes || new Extremes(1, 1);
      let axis_x = new Line(
        {}, 
        new Point({ ID: "axis-x-start", dimensions: [-extremes.x_max, 0], classes: ["ena.dimension", "ena.dimension"] }), 
        new Point({ ID: "axis-x-end", dimensions: [extremes.x_max, 0], classes: ["ena.dimension", "ena.dimension"] })
      );
      axis_x.ID = "axis-x";
      axisLineLayer.objects.set(axis_x.ID, axis_x);
      let axis_y = new Line(
        {}, 
        new Point({ ID: "axis-y-start", dimensions: [0, -extremes.y_max], classes: ["ena.dimension", "ena.dimension"] }),
        new Point({ ID: "axis-y-end", dimensions: [0, extremes.y_max], classes: ["ena.dimension", "ena.dimension"] })
      );
      axis_y.ID = "axis-y";
      axisLineLayer.objects.set(axis_y.ID, axis_y);
      console.log("Added axis lines to layer: ", axisLineLayer);
    }

    // Define extremes based on options
    this.extremes = new Extremes(options.GRAPH.x_max, options.GRAPH.y_max);
  }

  set extremes(e: Extremes) {
    this._extremes = e;
  }
  get extremes(): Extremes {
    return this._extremes;
  }
  get mirror_x(): boolean {
    return this._mirror_x;
  }
  set mirror_x(m: boolean) {
    this._mirror_x = m;
  }
  get mirror_y(): boolean {
    return this._mirror_y;
  }
  set mirror_y(m: boolean) {
    this._mirror_y = m;
  }

  x_mirror(): number {
    return (this.mirror_x ? -1 : 1);
  }
  y_mirror(): number {
    return (this.mirror_y ? -1 : 1);
  }

  add_point(p: DataFrameRow) {
    const point: Point = new Point(p);
    this.points.set(point.ID, point);

    // if (g_.options.POINT && g_.options.POINT.label) {
    //   p.label = new Label(p.meta[g_.options.POINT.label], p, g_);
    //   g_.labels.set(p.label.ID, p.label);
    // }
    // g_.points.set(p.ID, p);
    // const pointsLayer = g_.layers.search("layers", "points");
    // if (pointsLayer) {
    //   pointsLayer.objects.push(p);
    // }
    // g_.update_extremes();
  }
  add_points(ps: DataFrame) {
    let g_ = this;
    ps.rows().forEach((p: DataFrameRow) => {
      g_.add_point(p);
    });
  }

  add_nodes(ns: any[]) {
    let
      g_ = this
    ;

    ns.forEach((new_node) => {
      // if (g_.options.NODE && g_.options.NODE.label) {
      // new_node.label = new Label(new_node.meta[g_.options.NODE.label], new_node, g_);
      new_node.label = new Label(new_node.ID, new_node);
      g_.labels.set(new_node.label.ID, new_node.label);
      // }
      g_.nodes.set(new_node.ID, new_node);
      const nodesLayer = g_.layers.search("layers", "nodes");
      if (nodesLayer) {
        nodesLayer.objects.push(new_node);
      }
    });
    g_.update_extremes();
  }
  add_edge(e: any, from?: any, to?: any) {
    let g_ = this;
    g_.edges.set(e.ID, e);

    this.add_nodes([from || e.from, to || e.to]);

    return (e);
  }
  add_edges(es: any[]) {
    let added = es.map(e => this.add_edge(e));
    const edgesLayer = this.layers.search("layers", "edges");
    if (edgesLayer) {
      edgesLayer.objects.push(...added);
    }
    return (added);
  }

  update_extremes() {
    // let
    //   dim1 = this.options.GRAPH.dimensions[0],
    //   dim2 = this.options.GRAPH.dimensions[1],
    //   // Get all points and nodes to calculate extremes
    //   all_points = [...this.points.values(), ...this.nodes.values()].flat(),
    //   x_max = Math.max(...all_points.map((p: PlottedObject) => Math.abs(p.dimension(dim1) || 0))),
    //   y_max = Math.max(...all_points.map((p: PlottedObject) => Math.abs(p.dimension(dim2) || 0))),
    //   max = Math.max(x_max, y_max)
    // ;
    // this.extremes = new Extremes(Math.ceil(max), Math.ceil(max), { x: 1, y: 1 }, { x: 1, y: 1 });

    const search_layers = [
      this.layers.search("layers", "points"),
      this.layers.search("layers", "nodes")
    ].filter((l): l is LayerLike => l !== undefined);
    if (search_layers.length === 0) {
      this.extremes = new Extremes(1, 1);
    }
    else {
      // Bound = largest |x|/|y| across points and nodes, plus a modest margin
      // for peripheral node labels. The previous Math.ceil() snapped this up to
      // the next integer, which — for ENA's small coordinate ranges (≈1–2) —
      // left the network floating in a lot of dead space. Keep the raw value so
      // the drawing fills the canvas.
      const content_max = Math.max(
        ...search_layers.map(l => Math.max(
          ...[...l.objects.values()].map(o => Math.max(Math.abs(o.x), Math.abs(o.y)))
        )).filter(a => Math.abs(a) !== Infinity)
      );
      const found_max = (Number.isFinite(content_max) && content_max > 0 ? content_max : 1) * 1.3;
      this.extremes = new Extremes(found_max, found_max);
    }
  }

  base_point_size(scale = 8): number {
    let minDim = Math.min(this.extremes.x_max, this.extremes.y_max);
    let n = this.points.size + this.nodes.size;
    return Math.min(1, minDim / (Math.sqrt(n) * scale));
  }
}
