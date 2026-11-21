import { describe, expect, it } from "vitest";
import type { Impegno } from "@impegni/shared";
import { AuthError } from "../auth";
import { makeLog } from "../logger";
import { CLAIM_STALE_MS, createMemoryNotes } from "../services/notes";
import { handleDeleteNote, type DeleteNoteDeps } from "./deleteNote";

const NOW = new Date("2026-11-21T08:30:00Z");
const item = (o: Partial<Impegno> = {}): Impegno => ({
  tipo: "evento", titolo: "Riunione con Mario", descrizione: null, data: "2026-11-26", oraInizio: "10:00", durataMinuti: 60, modalita: null,
  luogo: null, partecipanti: [], priorita: "normale", mancanti: [], stato: "creato", ...o,
});

async function setup(items?: Impegno[], over: Partial<DeleteNoteDeps> = {}) {
  const notes = createMemoryNotes();
  await notes.create({ id: "n1", userId: "u1", text: "Riunione con Mario riservata", createdAt: "x", durationSec: 1, status: "elaborata", items });
  await notes.create({ id: "n2", userId: "u1", text: "altra nota", createdAt: "y", durationSec: 1, status: "nuova" });
  await notes.create({ id: "n3", userId: "u2", text: "di un altro", createdAt: "z", durationSec: 1, status: "nuova" });
  const lines: string[] = [];
  const deps: DeleteNoteDeps = { verify: async () => ({ userId: "u1", token: null }), notes, now: () => NOW, log: makeLog((l) => lines.push(l)), ...over };
  return { notes, lines, deps, call: (id = "n1") => handleDeleteNote(deps, { authorization: "Bearer x", noteId: id }) };
}

describe("handleDeleteNote", () => {
  it("elimina definitivamente la nota (non la nasconde) e solo quella", async () => {
    const { call, notes } = await setup([item()]);
    const out = await call();
    expect(out.status).toBe(200);
    expect(notes.all.map((n) => n.id)).toEqual(["n2", "n3"]);
  });
  it("una nota già eliminata → 404", async () => {
    const { call } = await setup();
    await call();
    expect((await call()).status).toBe(404);
  });
  it("la nota di un altro utente non si elimina (404) e resta intatta", async () => {
    const { call, notes } = await setup();
    expect((await call("n3")).status).toBe(404);
    expect(notes.all.map((n) => n.id)).toContain("n3");
  });
  it("senza accesso → 401 e nulla viene eliminato", async () => {
    const { call, notes } = await setup(undefined, { verify: async () => { throw new AuthError("x"); } });
    expect((await call()).status).toBe(401);
    expect(notes.all).toHaveLength(3);
  });
  it("durante la creazione di un impegno → 409; se la creazione è rimasta appesa da molto, si può", async () => {
    const recent = new Date(NOW.getTime() - 60_000).toISOString();
    const old = new Date(NOW.getTime() - CLAIM_STALE_MS - 1000).toISOString();
    const stuck = (iniziatoIl: string) => item({ stato: "in_creazione", creazione: { tipo: "evento", id: null, iniziatoIl, creatoIl: null } });
    const a = await setup([stuck(recent)]);
    expect((await a.call()).status).toBe(409);
    expect(a.notes.all.map((n) => n.id)).toContain("n1");
    const b = await setup([stuck(old)]);
    expect((await b.call()).status).toBe(200);
  });
  it("impegni già creati non impediscono l'eliminazione", async () => {
    const { call } = await setup([item({ stato: "creato" }), item({ stato: "scartato" })]);
    expect((await call()).status).toBe(200);
  });
  it("errore del database → 500", async () => {
    const { deps } = await setup();
    const out = await handleDeleteNote({ ...deps, notes: { ...deps.notes, delete: async () => { throw new Error("cosmos"); } } }, { authorization: "x", noteId: "n1" });
    expect(out.status).toBe(500);
  });
  it("i log non contengono il testo della nota", async () => {
    const { call, lines } = await setup([item()]);
    await call();
    const all = lines.join("\n");
    expect(all).toContain("elimina.ok");
    expect(all).not.toMatch(/Mario|riservata|u1/);
  });
});
