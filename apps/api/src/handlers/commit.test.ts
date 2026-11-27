import { describe, expect, it, vi } from "vitest";
import type { Impegno } from "@impegni/shared";
import { AuthError } from "../auth";
import { makeLog } from "../logger";
import { GraphWriteError, type GraphWriter } from "../services/graphWrite";
import { CLAIM_STALE_MS, createMemoryNotes } from "../services/notes";
import { createMemorySettings } from "../services/settings";
import { handleCommit, type CommitDeps, type Risultato } from "./commit";

const NOW = new Date("2026-11-21T08:30:00Z");
const evento = (o: Partial<Impegno> = {}): Impegno => ({
  tipo: "evento", titolo: "Riunione con Mario", descrizione: null, data: "2026-11-26", oraInizio: "10:00", durataMinuti: 60,
  modalita: "teams", luogo: null, partecipanti: ["Mario"], priorita: "normale", mancanti: [],
  invitati: [{ nome: "Mario", email: "mario@esterna.com", nomeContatto: "Mario Rossi" }], stato: "confermato", ...o,
});
const promemoria = (o: Partial<Impegno> = {}): Impegno =>
  evento({ tipo: "promemoria", titolo: "Pagare la bolletta", oraInizio: null, durataMinuti: null, modalita: null, partecipanti: [], invitati: [], ...o });

function fakeCalendar(over: Partial<GraphWriter> = {}) {
  const calendar = {
    createEvent: vi.fn(async () => ({ id: "ev-1" })),
    createTask: vi.fn(async () => ({ id: "task-1" })),
    ...over,
  } as GraphWriter & { createEvent: ReturnType<typeof vi.fn>; createTask: ReturnType<typeof vi.fn> };
  return calendar;
}

async function setup(items: Impegno[], calendarOver: Partial<GraphWriter> = {}, depsOver: Partial<CommitDeps> = {}) {
  const notes = createMemoryNotes();
  await notes.create({ id: "n1", userId: "u1", text: "t", createdAt: "x", durationSec: 1, status: "elaborata", items });
  const lines: string[] = [];
  const calendar = fakeCalendar(calendarOver);
  const deps: CommitDeps = {
    verify: async () => ({ userId: "u1", token: "tok-utente" }), notes, calendar, now: () => NOW,
    settings: createMemorySettings(), log: makeLog((l) => lines.push(l)), ...depsOver,
  };
  const call = async () => {
    const out = await handleCommit(deps, { authorization: "Bearer x", noteId: "n1" });
    return { out, risultati: (out.json.risultati ?? []) as Risultato[] };
  };
  return { notes, calendar, lines, deps, call };
}

describe("handleCommit", () => {
  it("crea l'evento (con inviti) e il promemoria, e li segna come creati", async () => {
    const { call, calendar, notes } = await setup([evento(), promemoria()]);
    const { out, risultati } = await call();
    expect(out.status).toBe(200);
    expect(risultati.map((r) => r.esito)).toEqual(["creato", "creato"]);
    expect(calendar.createEvent).toHaveBeenCalledTimes(1);
    expect(calendar.createTask).toHaveBeenCalledTimes(1);
    expect(calendar.createEvent.mock.calls[0][0]).toBe("tok-utente"); // per conto dell'utente
    expect(notes.all[0].items!.map((i) => i.stato)).toEqual(["creato", "creato"]);
    expect(notes.all[0].items![0].creazione).toMatchObject({ tipo: "evento", id: "ev-1" });
    expect(notes.all[0].items![1].creazione).toMatchObject({ tipo: "task", id: "task-1" });
  });

  it("NON tocca gli impegni scartati né quelli non confermati", async () => {
    const { call, calendar, notes } = await setup([evento({ stato: "scartato" }), evento({ stato: "da_confermare" }), promemoria({ stato: undefined })]);
    const { risultati } = await call();
    expect(risultati).toEqual([]);
    expect(calendar.createEvent).not.toHaveBeenCalled();
    expect(calendar.createTask).not.toHaveBeenCalled();
    expect(notes.all[0].items!.map((i) => i.stato)).toEqual(["scartato", "da_confermare", undefined]);
  });

  it("richiamarlo non crea doppioni", async () => {
    const { call, calendar } = await setup([evento(), promemoria()]);
    await call();
    const second = await call();
    expect(second.risultati.map((r) => r.esito)).toEqual(["gia_creato", "gia_creato"]);
    expect(calendar.createEvent).toHaveBeenCalledTimes(1);
    expect(calendar.createTask).toHaveBeenCalledTimes(1);
  });

  it("due richieste contemporanee: l'impegno viene creato una volta sola", async () => {
    const slow = { createTask: vi.fn(async () => { await new Promise((r) => setTimeout(r, 20)); return { id: "t" }; }) };
    const { call, calendar } = await setup([promemoria()], slow);
    const [a, b] = await Promise.all([call(), call()]);
    expect(calendar.createTask).toHaveBeenCalledTimes(1);
    expect([a.risultati[0].esito, b.risultati[0].esito].sort()).toEqual(["creato", "errore"]);
  });

  it("un errore su un impegno non blocca gli altri, e quello fallito resta riprovabile", async () => {
    const { call, calendar, notes } = await setup([evento(), promemoria()], {
      createEvent: vi.fn(async () => { throw new GraphWriteError("x", "temporaneo"); }),
    });
    const { risultati } = await call();
    expect(risultati.map((r) => r.esito)).toEqual(["errore", "creato"]);
    expect(risultati[0].messaggio).toContain("Riprova");
    expect(notes.all[0].items![0].stato).toBe("confermato"); // di nuovo disponibile
    expect(notes.all[0].items![0].creazione).toBeUndefined();
    // al secondo tentativo il servizio funziona
    calendar.createEvent.mockResolvedValueOnce({ id: "ev-9" });
    const retry = await call();
    expect(retry.risultati.map((r) => r.esito)).toEqual(["creato", "gia_creato"]);
    expect(calendar.createTask).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["permessi", "permesso"],
    ["dati", "rifiutato"],
  ] as const)("errore %s → messaggio comprensibile", async (kind, fragment) => {
    const { call } = await setup([promemoria()], { createTask: vi.fn(async () => { throw new GraphWriteError("x", kind); }) });
    expect((await call()).risultati[0].messaggio).toContain(fragment);
  });

  it("riconferma i dati prima di creare: data diventata passata → non crea e resta confermato", async () => {
    const { call, calendar, notes } = await setup([evento({ data: "2026-11-01" })]);
    const { risultati } = await call();
    expect(risultati[0].esito).toBe("errore");
    expect(risultati[0].messaggio).toContain("passata");
    expect(calendar.createEvent).not.toHaveBeenCalled();
    expect(notes.all[0].items![0].stato).toBe("confermato");
  });

  it("una creazione rimasta appesa da molto si può riprovare, una recente no", async () => {
    const old = new Date(NOW.getTime() - CLAIM_STALE_MS - 1000).toISOString();
    const recent = new Date(NOW.getTime() - 60_000).toISOString();
    const stuck = (iniziatoIl: string) => promemoria({ stato: "in_creazione", creazione: { tipo: "task", id: null, iniziatoIl, creatoIl: null } });
    const a = await setup([stuck(old)]);
    expect((await a.call()).risultati[0].esito).toBe("creato");
    const b = await setup([stuck(recent)]);
    expect((await b.call()).risultati[0].esito).toBe("errore");
    expect(b.calendar.createTask).not.toHaveBeenCalled();
  });

  it("usa le impostazioni dell'utente: anticipo e durata predefinita", async () => {
    const settings = createMemorySettings({ u1: { durataMinuti: 30, anticipoMinuti: 60, linkTeams: true, conservazioneGiorni: 90 } });
    const { call, calendar } = await setup([evento({ durataMinuti: null })], {}, { settings });
    await call();
    const payload = calendar.createEvent.mock.calls[0][1];
    expect(payload.reminderMinutesBeforeStart).toBe(60);
    expect(payload.end.dateTime).toBe("2026-11-26T10:30:00");
  });

  it("senza token Microsoft (modalità di sviluppo) → 503 e niente viene creato", async () => {
    const { call, calendar } = await setup([evento()], {}, { verify: async () => ({ userId: "u1", token: null }) });
    expect((await call()).out.status).toBe(503);
    expect(calendar.createEvent).not.toHaveBeenCalled();
  });

  it("senza accesso → 401; nota altrui → 404, senza creare nulla", async () => {
    const a = await setup([evento()], {}, { verify: async () => { throw new AuthError("x"); } });
    expect((await a.call()).out.status).toBe(401);
    const b = await setup([evento()], {}, { verify: async () => ({ userId: "intruso", token: "t" }) });
    expect((await b.call()).out.status).toBe(404);
    expect(b.calendar.createEvent).not.toHaveBeenCalled();
  });

  it("i log non contengono titoli, nomi, email o id utente", async () => {
    const { call, lines } = await setup([evento({ descrizione: "segretissimo" }), promemoria()]);
    await call();
    const all = lines.join("\n");
    expect(all).toContain("commit.ok");
    expect(all).not.toMatch(/Mario|esterna|bolletta|segretissimo|u1|tok-utente/);
  });
});
