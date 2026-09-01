# Depth Video

Turn any short clip into a depth map video — entirely in your browser. No upload, no server, no API key.

Built with [Depth Anything V2](https://huggingface.co/onnx-community/depth-anything-v2-small) (Apache 2.0) running locally via [Transformers.js](https://huggingface.co/docs/transformers.js) + WebGPU (with WASM fallback). Frames are encoded with WebCodecs `VideoEncoder` and muxed to `.webm` in a Worker.

## Live demo

[Deploy on Vercel →](https://vercel.com/new/clone?repository-url=https://github.com/YOUR-USER/depth-video-app)

## Features

- Drop an `.mp4` or `.webm` (≤ 15 s, ≤ 100 MB)
- Per-frame depth estimation via Depth Anything V2 Small
- Choose from `inferno` / `viridis` / `magma` / `turbo` colormaps
- Optional depth inversion (near = bright or far = bright)
- Live progress with ETA
- Download result as `.webm`

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ Main thread (React)                                            │
│  UploadZone ─▶ useDepthPipeline ─▶ PreviewPlayer               │
│                  │                                              │
│                  │ postMessage + Transferable                   │
│                  ▼                                              │
│   ┌────────────────┐ ┌─────────────────┐ ┌────────────────┐   │
│   │ DepthWorker    │ │ ColormapWorker   │ │ EncoderWorker   │   │
│   │ (WebGPU/WASM)  │ │ (OffscreenCanvas)│ │ (WebCodecs)     │   │
│   └────────────────┘ └─────────────────┘ └────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

- **Depth Anything V2 Small** — 50 MB ONNX weights, loaded from Hugging Face CDN on first use and cached by the browser.
- **WebGPU** when available (Chrome / Edge 113+, Safari 17+); falls back to **WASM** with multi-thread SIMD when not.
- **WebCodecs `VideoEncoder`** outputs VP9 (or AV1 / VP8 depending on browser support).
- **webm-muxer** packages encoded chunks into a single `.webm` file.
- All processing is local — your video and the output never touch the network.

## Local development

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # production bundle
pnpm preview  # serve built bundle locally
```

Requires Node 20+ and pnpm 9+.

## Deployment

The site is fully static. Deploy anywhere that serves files:

- **Vercel**: zero-config (already wired via `vercel.json`)
- **Netlify**: drop in the `dist/` folder after `pnpm build`
- **GitHub Pages**: enable Pages on `dist/` after `pnpm build`

The COOP / COEP / CORP response headers are critical for `SharedArrayBuffer` (used by ONNX Runtime multi-thread WASM). They're set in `vercel.json` and `vite.config.ts`.

## Browser support

| Browser | Backend | Quality |
|---|---|---|
| Chrome 113+ / Edge 113+ | WebGPU | Best |
| Safari 17+ | WebGPU | Best |
| Firefox 130+ | WASM (with SAB) | Slower but works |
| Older browsers | WASM single-thread | Slow |

## Model licence

[Depth Anything V2 Small](https://huggingface.co/depth-anything/Depth-Anything-V2-Small) is released under Apache 2.0. ONNX exports by the `onnx-community` organisation on Hugging Face are likewise Apache 2.0.

## Limitations

- 15 s cap is a UX choice (longer videos blow up memory and time)
- Output is VP9 `.webm`. H.264 `.mp4` is intentionally omitted because of the HEVC/H.264 patent landscape and would require shipping `mp4-muxer` (also heavier).
- No temporal smoothing — each frame is processed independently. Depth flickers between frames. Adding an opt-in temporal smoothing pass is straightforward but out of MVP scope.

## License

MIT