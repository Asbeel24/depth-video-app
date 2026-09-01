import type { VideoMetadata } from '../types/messages';

export interface ExtractOptions {
  targetFps: number;
  maxFrames?: number;
}

/**
 * Extract frames from a video file as ImageBitmap[].
 * Uses HTMLVideoElement.seeked + createImageBitmap for portable decoding.
 *
 * IMPORTANT: caller is responsible for `bitmap.close()` after each frame.
 */
export async function extractFrames(
  file: File,
  meta: VideoMetadata,
  opts: ExtractOptions,
  onProgress?: (extracted: number, total: number) => void,
): Promise<ImageBitmap[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video'));
  });

  const fps = Math.min(opts.targetFps, meta.fps || 30);
  const total = Math.min(
    opts.maxFrames ?? Infinity,
    Math.max(1, Math.floor(meta.duration * fps)),
  );

  const frames: ImageBitmap[] = [];
  try {
    for (let i = 0; i < total; i++) {
      const t = i / fps;
      await seek(video, Math.min(t, meta.duration - 0.05));
      const bmp = await createImageBitmap(video);
      frames.push(bmp);
      onProgress?.(i + 1, total);
    }
  } finally {
    URL.revokeObjectURL(url);
    video.src = '';
  }
  return frames;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    // Clamp tiny drift
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.01));
  });
}