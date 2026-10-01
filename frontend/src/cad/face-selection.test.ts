import { describe, expect, it } from 'vitest';
import { rotateFaceQuarterTurn } from './face-selection';
import type { Face2D } from './types';

const face: Face2D = {
  modelId: 'model',
  faceId: 'face',
  units: 'mm',
  widthMM: 100,
  heightMM: 50,
  approximationBudgetMM: 0.01,
  loops: [{
    role: 'outer',
    segments: [
      { kind: 'line', from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
      { kind: 'line', from: { x: 100, y: 0 }, to: { x: 100, y: 50 } },
      { kind: 'line', from: { x: 100, y: 50 }, to: { x: 0, y: 50 } },
      { kind: 'line', from: { x: 0, y: 50 }, to: { x: 0, y: 0 } },
    ],
  }],
  circularHoles: [{ center: { x: 20, y: 10 }, radiusMM: 3 }],
};

describe('rotateFaceQuarterTurn', () => {
  it('swaps bounds without changing scale or mirroring the hole pattern', () => {
    const rotated = rotateFaceQuarterTurn(face);
    expect(rotated.widthMM).toBe(50);
    expect(rotated.heightMM).toBe(100);
    expect(rotated.circularHoles[0]).toEqual({ center: { x: 10, y: 80 }, radiusMM: 3 });
    const first = rotated.loops[0].segments[0];
    expect(Math.hypot(first.to.x - first.from.x, first.to.y - first.from.y)).toBeCloseTo(100, 12);
  });
});
