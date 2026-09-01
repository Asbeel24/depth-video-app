import { useEffect, useRef } from 'react';
import type { PipelineProgress } from '../../types/messages';

interface Props {
  originalUrl: string | null;
  outputUrl: string | null;
  progress: PipelineProgress;
}

export function PreviewPlayer({ originalUrl, outputUrl, progress }: Props) {
  const originalRef = useRef<HTMLVideoElement>(null);
  const outputRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (originalRef.current && originalUrl) originalRef.current.load();
  }, [originalUrl]);
  useEffect(() => {
    if (outputRef.current && outputUrl) outputRef.current.load();
  }, [outputUrl]);

  const showPlaceholder = !originalUrl && !outputUrl;

  return (
    <div className="space-y-4">
      {showPlaceholder && (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg hairline bg-surface-2/30 text-center">
          <p className="max-w-xs text-sm text-ink-muted">
            Upload a video to see the original and the generated depth output side-by-side.
          </p>
        </div>
      )}

      {(originalUrl || outputUrl) && (
        <div className="grid gap-4">
          {originalUrl && (
            <figure className="space-y-2">
              <figcaption className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                Original
              </figcaption>
              <video
                ref={originalRef}
                src={originalUrl}
                controls
                muted
                playsInline
                loop
                className="aspect-video w-full rounded-lg hairline bg-black"
              />
            </figure>
          )}
          {outputUrl && (
            <figure className="space-y-2">
              <figcaption className="font-mono text-xs uppercase tracking-wider text-accent">
                Depth output
              </figcaption>
              <video
                ref={outputRef}
                src={outputUrl}
                controls
                muted
                playsInline
                loop
                autoPlay
                className="aspect-video w-full rounded-lg hairline bg-black"
              />
            </figure>
          )}
          {progress.stage === 'inferring' && (
            <p className="text-center font-mono text-xs text-ink-muted">
              Processing {progress.processedFrames} / {progress.totalFrames} frames…
            </p>
          )}
        </div>
      )}
    </div>
  );
}