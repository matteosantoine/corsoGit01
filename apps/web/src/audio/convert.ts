import { encodeWav } from "./wav";

export const TARGET_RATE = 16000;

/**
 * Converte qualunque registrazione del browser (WebM/Opus, MP4/AAC...) in
 * WAV 16 kHz mono, il formato accettato da Azure AI Speech.
 */
export async function toWav16kMono(blob: Blob): Promise<Blob> {
  const data = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(data);
    const frames = Math.ceil(decoded.duration * TARGET_RATE);
    const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return new Blob([encodeWav(rendered.getChannelData(0), TARGET_RATE)], { type: "audio/wav" });
  } finally {
    void ctx.close();
  }
}
