import { useEffect } from 'react';
import { AppShell } from './components/Layout/AppShell';
import { useDepthPipeline } from './hooks/useDepthPipeline';
import { useUrlState } from './hooks/useUrlState';
import { UploadZone } from './components/UploadZone/UploadZone';
import { PreviewPlayer } from './components/PreviewPlayer/PreviewPlayer';
import { Controls } from './components/Controls/Controls';
import { PipelineStatus } from './components/Status/PipelineStatus';
import { DownloadButton } from './components/DownloadButton/DownloadButton';
import { ErrorBanner } from './components/Status/ErrorBanner';

export default function App() {
  const state = useDepthPipeline();
  const { colormap, invert, setColormap, setInvert } = useUrlState();

  // Keyboard: Cmd/Ctrl+Enter to start
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (state.file && !state.running) void state.start();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.file, state.running, state]);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6 md:pt-16">
        <header className="mb-12 md:mb-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            depth · anything · v2
          </p>
          <h1 className="font-display text-balance text-[length:var(--text-hero)] font-semibold text-ink">
            Turn any clip<br />
            <span className="text-accent">into depth.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-ink-muted text-balance">
            Drop a 15-second video. We&apos;ll estimate per-frame depth entirely in your browser — no upload,
            no server, no API key. Powered by Depth Anything V2.
          </p>
        </header>

        {state.error && <ErrorBanner error={state.error} onDismiss={state.clearError} />}

        <section className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <UploadZone
              file={state.file}
              meta={state.meta}
              onFile={state.setFile}
              disabled={state.running}
            />

            {state.file && state.meta && (
              <Controls
                colormap={colormap}
                invert={invert}
                onColormapChange={setColormap}
                onInvertChange={setInvert}
                disabled={state.running}
              />
            )}

            <PipelineStatus
              progress={state.progress}
              running={state.running}
              canStart={Boolean(state.file && state.meta)}
              onStart={() => void state.start()}
              onCancel={state.cancel}
            />
          </div>

          <div className="space-y-6">
            {state.outputUrl && (
              <DownloadButton url={state.outputUrl} filename={state.outputFilename ?? 'depth-video.webm'} />
            )}
            <PreviewPlayer
              originalUrl={state.originalUrl}
              outputUrl={state.outputUrl}
              progress={state.progress}
            />
          </div>
        </section>

        <footer className="mt-24 border-t border-line pt-8 text-xs text-ink-muted">
          <p className="font-mono uppercase tracking-wider">
            Model · Depth Anything V2 Small · Apache 2.0 · runs on WebGPU when available
          </p>
          <p className="mt-2 max-w-2xl">
            Everything happens on your device. Video frames never leave the browser tab. Model weights are loaded
            once from Hugging Face CDN and cached.
          </p>
        </footer>
      </main>
    </AppShell>
  );
}