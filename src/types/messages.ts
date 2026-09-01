/**
 * Shared message protocol between main thread and Workers.
 */

export type ColormapId = 'inferno' | 'viridis' | 'magma' | 'turbo';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export type PipelineStage =
  | 'idle'
  | 'uploading'
  | 'extracting'
  | 'loading-model'
  | 'inferring'
  | 'colormapping'
  | 'encoding'
  | 'ready'
  | 'error';

export interface PipelineProgress {
  stage: PipelineStage;
  totalFrames: number;
  processedFrames: number;
  fps: number;
  etaSeconds: number;
  message?: string;
}

export interface PipelineError {
  stage: PipelineStage;
  message: string;
  recoverable: boolean;
}

/* ----- Depth Worker ----- */

export type DepthRequest =
  | { type: 'init'; modelId: string; device: 'webgpu' | 'wasm' }
  | { type: 'predict'; id: number; imageData: ImageData };

export type DepthResponse =
  | { type: 'init-done'; modelId: string; device: 'webgpu' | 'wasm' }
  | { type: 'init-error'; error: string }
  | { type: 'predict-done'; id: number; depth: Float32Array; width: number; height: number }
  | { type: 'predict-error'; id: number; error: string };

/* ----- Colormap Worker ----- */

export type ColormapRequest = { type: 'apply'; id: number; depth: Float32Array; width: number; height: number; palette: ColormapId; invert: boolean };

export type ColormapResponse =
  | { type: 'apply-done'; id: number; rgba: Uint8ClampedArray; width: number; height: number }
  | { type: 'apply-error'; id: number; error: string };

/* ----- Encoder Worker ----- */

export type EncoderRequest =
  | { type: 'init'; width: number; height: number; fps: number; bitrate: number; codec: 'vp9' | 'vp8' | 'av1' }
  | { type: 'encode'; id: number; rgba: Uint8ClampedArray; width: number; height: number; timestampUs: number }
  | { type: 'finalize' };

export type EncoderResponse =
  | { type: 'init-done' }
  | { type: 'init-error'; error: string }
  | { type: 'encode-ack'; id: number }
  | { type: 'finalized'; buffer: ArrayBuffer }
  | { type: 'error'; error: string };