import type { Orientation, Paper } from '../services/desktop';

const paperDimensionsMM: Record<Paper, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
};

export interface TemplateLayoutOptions {
  paper: Paper;
  orientation: Orientation;
  marginMM: number;
  offsetXMM?: number;
  offsetYMM?: number;
}

export interface TemplateLayout {
  orientation: Exclude<Orientation, 'auto'>;
  columns: number;
  rows: number;
  canvasWidthMM: number;
  canvasHeightMM: number;
  originXMM: number;
  originYMM: number;
  offsetXMM: number;
  offsetYMM: number;
  maxOffsetXMM: number;
  maxOffsetYMM: number;
}

const tileCountEpsilon = 1e-7;

export function calculateTemplateLayout(
  widthMM: number,
  heightMM: number,
  options: TemplateLayoutOptions,
): TemplateLayout {
  if (!Number.isFinite(widthMM) || !Number.isFinite(heightMM) || widthMM <= 0 || heightMM <= 0) {
    throw new Error('The selected face has invalid dimensions');
  }
  if (!Number.isFinite(options.marginMM) || options.marginMM < 0) {
    throw new Error('The printer margin is invalid');
  }

  const orientation = resolveOrientation(widthMM, heightMM, options);
  const paper = orientedPaper(options.paper, orientation);
  const usableWidthMM = paper.width - 2 * options.marginMM;
  const usableHeightMM = paper.height - 2 * options.marginMM;
  if (usableWidthMM <= 0 || usableHeightMM <= 0) {
    throw new Error('The printer margin leaves no printable paper area');
  }

  const columns = tileCount(widthMM, usableWidthMM);
  const rows = tileCount(heightMM, usableHeightMM);
  const canvasWidthMM = columns * usableWidthMM;
  const canvasHeightMM = rows * usableHeightMM;
  const maxOffsetXMM = Math.max(0, (canvasWidthMM - widthMM) / 2);
  const maxOffsetYMM = Math.max(0, (canvasHeightMM - heightMM) / 2);
  const offsetXMM = clampOffset(options.offsetXMM ?? 0, maxOffsetXMM);
  const offsetYMM = clampOffset(options.offsetYMM ?? 0, maxOffsetYMM);

  return {
    orientation,
    columns,
    rows,
    canvasWidthMM,
    canvasHeightMM,
    originXMM: maxOffsetXMM + offsetXMM,
    originYMM: maxOffsetYMM + offsetYMM,
    offsetXMM,
    offsetYMM,
    maxOffsetXMM,
    maxOffsetYMM,
  };
}

export function clampOffset(value: number, maximum: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(-maximum, value));
}

function resolveOrientation(
  widthMM: number,
  heightMM: number,
  options: TemplateLayoutOptions,
): Exclude<Orientation, 'auto'> {
  if (options.orientation !== 'auto') return options.orientation;
  const portrait = orientedPaper(options.paper, 'portrait');
  const landscape = orientedPaper(options.paper, 'landscape');
  const portraitCount = countForPaper(widthMM, heightMM, portrait, options.marginMM);
  const landscapeCount = countForPaper(widthMM, heightMM, landscape, options.marginMM);
  return landscapeCount < portraitCount ? 'landscape' : 'portrait';
}

function orientedPaper(paper: Paper, orientation: Exclude<Orientation, 'auto'>): { width: number; height: number } {
  const dimensions = paperDimensionsMM[paper];
  return orientation === 'landscape'
    ? { width: dimensions.height, height: dimensions.width }
    : dimensions;
}

function countForPaper(
  widthMM: number,
  heightMM: number,
  paper: { width: number; height: number },
  marginMM: number,
): number {
  const usableWidthMM = paper.width - 2 * marginMM;
  const usableHeightMM = paper.height - 2 * marginMM;
  if (usableWidthMM <= 0 || usableHeightMM <= 0) return Number.POSITIVE_INFINITY;
  return tileCount(widthMM, usableWidthMM) * tileCount(heightMM, usableHeightMM);
}

function tileCount(lengthMM: number, usableLengthMM: number): number {
  return Math.max(1, Math.ceil(lengthMM / usableLengthMM - tileCountEpsilon));
}
