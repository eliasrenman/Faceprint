import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OcctKernel, type ShapeHandle } from 'occt-wasm';

let kernel: Awaited<ReturnType<typeof OcctKernel.init>>;

beforeAll(async () => {
  kernel = await OcctKernel.init();
});

afterAll(() => kernel.releaseAll());

async function importFixture(name: string): Promise<ShapeHandle> {
  const data = await readFile(resolve(process.cwd(), '../testdata/step', name));
  return kernel.importStep(Uint8Array.from(data).buffer);
}

function sortedDimensions(bounds: ReturnType<typeof kernel.getBoundingBox>): number[] {
  return [bounds.xmax - bounds.xmin, bounds.ymax - bounds.ymin, bounds.zmax - bounds.zmin].sort((a, b) => b - a);
}

describe('pinned occt-wasm STEP integration', () => {
  it('imports the millimetre plate at its exact physical dimensions', async () => {
    const shape = await importFixture('asymmetric-plate-100x50mm.step');
    const dimensions = sortedDimensions(kernel.getBoundingBox(shape));
    expect(dimensions[0]).toBeCloseTo(100, 7);
    expect(dimensions[1]).toBeCloseTo(50, 7);
    expect(kernel.getSubShapes(shape, 'face').some((face) => kernel.surfaceType(face) === 'plane')).toBe(true);
  });

  it('normalizes an inch-authored STEP fixture to the same millimetre dimensions', async () => {
    const shape = await importFixture('plate-100x50mm-authored-inches.step');
    const dimensions = sortedDimensions(kernel.getBoundingBox(shape));
    expect(dimensions[0]).toBeCloseTo(100, 6);
    expect(dimensions[1]).toBeCloseTo(50, 6);
  });

  it('preserves a far translated and rotated component placement in world space', async () => {
    const shape = await importFixture('translated-rotated-plate.step');
    const bounds = kernel.getBoundingBox(shape);
    expect(Math.abs(bounds.xmin)).toBeGreaterThan(100_000);
    expect(Math.abs(bounds.ymin)).toBeGreaterThan(100_000);
    expect(Math.abs(bounds.zmin)).toBeGreaterThan(10_000);
    const dimensions = sortedDimensions(bounds);
    expect(dimensions[2]).toBeCloseTo(3, 6);
  });
});
