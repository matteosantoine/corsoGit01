import { describe, expect, it } from "vitest";
import type { Impegno } from "@impegni/shared";
import { AuthError } from "../auth";
import { makeLog } from "../logger";
import { createMemoryNotes } from "../services/notes";
import { handleNotesList, PAGE_SIZE, type NotesListDeps } from "./notesList";

const imp = (o: Partial<Impegno> = {}): Impegno => ({
  tipo: "evento", titolo: "Riunione", descrizione: null, data: "2026-11-26", oraInizio: "10:00", durataMinuti: 60, modalita: null,
  luogo: null, partecipanti: [], priorita: "normale", mancanti: [], stato: "creato", ...o,
});

async function setup(count = 3) {
  const notes = createMemoryNotes();
  for (let i = 0; i < count; i++) {
    await notes.create({ id: `n${i}`, userId: "u1", text: i === 1 ? "Chiamare il commercialista" : `Nota numero ${i}`, createdAt: `2026-11-${String(10 + i).padStart(2, "0")}T09:00:00Z`, durationSec: 5, status: "elaborata", items: i === 0 ? [imp()] : undefined });
  }
  await notes.create({ id: "altrui", userId: "u2", text: "segreto di un altro", createdAt: "2026-11-20T09:00:00Z", durationSec: 1, status: "nuova" });
  const lines: string[] = [];
  const deps: NotesListDeps = { verify: async () => ({ userId: "u1", token: null }), notes, log: makeLog((l) => lines.push(l)) };
  const call = (q: string | null = null, before: string | null = null) => handleNotesList(deps, { authorization: "Bearer x", q, before });
  return { call, lines, deps };
}
type Row = { id: string; testo: string; impegni: { titolo: string; stato: string }[] };

describe("handleNotesList", () => {
  it("dalla più recente, solo dell'utente, con gli impegni generati", async () => {
    const { call } = await setup();
    const note = (await call()).json.note as Row[];
    expect(note.map((n) => n.id)).toEqual(["n2", "n1", "n0"]);
    expect(note[2].impegni).toEqual([{ titolo: "Riunione", tipo: "evento", stato: "creato", data: "2026-11-26", oraInizio: "10:00" }]);
    expect(JSON.stringify(note)).not.toContain("segreto");
  });
  it("ricerca nel testo senza distinguere le maiuscole", async () => {
    const { call } = await setup();
    expect(((await call("COMMERCIALISTA")).json.note as Row[]).map((n) => n.id)).toEqual(["n1"]);
    expect((await call("inesistente")).json.note).toEqual([]);
  });
  it("paginazione: pagina piena → cursore, poi il resto", async () => {
    const { call } = await setup(PAGE_SIZE + 5);
    const first = (await call()).json;
    expect((first.note as Row[]).length).toBe(PAGE_SIZE);
    expect(first.altre).toBeTruthy();
    const second = (await call(null, first.altre as string)).json;
    expect((second.note as Row[]).length).toBe(5);
    expect(second.altre).toBeNull();
  });
  it("cursore non valido: ignorato", async () => {
    const { call } = await setup();
    expect(((await call(null, "boh")).json.note as Row[]).length).toBe(3);
  });
  it("senza accesso → 401", async () => {
    const { deps } = await setup();
    expect((await handleNotesList({ ...deps, verify: async () => { throw new AuthError("x"); } }, { authorization: null, q: null, before: null })).status).toBe(401);
  });
  it("i log non contengono il testo delle note", async () => {
    const { call, lines } = await setup();
    await call("commercialista");
    expect(lines.join("\n")).toContain("note.ok");
    expect(lines.join("\n")).not.toContain("commercialista");
  });
});
