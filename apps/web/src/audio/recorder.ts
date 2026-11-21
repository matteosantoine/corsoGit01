export type Recorder = { stop: () => Promise<Blob>; cancel: () => void };

/** Avvia la registrazione dal microfono. Chiamare stop() per ottenere l'audio. */
export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const media = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  media.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const release = () => stream.getTracks().forEach((t) => t.stop());
  media.start();

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        media.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: media.mimeType }));
        };
        media.stop();
      }),
    cancel: () => {
      media.onstop = null;
      if (media.state !== "inactive") media.stop();
      release();
    },
  };
}

export function microphoneErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError")
    return "Il microfono è bloccato. Consenti l'uso del microfono per questa app nelle impostazioni del telefono o del browser.";
  if (name === "NotFoundError") return "Non trovo nessun microfono su questo dispositivo.";
  return "Non riesco a registrare. Riprova tra un momento.";
}
