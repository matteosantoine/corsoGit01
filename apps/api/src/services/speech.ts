export type Transcription = { text: string; durationMs: number };

export interface SpeechClient {
  transcribe(wav: Uint8Array): Promise<Transcription>;
}

export class SpeechError extends Error {}

type Options = {
  endpoint: string; // es. https://<nome>.cognitiveservices.azure.com
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
};

/** Trascrizione "fast" di Azure AI Speech, in italiano. L'audio resta solo in memoria. */
export function createSpeechClient({ endpoint, getToken, fetchImpl = fetch }: Options): SpeechClient {
  const url = `${endpoint.replace(/\/$/, "")}/speechtotext/transcriptions:transcribe?api-version=2024-11-15`;
  return {
    async transcribe(wav) {
      const form = new FormData();
      form.append("audio", new Blob([wav as BlobPart], { type: "audio/wav" }), "nota.wav");
      form.append("definition", JSON.stringify({ locales: ["it-IT"] }));
      let res: Response;
      try {
        res = await fetchImpl(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${await getToken()}` },
          body: form,
        });
      } catch {
        throw new SpeechError("servizio non raggiungibile");
      }
      if (!res.ok) throw new SpeechError(`risposta ${res.status}`);
      const data = (await res.json()) as {
        durationMilliseconds?: number;
        combinedPhrases?: { text?: string }[];
      };
      const text = (data.combinedPhrases ?? []).map((p) => p.text ?? "").join(" ").trim();
      return { text, durationMs: data.durationMilliseconds ?? 0 };
    },
  };
}
