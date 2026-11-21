import { describe, expect, it } from "vitest";
import type { Impegno } from "@impegni/shared";
import { AuthError } from "../auth";
import { makeLog } from "../logger";
import { createMemoryNotes } from "../services/notes";
import { handleConfirm, type ConfirmDeps } from "./confirm";

const evento = (o: Partial<Impegno> = {}): Impegno => ({
  tipo: "evento", titolo: "Riunione con Mario", descrizione: null, data: "2026-11-26", oraInizio: "10:00", durataMinuti: 60,
  modalita: "teams", luogo: null, partecipanti: ["Mario"], priorita: "normale", mancanti: [],
  invitati: [{ nome: "Mario", email: "mario@esterna.com", nomeContatto: "Mario Rossi" }], ...o,
});
const promemoria = (o: Partial<Impegno> = {}): Impegno =>
  evento({ tipo: "promemoria", titolo: "Pagare la bolletta", oraInizio: null, partecipanti: [], invitati: [], modalita: null, durataMinuti: null, ...o });

async function setup(stored: Impegno[] = [evento(), promemoria()], over: Partial<ConfirmDeps> = {}) {
  const notes = createMemoryNotes();
  await notes.create({ id: "n1", userId: "u1", text: "t", createdAt: "x", durationSec: 1, status: "elaborata", items: stored });
  const lines: string[] = [];
  const deps: ConfirmDeps = {
    verify: async () => ({ userId: "u1", token: null }), notes,
    now: () => new Date("2026-11-21T08:30:00Z"), log: makeLog((l) => lines.push(l)), ...over,
  };
  const call = (body: unknown, id = "n1") => handleConfirm(deps, { authorization: "Bearer x", noteId: id, body });
  return { notes, lines, deps, call };
}
const dec = (...d: [string, Impegno][]) => ({ decisioni: d.map(([stato, impegno]) => ({ stato, impegno })) });

describe("handleConfirm", () => {
  it("salva conferma e scarto, e conta", async () => {
    const { call, notes } = await setup();
    const out = await call(dec(["confermato", evento()], ["scartato", promemoria()]));
    expect(out.status).toBe(200);
    expect(out.json).toMatchObject({ confermati: 1, scartati: 1 });
    expect(notes.all[0].items!.map((i) => i.stato)).toEqual(["confermato", "scartato"]);
  });
  it("registra le modifiche fatte dall'utente (es. nuova ora)", async () => {
    const { call, notes } = await setup();
    await call(dec(["confermato", evento({ oraInizio: "11:30" })], ["confermato", promemoria()]));
    expect(notes.all[0].items![0].oraInizio).toBe("11:30");
  });
  it.each([
    ["evento senza invitati", evento({ invitati: [] }), "Manca almeno un invitato"],
    ["evento con email non valida", evento({ invitati: [{ nome: "Mario", email: "mario", nomeContatto: null }] }), "non sono validi"],
    ["data nel passato", evento({ data: "2026-11-01" }), "passata"],
    ["senza data", promemoria({ data: null }), "data"],
    ["evento senza ora", evento({ oraInizio: null }), "ora"],
  ])("rifiuta di CONFERMARE: %s", async (_n, bad, fragment) => {
    const { call, notes } = await setup([bad]);
    const out = await call(dec(["confermato", bad]));
    expect(out.status).toBe(400);
    expect(String(out.json.messaggio)).toContain(fragment);
    expect(notes.all[0].items![0].stato).toBeUndefined(); // nulla è stato salvato
  });
  it("uno scarto non richiede che l'impegno sia completo", async () => {
    const bad = promemoria({ data: null });
    const { call } = await setup([bad]);
    expect((await call(dec(["scartato", bad]))).status).toBe(200);
  });
  it("numero di impegni diverso da quelli salvati → 409", async () => {
    const { call } = await setup([evento()]);
    expect((await call(dec(["confermato", evento()], ["confermato", promemoria()]))).status).toBe(409);
  });
  it("un impegno già creato non torna indietro e resta 'creato'", async () => {
    const creato = { ...evento(), stato: "creato" as const };
    const { call, notes } = await setup([creato]);
    expect((await call(dec(["scartato", evento()]))).status).toBe(409);
    expect((await call(dec(["confermato", evento({ oraInizio: "12:00" })]))).status).toBe(200);
    expect(notes.all[0].items![0].stato).toBe("creato");
  });
  it.each([[null], [{}], [{ decisioni: "x" }], [{ decisioni: [{ stato: "forse", impegno: {} }] }]])("corpo non valido %j → 400", async (body) => {
    const { call } = await setup();
    expect((await call(body)).status).toBe(400);
  });
  it("nota di un altro utente → 404 e nessuna modifica", async () => {
    const { call, deps, notes } = await setup();
    const out = await handleConfirm({ ...deps, verify: async () => ({ userId: "intruso", token: null }) }, { authorization: "x", noteId: "n1", body: dec(["confermato", evento()], ["confermato", promemoria()]) });
    expect(out.status).toBe(404);
    expect(notes.all[0].items!.every((i) => i.stato === undefined)).toBe(true);
    void call;
  });
  it("senza accesso → 401", async () => {
    const { call } = await setup(undefined, { verify: async () => { throw new AuthError("x"); } });
    expect((await call(dec(["confermato", evento()], ["confermato", promemoria()]))).status).toBe(401);
  });
  it("i log non contengono titoli, nomi o email", async () => {
    const { call, lines } = await setup();
    await call(dec(["confermato", evento()], ["scartato", promemoria()]));
    const all = lines.join("\n");
    expect(all).toContain("conferma.ok");
    expect(all).not.toMatch(/Mario|esterna|bolletta/);
  });
});
