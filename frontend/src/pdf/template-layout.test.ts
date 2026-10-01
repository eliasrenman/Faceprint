import { describe, expect, it } from 'vitest';
import { calculateTemplateLayout } from './template-layout';

describe('calculateTemplateLayout', () => {
  it('centers a face on a full A4 portrait sheet', () => {
    const layout = calculateTemplateLayout(100, 50, {
      paper: 'A4',
      orientation: 'portrait',
      marginMM: 0,
    });

    expect(layout.orientation).toBe('portrait');
    expect(layout.columns).toBe(1);
    expect(layout.rows).toBe(1);
    expect(layout.canvasWidthMM).toBe(210);
    expect(layout.canvasHeightMM).toBe(297);
    expect(layout.originXMM).toBe(55);
    expect(layout.originYMM).toBe(123.5);
  });

  it('centers within the printable area when margins are reserved', () => {
    const layout = calculateTemplateLayout(100, 50, {
      paper: 'A4',
      orientation: 'portrait',
      marginMM: 5,
    });

    expect(layout.canvasWidthMM).toBe(200);
    expect(layout.canvasHeightMM).toBe(287);
    expect(layout.originXMM).toBe(50);
    expect(layout.originYMM).toBe(118.5);
  });

  it('matches the tiler auto-orientation rule and centers across the full grid', () => {
    const layout = calculateTemplateLayout(900, 297, {
      paper: 'A4',
      orientation: 'auto',
      marginMM: 0,
    });

    expect(layout.orientation).toBe('portrait');
    expect(layout.columns).toBe(5);
    expect(layout.rows).toBe(1);
    expect(layout.canvasWidthMM).toBe(1050);
    expect(layout.canvasHeightMM).toBe(297);
    expect(layout.originXMM).toBe(75);
    expect(layout.originYMM).toBe(0);
  });

  it('applies and safely clamps X/Y movement inside the current grid', () => {
    const layout = calculateTemplateLayout(100, 50, {
      paper: 'A4',
      orientation: 'portrait',
      marginMM: 0,
      offsetXMM: 20,
      offsetYMM: -500,
    });

    expect(layout.offsetXMM).toBe(20);
    expect(layout.offsetYMM).toBe(-123.5);
    expect(layout.originXMM).toBe(75);
    expect(layout.originYMM).toBe(0);
  });
});
