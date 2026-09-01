import type { ReactNode } from 'react';
import { useBrowserCapabilities } from '../../hooks/useBrowserCapabilities';
import { CapabilityBadge } from '../Status/CapabilityBadge';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const caps = useBrowserCapabilities();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line/60 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2 font-mono text-sm font-medium">
            <span className="inline-block h-3 w-3 rounded-full bg-accent" />
            <span>depth.video</span>
          </a>
          <CapabilityBadge caps={caps} />
        </div>
      </header>
      {children}
    </div>
  );
}