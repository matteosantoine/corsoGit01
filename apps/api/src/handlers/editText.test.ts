import { describe, expect, it } from "vitest";
import type { Impegno } from "@impegni/shared";
import { AuthError } from "../auth";
import { makeLog } from "../logger";
import { createMemoryNotes } from "../services/notes";
import { handleEditText, MAX_TEXT_CHARS, type EditTextDeps } from "./editText";

const item: Impegno = {
  tipo: "promemoria", titolo: "x", descrizione: null, data: null, oraInizio: null, durataMinuti: null,
  modalita: null, luogo: null, partecipanti: [], priorita: "normale", mancanti: ["data"],
};

async function setup(over: Partial<EditTextDeps> = {}) {
  const notes = createMemoryNotes();
  await notes.create({ id: "n1", userId: "u1", text: "Chiamare Maria", createdAt: "x", durationSec: 3, status: "elaborata", items: [item] });
  const lines: string[] = [];
  const deps: EditTextDeps = { verify: async () => ({ userId: "u1", token: null }), notes, log: makeLog((l) => lines.push(l)), ...over };
  return { notes, lines, deps, call: (text: unknown, id = "n1") => handleEditText(deps, { authorization: "Bearer x", noteId: id, text }) };
}

describe("handleEditText", () => {
  it("salva il testo corretto e scarta gli impegni vecchi", async () => {
    const { call, notes } = await setup();
    const out = await call("  Chiamare Mario  ");
    expect(out.status).toBe(200);
    expect(out.json).toEqual({ noteId: "n1", text: "Chiamare Mario" });
    expect(notes.all[0].text).toBe("Chiamare Mario");
    expect(notes.all[0].items).toBeUndefined();
    expect(notes.all[0].status).toBe("nuova");
  });
  it.each([["vuoto", ""], ["solo spazi", "   "], ["non testo", 42], ["assente", undefined]])("rifiuta testo %s", async (_n, v) => {
    const { call, notes } = await setup();
    expect((await call(v)).status).toBe(400);
    expect(notes.all[0].text).toBe("Chiamare Maria");
  });
  it("rifiuta testi troppo lunghi", async () => {
    const { call } = await setup();
    expect((await call("a".repeat(MAX_TEXT_CHARS + 1))).status).toBe(400);
    expect((await call("a".repeat(MAX_TEXT_CHARS))).status).toBe(200);
  });
  it("nota di un altro utente o inesistente → 404 e nessuna modifica", async () => {
    const { call, deps, notes } = await setup();
    expect((await call("x", "altra")).status).toBe(404);
    expect((await handleEditText({ ...deps, verify: async () => ({ userId: "intruso", token: null }) }, { authorization: "x", noteId: "n1", text: "hack" })).status).toBe(404);
    expect(notes.all[0].text).toBe("Chiamare Maria");
  });
  it("se un impegno è già stato creato, il testo non si può più cambiare", async () => {
    const { call, notes } = await setup();
    notes.all[0].items = [{ ...item, stato: "creato" }];
    const out = await call("Chiamare Mario");
    expect(out.status).toBe(409);
    expect(notes.all[0].text).toBe("Chiamare Maria");
    expect(notes.all[0].items![0].stato).toBe("creato");
  });
  it("senza accesso valido → 401", async () => {
    const { call } = await setup({ verify: async () => { throw new AuthError("x"); } });
    expect((await call("x")).status).toBe(401);
  });
  it("errore di salvataggio → 500", async () => {
    const { call, deps } = await setup();
    deps.notes = { ...deps.notes, updateText: async () => { throw new Error("cosmos"); } };
    expect((await call("x")).status).toBe(500);
  });
  it("i log non contengono il testo", async () => {
    const { call, lines } = await setup();
    await call("Chiamare Mario segretissimo");
    const all = lines.join("\n");
    expect(all).toContain("modifica.ok");
    expect(all).not.toContain("segretissimo");
    expect(all).not.toContain("u1");
  });
});
