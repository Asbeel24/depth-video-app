import { create } from 'zustand';
import type { ColormapId } from '../types/messages';

interface UrlState {
  colormap: ColormapId;
  invert: boolean;
  setColormap: (c: ColormapId) => void;
  setInvert: (v: boolean) => void;
}

const COLORMAPS: ColormapId[] = ['inferno', 'viridis', 'magma', 'turbo'];

function read(): { colormap: ColormapId; invert: boolean } {
  if (typeof window === 'undefined') return { colormap: 'inferno', invert: false };
  const params = new URLSearchParams(window.location.search);
  const cmap = params.get('cmap');
  const inv = params.get('inv');
  return {
    colormap: COLORMAPS.includes(cmap as ColormapId) ? (cmap as ColormapId) : 'inferno',
    invert: inv === '1' || inv === 'true',
  };
}

function write(state: { colormap: ColormapId; invert: boolean }) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  if (state.colormap !== 'inferno') params.set('cmap', state.colormap);
  if (state.invert) params.set('inv', '1');
  const q = params.toString();
  const url = q ? `${window.location.pathname}?${q}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

export const useUrlState = create<UrlState>((set, get) => ({
  ...read(),
  setColormap: (colormap) => {
    set({ colormap });
    write({ colormap, invert: get().invert });
  },
  setInvert: (invert) => {
    set({ invert });
    write({ colormap: get().colormap, invert });
  },
}));