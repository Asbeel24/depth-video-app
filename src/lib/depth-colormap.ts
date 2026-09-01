import type { ColormapId } from '../types/messages';

interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Sample a colormap at t∈[0,1] */
export type PaletteFn = (t: number) => RGB;

export const PALETTES: Record<ColormapId, PaletteFn> = {
  inferno: (t) => lerp3(t, [0, 0, 4], [66, 10, 104], [147, 38, 103], [224, 81, 58], [252, 165, 10], [252, 255, 164]),
  viridis: (t) => lerp3(t, [68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]),
  magma: (t) => lerp3(t, [0, 0, 4], [59, 15, 112], [140, 41, 129], [222, 73, 104], [254, 159, 109], [252, 253, 191]),
  turbo: (t) => {
    // Polynomial approximation of Google Turbo
    const r = Math.round(34.61 + t * (1172.33 - t * (10789.6 - t * (33300.4 - t * (38394.4 - t * 14825.7)))));
    const g = Math.round(23.31 + t * (557.33 + t * (1221.5 - t * (3574.0 + t * (1073.0 + t * 1274.4)))));
    const b = Math.round(27.2 + t * (3211.1 - t * (15327.9 - t * (27814 - t * (22569.9 - t * 6838.5)))));
    return {
      r: Math.max(0, Math.min(255, r)),
      g: Math.max(0, Math.min(255, g)),
      b: Math.max(0, Math.min(255, b)),
    };
  },
};

/** Apply colormap to a depth map (assumed already normalised 0..1). */
export function applyColormap(
  depth: Float32Array,
  width: number,
  height: number,
  palette: ColormapId,
  invert: boolean,
): Uint8ClampedArray {
  const fn = PALETTES[palette];
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < depth.length; i++) {
    const v = invert ? 1 - depth[i] : depth[i];
    const c = fn(Math.max(0, Math.min(1, v)));
    const j = i * 4;
    out[j] = c.r;
    out[j + 1] = c.g;
    out[j + 2] = c.b;
    out[j + 3] = 255;
  }
  return out;
}

/**
 * Normalize raw depth output to 0..1.
 * Most depth models output disparities — closer=larger, so we invert for intuitive display.
 * This is consistent with what the model returns from the pipeline.
 */
export function normalizeDepth(depth: Float32Array): Float32Array {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < depth.length; i++) {
    const v = depth[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const out = new Float32Array(depth.length);
  for (let i = 0; i < depth.length; i++) {
    out[i] = (depth[i] - min) / range;
  }
  return out;
}

function lerp3(t: number, ...stops: number[][]): RGB {
  const segments = stops.length - 1;
  const scaled = t * segments;
  const i = Math.min(segments - 1, Math.floor(scaled));
  const f = scaled - i;
  const a = stops[i];
  const b = stops[i + 1];
  return {
    r: Math.round(a[0] + (b[0] - a[0]) * f),
    g: Math.round(a[1] + (b[1] - a[1]) * f),
    b: Math.round(a[2] + (b[2] - a[2]) * f),
  };
}