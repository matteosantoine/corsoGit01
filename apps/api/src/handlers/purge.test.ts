import { describe, expect, it } from "vitest";
import type { Impegno } from "@impegni/shared";
import { makeLog } from "../logger";
import { CLAIM_STALE_MS, createMemoryNotes } from "../services/notes";
import { createMemorySettings } from "../services/settings";
import { handlePurge } from "./purge";

const NOW = new Date("2026-11-27T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

async function setup(settings = createMemorySettings()) {
  const notes = createMemoryNotes();
  const add = (id: string, userId: string, ageDays: number, items?: Impegno[]) =>
    notes.create({ id, userId, text: `testo ${id}`, createdAt: daysAgo(ageDays), durationSec: 1, status: "nuova", items });
  const lines: string[] = [];
  const run = () => handlePurge({ notes, settings, now: () => NOW, log: makeLog((l) => lines.push(l)) });
  return { notes, settings, add, run, lines, ids: () => notes.all.map((n) => n.id).sort() };
}
const inCreation = (iniziatoIl: string): Impegno => ({
  tipo: "promemoria", titolo: "x", descrizione: null, data: "2026-12-01", oraInizio: null, durataMinuti: null, modalita: null, luogo: null,
  partecipanti: [], priorita: "normale", mancanti: [], stato: "in_creazione", creazione: { tipo: "task", id: null, iniziatoIl, creatoIl: null },
});

describe("handlePurge", () => {
  it("di default elimina le note con più di 90 giorni e tiene le altre", async () => {
    const { add, run, ids } = await setup();
    await add("vecchia", "u1", 91); await add("limite", "u1", 89); await add("nuova", "u1", 1);
    const r = await run();
    expect(r).toEqual({ utenti: 1, eliminate: 1, errori: 0 });
    expect(ids()).toEqual(["limite", "nuova"]);
  });
  it("rispetta il periodo scelto da ciascun utente", async () => {
    const settings = createMemorySettings({ u1: { durataMinuti: 60, anticipoMinuti: 15, linkTeams: true, conservazioneGiorni: 30 } });
    const { add, run, ids } = await setup(settings);
    await add("u1-40gg", "u1", 40); await add("u2-40gg", "u2", 40); await add("u2-100gg", "u2", 100);
    expect((await run()).eliminate).toBe(2);
    expect(ids()).toEqual(["u2-40gg"]); // u1: 30 giorni → via; u2: 90 giorni → resta solo la più recente
  });
  it("cambiare l'impostazione vale anche per le note già salvate", async () => {
    const { add, run, settings, ids } = await setup();
    await add("n", "u1", 45);
    await run(); expect(ids()).toEqual(["n"]);
    await settings.put("u1", { durataMinuti: 60, anticipoMinuti: 15, linkTeams: true, conservazioneGiorni: 30 });
    await run(); expect(ids()).toEqual([]);
  });
  it("non elimina una nota con un impegno in creazione recente, sì se è rimasto appeso", async () => {
    const { add, run, ids } = await setup();
    await add("in-corso", "u1", 200, [inCreation(new Date(NOW.getTime() - 60_000).toISOString())]);
    await add("appesa", "u1", 200, [inCreation(new Date(NOW.getTime() - CLAIM_STALE_MS - 1000).toISOString())]);
    await run();
    expect(ids()).toEqual(["in-corso"]);
  });
  it("un errore su un utente non ferma gli altri", async () => {
    const { notes, add, lines } = await setup();
    await add("a", "u1", 200); await add("b", "u2", 200);
    const flaky = { ...notes, deleteOlderThan: async (u: string, c: string, n: Date) => { if (u === "u1") throw new Error("x"); return notes.deleteOlderThan(u, c, n); } };
    const r = await handlePurge({ notes: flaky, settings: createMemorySettings(), now: () => NOW, log: makeLog((l) => lines.push(l)) });
    expect(r).toMatchObject({ eliminate: 1, errori: 1 });
    expect(notes.all.map((n) => n.id)).toEqual(["a"]);
  });
  it("se non si leggono le impostazioni usa 90 giorni; se non si leggono gli utenti segnala l'errore", async () => {
    const { notes, add, ids } = await setup();
    await add("x", "u1", 100);
    const r = await handlePurge({ notes, settings: { get: async () => { throw new Error("x"); } }, now: () => NOW, log: makeLog(() => {}) });
    expect(r.eliminate).toBe(1); expect(ids()).toEqual([]);
    const down = await handlePurge({ notes: { userIds: async () => { throw new Error("x"); }, deleteOlderThan: async () => 0 }, settings: createMemorySettings(), now: () => NOW, log: makeLog(() => {}) });
    expect(down.errori).toBe(1);
  });
  it("i log contengono solo conteggi, mai testi o id utente", async () => {
    const { add, run, lines } = await setup();
    await add("segreta", "utente-riservato", 200);
    await run();
    const all = lines.join("\n");
    expect(all).toContain("pulizia.ok");
    expect(all).not.toMatch(/segreta|utente-riservato|testo/);
  });
});
