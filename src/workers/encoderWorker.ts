/// <reference lib="webworker" />
import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import type { EncoderRequest, EncoderResponse } from '../types/messages';

let muxer: Muxer<ArrayBufferTarget> | null = null;
let encoder: VideoEncoder | null = null;
let width = 0;
let height = 0;
let fps = 30;
let frameIndex = 0;

function codecString(c: 'vp9' | 'vp8' | 'av1') {
  switch (c) {
    case 'vp9':
      return 'vp09.00.10.08';
    case 'vp8':
      return 'vp8';
    case 'av1':
      return 'av1';
  }
}

async function pickCodec(reqWidth: number, reqHeight: number, reqFps: number): Promise<'vp9' | 'vp8' | 'av1'> {
  const candidates: ('vp9' | 'vp8' | 'av1')[] = ['vp9', 'av1', 'vp8'];
  for (const codec of candidates) {
    try {
      const supported = await VideoEncoder.isConfigSupported({
        codec: codecString(codec),
        width: reqWidth,
        height: reqHeight,
        bitrate: 5_000_000,
        framerate: reqFps,
      });
      if (supported && supported.supported !== false) return codec;
    } catch {
      // try next
    }
  }
  return 'vp9';
}

async function init(req: Extract<EncoderRequest, { type: 'init' }>) {
  width = req.width;
  height = req.height;
  fps = req.fps;
  const codec = await pickCodec(width, height, fps);

  muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: codec === 'vp9' ? 'V_VP9' : codec === 'vp8' ? 'V_VP8' : 'V_AV1',
      width,
      height,
      frameRate: fps,
    },
  });

  encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer?.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      const out: EncoderResponse = { type: 'error', error: e.message };
      self.postMessage(out);
    },
  });

  encoder.configure({
    codec: codecString(codec),
    width,
    height,
    bitrate: req.bitrate,
    framerate: fps,
  });
  frameIndex = 0;

  const out: EncoderResponse = { type: 'init-done' };
  self.postMessage(out);
}

self.onmessage = async (e: MessageEvent<EncoderRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      await init(msg);
      return;
    }
    if (msg.type === 'encode') {
      if (!encoder || !muxer) throw new Error('Encoder not initialised');
      const init: VideoFrameBufferInit = {
        format: 'RGBA',
        codedWidth: msg.width,
        codedHeight: msg.height,
        timestamp: msg.timestampUs,
      };
      const vf = new VideoFrame(msg.rgba, init);
      const keyFrame = frameIndex % fps === 0;
      encoder.encode(vf, { keyFrame });
      vf.close();
      frameIndex++;
      const ack: EncoderResponse = { type: 'encode-ack', id: msg.id };
      self.postMessage(ack);
      return;
    }
    if (msg.type === 'finalize') {
      if (!encoder || !muxer) throw new Error('Encoder not initialised');
      await encoder.flush();
      muxer.finalize();
      const buf = (muxer.target as ArrayBufferTarget).buffer;
      const out: EncoderResponse = { type: 'finalized', buffer: buf };
      self.postMessage(out, [buf]);
      encoder = null;
      muxer = null;
      frameIndex = 0;
    }
  } catch (err) {
    const out: EncoderResponse = {
      type: 'error',
      error: err instanceof Error ? err.message : 'Encoder error',
    };
    self.postMessage(out);
  }
};

export {};