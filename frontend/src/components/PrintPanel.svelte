<script lang="ts">
  import type { Orientation, Paper } from '../services/desktop';
  import { clampOffset } from '../pdf/template-layout';

  export let paper: Paper;
  export let orientation: Orientation;
  export let marginMM: number;
  export let rotated: boolean;
  export let holeCenters: boolean;
  export let offsetXMM: number;
  export let offsetYMM: number;
  export let widthMM: number;
  export let heightMM: number;
  export let maxOffsetXMM: number;
  export let maxOffsetYMM: number;
  export let pageCount: number | undefined;
  export let resolvedOrientation: string | undefined;
  export let stale: boolean;

  const papers: Paper[] = ['A4', 'A3', 'A2'];
  const orientations: Array<{ value: Orientation; label: string }> = [
    { value: 'auto', label: 'Auto' },
    { value: 'portrait', label: 'Portrait' },
    { value: 'landscape', label: 'Landscape' },
  ];

  $: appliedOffsetXMM = clampOffset(offsetXMM, maxOffsetXMM);
  $: appliedOffsetYMM = clampOffset(offsetYMM, maxOffsetYMM);

  function setPaper(value: Paper): void {
    paper = value;
    centerTemplate();
  }

  function setOrientation(value: Orientation): void {
    orientation = value;
    centerTemplate();
  }

  function setMargin(event: Event): void {
    marginMM = Number((event.currentTarget as HTMLSelectElement).value);
    centerTemplate();
  }

  function toggleRotation(): void {
    rotated = !rotated;
    centerTemplate();
  }

  function setOffset(axis: 'x' | 'y', event: Event): void {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (axis === 'x') offsetXMM = clampOffset(value, maxOffsetXMM);
    else offsetYMM = clampOffset(value, maxOffsetYMM);
  }

  function centerTemplate(): void {
    offsetXMM = 0;
    offsetYMM = 0;
  }
</script>

<aside class="panel">
  <div>
    <span class="eyebrow">Template setup</span>
    <h2>{widthMM.toFixed(2)} × {heightMM.toFixed(2)} mm</h2>
    <p class="fixed">Scale <strong>1:1 — fixed</strong></p>
  </div>

  <fieldset>
    <legend>Paper</legend>
    <div class="segments three">
      {#each papers as choice}
        <button class:active={paper === choice} on:click={() => setPaper(choice)}>{choice}</button>
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend>Paper orientation</legend>
    <div class="segments three">
      {#each orientations as choice}
        <button class:active={orientation === choice.value} on:click={() => setOrientation(choice.value)}>{choice.label}</button>
      {/each}
    </div>
  </fieldset>

  <fieldset>
    <legend>Template</legend>
    <button class:active={rotated} class="wide-toggle" on:click={toggleRotation}>Rotate drawing 90°</button>
  </fieldset>

  <fieldset class="position-fieldset">
    <legend>Position on paper</legend>
    <button class="center-button" on:click={centerTemplate} disabled={appliedOffsetXMM === 0 && appliedOffsetYMM === 0}>Center</button>
    <div class="position-grid">
      <label>
        X offset (mm)
        <input
          type="number"
          step="0.5"
          min={-maxOffsetXMM}
          max={maxOffsetXMM}
          value={appliedOffsetXMM}
          disabled={maxOffsetXMM < 0.005}
          on:input={(event) => setOffset('x', event)}
        />
      </label>
      <label>
        Y offset (mm)
        <input
          type="number"
          step="0.5"
          min={-maxOffsetYMM}
          max={maxOffsetYMM}
          value={appliedOffsetYMM}
          disabled={maxOffsetYMM < 0.005}
          on:input={(event) => setOffset('y', event)}
        />
      </label>
    </div>
    <p class="position-help">The drawing is centered by default. Positive X moves right; positive Y moves up. Movement is limited to the current sheet layout.</p>
  </fieldset>

  <details>
    <summary>Advanced</summary>
    <label>
      Printer margin
      <select value={marginMM} on:change={setMargin}>
        <option value={0}>0 mm · edge-to-edge PDF</option>
        <option value={5}>5 mm · verified preset</option>
      </select>
    </label>
    <label class="check"><input type="checkbox" bind:checked={holeCenters} /> Hole centre crosses</label>
  </details>

  {#if marginMM === 0}
    <p class="warning">Edge-to-edge PDF. A printer with unprintable edges may cut off lines. Use a margin that matches your printer when needed.</p>
  {:else}
    <p class="warning">The 5 mm content margin is reserved in the PDF. Confirm that it matches your printer’s actual hardware margins.</p>
  {/if}

  <div class="summary" aria-live="polite">
    {#if stale}
      Generating actual PDF…
    {:else if pageCount && resolvedOrientation}
      <strong>{pageCount} {pageCount === 1 ? 'sheet' : 'sheets'}</strong> · {paper} {resolvedOrientation} · 1:1
    {/if}
  </div>
</aside>

<style>
  .panel { display: flex; flex-direction: column; gap: 22px; padding: 28px 24px; overflow-y: auto; background: #f4f0e8; border-right: 1px solid #d8d1c5; }
  .eyebrow { color: #d95525; font-size: 11px; letter-spacing: .13em; text-transform: uppercase; font-weight: 750; }
  h2 { margin: 6px 0 2px; font-size: 22px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .fixed { margin: 0; color: #716a60; font-size: 13px; }
  fieldset { border: 0; padding: 0; margin: 0; }
  legend { margin-bottom: 8px; font-size: 12px; font-weight: 700; color: #514b43; }
  .segments { display: grid; border: 1px solid #c6bfb3; border-radius: 8px; overflow: hidden; }
  .segments.three { grid-template-columns: repeat(3, 1fr); }
  button { font: inherit; }
  .segments button, .wide-toggle { border: 0; border-right: 1px solid #c6bfb3; background: #fffdf9; min-height: 38px; color: #4e4941; cursor: pointer; }
  .segments button:last-child { border-right: 0; }
  .segments button.active, .wide-toggle.active { color: #fff; background: #282b2a; }
  .wide-toggle { width: 100%; border: 1px solid #c6bfb3; border-radius: 8px; }
  details { border-top: 1px solid #d8d1c5; padding-top: 15px; }
  summary { cursor: pointer; font-size: 13px; font-weight: 700; margin-bottom: 14px; }
  label { display: grid; gap: 7px; margin: 12px 0; font-size: 12px; color: #575149; }
  select, input[type='number'] { width: 100%; box-sizing: border-box; border: 1px solid #c6bfb3; border-radius: 7px; background: white; padding: 9px; font: inherit; }
  input:disabled { color: #928b80; background: #e9e4da; }
  .check { display: flex; align-items: center; gap: 8px; }
  .position-fieldset { position: relative; }
  .position-fieldset legend { margin-bottom: 8px; }
  .position-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .position-grid label { margin: 0; }
  .center-button { position: absolute; right: 0; top: -4px; border: 0; padding: 3px 0; color: #c84f23; background: transparent; font-size: 12px; cursor: pointer; }
  .center-button:disabled { color: #999187; cursor: default; }
  .position-help { margin: 8px 0 0; color: #777065; font-size: 11px; line-height: 1.4; }
  .warning { margin: 0; padding: 12px; border-radius: 7px; background: #fff4d8; color: #725d2f; font-size: 12px; line-height: 1.45; }
  .summary { min-height: 38px; margin-top: auto; padding-top: 14px; border-top: 1px solid #d8d1c5; color: #403b34; font-size: 13px; }
</style>
