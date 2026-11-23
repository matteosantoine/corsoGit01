import { encodeWav } from "../audio/wav";
import type { Recorder } from "../audio/recorder";

/** Anteprima: nessun microfono; restituisce un secondo di silenzio in formato WAV valido. */
export function fakeRecorder(): Recorder {
  return {
    stop: async () => new Blob([encodeWav(new Float32Array(16000), 16000)], { type: "audio/wav" }),
    cancel: () => {},
  };
}
