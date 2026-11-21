import { describe, expect, it, vi } from "vitest";
import { createSpeechClient, SpeechError } from "./speech";

const wav = new Uint8Array([1, 2, 3]);
const make = (fetchImpl: typeof fetch) =>
  createSpeechClient({ endpoint: "https://x.cognitiveservices.azure.com/", getToken: async () => "tok", fetchImpl });

describe("createSpeechClient", () => {
  it("invia audio + definizione it-IT e unisce le frasi", async () => {
    const f = vi.fn(async () =>
      new Response(JSON.stringify({ durationMilliseconds: 3000, combinedPhrases: [{ text: "Ciao" }, { text: "mondo" }] })),
    );
    const out = await make(f as unknown as typeof fetch).transcribe(wav);
    expect(out).toEqual({ text: "Ciao mondo", durationMs: 3000 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x.cognitiveservices.azure.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const form = init.body as FormData;
    expect(JSON.parse(form.get("definition") as string)).toEqual({ locales: ["it-IT"] });
    expect(form.get("audio")).toBeInstanceOf(Blob);
  });

  it("errore HTTP → SpeechError", async () => {
    const f = (async () => new Response("no", { status: 429 })) as unknown as typeof fetch;
    await expect(make(f).transcribe(wav)).rejects.toBeInstanceOf(SpeechError);
  });

  it("rete assente → SpeechError", async () => {
    const f = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    await expect(make(f).transcribe(wav)).rejects.toBeInstanceOf(SpeechError);
  });
});
