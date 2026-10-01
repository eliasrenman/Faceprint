import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerURL from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerURL;

/** Loads and rasterizes page one through the same packaged PDF.js worker used
 * by the visible preview. This is used only by the opt-in release self-test. */
export async function verifyPDFRender(bytes: Uint8Array): Promise<number> {
  const loading = pdfjs.getDocument({ data: bytes.slice() });
  const pdfDocument = await loading.promise;
  try {
    const page = await pdfDocument.getPage(1);
    const viewport = page.getViewport({ scale: 0.25 });
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('WebView canvas 2D context is unavailable');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return pdfDocument.numPages;
  } finally {
    await loading.destroy();
  }
}
