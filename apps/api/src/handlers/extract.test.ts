import { describe, expect, it, vi } from "vitest";
import type { ImpegnoModel } from "@impegni/shared";
import { AuthError } from "../auth";
import { makeLog } from "../logger";
import { createMemoryNotes } from "../services/notes";
import { ExtractionError, type Extractor } from "../services/extractor";
import { createMemorySettings } from "../services/settings";
import { handleExtract, type ExtractDeps } from "./extract";

const model = (o: Partial<ImpegnoModel> = {}): ImpegnoModel => ({
  tipo: "evento", titolo: "Riunione con Mario", descrizione: null, data: "2026-11-26", oraInizio: "10:00",
  durataMinuti: null, modalita: "teams", luogo: null, partecipanti: ["Mario"], priorita: "normale", ...o,
});

async function setup(extract: Extractor["extract"], over: Partial<ExtractDeps> = {}) {
  const notes = createMemoryNotes();
  await notes.create({ id: "n1", userId: "u1", text: "Giovedì prossimo alle dieci Mario", createdAt: "x", durationSec: 3, status: "nuova" });
  const lines: string[] = [];
  const extractor = { extract: vi.fn(extract) } as Extractor & { extract: ReturnType<typeof vi.fn> };
  const deps: ExtractDeps = {
    verify: async () => ({ userId: "u1", token: null }),
    notes, extractor,
    now: () => new Date("2026-11-21T08:30:00Z"),
    settings: createMemorySettings(),
    log: makeLog((l) => lines.push(l)),
    ...over,
  };
  return { deps, notes, lines, extractor, call: (id = "n1") => handleExtract(deps, { authorization: "Bearer x", noteId: id }) };
}

describe("handleExtract", () => {
  it("estrae, ricontrolla, salva e risponde", async () => {
    const { call, notes } = await setup(async () => [model()]);
    const out = await call();
    expect(out.status).toBe(200);
    const items = out.json.items as { durataMinuti: number; mancanti: string[] }[];
    expect(items[0].durataMinuti).toBe(60);
    expect(items[0].mancanti).toEqual([]);
    expect(notes.all[0].status).toBe("elaborata");
    expect(notes.all[0].items).toHaveLength(1);
  });

  it("applica le impostazioni: durata predefinita e link Teams", async () => {
    const settings = createMemorySettings({ u1: { durataMinuti: 90, anticipoMinuti: 15, linkTeams: true, conservazioneGiorni: 90 } });
    const { call, extractor } = await setup(async () => [model({ modalita: null })], { settings });
    const items = (await call()).json.items as { durataMinuti: number; modalita: string | null }[];
    expect(items[0]).toMatchObject({ durataMinuti: 90, modalita: "teams" });
    expect(extractor.extract.mock.calls[0][1].defaultDurationMin).toBe(90); // anche il modello la conosce
  });
  it("con Teams disattivato non lo aggiunge", async () => {
    const settings = createMemorySettings({ u1: { durataMinuti: 60, anticipoMinuti: 15, linkTeams: false, conservazioneGiorni: 90 } });
    const { call } = await setup(async () => [model({ modalita: null })], { settings });
    expect(((await call()).json.items as { modalita: string | null }[])[0].modalita).toBeNull();
  });
  it("se le impostazioni non si leggono usa quelle predefinite", async () => {
    const settings = { get: async () => { throw new Error("cosmos"); } };
    const { call } = await setup(async () => [model({ modalita: null })], { settings });
    expect(((await call()).json.items as { durataMinuti: number }[])[0].durataMinuti).toBe(60);
  });

  it("segnala come mancanti i dati che il modello non ha dato", async () => {
    const { call } = await setup(async () => [model({ data: null, oraInizio: null, partecipanti: [] })]);
    const items = (await call()).json.items as { mancanti: string[] }[];
    expect(items[0].mancanti).toEqual(["data", "ora", "partecipanti"]);
  });

  it("riprova una volta se il primo tentativo fallisce", async () => {
    let n = 0;
    const { call, extractor } = await setup(async () => { if (++n === 1) throw new ExtractionError("json"); return [model()]; });
    expect((await call()).status).toBe(200);
    expect(extractor.extract).toHaveBeenCalledTimes(2);
  });

  it("se fallisce due volte: 502 e la nota non viene toccata", async () => {
    const { call, notes } = await setup(async () => { throw new ExtractionError("x"); });
    expect((await call()).status).toBe(502);
    expect(notes.all[0].items).toBeUndefined();
    expect(notes.all[0].status).toBe("nuova");
  });

  it("nota di un altro utente o inesistente → 404, il modello non viene chiamato", async () => {
    const { call, deps, extractor } = await setup(async () => [model()]);
    expect((await call("altra")).status).toBe(404);
    expect((await handleExtract({ ...deps, verify: async () => ({ userId: "intruso", token: null }) }, { authorization: "x", noteId: "n1" })).status).toBe(404);
    expect(extractor.extract).not.toHaveBeenCalled();
  });

  it("senza accesso valido → 401", async () => {
    const { call, extractor } = await setup(async () => [model()], { verify: async () => { throw new AuthError("x"); } });
    expect((await call()).status).toBe(401);
    expect(extractor.extract).not.toHaveBeenCalled();
  });

  it("nota senza impegni → 200 con lista vuota", async () => {
    const { call } = await setup(async () => []);
    const out = await call();
    expect(out.status).toBe(200);
    expect(out.json.items).toEqual([]);
  });

  it("errore di salvataggio → 500", async () => {
    const { call, deps } = await setup(async () => [model()]);
    deps.notes = { ...deps.notes, saveItems: async () => { throw new Error("cosmos"); } };
    expect((await call()).status).toBe(500);
  });

  it("i log non contengono testo della nota né nomi", async () => {
    const { call, lines } = await setup(async () => [model()]);
    await call();
    const all = lines.join("\n");
    expect(all).toContain("extract.ok");
    expect(all).not.toContain("Mario");
    expect(all).not.toContain("u1");
  });
});
