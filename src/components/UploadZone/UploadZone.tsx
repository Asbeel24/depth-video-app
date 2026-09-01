import { useRef, useState, useCallback, type DragEvent, type ChangeEvent } from 'react';
import type { VideoMetadata } from '../../types/messages';

interface Props {
  file: File | null;
  meta: VideoMetadata | null;
  onFile: (file: File | null, meta?: VideoMetadata | null) => void;
  disabled: boolean;
}

const MAX_DURATION = 15;
const MAX_BYTES = 100 * 1024 * 1024;
const ACCEPTED = ['video/mp4', 'video/webm'];

export function UploadZone({ file, meta, onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (f: File | null | undefined) => {
      if (!f) return;
      setError(null);
      if (!ACCEPTED.includes(f.type)) {
        setError('Only .mp4 or .webm files are accepted');
        return;
      }
      if (f.size > MAX_BYTES) {
        setError('File is too large. Try a clip under 100 MB.');
        return;
      }
      try {
        const meta = await readMeta(f);
        if (meta.duration > MAX_DURATION + 0.5) {
          setError(`Video is ${meta.duration.toFixed(1)}s — please trim to under 15s.`);
          return;
        }
        onFile(f, meta);
      } catch (err) {
        setError(`Could not read video: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    },
    [onFile],
  );

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    void handleFile(e.dataTransfer.files?.[0]);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const reset = () => {
    setError(null);
    onFile(null, null);
  };

  if (file && meta) {
    return (
      <div className="space-y-3 rounded-lg hairline bg-surface-2/50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs uppercase tracking-wider text-ink-muted">
              {file.type.replace('video/', '')} · {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
            <p className="mt-1 truncate text-sm text-ink">{file.name}</p>
            <p className="mt-1 font-mono text-xs text-ink-muted">
              {meta.width}×{meta.height} · {meta.fps.toFixed(1)} fps · {meta.duration.toFixed(1)}s
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={reset}
              className="font-mono text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              change
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`group relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-all ${
          dragOver
            ? 'border-accent bg-accent/5'
            : 'border-line bg-surface-2/30 hover:border-ink-muted/60'
        } ${disabled ? 'pointer-events-none opacity-40' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm"
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
          aria-label="Upload video file"
        />
        <svg viewBox="0 0 24 24" className="mb-3 h-8 w-8 text-ink-muted" aria-hidden="true">
          <path
            d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-sm text-ink">
          <span className="font-medium underline-offset-2 group-hover:underline">Click to upload</span>{' '}
          <span className="text-ink-muted">or drag a file here</span>
        </p>
        <p className="mt-2 font-mono text-xs text-ink-muted">mp4 / webm · ≤ 15s · ≤ 100MB</p>
      </label>
      {error && (
        <p role="alert" className="mt-2 font-mono text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

async function readMeta(file: File): Promise<VideoMetadata> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('decode failed'));
  });
  const duration = video.duration;
  const width = video.videoWidth;
  const height = video.videoHeight;
  URL.revokeObjectURL(url);
  const fps = await sampleFps(file).catch(() => 30);
  return { duration, width, height, fps };
}

async function sampleFps(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    const timestamps: number[] = [];
    const SAMPLE_MS = 800;
    const start = performance.now();
    let stopped = false;
    const collect = () => {
      if (stopped) return;
      timestamps.push(video.currentTime);
      if (performance.now() - start >= SAMPLE_MS) {
        stopped = true;
        video.pause();
        URL.revokeObjectURL(url);
        if (timestamps.length < 2) return resolve(30);
        const span = timestamps[timestamps.length - 1] - timestamps[0];
        const fps = (timestamps.length - 1) / span;
        return resolve(fps > 0 ? fps : 30);
      }
      if ('requestVideoFrameCallback' in video) {
        (video as unknown as { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(
          collect,
        );
      } else {
        requestAnimationFrame(collect);
      }
    };
    video.oncanplay = () => {
      void video.play();
      if ('requestVideoFrameCallback' in video) {
        (video as unknown as { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(
          collect,
        );
      } else {
        requestAnimationFrame(collect);
      }
    };
    video.onerror = () => {
      stopped = true;
      URL.revokeObjectURL(url);
      resolve(30);
    };
    setTimeout(() => {
      if (stopped) return;
      stopped = true;
      URL.revokeObjectURL(url);
      if (timestamps.length >= 2) {
        const span = timestamps[timestamps.length - 1] - timestamps[0];
        const fps = (timestamps.length - 1) / span;
        resolve(fps > 0 ? fps : 30);
      } else {
        resolve(30);
      }
    }, SAMPLE_MS + 1500);
  });
}

