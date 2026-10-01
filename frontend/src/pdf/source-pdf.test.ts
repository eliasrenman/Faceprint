import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, PrintScaling } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { Face2D } from '../cad/types';
import { createSourcePDF, pointsPerMM } from './source-pdf';

const rectangle: Face2D = {
  modelId: 'm',
  faceId: 'f',
  units: 'mm',
  widthMM: 100,
  heightMM: 50,
  approximationBudgetMM: 0.01,
  circularHoles: [{ center: { x: 25, y: 25 }, radiusMM: 4 }],
  loops: [{
    role: 'outer',
    segments: [
      { kind: 'line', from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
      { kind: 'line', from: { x: 100, y: 0 }, to: { x: 100, y: 50 } },
      { kind: 'line', from: { x: 100, y: 50 }, to: { x: 0, y: 50 } },
      { kind: 'line', from: { x: 0, y: 50 }, to: { x: 0, y: 0 } },
    ],
  }],
};

describe('createSourcePDF', () => {
  it('writes exact physical vector bounds with rotation zero and no scaling hint', async () => {
    const bytes = await createSourcePDF(rectangle, false);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    const page = document.getPage(0);
    expect(page.getWidth() / pointsPerMM).toBeCloseTo(100, 9);
    expect(page.getHeight() / pointsPerMM).toBeCloseTo(50, 9);
    expect(page.getRotation().angle).toBe(0);
    for (const box of [page.getMediaBox(), page.getCropBox(), page.getTrimBox(), page.getBleedBox()]) {
      expect(box.x).toBe(0);
      expect(box.y).toBe(0);
      expect(box.width / pointsPerMM).toBeCloseTo(100, 9);
      expect(box.height / pointsPerMM).toBeCloseTo(50, 9);
    }
    expect(document.catalog.getViewerPreferences()?.getPrintScaling()).toBe(PrintScaling.None);
  });

  it('keeps optional center crosses off unless requested', async () => {
    const clean = await createSourcePDF(rectangle, false);
    const marked = await createSourcePDF(rectangle, true);
    expect(marked.byteLength).toBeGreaterThan(clean.byteLength);
  });

  it('uses a paper-sized canvas for centered output without changing scale', async () => {
    const bytes = await createSourcePDF(rectangle, false, {
      paper: 'A4',
      orientation: 'portrait',
      marginMM: 0,
    });
    const document = await PDFDocument.load(bytes);
    const page = document.getPage(0);
    expect(page.getWidth() / pointsPerMM).toBeCloseTo(210, 9);
    expect(page.getHeight() / pointsPerMM).toBeCloseTo(297, 9);

    const contents = page.node.Contents();
    if (!contents) throw new Error('Expected a page content stream');
    const contentObjects = contents instanceof PDFArray ? contents.asArray() : [contents];
    const streamText = contentObjects.map((object) => {
      const stream = document.context.lookup(object) as PDFRawStream;
      return new TextDecoder().decode(decodePDFRawStream(stream).decode());
    }).join('\n');
    const translation = streamText.match(/1 0 0 1 ([\d.]+) ([\d.]+) cm/);
    expect(Number(translation?.[1]) / pointsPerMM).toBeCloseTo(55, 9);
    expect(Number(translation?.[2]) / pointsPerMM).toBeCloseTo(123.5, 9);
  });
});
