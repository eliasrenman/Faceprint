export type Vec3 = { x: number; y: number; z: number };
export type Point2 = { x: number; y: number };

export type Segment2 =
  | { kind: 'line'; from: Point2; to: Point2 }
  | { kind: 'cubic'; from: Point2; c1: Point2; c2: Point2; to: Point2 };

export interface Loop2D {
  role: 'outer' | 'inner';
  segments: Segment2[];
}

export interface Face2D {
  modelId: string;
  faceId: string;
  units: 'mm';
  widthMM: number;
  heightMM: number;
  loops: Loop2D[];
  circularHoles: Array<{ center: Point2; radiusMM: number }>;
  approximationBudgetMM: number;
}

export interface FaceMeshData {
  faceId: string;
  planar: boolean;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface ModelSceneData {
  modelId: string;
  faces: FaceMeshData[];
  wireframe: Float32Array;
  wireGroups: Int32Array;
  bounds: {
    xmin: number;
    ymin: number;
    zmin: number;
    xmax: number;
    ymax: number;
    zmax: number;
  };
}

export type CADRequest =
  | { type: 'configure'; wasm: ArrayBuffer }
  | { type: 'load'; step: ArrayBuffer }
  | { type: 'extract'; modelId: string; faceId: string; viewingDirection: Vec3 }
  | { type: 'dispose' };
