<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

  export let document: PDFDocumentProxy;
  export let pageNumber: number;
  export let scale = 1;
  export let label = '';

  let canvas: HTMLCanvasElement;
  let task: RenderTask | undefined;
  let generation = 0;

  onDestroy(() => task?.cancel());
  $: if (canvas && document && pageNumber && scale) {
    // Snapshot reactive inputs before rendering. Mutating canvas.width/height
    // through the reactive `canvas` binding makes Svelte 5 invalidate this
    // effect again, producing an unbounded render/cancel loop.
    render(canvas, document, pageNumber, scale);
  }

  async function render(
    target: HTMLCanvasElement,
    pdfDocument: PDFDocumentProxy,
    targetPageNumber: number,
    targetScale: number,
  ): Promise<void> {
    const current = ++generation;
    task?.cancel();
    const page = await pdfDocument.getPage(targetPageNumber);
    if (current !== generation) return;
    const viewport = page.getViewport({ scale: targetScale });
    const ratio = window.devicePixelRatio || 1;
    target.width = Math.ceil(viewport.width * ratio);
    target.height = Math.ceil(viewport.height * ratio);
    target.style.width = `${viewport.width}px`;
    target.style.height = `${viewport.height}px`;
    const context = target.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable');
    task = page.render({
      canvas: target,
      canvasContext: context,
      viewport,
      transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
    });
    try {
      await task.promise;
    } catch (error) {
      if (!(error instanceof Error && error.name === 'RenderingCancelledException')) throw error;
    }
  }
</script>

<canvas bind:this={canvas} aria-label={label || `PDF page ${pageNumber}`}></canvas>

<style>
  canvas { display: block; background: white; box-shadow: 0 1px 9px rgba(21, 18, 13, .18); }
</style>
