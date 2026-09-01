import type { Capabilities } from '../../hooks/useBrowserCapabilities';

interface Props {
  caps: Capabilities;
}

const LABELS: Record<Capabilities['level'], { text: string; tone: 'good' | 'warn' | 'bad' }> = {
  full: { text: 'WebGPU', tone: 'good' },
  'wasm-only': { text: 'WASM', tone: 'warn' },
  legacy: { text: 'Legacy', tone: 'warn' },
  unsupported: { text: 'Unsupported', tone: 'bad' },
};

const TONE_CLASS = {
  good: 'border-accent/40 bg-accent/10 text-accent',
  warn: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  bad: 'border-red-400/40 bg-red-400/10 text-red-300',
} as const;

export function CapabilityBadge({ caps }: Props) {
  const meta = LABELS[caps.level];
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${TONE_CLASS[meta.tone]}`}
      title={`SharedArrayBuffer: ${caps.sharedArrayBuffer} · WebGPU: ${caps.webgpu} · WebCodecs: ${caps.webcodecs}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {meta.text}
    </div>
  );
}