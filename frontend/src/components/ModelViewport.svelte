<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import {
    ArcRotateCamera,
    Color3,
    Color4,
    DirectionalLight,
    Engine,
    HemisphericLight,
    Mesh,
    MeshBuilder,
    Scene,
    StandardMaterial,
    Vector3,
    VertexData,
  } from '@babylonjs/core';
  import type { ModelSceneData, Vec3 } from '../cad/types';

  export let model: ModelSceneData;
  export let selectedFaceId: string | undefined;

  const dispatch = createEventDispatcher<{
    select: { faceId: string; planar: boolean; viewingDirection: Vec3 };
  }>();

  let canvas: HTMLCanvasElement;
  let engine: Engine | undefined;
  let scene: Scene | undefined;
  let camera: ArcRotateCamera | undefined;
  let meshes: Mesh[] = [];
  let renderedModelId = '';
  let hoverFaceId: string | undefined;
  let downPosition: { x: number; y: number } | undefined;

  let normalMaterial: StandardMaterial;
  let hoverMaterial: StandardMaterial;
  let selectedMaterial: StandardMaterial;
  let edgeMaterial: StandardMaterial;

  onMount(() => {
    engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
    scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    scene.clearColor = new Color4(0.055, 0.065, 0.075, 1);
    camera = new ArcRotateCamera('camera', Math.PI / 4, Math.PI / 3, 10, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 35;
    camera.panningSensibility = 170;
    camera.lowerRadiusLimit = 0.01;

    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    ambient.intensity = 0.72;
    const key = new DirectionalLight('key', new Vector3(-0.7, -1, -0.4), scene);
    key.intensity = 0.62;

    normalMaterial = material('normal', new Color3(0.69, 0.72, 0.73), scene);
    hoverMaterial = material('hover', new Color3(0.96, 0.67, 0.22), scene);
    selectedMaterial = material('selected', new Color3(0.97, 0.46, 0.12), scene);
    edgeMaterial = material('edges', new Color3(0.08, 0.09, 0.1), scene);
    edgeMaterial.disableLighting = true;

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('resize', resize);
    engine.runRenderLoop(() => scene?.render());
    rebuild();
  });

  onDestroy(() => {
    window.removeEventListener('resize', resize);
    canvas?.removeEventListener('pointerdown', handlePointerDown);
    canvas?.removeEventListener('pointermove', handlePointerMove);
    canvas?.removeEventListener('pointerup', handlePointerUp);
    engine?.dispose();
  });

  $: if (scene && model && model.modelId !== renderedModelId) rebuild();
  $: if (scene) updateMaterials();

  function material(name: string, color: Color3, owner: Scene): StandardMaterial {
    const result = new StandardMaterial(name, owner);
    result.diffuseColor = color;
    result.specularColor = new Color3(0.14, 0.14, 0.14);
    result.backFaceCulling = false;
    return result;
  }

  function rebuild(): void {
    if (!scene || !camera || !model) return;
    for (const mesh of meshes) mesh.dispose();
    meshes = [];
    hoverFaceId = undefined;

    for (const face of model.faces) {
      const mesh = new Mesh(face.faceId, scene);
      const vertices = new VertexData();
      vertices.positions = Array.from(face.positions);
      vertices.normals = Array.from(face.normals);
      vertices.indices = Array.from(face.indices);
      vertices.applyToMesh(mesh, true);
      mesh.metadata = { faceId: face.faceId, planar: face.planar };
      mesh.material = normalMaterial;
      mesh.isPickable = true;
      meshes.push(mesh);
    }

    const lines: Vector3[][] = [];
    for (let group = 0; group < model.wireGroups.length; group += 3) {
      const start = model.wireGroups[group];
      const count = model.wireGroups[group + 1];
      const positions: Vector3[] = [];
      for (let index = 0; index < count; index += 1) {
        const offset = (start + index) * 3;
        if (offset + 2 >= model.wireframe.length) break;
        positions.push(new Vector3(model.wireframe[offset], model.wireframe[offset + 1], model.wireframe[offset + 2]));
      }
      if (positions.length >= 2) lines.push(positions);
    }
    if (lines.length > 0) {
      const overlay = MeshBuilder.CreateLineSystem('cad-edges', { lines }, scene);
      overlay.color = new Color3(0.08, 0.09, 0.1);
      overlay.isPickable = false;
      meshes.push(overlay);
    }
    renderedModelId = model.modelId;
    resetView();
    updateMaterials();
  }

  function updateMaterials(): void {
    for (const mesh of meshes) {
      const faceId = mesh.metadata?.faceId as string | undefined;
      if (!faceId) continue;
      mesh.material = faceId === selectedFaceId ? selectedMaterial : faceId === hoverFaceId ? hoverMaterial : normalMaterial;
    }
  }

  function pick(event: PointerEvent): Mesh | undefined {
    if (!scene) return undefined;
    const result = scene.pick(event.offsetX, event.offsetY, (candidate) => Boolean(candidate.metadata?.faceId));
    return result?.hit ? (result.pickedMesh as Mesh) : undefined;
  }

  function handlePointerDown(event: PointerEvent): void {
    downPosition = { x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(event: PointerEvent): void {
    const mesh = pick(event);
    hoverFaceId = mesh?.metadata?.faceId;
    canvas.style.cursor = mesh ? 'pointer' : 'grab';
    updateMaterials();
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!downPosition || !camera) return;
    const movement = Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y);
    downPosition = undefined;
    if (movement > 5) return;
    const mesh = pick(event);
    if (!mesh?.metadata?.faceId) return;
    const direction = camera.position.subtract(camera.target).normalize();
    dispatch('select', {
      faceId: mesh.metadata.faceId as string,
      planar: Boolean(mesh.metadata.planar),
      viewingDirection: { x: direction.x, y: direction.y, z: direction.z },
    });
  }

  function resetView(): void {
    if (!camera || !model) return;
    const { xmin, ymin, zmin, xmax, ymax, zmax } = model.bounds;
    camera.target = new Vector3((xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2);
    const diagonal = Math.hypot(xmax - xmin, ymax - ymin, zmax - zmin);
    camera.radius = Math.max(diagonal * 1.45, 1);
    camera.alpha = Math.PI / 4;
    camera.beta = Math.PI / 3;
    camera.lowerRadiusLimit = Math.max(diagonal * 0.015, 0.001);
    camera.upperRadiusLimit = Math.max(diagonal * 20, 10);
  }

  function resize(): void {
    engine?.resize();
  }
</script>

<div class="viewport-shell">
  <canvas bind:this={canvas} aria-label="Interactive 3D model viewport"></canvas>
  <div class="viewport-help">Drag to orbit · right-drag to pan · scroll to zoom</div>
  <button class="reset" on:click={resetView}>Reset view</button>
</div>

<style>
  .viewport-shell { position: relative; width: 100%; height: 100%; min-height: 430px; overflow: hidden; background: #0e1113; }
  canvas { width: 100%; height: 100%; display: block; outline: none; touch-action: none; }
  .viewport-help { position: absolute; left: 18px; bottom: 16px; color: #b9c0bd; font-size: 12px; letter-spacing: .02em; pointer-events: none; }
  .reset { position: absolute; right: 16px; top: 16px; border: 1px solid #59605f; color: #f8f6f1; background: rgba(20,23,24,.85); border-radius: 7px; padding: 8px 11px; cursor: pointer; }
</style>
