import type { CADRequest, Face2D, ModelSceneData, Vec3 } from './types';

type WorkerEnvelope = { id: number; request: CADRequest };
type WorkerResult = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };

export class CADAdapter {
  private worker: Worker;
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      const callback = this.pending.get(event.data.id);
      if (!callback) return;
      this.pending.delete(event.data.id);
      if (event.data.ok) callback.resolve(event.data.result);
      else callback.reject(new Error(event.data.error));
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'CAD worker failed');
      for (const callback of this.pending.values()) callback.reject(error);
      this.pending.clear();
    };
  }

  configureKernel(wasm: ArrayBuffer): Promise<void> {
    return this.call<void>({ type: 'configure', wasm }, [wasm]);
  }

  load(step: ArrayBuffer): Promise<ModelSceneData> {
    return this.call<ModelSceneData>({ type: 'load', step }, [step]);
  }

  extract(modelId: string, faceId: string, viewingDirection: Vec3): Promise<Face2D> {
    return this.call<Face2D>({ type: 'extract', modelId, faceId, viewingDirection });
  }

  async disposeModel(): Promise<void> {
    await this.call<void>({ type: 'dispose' });
  }

  terminate(): void {
    this.worker.terminate();
    const error = new Error('CAD worker terminated');
    for (const callback of this.pending.values()) callback.reject(error);
    this.pending.clear();
  }

  private call<T>(request: CADRequest, transfer: Transferable[] = []): Promise<T> {
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      const message: WorkerEnvelope = { id, request };
      this.worker.postMessage(message, transfer);
    });
  }
}
