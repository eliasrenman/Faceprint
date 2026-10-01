import type { Face2D, Point2, Segment2 } from './types';

const rotatePoint = (point: Point2, width: number): Point2 => ({ x: point.y, y: width - point.x });

export function rotateFaceQuarterTurn(face: Face2D): Face2D {
  const rotateSegment = (segment: Segment2): Segment2 => {
    if (segment.kind === 'line') {
      return {
        kind: 'line',
        from: rotatePoint(segment.from, face.widthMM),
        to: rotatePoint(segment.to, face.widthMM),
      };
    }
    return {
      kind: 'cubic',
      from: rotatePoint(segment.from, face.widthMM),
      c1: rotatePoint(segment.c1, face.widthMM),
      c2: rotatePoint(segment.c2, face.widthMM),
      to: rotatePoint(segment.to, face.widthMM),
    };
  };

  return {
    ...face,
    widthMM: face.heightMM,
    heightMM: face.widthMM,
    loops: face.loops.map((loop) => ({ ...loop, segments: loop.segments.map(rotateSegment) })),
    circularHoles: face.circularHoles.map((hole) => ({
      ...hole,
      center: rotatePoint(hole.center, face.widthMM),
    })),
  };
}
