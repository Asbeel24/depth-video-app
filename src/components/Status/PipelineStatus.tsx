import type { PipelineProgress } from '../../types/messages';

interface Props {
  progress: PipelineProgress;
  running: boolean;
  canStart: boolean;
  onStart: () => void;
  onCancel: () => void;
}

const STAGE_LABEL: Record<PipelineProgress['stage'], string> = {
  idle: 'Ready',
  uploading: 'Loading',
  extracting: 'Extracting frames',
  'loading-model': 'Loading model',
  inferring: 'Estimating depth',
  colormapping: 'Coloring',
  encoding: 'Encoding video',
  ready: 'Done',
  error: 'Failed',
};

export function PipelineStatus({ progress, running, canStart, onStart, onCancel }: Props) {
  const pct =
    progress.totalFrames > 0
      ? Math.min(100, Math.round((progress.processedFrames / progress.totalFrames) * 100))
      : 0;

  const showProgress = running && (progress.stage === 'inferring' || progress.stage === 'colormapping' || progress.stage === 'encoding');
  const isError = progress.stage === 'error';

  return (
    <div className="space-y-4 rounded-lg hairline bg-surface-2/50 p-5">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-ink-muted">
        <span className={isError ? 'text-red-300' : ''}>{STAGE_LABEL[progress.stage]}</span>
        {running && progress.etaSeconds > 0 && <span>~{Math.ceil(progress.etaSeconds)}s left</span>}
        {progress.message && running && <span className="text-ink-muted/70">{progress.message}</span>}
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Processing progress"
      >
        <div
          className={`h-full transition-[width] duration-300 ${
            isError ? 'bg-red-500' : 'bg-accent'
          }`}
          style={{
            width:
              showProgress
                ? `${pct}%`
                : running
                  ? '100%'
                  : progress.stage === 'ready'
                    ? '100%'
                    : '0%',
            transitionTimingFunction: 'var(--ease-out-expo)',
          }}
        />
      </div>

      {progress.message && !running && (
        <p
          role="alert"
          className={`font-mono text-xs ${
            isError ? 'text-red-300' : 'text-ink-muted'
          }`}
        >
          {progress.message}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-ink-muted font-mono">
        <span>
          {progress.totalFrames > 0 ? `${progress.processedFrames} / ${progress.totalFrames} frames` : '—'}
        </span>
        {running && progress.fps > 0 && <span>{progress.fps.toFixed(1)} fps</span>}
      </div>

      <div className="flex gap-3 pt-2">
        {!running ? (
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className="flex-1 rounded-md bg-accent px-5 py-3 font-mono text-sm font-medium text-black transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent"
          >
            {isError ? 'Try again' : 'Start processing'}
            <span className="ml-2 hidden text-xs opacity-60 sm:inline">⌘ ↵</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md hairline bg-surface-2 px-5 py-3 font-mono text-sm font-medium text-ink transition-colors hover:bg-surface-2/70"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}