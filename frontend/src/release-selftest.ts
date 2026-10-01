import stepFixture from '../../testdata/step/asymmetric-plate-100x50mm.step?raw';
import type { CADAdapter } from './cad/adapter';
import type { Face2D } from './cad/types';
import { createSourcePDF } from './pdf/source-pdf';
import { verifyPDFRender } from './pdf/verify-render';
import {
  createTemplate,
  recordIntegrationSelfTest,
  type IntegrationSelfTestResult,
} from './services/desktop';
import { base64ToBytes, bytesToBase64 } from './services/transport';

const close = (actual: number, expected: number, tolerance = 0.02): boolean =>
  Math.abs(actual - expected) <= tolerance;

export async function runReleaseSelfTest(cad: CADAdapter, kernelDigest = ''): Promise<void> {
  const result: IntegrationSelfTestResult = {
    finished: false,
    passed: false,
    stage: 'starting',
    detail: '',
    widthMM: 0,
    heightMM: 0,
    pageCount: 0,
    pdfRendered: false,
    kernelOverrideUsed: kernelDigest !== '',
    kernelDigest,
    previewDigest: '',
  };

  try {
    await recordIntegrationSelfTest(result);
    result.stage = 'occt-wasm STEP import';
    await recordIntegrationSelfTest(result);
    const bytes = new TextEncoder().encode(stepFixture);
    const model = await cad.load(bytes.buffer);
    const planarFaces = model.faces.filter((face) => face.planar);
    if (planarFaces.length === 0) throw new Error('fixture has no planar faces');

    result.stage = 'exact face extraction';
    await recordIntegrationSelfTest(result);
    let selected: Face2D | undefined;
    for (const candidate of planarFaces) {
      const face = await cad.extract(model.modelId, candidate.faceId, { x: 0, y: 0, z: 1 });
      if (!selected || face.widthMM * face.heightMM > selected.widthMM * selected.heightMM) selected = face;
    }
    if (!selected) throw new Error('could not extract a planar fixture face');
    const dimensions = [selected.widthMM, selected.heightMM].sort((a, b) => b - a);
    result.widthMM = dimensions[0];
    result.heightMM = dimensions[1];
    if (!close(dimensions[0], 100) || !close(dimensions[1], 50)) {
      throw new Error(`known face measured ${dimensions[0].toFixed(4)} × ${dimensions[1].toFixed(4)} mm`);
    }

    result.stage = 'pdftilecut';
    await recordIntegrationSelfTest(result);
    const source = await createSourcePDF(selected, false, {
      paper: 'A4',
      orientation: 'landscape',
      marginMM: 0,
    });
    const preview = await createTemplate(bytesToBase64(source), {
      paper: 'A4',
      orientation: 'landscape',
      marginMM: 0,
      fullPage: true,
    });
    result.pageCount = preview.info.pageCount;
    result.previewDigest = preview.digest;
    if (preview.info.pageCount !== 1 || !close(preview.info.pageWidthMM, 297) || !close(preview.info.pageHeightMM, 210)) {
      throw new Error(`unexpected tiled layout: ${preview.info.pageCount} page(s), ${preview.info.pageWidthMM.toFixed(3)} × ${preview.info.pageHeightMM.toFixed(3)} mm`);
    }

    result.stage = 'PDF.js render';
    await recordIntegrationSelfTest(result);
    const output = base64ToBytes(preview.pdfBase64);
    const renderedPages = await verifyPDFRender(output);
    if (renderedPages !== preview.info.pageCount) throw new Error('PDF.js page count differs from backend inspection');
    const digestInput = Uint8Array.from(output).buffer;
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', digestInput)))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    if (digest !== preview.digest) throw new Error('preview bytes do not match the backend digest');
    result.pdfRendered = true;
    result.passed = true;
    result.finished = true;
    result.stage = 'complete';
    result.detail = `Packaged WebView loaded OCCT WASM${kernelDigest ? ' through the user-override route' : ''}, preserved 100 mm, called pdftilecut, and rendered the returned bytes with PDF.js.`;
  } catch (error) {
    result.detail = error instanceof Error ? error.message : String(error);
    result.finished = true;
  }

  await recordIntegrationSelfTest(result);
}
