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

  // Apple / Safari / older drivers often lack fp16 support on WebGPU.
  // Try fp16 first (faster), fall back to fp32 (works everywhere), then wasm.
  type Dev = 'webgpu' | 'wasm';
  type Dt = 'fp16' | 'fp32';
  const dtypes: Dt[] = device === 'webgpu' ? ['fp16', 'fp32'] : ['fp32'];
  const devices: Dev[] = device === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];

  let lastErr: unknown = null;
  for (const dev of devices) {
    for (const dt of dtypes) {
      try {
        console.log(`[depthWorker] try device=${dev} dtype=${dt}`);
        pipe = (await pipeline('depth-estimation', modelId, { device: dev, dtype: dt })) as unknown as DepthPipeline;
        console.log(`[depthWorker] ready (device=${dev}, dtype=${dt})`);
        return;
      } catch (err) {
        console.warn(`[depthWorker] device=${dev} dtype=${dt} failed:`, err);
        lastErr = err;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Model init failed');
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
      // transformers.js v3 input types: HTMLImageElement / HTMLCanvasElement / HTMLVideoElement /
// ImageBitmap / OffscreenCanvas (context-less) / Blob / URL string.
// Blob is the portable cross-worker choice — it's structured-cloneable without a transfer list.
      const result = await pipe(msg.blob);
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