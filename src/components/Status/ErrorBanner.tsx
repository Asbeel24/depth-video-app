import type { PipelineError } from '../../types/messages';

interface Props {
  error: PipelineError;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: Props) {
  return (
    <div
      role="alert"
      className="mb-8 flex items-start gap-3 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0 text-red-300" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div className="flex-1">
        <p className="font-mono text-xs uppercase tracking-wider text-red-200">{error.stage}</p>
        <p className="mt-1 text-red-100">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs text-red-200 underline underline-offset-2 hover:text-white"
        aria-label="Dismiss error"
      >
        dismiss
      </button>
    </div>
  );
}