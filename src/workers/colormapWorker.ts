/// <reference lib="webworker" />
import { applyColormap, normalizeDepth } from '../lib/depth-colormap';
import type { ColormapRequest, ColormapResponse } from '../types/messages';

self.onmessage = (e: MessageEvent<ColormapRequest>) => {
  const msg = e.data;
  if (msg.type === 'apply') {
    try {
      const normalised = normalizeDepth(msg.depth);
      const rgba = applyColormap(normalised, msg.width, msg.height, msg.palette, msg.invert);
      const out: ColormapResponse = {
        type: 'apply-done',
        id: msg.id,
        rgba,
        width: msg.width,
        height: msg.height,
      };
      self.postMessage(out, [rgba.buffer]);
    } catch (err) {
      const out: ColormapResponse = {
        type: 'apply-error',
        id: msg.id,
        error: err instanceof Error ? err.message : 'Colormap failed',
      };
      self.postMessage(out);
    }
  }
};

export {};