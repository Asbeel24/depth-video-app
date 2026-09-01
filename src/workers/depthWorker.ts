/// <reference lib="webworker" />
import type { DepthRequest, DepthResponse } from '../types/messages';

type DepthPipeline = (input: unknown) => Promise<{ depth: { data: Float32Array; width: number; height: number } }>;

let pipe: DepthPipeline | null = null;

async function init(modelId: string, device: 'webgpu' | 'wasm') {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  try {
    env.remoteHost = 'https://huggingface.co';
    env.remotePathTemplate = '{model}/resolve/{revision}/';
  } catch {
    // older versions don't expose these
  }
  console.log('[depthWorker] loading model', modelId, 'device', device);
  try {
    pipe = (await pipeline('depth-estimation', modelId, { device, dtype: 'fp16' })) as unknown as DepthPipeline;
    console.log('[depthWorker] ready');
  } catch (err) {
    console.error('[depthWorker] init failed', err);
    throw err;
  }
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
      // transformers.js v3 accepts OffscreenCanvas / HTMLCanvasElement / ImageData / Blob directly.
      const result = await pipe(msg.canvas);
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