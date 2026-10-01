/// <reference lib="webworker" />

import { OcctKernel, type CurveKind, type OcctKernel as KernelType, type ShapeHandle, type Vec3 } from 'occt-wasm';
import wasmURL from 'occt-wasm/dist/occt-wasm.wasm?url';
import type { CADRequest, Face2D, FaceMeshData, Loop2D, ModelSceneData, Point2 } from './types';

type Envelope = { id: number; request: CADRequest };
type EdgeSamples = { points: Vec3[]; curve: CurveKind };

const scope = self as unknown as DedicatedWorkerGlobalScope;
const approximationBudgetMM = 0.005;
const joinToleranceMM = 0.02;
const maxFaces = 5_000;
const maxBoundaryPoints = 250_000;

let kernelPromise: Promise<KernelType> | undefined;
let kernelSource: string | ArrayBuffer = wasmURL;
let modelId = '';
let modelRoot: ShapeHandle | undefined;
let faces = new Map<string, ShapeHandle>();

function getKernel(): Promise<KernelType> {
  kernelPromise ??= OcctKernel.init({ wasm: kernelSource });
  return kernelPromise;
}

function configureKernel(wasm: ArrayBuffer): void {
  if (kernelPromise) throw new Error('The CAD kernel is already running; restart FacePrint to change it');
  if (wasm.byteLength === 0) throw new Error('The CAD kernel override is empty');
  kernelSource = wasm;
}

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const distance = (a: Vec3, b: Vec3): number => length(sub(a, b));
const normalize = (a: Vec3): Vec3 => {
  const magnitude = length(a);
  if (!Number.isFinite(magnitude) || magnitude < 1e-12) throw new Error('CAD surface returned an invalid direction');
  return scale(a, 1 / magnitude);
};

function pointSegmentDistance(point: Vec3, from: Vec3, to: Vec3): number {
  const segment = sub(to, from);
  const denominator = dot(segment, segment);
  if (denominator < 1e-24) return distance(point, from);
  const t = Math.max(0, Math.min(1, dot(sub(point, from), segment) / denominator));
  return distance(point, add(from, scale(segment, t)));
}

async function disposeModel(): Promise<void> {
  if (!kernelPromise) return;
  const kernel = await kernelPromise;
  kernel.releaseAll();
  modelRoot = undefined;
  modelId = '';
  faces.clear();
}

async function loadModel(step: ArrayBuffer): Promise<ModelSceneData> {
  const kernel = await getKernel();
  kernel.releaseAll();
  faces.clear();
  modelId = crypto.randomUUID();
  modelRoot = kernel.importStep(step);
  const handles = kernel.getSubShapes(modelRoot, 'face');
  if (handles.length === 0) throw new Error('The STEP file contains no faces');
  if (handles.length > maxFaces) throw new Error(`The model has ${handles.length} faces; the limit is ${maxFaces}`);

  const faceMeshes: FaceMeshData[] = [];
  const transfers: Transferable[] = [];
  for (let index = 0; index < handles.length; index += 1) {
    const handle = handles[index];
    const faceId = `face-${index + 1}`;
    faces.set(faceId, handle);
    const mesh = kernel.tessellate(handle, { linearDeflection: 0.15, angularDeflection: 0.35 });
    const faceMesh: FaceMeshData = {
      faceId,
      planar: kernel.surfaceType(handle) === 'plane',
      positions: mesh.positions,
      normals: mesh.normals,
      indices: mesh.indices,
    };
    faceMeshes.push(faceMesh);
    transfers.push(mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer);
  }

  const wire = kernel.wireframe(modelRoot, { source: 'triangulation', deflection: 0.15 });
  transfers.push(wire.points.buffer, wire.edgeGroups.buffer);
  const result: ModelSceneData = {
    modelId,
    faces: faceMeshes,
    wireframe: wire.points,
    wireGroups: wire.edgeGroups,
    bounds: kernel.getBoundingBox(modelRoot, { precise: false }),
  };
  Object.defineProperty(result, '__transfers', { value: transfers, enumerable: false });
  return result;
}

function evaluateAdaptive(
  kernel: KernelType,
  edge: ShapeHandle,
  start: number,
  end: number,
  from: Vec3,
  to: Vec3,
  depth: number,
): Vec3[] {
  const span = end - start;
  const parameters = [start + span * 0.25, start + span * 0.5, start + span * 0.75];
  const points = parameters.map((parameter) => kernel.curvePointAtParam(edge, parameter));
  const worst = Math.max(...points.map((point) => pointSegmentDistance(point, from, to)));
  if (worst <= approximationBudgetMM * 0.8) return [from, to];
  if (depth >= 18) throw new Error('A boundary curve exceeds the 0.005 mm approximation budget');

  const midpoint = points[1];
  const left = evaluateAdaptive(kernel, edge, start, parameters[1], from, midpoint, depth + 1);
  const right = evaluateAdaptive(kernel, edge, parameters[1], end, midpoint, to, depth + 1);
  return [...left.slice(0, -1), ...right];
}

function sampleEdge(kernel: KernelType, edge: ShapeHandle): EdgeSamples {
  const curve = kernel.curveType(edge);
  const parameters = kernel.curveParameters(edge);
  if (!Number.isFinite(parameters.first) || !Number.isFinite(parameters.last) || parameters.first === parameters.last) {
    throw new Error('A boundary edge has an invalid parameter range');
  }
  const segments = curve === 'line' ? 1 : curve === 'bspline' || curve === 'bezier' ? 16 : 8;
  const sampled: Vec3[] = [];
  for (let index = 0; index < segments; index += 1) {
    const start = parameters.first + ((parameters.last - parameters.first) * index) / segments;
    const end = parameters.first + ((parameters.last - parameters.first) * (index + 1)) / segments;
    const from = kernel.curvePointAtParam(edge, start);
    const to = kernel.curvePointAtParam(edge, end);
    const part = curve === 'line' ? [from, to] : evaluateAdaptive(kernel, edge, start, end, from, to, 0);
    sampled.push(...(index === 0 ? part : part.slice(1)));
    if (sampled.length > maxBoundaryPoints) throw new Error('The selected boundary is too complex to export safely');
  }
  if (kernel.shapeOrientation(edge) === 'reversed') sampled.reverse();
  return { points: sampled, curve };
}

function orderEdges(edges: EdgeSamples[]): { points: Vec3[]; curves: CurveKind[] } {
  if (edges.length === 0) throw new Error('A face boundary has no edges');
  const remaining = edges.slice(1);
  const ordered = edges[0].points.slice();
  const curves = [edges[0].curve];

  while (remaining.length > 0) {
    const tail = ordered[ordered.length - 1];
    let matchIndex = -1;
    let reverse = false;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index].points;
      if (distance(tail, candidate[0]) <= joinToleranceMM) {
        matchIndex = index;
        break;
      }
      if (distance(tail, candidate[candidate.length - 1]) <= joinToleranceMM) {
        matchIndex = index;
        reverse = true;
        break;
      }
    }
    if (matchIndex < 0) throw new Error('A selected face has an open or disconnected boundary');
    const [matched] = remaining.splice(matchIndex, 1);
    const points = reverse ? matched.points.slice().reverse() : matched.points;
    ordered.push(...points.slice(1));
    curves.push(matched.curve);
    if (ordered.length > maxBoundaryPoints) throw new Error('The selected boundary is too complex to export safely');
  }

  if (distance(ordered[0], ordered[ordered.length - 1]) > joinToleranceMM) {
    throw new Error('A selected face has an open boundary');
  }
  ordered[ordered.length - 1] = ordered[0];
  return { points: ordered, curves };
}

function circleThrough(a: Point2, b: Point2, c: Point2): { center: Point2; radius: number } | undefined {
  const denominator = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(denominator) < 1e-10) return undefined;
  const aa = a.x * a.x + a.y * a.y;
  const bb = b.x * b.x + b.y * b.y;
  const cc = c.x * c.x + c.y * c.y;
  const center = {
    x: (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / denominator,
    y: (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / denominator,
  };
  return { center, radius: Math.hypot(a.x - center.x, a.y - center.y) };
}

function detectCircle(points: Point2[], curves: CurveKind[]): { center: Point2; radiusMM: number } | undefined {
  if (!curves.every((curve) => curve === 'circle') || points.length < 7) return undefined;
  const unique = points.slice(0, -1);
  const circle = circleThrough(unique[0], unique[Math.floor(unique.length / 3)], unique[Math.floor((2 * unique.length) / 3)]);
  if (!circle || circle.radius <= 0) return undefined;
  const maxError = Math.max(...unique.map((point) => Math.abs(Math.hypot(point.x - circle.center.x, point.y - circle.center.y) - circle.radius)));
  if (maxError > 0.01) return undefined;
  return { center: circle.center, radiusMM: circle.radius };
}

async function extractFace(requestModelId: string, faceId: string, viewingDirection: Vec3): Promise<Face2D> {
  if (requestModelId !== modelId || !modelRoot) throw new Error('The selected face belongs to an old model');
  const face = faces.get(faceId);
  if (!face) throw new Error('The selected face is no longer available');
  const kernel = await getKernel();
  if (kernel.surfaceType(face) !== 'plane') throw new Error('Choose a flat surface');

  const bounds = kernel.uvBounds(face);
  const u = (bounds.uMin + bounds.uMax) / 2;
  const v = (bounds.vMin + bounds.vMax) / 2;
  const origin = kernel.pointOnSurface(face, u, v);
  let normal = normalize(kernel.surfaceNormal(face, u, v));
  if (kernel.shapeOrientation(face) === 'reversed') normal = scale(normal, -1);
  if (dot(normal, normalize(viewingDirection)) < 0) normal = scale(normal, -1);

  const references: Vec3[] = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
  const reference = references.find((axis) => Math.abs(dot(axis, normal)) < 0.9) ?? references[2];
  const axisU = normalize(sub(reference, scale(normal, dot(reference, normal))));
  const axisV = normalize(cross(normal, axisU));
  const flatten = (point: Vec3): Point2 => {
    const offset = sub(point, origin);
    return { x: dot(offset, axisU), y: dot(offset, axisV) };
  };

  const outer = kernel.outerWire(face);
  const wires = kernel.getSubShapes(face, 'wire');
  if (wires.length === 0) throw new Error('The selected face has no printable boundary');
  const rawLoops: Array<{ role: 'outer' | 'inner'; points: Point2[]; curves: CurveKind[] }> = [];
  let pointCount = 0;
  for (const wire of wires) {
    const edgeHandles = kernel.getSubShapes(wire, 'edge');
    const ordered = orderEdges(edgeHandles.map((edge) => sampleEdge(kernel, edge)));
    pointCount += ordered.points.length;
    if (pointCount > maxBoundaryPoints) throw new Error('The selected face boundary is too complex to export safely');
    rawLoops.push({
      role: kernel.isSame(wire, outer) ? 'outer' : 'inner',
      points: ordered.points.map(flatten),
      curves: ordered.curves,
    });
  }
  if (!rawLoops.some((loop) => loop.role === 'outer')) throw new Error('The outer face boundary could not be identified');

  const allPoints = rawLoops.flatMap((loop) => loop.points);
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const widthMM = maxX - minX;
  const heightMM = maxY - minY;
  if (!(widthMM > 0) || !(heightMM > 0)) throw new Error('The selected face has zero printable area');

  const translate = (point: Point2): Point2 => ({ x: point.x - minX, y: point.y - minY });
  const loops: Loop2D[] = rawLoops.map((loop) => {
    const points = loop.points.map(translate);
    return {
      role: loop.role,
      segments: points.slice(0, -1).map((from, index) => ({ kind: 'line' as const, from, to: points[index + 1] })),
    };
  });
  const circularHoles = rawLoops
    .filter((loop) => loop.role === 'inner')
    .map((loop) => detectCircle(loop.points, loop.curves))
    .filter((circle): circle is { center: Point2; radiusMM: number } => circle !== undefined)
    .map((circle) => ({ ...circle, center: translate(circle.center) }));

  return {
    modelId,
    faceId,
    units: 'mm',
    widthMM,
    heightMM,
    loops,
    circularHoles,
    approximationBudgetMM: 0.01,
  };
}

scope.onmessage = async (event: MessageEvent<Envelope>) => {
  const { id, request } = event.data;
  try {
    let result: unknown;
    let transfers: Transferable[] = [];
    if (request.type === 'configure') {
      configureKernel(request.wasm);
    } else if (request.type === 'load') {
      result = await loadModel(request.step);
      transfers = (result as ModelSceneData & { __transfers?: Transferable[] }).__transfers ?? [];
    } else if (request.type === 'extract') {
      result = await extractFace(request.modelId, request.faceId, request.viewingDirection);
    } else {
      await disposeModel();
    }
    scope.postMessage({ id, ok: true, result }, transfers);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scope.postMessage({ id, ok: false, error: message });
  }
};
