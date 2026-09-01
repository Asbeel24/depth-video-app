interface Props {
  url: string;
  filename: string;
}

export function DownloadButton({ url, filename }: Props) {
  return (
    <a
      href={url}
      download={filename}
      className="group flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-mono text-sm font-medium text-black transition-all hover:bg-accent/90"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Download {filename}
      <span className="ml-1 text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
    </a>
  );
}