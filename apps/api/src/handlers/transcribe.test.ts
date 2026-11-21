import { describe, expect, it, vi } from "vitest";
import { AuthError } from "../auth";
import { makeLog } from "../logger";
import { createMemoryNotes } from "../services/notes";
import { SpeechError, type SpeechClient } from "../services/speech";
import { handleTranscribe, MAX_AUDIO_BYTES, type Deps } from "./transcribe";

function wav(bytes = 1000): ArrayBuffer {
  const b = new Uint8Array(bytes);
  b.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  b.set([..."WAVE"].map((c) => c.charCodeAt(0)), 8);
  return b.buffer;
}

function setup(over: Partial<Deps> = {}) {
  const notes = createMemoryNotes();
  const lines: string[] = [];
  const speech: SpeechClient = { transcribe: vi.fn(async () => ({ text: "Giovedì alle 10 chiamare Mario", durationMs: 4200 })) };
  const deps: Deps = {
    verify: async () => ({ userId: "utente-1" }),
    speech,
    notes,
    now: () => new Date("2026-11-21T10:00:00Z"),
    newId: () => "nota-1",
    log: makeLog((l) => lines.push(l)),
    ...over,
  };
  const call = (body: ArrayBuffer = wav()) =>
    handleTranscribe(deps, { authorization: "Bearer x", contentType: "audio/wav", body });
  return { deps, notes, lines, speech, call };
}

describe("handleTranscribe", () => {
  it("trascrive, salva solo il testo e risponde", async () => {
    const { call, notes } = setup();
    const out = await call();
    expect(out.status).toBe(200);
    expect(out.json).toEqual({ noteId: "nota-1", text: "Giovedì alle 10 chiamare Mario", durationSec: 4 });
    expect(notes.all).toHaveLength(1);
    expect(Object.keys(notes.all[0]).sort()).toEqual(
      ["createdAt", "durationSec", "id", "status", "text", "userId"],
    ); // nessun campo audio
  });

  it("non salva nulla se la trascrizione fallisce (l'audio resta al client per riprovare)", async () => {
    const { call, notes } = setup({
      speech: { transcribe: async () => { throw new SpeechError("risposta 500"); } },
    });
    const out = await call();
    expect(out.status).toBe(502);
    expect(notes.all).toHaveLength(0);
  });

  it("segnala quando non c'è parlato e non salva", async () => {
    const { call, notes } = setup({ speech: { transcribe: async () => ({ text: "", durationMs: 2000 }) } });
    const out = await call();
    expect(out.status).toBe(422);
    expect(notes.all).toHaveLength(0);
  });

  it("se il salvataggio fallisce NON conferma (il client non deve cancellare l'audio)", async () => {
    const { call } = setup({ notes: { create: async () => { throw new Error("cosmos giù"); } } });
    const out = await call();
    expect(out.status).toBe(500);
    expect(out.json).not.toHaveProperty("noteId");
  });

  it("rifiuta senza token valido e non chiama Speech", async () => {
    const { call, speech } = setup({ verify: async () => { throw new AuthError("x"); } });
    expect((await call()).status).toBe(401);
    expect(speech.transcribe).not.toHaveBeenCalled();
  });

  it("rifiuta file vuoti, troppo grandi o non WAV", async () => {
    const { call, speech } = setup();
    expect((await call(new ArrayBuffer(0))).status).toBe(400);
    expect((await call(new ArrayBuffer(MAX_AUDIO_BYTES + 1))).status).toBe(413);
    expect((await call(new Uint8Array(500).buffer)).status).toBe(415);
    expect(speech.transcribe).not.toHaveBeenCalled();
  });

  it("i log non contengono il testo della nota né l'id utente", async () => {
    const { call, lines } = setup();
    await call();
    const all = lines.join("\n");
    expect(all).toContain("transcribe.ok");
    expect(all).not.toContain("Mario");
    expect(all).not.toContain("utente-1");
  });
});
