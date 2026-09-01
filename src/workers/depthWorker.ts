/// <reference lib="webworker" />
import type { DepthRequest, DepthResponse } from '../types/messages';

type DepthPipeline = (input: unknown) => Promise<{ depth: { data: Float32Array; width: number; height: number } }>;

let pipe: DepthPipeline | null = null;

async function init(modelId: string, device: 'webgpu' | 'wasm') {
  // Dynamic import so Vite splits this out and avoids SSR issues
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  pipe = (await pipeline('depth-estimation', modelId, { device, dtype: 'fp16' })) as unknown as DepthPipeline;
}

self.onmessage = async (e: MessageEvent<DepthRequest>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      await init(msg.modelId, msg.device);
      const out: DepthResponse = { type: 'init-done', modelId: msg.modelId, device: msg.device };
      self.postMessage(out);
    } catch (err) {
      const out: DepthResponse = {
        type: 'init-error',
        error: err instanceof Error ? err.message : 'Model init failed',
      };
      self.postMessage(out);
    }
    return;
  }

  if (msg.type === 'predict') {
    if (!pipe) {
      const out: DepthResponse = { type: 'predict-error', id: msg.id, error: 'Model not initialised' };
      self.postMessage(out);
      return;
    }
    try {
      // transformers.js accepts ImageBitmap directly via RawImage.from()
      const result = await pipe(msg.bitmap);
      const depth = result.depth;
      const out: DepthResponse = {
        type: 'predict-done',
        id: msg.id,
        depth: new Float32Array(depth.data),
        width: depth.width,
        height: depth.height,
      };
      self.postMessage(out, []);
    } catch (err) {
      const out: DepthResponse = {
        type: 'predict-error',
        id: msg.id,
        error: err instanceof Error ? err.message : 'Inference failed',
      };
      self.postMessage(out);
    }
  }
};

export {};