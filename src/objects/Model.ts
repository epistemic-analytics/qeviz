import { DataFrame, DataFrameRow } from "../types/DataFrame";

export type ModelKey = "udpated" | "points" | "nodes" | "edges" | "dimensions" | "confidence" | "outlier";

export interface ModelData {
  updated?: number; // timestamp in milliseconds
  points: DataFrame;
  nodes: DataFrame;
  edges: DataFrame;
  dimensions: (string | number)[];
  confidence?: DataFrame;
  outlier?: DataFrame;
  // add other properties as needed
}

export class Model implements ModelData {
  private _updated: number | undefined;
  private _points: DataFrame;
  private _nodes: DataFrame;
  private _edges: DataFrame;
  private _dimensions: (string | number)[];
  private _params: any;
  private _confidence: DataFrame | undefined;
  private _outlier: DataFrame | undefined;

  constructor(o: ModelData = {} as ModelData) {
    this._points = o.points ?? new DataFrame();
    this._nodes = o.nodes ?? new DataFrame();
    this._edges = o.edges ?? new DataFrame();
    this._dimensions = o.dimensions ?? ["RR1", "SVD2"];
    this._confidence = undefined;
    this._outlier = undefined;
  }

  public get updated(): number | undefined {
    return this._updated;
  }
  public set updated(value: number | undefined) {
    this._updated = value;
  }

  public get points(): DataFrame {
    return this._points;
  }
  public set points(value: DataFrame) {
    this._points = value;
  }

  public get nodes(): DataFrame {
    return this._nodes;
  }
  public set nodes(value: DataFrame) {
    this._nodes = value;
  }

  public get edges(): DataFrame {
    return this._edges;
  }
  public set edges(value: DataFrame) {
    this._edges = value;
  }

  public get confidence(): DataFrame | undefined {
    return this._confidence;
  }
  public set confidence(value: DataFrame | undefined) {
    this._confidence = value;
  }

  public get outlier(): DataFrame | undefined {
    return this._outlier;
  }
  public set outlier(value: DataFrame | undefined) {
    this._outlier = value;
  }

  public get dimensions(): (string | number)[] {
    return this._dimensions;
  }
  public set dimensions(value: (string | number)[]) {
    this._dimensions = value;
  }

  public get params(): any {
    return this._params;
  }
  public set params(value: any) {
    this._params = value;
  }

  public point(id: string): DataFrameRow | undefined {
    return this._points.row(id);
  }

  // Dynamic getter
  // public getByKey<K extends ModelKey>(key: K): Model[K] {
  //   return this[key];
  // }

  // Dynamic setter
  public setByKey<K extends keyof ModelData>(key: K, value: ModelData[K]): void {
    (this as any)[key] = value;
  }
}

export default Model;