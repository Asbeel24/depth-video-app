/**
 * Detect browser capabilities to drive runtime selection.
 * Runs once on mount; values are memoized.
 */
import { useEffect, useState } from 'react';

export type CapabilityLevel = 'full' | 'wasm-only' | 'legacy' | 'unsupported';

export interface Capabilities {
  sharedArrayBuffer: boolean;
  webgpu: boolean;
  webcodecs: boolean;
  offscreenCanvas: boolean;
  webWorker: boolean;
  crossOriginIsolated: boolean;
  level: CapabilityLevel;
}

function detect(): Capabilities {
  const sab = typeof SharedArrayBuffer !== 'undefined';
  const xOriginIsolated = (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
  const webgpu =
    typeof navigator !== 'undefined' &&
    'gpu' in navigator &&
    typeof (navigator as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu?.requestAdapter === 'function';
  const webcodecs = typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder !== 'undefined';
  const offscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  const webWorker = typeof Worker !== 'undefined';

  let level: CapabilityLevel = 'unsupported';
  if (webgpu && webcodecs && webWorker) {
    level = xOriginIsolated ? 'full' : 'wasm-only';
  } else if (webcodecs && webWorker && offscreenCanvas) {
    level = 'wasm-only';
  } else if (webWorker) {
    level = 'legacy';
  }

  return {
    sharedArrayBuffer: sab,
    webgpu,
    webcodecs,
    offscreenCanvas,
    webWorker,
    crossOriginIsolated: xOriginIsolated,
    level,
  };
}

let cached: Capabilities | null = null;

export function getBrowserCapabilities(): Capabilities {
  if (typeof window === 'undefined') {
    return {
      sharedArrayBuffer: false,
      webgpu: false,
      webcodecs: false,
      offscreenCanvas: false,
      webWorker: false,
      crossOriginIsolated: false,
      level: 'unsupported',
    };
  }
  if (!cached) cached = detect();
  return cached;
}

export function useBrowserCapabilities(): Capabilities {
  const [caps, setCaps] = useState<Capabilities>(getBrowserCapabilities);
  useEffect(() => {
    if (!cached) {
      cached = detect();
      setCaps(cached);
    }
  }, []);
  return caps;
}