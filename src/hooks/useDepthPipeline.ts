import { create } from 'zustand';
import { extractFrames } from '../lib/video-extractor';
import { getBrowserCapabilities } from './useBrowserCapabilities';
import { useUrlState } from './useUrlState';
import type {
  EncoderRequest,
  EncoderResponse,
  ColormapRequest,
  ColormapResponse,
  DepthRequest,
  DepthResponse,
  PipelineError,
  PipelineProgress,
  VideoMetadata,
} from '../types/messages';

const MODEL_ID = 'onnx-community/depth-anything-v2-small';
const TARGET_FPS = 24;
const TARGET_BITRATE = 5_000_000;
const TARGET_INPUT = 518;

interface PipelineState {
  file: File | null;
  meta: VideoMetadata | null;
  originalUrl: string | null;
  outputUrl: string | null;
  outputFilename: string | null;
  running: boolean;
  progress: PipelineProgress;
  error: PipelineError | null;
}

interface PipelineActions {
  setFile: (file: File | null, meta?: VideoMetadata | null) => void;
  setMeta: (meta: VideoMetadata | null) => void;
  start: () => Promise<void>;
  cancel: () => void;
  clearError: () => void;
}

const initialProgress: PipelineProgress = {
  stage: 'idle',
  totalFrames: 0,
  processedFrames: 0,
  fps: 0,
  etaSeconds: 0,
};

export const useDepthPipelineStore = create<PipelineState & PipelineActions>((set, get) => ({
  file: null,
  meta: null,
  originalUrl: null,
  outputUrl: null,
  outputFilename: null,
  running: false,
  progress: initialProgress,
  error: null,

  setFile: (file, meta = null) => {
    const cur = get();
    if (cur.originalUrl) URL.revokeObjectURL(cur.originalUrl);
    if (cur.outputUrl) URL.revokeObjectURL(cur.outputUrl);
    if (!file) {
      set({
        file: null,
        meta: null,
        originalUrl: null,
        outputUrl: null,
        outputFilename: null,
        progress: initialProgress,
        error: null,
      });
      return;
    }
    set({
      file,
      meta,
      originalUrl: URL.createObjectURL(file),
      outputUrl: null,
      outputFilename: null,
      progress: { ...initialProgress, stage: 'uploading' },
    });
  },

  setMeta: (meta) => set({ meta }),

  clearError: () => set({ error: null }),

  cancel: () => {
    set({ running: false, progress: { ...initialProgress, stage: 'idle' } });
  },

  start: async () => {
    const { file, meta } = get();
    if (!file || !meta) return;
    set({ running: true, error: null, progress: { ...initialProgress, stage: 'extracting' } });

    try {
      const frames = await extractFrames(file, meta, { targetFps: TARGET_FPS });
      const total = frames.length;
      if (total === 0) throw new Error('No frames extracted from video');
      set({ progress: { ...get().progress, stage: 'loading-model', totalFrames: total } });

      const caps = getBrowserCapabilities();
      const device: 'webgpu' | 'wasm' = caps.webgpu ? 'webgpu' : 'wasm';
      console.log('[pipeline] device =', device, 'caps:', caps);

      const depth = new Worker(new URL('../workers/depthWorker.ts', import.meta.url), { type: 'module' });
      const colormap = new Worker(new URL('../workers/colormapWorker.ts', import.meta.url), { type: 'module' });
      const encoder = new Worker(new URL('../workers/encoderWorker.ts', import.meta.url), { type: 'module' });

      await initDepthWorker(depth, { type: 'init', modelId: MODEL_ID, device });
      console.log('[pipeline] depth model initialised');
      await initEncoderWorker(encoder, {
        type: 'init',
        width: meta.width,
        height: meta.height,
        fps: TARGET_FPS,
        bitrate: TARGET_BITRATE,
        codec: 'vp9',
      });

      const { colormap: palette, invert } = useUrlState.getState();
      let processed = 0;
      const t0 = performance.now();
      let lastReport = t0;
      let lastProcessed = 0;

      for (let i = 0; i < frames.length; i++) {
        if (!get().running) throw new Error('cancelled');

        const bmp = frames[i];
        // transformers.js v3 accepts OffscreenCanvas / HTMLCanvasElement / ImageData / Blob — but NOT ImageBitmap.
        const off = new OffscreenCanvas(TARGET_INPUT, TARGET_INPUT);
        const ctx = off.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2D context');
        ctx.drawImage(bmp, 0, 0, TARGET_INPUT, TARGET_INPUT);

        const depthRes = await predictFrame(depth, i, off);
        const resized = resizeDepth(depthRes.depth, depthRes.width, depthRes.height, meta.width, meta.height);

        const colorRes = await applyColormapToFrame(colormap, i, resized, meta.width, meta.height, palette, invert);

        const tsUs = Math.round((i / TARGET_FPS) * 1_000_000);
        await encodeFrame(encoder, i, colorRes.rgba, meta.width, meta.height, tsUs);

        processed++;
        const now = performance.now();
        if (now - lastReport > 250) {
          const dt = (now - lastReport) / 1000;
          const fps = (processed - lastProcessed) / dt;
          const remaining = (total - processed) / Math.max(fps, 0.1);
          set({
            progress: {
              stage: 'inferring',
              totalFrames: total,
              processedFrames: processed,
              fps,
              etaSeconds: remaining,
            },
          });
          lastReport = now;
          lastProcessed = processed;
        }
        bmp.close();
      }

      set({ progress: { ...get().progress, stage: 'encoding' } });
      const buffer = await finalizeEncoder(encoder);

      depth.terminate();
      colormap.terminate();
      encoder.terminate();

      const blob = new Blob([buffer], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const filename = `${file.name.replace(/\.[^.]+$/, '')}-depth.webm`;

      set({
        running: false,
        outputUrl: url,
        outputFilename: filename,
        progress: { stage: 'ready', totalFrames: total, processedFrames: total, fps: 0, etaSeconds: 0 },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const stack = err instanceof Error ? err.stack : undefined;
      const stage = get().progress.stage;
      console.error('[pipeline] failed at stage', stage, message, stack);
      set({
        running: false,
        error: {
          stage,
          message,
          recoverable: !message.toLowerCase().includes('cancel'),
        },
        progress: { ...initialProgress, stage: 'error', message },
      });
    }
  },
}));

export function useDepthPipeline() {
  return useDepthPipelineStore();
}

/* ---- Typed worker helpers ---- */

function initDepthWorker(worker: Worker, initMsg: Extract<DepthRequest, { type: 'init' }>): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<DepthResponse>) => {
      if (e.data.type === 'init-done') {
        worker.removeEventListener('message', handler);
        resolve();
      } else if (e.data.type === 'init-error') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage(initMsg);
  });
}

function predictFrame(
  worker: Worker,
  id: number,
  canvas: OffscreenCanvas,
): Promise<Extract<DepthResponse, { type: 'predict-done' }>> {
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<DepthResponse>) => {
      if (e.data.type === 'predict-done' && e.data.id === id) {
        worker.removeEventListener('message', handler);
        resolve(e.data);
      } else if (e.data.type === 'predict-error' && e.data.id === id) {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'predict', id, canvas } as DepthRequest);
  });
}

function applyColormapToFrame(
  worker: Worker,
  id: number,
  depth: Float32Array,
  width: number,
  height: number,
  palette: 'inferno' | 'viridis' | 'magma' | 'turbo',
  invert: boolean,
): Promise<Extract<ColormapResponse, { type: 'apply-done' }>> {
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<ColormapResponse>) => {
      if (e.data.type === 'apply-done' && e.data.id === id) {
        worker.removeEventListener('message', handler);
        resolve(e.data);
      } else if (e.data.type === 'apply-error' && e.data.id === id) {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'apply', id, depth, width, height, palette, invert } as ColormapRequest);
  });
}

function initEncoderWorker(worker: Worker, initMsg: Extract<EncoderRequest, { type: 'init' }>): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<EncoderResponse>) => {
      if (e.data.type === 'init-done') {
        worker.removeEventListener('message', handler);
        resolve();
      } else if (e.data.type === 'init-error' || e.data.type === 'error') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage(initMsg);
  });
}

function encodeFrame(
  worker: Worker,
  id: number,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  timestampUs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<EncoderResponse>) => {
      if (e.data.type === 'encode-ack' && e.data.id === id) {
        worker.removeEventListener('message', handler);
        resolve();
      } else if (e.data.type === 'error') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'encode', id, rgba, width, height, timestampUs } as EncoderRequest);
  });
}

function finalizeEncoder(worker: Worker): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<EncoderResponse>) => {
      if (e.data.type === 'finalized') {
        worker.removeEventListener('message', handler);
        resolve(e.data.buffer);
      } else if (e.data.type === 'error') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'finalize' } as EncoderRequest);
  });
}

function resizeDepth(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  const out = new Float32Array(dw * dh);
  const xRatio = sw / dw;
  const yRatio = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor(y * yRatio));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor(x * xRatio));
      out[y * dw + x] = src[sy * sw + sx];
    }
  }
  return out;
}