import type { ColormapId } from '../../types/messages';

interface Props {
  colormap: ColormapId;
  invert: boolean;
  onColormapChange: (c: ColormapId) => void;
  onInvertChange: (v: boolean) => void;
  disabled: boolean;
}

const PALETTES: { id: ColormapId; label: string; preview: string }[] = [
  { id: 'inferno', label: 'inferno', preview: 'linear-gradient(90deg,#000004,#420a68,#932667,#dd513a,#fca50a,#fcffa4)' },
  { id: 'viridis', label: 'viridis', preview: 'linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725)' },
  { id: 'magma', label: 'magma', preview: 'linear-gradient(90deg,#000004,#3b0f70,#8c2981,#de4968,#fe9f6d,#fcfdbf)' },
  { id: 'turbo', label: 'turbo', preview: 'linear-gradient(90deg,#30123b,#4145ab,#3ea7d1,#46f884,#e4dc37,#ec5a09,#7a0403)' },
];

export function Controls({ colormap, invert, onColormapChange, onInvertChange, disabled }: Props) {
  return (
    <div className="rounded-lg hairline bg-surface-2/50 p-5">
      <p className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-muted">Color palette</p>
      <div className="grid grid-cols-2 gap-2">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onColormapChange(p.id)}
            disabled={disabled}
            aria-pressed={colormap === p.id}
            className={`group relative overflow-hidden rounded-md border text-left transition-all ${
              colormap === p.id
                ? 'border-accent shadow-[0_0_0_1px_rgb(var(--color-accent))]'
                : 'border-line hover:border-ink-muted/60'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <div className="h-6 w-full" style={{ background: p.preview }} aria-hidden="true" />
            <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-muted group-hover:text-ink">
              {p.label}
            </p>
          </button>
        ))}
      </div>

      <label className="mt-5 flex cursor-pointer items-center justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">Invert depth</span>
        <button
          type="button"
          role="switch"
          aria-checked={invert}
          onClick={() => onInvertChange(!invert)}
          disabled={disabled}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            invert ? 'bg-accent' : 'bg-surface'
          } ${disabled ? 'opacity-50' : ''}`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              invert ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </label>
    </div>
  );
}