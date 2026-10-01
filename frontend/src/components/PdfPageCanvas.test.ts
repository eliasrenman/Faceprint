import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compile, preprocess } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import sveltePreprocess from 'svelte-preprocess';

describe('PdfPageCanvas reactivity', () => {
  it('does not invalidate its render effect when sizing the canvas', async () => {
    const filename = resolve(process.cwd(), 'src/components/PdfPageCanvas.svelte');
    const source = await readFile(filename, 'utf8');
    const processed = await preprocess(source, sveltePreprocess({ typescript: true }), { filename });
    const output = compile(processed.code, { filename, generate: 'client', dev: false }).js.code;

    // A direct assignment such as canvas.width = ... compiles to a mutation
    // of the reactive `canvas` binding. Because the render effect also reads
    // that binding, the mutation immediately schedules another PDF render.
    expect(output).not.toMatch(/mutate\([^,]*canvas/);
    expect(source).toContain('target.width =');
  });
});
