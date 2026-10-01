<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { CADAdapter } from './cad/adapter';
  import { rotateFaceQuarterTurn } from './cad/face-selection';
  import type { Face2D, ModelSceneData, Vec3 } from './cad/types';
  import ModelViewport from './components/ModelViewport.svelte';
  import PdfPreview from './components/PdfPreview.svelte';
  import PrintPanel from './components/PrintPanel.svelte';
  import { createSourcePDF } from './pdf/source-pdf';
  import { calculateTemplateLayout } from './pdf/template-layout';
  import { runReleaseSelfTest } from './release-selftest';
  import {
    createTemplate,
    discardTemplate,
    getKernelOverride,
    integrationSelfTestEnabled,
    modelFromDroppedFile,
    openModel,
    recordIntegrationSelfTest,
    saveTemplate,
    type OpenedModel,
    type Orientation,
    type Paper,
    type PreviewResult,
  } from './services/desktop';
  import { bytesToBase64, base64ToBytes } from './services/transport';

  type Phase = 'empty' | 'model' | 'setup';

  const cad = new CADAdapter();
  let phase: Phase = 'empty';
  let filename = '';
  let model: ModelSceneData | undefined;
  let selectedFaceId: string | undefined;
  let selectedFace: Face2D | undefined;
  let selectionMessage = '';
  let loadingModel = false;
  let errorMessage = '';
  let savedMessage = '';
  let dragging = false;

  let paper: Paper = 'A4';
  let orientation: Orientation = 'auto';
  let marginMM = 0;
  let rotated = false;
  let holeCenters = false;
  let offsetXMM = 0;
  let offsetYMM = 0;

  let preview: PreviewResult | undefined;
  let previewBytes: Uint8Array | undefined;
  let previewStale = false;
  let generating = false;
  let saving = false;
  let desiredRevision = 0;
  let completedRevision = 0;
  let selectionRevision = 0;
  let generationTimer: ReturnType<typeof setTimeout> | undefined;
  let kernelReady: Promise<void> = Promise.resolve();

  $: printableFace = selectedFace ? (rotated ? rotateFaceQuarterTurn(selectedFace) : selectedFace) : undefined;
  $: placement = printableFace
    ? calculateTemplateLayout(printableFace.widthMM, printableFace.heightMM, { paper, orientation, marginMM: Number(marginMM), offsetXMM, offsetYMM })
    : undefined;
  $: generationKey = `${phase}|${paper}|${orientation}|${marginMM}|${rotated}|${holeCenters}|${offsetXMM}|${offsetYMM}|${selectedFace?.faceId ?? ''}`;
  $: if (phase === 'setup' && selectedFace) {
    generationKey;
    scheduleGeneration();
  }

  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('faceprint.export-preferences') ?? '{}') as {
        paper?: Paper;
        orientation?: Orientation;
        marginMM?: number;
      };
      if (['A4', 'A3', 'A2'].includes(saved.paper ?? '')) paper = saved.paper ?? 'A4';
      if (['auto', 'portrait', 'landscape'].includes(saved.orientation ?? '')) orientation = saved.orientation ?? 'auto';
      if (saved.marginMM === 0 || saved.marginMM === 5) marginMM = saved.marginMM;
    } catch {
      // Ignore malformed preferences. Model state is never persisted.
    }
    kernelReady = initializeRuntime();
  });

  onDestroy(() => {
    if (generationTimer) clearTimeout(generationTimer);
    cad.terminate();
  });

  async function chooseModel(): Promise<void> {
    clearMessages();
    try {
      await kernelReady;
      const opened = await openModel();
      if (opened) await loadOpenedModel(opened);
    } catch (error) {
      showError(error);
    }
  }

  async function loadOpenedModel(opened: OpenedModel): Promise<void> {
    await kernelReady;
    loadingModel = true;
    clearMessages();
    selectionRevision += 1;
    cancelGeneration();
    if (preview) await discardTemplate(preview.previewID).catch(() => undefined);
    preview = undefined;
    previewBytes = undefined;
    selectedFace = undefined;
    selectedFaceId = undefined;
    selectionMessage = '';
    rotated = false;
    holeCenters = false;
    offsetXMM = 0;
    offsetYMM = 0;
    try {
      model = await cad.load(opened.bytes);
      filename = opened.filename;
      phase = 'model';
    } catch (error) {
      model = undefined;
      filename = '';
      phase = 'empty';
      throw error;
    } finally {
      loadingModel = false;
    }
  }

  async function initializeRuntime(): Promise<void> {
    const selfTest = await integrationSelfTestEnabled();
    try {
      const override = await getKernelOverride();
      if (override.found && override.bytes) await cad.configureKernel(override.bytes);
      if (selfTest) await runReleaseSelfTest(cad, override.digest ?? '');
    } catch (error) {
      showError(error);
      if (selfTest) {
        const detail = error instanceof Error ? error.message : String(error);
        await recordIntegrationSelfTest({
          finished: true,
          passed: false,
          stage: 'runtime initialization',
          detail,
          widthMM: 0,
          heightMM: 0,
          pageCount: 0,
          pdfRendered: false,
          kernelOverrideUsed: false,
          kernelDigest: '',
          previewDigest: '',
        });
      }
      throw error;
    }
  }

  async function handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    dragging = false;
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    try {
      await loadOpenedModel(await modelFromDroppedFile(file));
    } catch (error) {
      showError(error);
    }
  }

  async function handleFaceSelection(detail: { faceId: string; planar: boolean; viewingDirection: Vec3 }): Promise<void> {
    const revision = ++selectionRevision;
    selectedFaceId = detail.faceId;
    selectedFace = undefined;
    offsetXMM = 0;
    offsetYMM = 0;
    clearMessages();
    if (!detail.planar) {
      selectionMessage = 'Choose a flat surface';
      return;
    }
    selectionMessage = 'Reading exact face boundary…';
    try {
      const extracted = await cad.extract(model!.modelId, detail.faceId, detail.viewingDirection);
      if (revision !== selectionRevision) return;
      selectedFace = extracted;
      selectionMessage = '';
    } catch (error) {
      if (revision !== selectionRevision) return;
      selectedFaceId = undefined;
      selectionMessage = error instanceof Error ? error.message : String(error);
    }
  }

  function printSelectedFace(): void {
    if (!selectedFace) return;
    savedMessage = '';
    phase = 'setup';
  }

  function scheduleGeneration(): void {
    if (!selectedFace || phase !== 'setup') return;
    desiredRevision += 1;
    previewStale = true;
    if (generationTimer) clearTimeout(generationTimer);
    generationTimer = setTimeout(() => void processGenerations(), 260);
  }

  async function processGenerations(): Promise<void> {
    if (generating || phase !== 'setup' || !selectedFace) return;
    generating = true;
    try {
      while (completedRevision < desiredRevision && phase === 'setup' && selectedFace) {
        const revision = desiredRevision;
        errorMessage = '';
        const face = rotated ? rotateFaceQuarterTurn(selectedFace) : selectedFace;
        try {
          const sourcePDF = await createSourcePDF(face, holeCenters, {
            paper,
            orientation,
            marginMM: Number(marginMM),
            offsetXMM,
            offsetYMM,
          });
          const result = await createTemplate(bytesToBase64(sourcePDF), {
            paper,
            orientation,
            marginMM: Number(marginMM),
            fullPage: Number(marginMM) === 0,
          });
          completedRevision = revision;
          if (revision === desiredRevision && phase === 'setup') {
            preview = result;
            previewBytes = base64ToBytes(result.pdfBase64);
            previewStale = false;
          }
        } catch (error) {
          completedRevision = revision;
          if (revision === desiredRevision) {
            previewStale = true;
            showError(error);
          }
        }
      }
    } finally {
      generating = false;
      if (completedRevision < desiredRevision && phase === 'setup') void processGenerations();
    }
  }

  async function savePDF(): Promise<void> {
    if (!preview || previewStale || generating) return;
    saving = true;
    clearMessages();
    try {
      const result = await saveTemplate(preview.previewID, filename);
      if (result.saved) {
        localStorage.setItem('faceprint.export-preferences', JSON.stringify({ paper, orientation, marginMM: Number(marginMM) }));
        savedMessage = `${result.filename} saved. Print at 100% / Actual Size, one PDF page per sheet, single-sided. Check a known dimension before cutting.`;
      }
    } catch (error) {
      showError(error);
    } finally {
      saving = false;
    }
  }

  function backToModel(): void {
    cancelGeneration();
    phase = 'model';
    previewStale = false;
    savedMessage = '';
  }

  function cancelGeneration(): void {
    if (generationTimer) clearTimeout(generationTimer);
    generationTimer = undefined;
    desiredRevision = completedRevision;
  }

  function clearMessages(): void {
    errorMessage = '';
    savedMessage = '';
  }

  function showError(error: unknown): void {
    errorMessage = error instanceof Error ? error.message : String(error);
  }
</script>

<svelte:window
  on:dragenter={(event) => { event.preventDefault(); dragging = true; }}
  on:dragover={(event) => event.preventDefault()}
  on:dragleave={(event) => { if (event.relatedTarget === null) dragging = false; }}
  on:drop={handleDrop}
/>

<main class:drop-active={dragging}>
  <header>
    <button class="brand" on:click={() => phase !== 'empty' && chooseModel()} aria-label="Open another STEP model">
      <span class="mark"><i></i><i></i><i></i></span>
      <span>FacePrint</span>
    </button>
    {#if filename}<span class="filename" title={filename}>{filename}</span>{/if}
    {#if phase !== 'empty'}<button class="open-small" on:click={chooseModel}>Open STEP</button>{/if}
  </header>

  {#if phase === 'empty'}
    <section class="empty">
      <div class="empty-card">
        <div class="hero-mark"><span></span><span></span><span></span></div>
        <p class="kicker">Full-scale surface templates</p>
        <h1>Turn a CAD face into<br />a tiled paper template.</h1>
        <p class="intro">Open a STEP model, choose one flat surface, then preview and save a clean 1:1 PDF.</p>
        <button class="primary" on:click={chooseModel} disabled={loadingModel}>{loadingModel ? 'Opening CAD kernel…' : 'Open STEP'}</button>
        <p class="drop-hint">or drop a .step / .stp file here · stays offline</p>
      </div>
    </section>
  {:else if phase === 'model' && model}
    <section class="model-workspace">
      <div class="viewer">
        <ModelViewport {model} {selectedFaceId} on:select={(event) => handleFaceSelection(event.detail)} />
      </div>
      <aside class="selection-panel">
        <span class="step-number">01</span>
        <p class="kicker">Select surface</p>
        <h1>Click a flat surface to print it.</h1>
        <p>Orbit to the side you want to see on paper. The display mesh is only for picking; the PDF is built from exact STEP boundaries.</p>
        {#if selectionMessage}<div class:invalid={selectionMessage === 'Choose a flat surface'} class="selection-message">{selectionMessage}</div>{/if}
        {#if selectedFace}
          <div class="dimensions">
            <span>Selected template</span>
            <strong>{selectedFace.widthMM.toFixed(2)} × {selectedFace.heightMM.toFixed(2)} mm</strong>
            <small>Planar face · 1:1</small>
          </div>
          <button class="primary print" on:click={printSelectedFace}>Print this face <span>→</span></button>
        {/if}
      </aside>
    </section>
  {:else if phase === 'setup' && selectedFace && printableFace}
    <section class="setup-workspace">
      <PrintPanel
        bind:paper bind:orientation bind:marginMM bind:rotated bind:holeCenters bind:offsetXMM bind:offsetYMM
        widthMM={printableFace.widthMM}
        heightMM={printableFace.heightMM}
        maxOffsetXMM={placement?.maxOffsetXMM ?? 0}
        maxOffsetYMM={placement?.maxOffsetYMM ?? 0}
        pageCount={preview?.info.pageCount}
        resolvedOrientation={preview?.info.resolvedOrientation}
        stale={previewStale || generating}
      />
      <div class="preview-area">
        {#if previewBytes && preview}
          <PdfPreview pdfBytes={previewBytes} digest={preview.digest} />
        {:else}
          <div class="preview-placeholder"><div class="spinner"></div><span>Building full-scale sheets…</span></div>
        {/if}
      </div>
      <footer class="actions">
        <button class="back" on:click={backToModel}>← Back to model</button>
        <div class="save-side">
          {#if previewStale}<span>Preview is updating</span>{/if}
          <button class="primary" on:click={savePDF} disabled={!preview || previewStale || generating || saving}>{saving ? 'Saving…' : 'Save PDF'}</button>
        </div>
      </footer>
    </section>
  {/if}

  {#if errorMessage}<div class="toast error" role="alert"><span>{errorMessage}</span><button on:click={() => (errorMessage = '')}>×</button></div>{/if}
  {#if savedMessage}<div class="toast success" role="status"><span>{savedMessage}</span><button on:click={() => (savedMessage = '')}>×</button></div>{/if}
  {#if dragging}<div class="drop-overlay"><div>Drop STEP model to open</div></div>{/if}
</main>
