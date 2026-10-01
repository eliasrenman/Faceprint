import {
  LineCapStyle,
  PDFDocument,
  PrintScaling,
  appendBezierCurve,
  closePath,
  degrees,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setLineCap,
  setLineWidth,
  setStrokingColor,
  stroke,
  translate,
} from 'pdf-lib';
import type { Face2D, Point2 } from '../cad/types';
import { calculateTemplateLayout, type TemplateLayoutOptions } from './template-layout';

export const pointsPerMM = 72 / 25.4;
const toPoints = (millimetres: number): number => millimetres * pointsPerMM;

export async function createSourcePDF(
  face: Face2D,
  includeHoleCenters: boolean,
  layoutOptions?: TemplateLayoutOptions,
): Promise<Uint8Array> {
  if (!(face.widthMM > 0) || !(face.heightMM > 0)) throw new Error('The selected face has invalid dimensions');
  const layout = layoutOptions ? calculateTemplateLayout(face.widthMM, face.heightMM, layoutOptions) : undefined;
  const width = toPoints(layout?.canvasWidthMM ?? face.widthMM);
  const height = toPoints(layout?.canvasHeightMM ?? face.heightMM);
  const document = await PDFDocument.create();
  document.setProducer('FacePrint');
  document.setCreator('FacePrint');
  const page = document.addPage([width, height]);
  page.setRotation(degrees(0));
  page.setMediaBox(0, 0, width, height);
  page.setCropBox(0, 0, width, height);
  page.setBleedBox(0, 0, width, height);
  page.setTrimBox(0, 0, width, height);
  document.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);

  page.pushOperators(
    pushGraphicsState(),
    translate(toPoints(layout?.originXMM ?? 0), toPoints(layout?.originYMM ?? 0)),
    setStrokingColor(rgb(0, 0, 0)),
    setLineWidth(toPoints(0.15)),
    setLineCap(LineCapStyle.Butt),
  );
  for (const loop of face.loops) {
    const first = loop.segments[0];
    if (!first) throw new Error('A selected boundary loop is empty');
    page.pushOperators(moveTo(toPoints(first.from.x), toPoints(first.from.y)));
    for (const segment of loop.segments) {
      if (segment.kind === 'line') {
        page.pushOperators(lineTo(toPoints(segment.to.x), toPoints(segment.to.y)));
      } else {
        page.pushOperators(
          appendBezierCurve(
            toPoints(segment.c1.x),
            toPoints(segment.c1.y),
            toPoints(segment.c2.x),
            toPoints(segment.c2.y),
            toPoints(segment.to.x),
            toPoints(segment.to.y),
          ),
        );
      }
    }
    page.pushOperators(closePath(), stroke());
  }

  if (includeHoleCenters) {
    for (const hole of face.circularHoles) drawCenterCross(page, hole.center, hole.radiusMM);
  }
  page.pushOperators(popGraphicsState());
  return document.save({ useObjectStreams: false, addDefaultPage: false, objectsPerTick: 50 });
}

function drawCenterCross(page: ReturnType<PDFDocument['addPage']>, center: Point2, radiusMM: number): void {
  const halfSize = Math.min(2, Math.max(0.75, radiusMM * 0.45));
  page.pushOperators(
    moveTo(toPoints(center.x - halfSize), toPoints(center.y)),
    lineTo(toPoints(center.x + halfSize), toPoints(center.y)),
    moveTo(toPoints(center.x), toPoints(center.y - halfSize)),
    lineTo(toPoints(center.x), toPoints(center.y + halfSize)),
    stroke(),
  );
}
