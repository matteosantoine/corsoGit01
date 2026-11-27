import { describe, expect, it, vi } from "vitest";
import { makeLog } from "../logger";
import { createMemoryNotes } from "../services/notes";
import { createMemorySettings } from "../services/settings";
import { handleTranscribe } from "./transcribe";
import { handleExtract } from "./extract";
import { handleEditText } from "./editText";
import { handlePeople } from "./people";
import { handleCommit } from "./commit";

const verify = async () => ({ userId: "u1", token: "tok" });
const log = makeLog(() => {});
const blocked = () => false;
const wav = (() => { const b = new Uint8Array(1000); b.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0); b.set([..."WAVE"].map((c) => c.charCodeAt(0)), 8); return b.buffer; })();

describe("limite di richieste: oltre il limite si blocca PRIMA di usare servizi a pagamento", () => {
  it("trascrizione (categoria 'audio')", async () => {
    const speech = { transcribe: vi.fn() };
    const seen: string[] = [];
    const out = await handleTranscribe(
      { verify, speech, notes: createMemoryNotes(), now: () => new Date(), newId: () => "n", log, rateLimit: (u, b) => { seen.push(`${b}:${u}`); return false; } },
      { authorization: "x", contentType: "audio/wav", body: wav },
    );
    expect(out.status).toBe(429);
    expect(out.json.error).toBe("troppe_richieste");
    expect(speech.transcribe).not.toHaveBeenCalled();
    expect(seen).toEqual(["audio:u1"]);
  });
  it("estrazione AI (categoria 'ai')", async () => {
    const notes = createMemoryNotes();
    await notes.create({ id: "n1", userId: "u1", text: "t", createdAt: "x", durationSec: 1, status: "nuova" });
    const extractor = { extract: vi.fn() };
    const out = await handleExtract({ verify, notes, extractor, now: () => new Date(), settings: createMemorySettings(), log, rateLimit: blocked }, { authorization: "x", noteId: "n1" });
    expect(out.status).toBe(429);
    expect(extractor.extract).not.toHaveBeenCalled();
  });
  it("ricerca contatti", async () => {
    const people = { search: vi.fn() };
    const out = await handlePeople({ verify, people, log, rateLimit: blocked }, { authorization: "x", query: "Mario" });
    expect(out.status).toBe(429);
    expect(people.search).not.toHaveBeenCalled();
  });
  it("correzione del testo", async () => {
    const notes = createMemoryNotes();
    await notes.create({ id: "n1", userId: "u1", text: "vecchio", createdAt: "x", durationSec: 1, status: "nuova" });
    const out = await handleEditText({ verify, notes, log, rateLimit: blocked }, { authorization: "x", noteId: "n1", text: "nuovo" });
    expect(out.status).toBe(429);
    expect(notes.all[0].text).toBe("vecchio");
  });
  it("creazione in Outlook/To Do", async () => {
    const calendar = { createEvent: vi.fn(), createTask: vi.fn() };
    const out = await handleCommit({ verify, notes: createMemoryNotes(), calendar, now: () => new Date(), settings: createMemorySettings(), log, rateLimit: blocked }, { authorization: "x", noteId: "n1" });
    expect(out.status).toBe(429);
    expect(calendar.createEvent).not.toHaveBeenCalled();
  });
  it("senza limitatore (test, anteprima) tutto funziona come prima", async () => {
    const speech = { transcribe: vi.fn(async () => ({ text: "ciao", durationMs: 1000 })) };
    const out = await handleTranscribe({ verify, speech, notes: createMemoryNotes(), now: () => new Date(), newId: () => "n", log }, { authorization: "x", contentType: "audio/wav", body: wav });
    expect(out.status).toBe(200);
  });
  it("l'utente non autenticato riceve 401, non 429 (il limite non rivela nulla)", async () => {
    const out = await handlePeople({ verify: async () => { throw new Error("x"); }, people: { search: vi.fn() }, log, rateLimit: blocked }, { authorization: null, query: "x" });
    expect(out.status).toBe(401);
  });
});
