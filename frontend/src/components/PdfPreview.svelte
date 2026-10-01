<script lang="ts">
  import { onDestroy } from 'svelte';
  import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
  import pdfWorkerURL from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
  import PdfPageCanvas from './PdfPageCanvas.svelte';

  export let pdfBytes: Uint8Array | undefined;
  export let digest = '';

  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerURL;
  let document: pdfjs.PDFDocumentProxy | undefined;
  let loadingTask: pdfjs.PDFDocumentLoadingTask | undefined;
  let selectedPage = 1;
  let zoom = 0.9;
  let loadGeneration = 0;
  let error = '';

  $: if (pdfBytes) load(pdfBytes);

  onDestroy(() => {
    loadGeneration += 1;
    loadingTask?.destroy();
    document?.cleanup();
  });

  async function load(bytes: Uint8Array): Promise<void> {
    const generation = ++loadGeneration;
    error = '';
    await loadingTask?.destroy();
    await document?.cleanup();
    document = undefined;
    loadingTask = pdfjs.getDocument({ data: bytes.slice() });
    try {
      const loaded = await loadingTask.promise;
      if (generation !== loadGeneration) {
        await loaded.cleanup();
        return;
      }
      document = loaded;
      selectedPage = 1;
    } catch (reason) {
      if (generation === loadGeneration) error = reason instanceof Error ? reason.message : String(reason);
    }
  }
</script>

<section class="preview" aria-label="Actual tiled PDF preview">
  {#if error}
    <div class="preview-error">Could not render the PDF: {error}</div>
  {:else if document}
    <aside class="thumbnails">
      {#each Array(document.numPages) as _, index}
        <button class:active={selectedPage === index + 1} on:click={() => (selectedPage = index + 1)} aria-label={`Show sheet ${index + 1}`}>
          <PdfPageCanvas {document} pageNumber={index + 1} scale={0.18} label={`Sheet ${index + 1} thumbnail`} />
          <span>{index + 1}</span>
        </button>
      {/each}
    </aside>
    <div class="page-stage">
      <div class="zoom-controls">
        <button on:click={() => (zoom = Math.max(0.35, zoom - 0.15))} aria-label="Zoom out">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button on:click={() => (zoom = Math.min(2.5, zoom + 0.15))} aria-label="Zoom in">+</button>
      </div>
      <div class="sheet-label">Sheet {selectedPage} of {document.numPages}</div>
      <div class="page-scroll">
        <PdfPageCanvas {document} pageNumber={selectedPage} scale={zoom} label={`Sheet ${selectedPage}`} />
      </div>
      <div class="digest">Preview bytes · SHA-256 {digest.slice(0, 12)}…</div>
    </div>
  {:else}
    <div class="loading">Rendering actual PDF sheets…</div>
  {/if}
</section>

<style>
  .preview { min-width: 0; min-height: 0; display: grid; grid-template-columns: 118px 1fr; height: 100%; background: #d8d4cc; }
  .thumbnails { overflow-y: auto; padding: 12px 10px; background: #c9c4bb; border-right: 1px solid #b4aea3; }
  .thumbnails button { width: 100%; display: grid; justify-items: center; gap: 5px; border: 1px solid transparent; border-radius: 6px; padding: 8px 4px; margin-bottom: 9px; color: #4b4740; background: transparent; cursor: pointer; overflow: hidden; }
  .thumbnails button.active { background: #f6f2e9; border-color: #e05d2a; color: #23201b; }
  .thumbnails :global(canvas) { max-width: 86px; height: auto !important; }
  .thumbnails span { font-size: 11px; font-variant-numeric: tabular-nums; }
  .page-stage { position: relative; min-width: 0; min-height: 0; display: grid; grid-template-rows: auto auto 1fr auto; }
  .zoom-controls { display: flex; justify-content: center; align-items: center; gap: 9px; padding: 10px; }
  .zoom-controls button { width: 28px; height: 28px; border: 1px solid #aaa397; border-radius: 6px; background: #eeeae2; cursor: pointer; }
  .zoom-controls span { min-width: 46px; text-align: center; font-size: 12px; }
  .sheet-label { text-align: center; font-size: 12px; color: #615c53; padding-bottom: 7px; }
  .page-scroll { min-height: 0; overflow: auto; display: grid; place-items: start center; padding: 16px 28px 28px; }
  .digest { font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; color: #6c675e; text-align: center; padding: 6px 10px 9px; }
  .loading, .preview-error { grid-column: 1 / -1; display: grid; place-items: center; padding: 30px; color: #59544d; }
  .preview-error { color: #8a3128; }
</style>
