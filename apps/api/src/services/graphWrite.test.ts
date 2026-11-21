import { describe, expect, it, vi } from "vitest";
import type { Impegno } from "@impegni/shared";
import { buildEventPayload, buildTaskPayload, createGraphWriter, GraphWriteError, GRAPH_TZ } from "./graphWrite";

const evento = (o: Partial<Impegno> = {}): Impegno => ({
  tipo: "evento", titolo: "Riunione con Mario", descrizione: "Budget 2027", data: "2026-11-26", oraInizio: "10:00", durataMinuti: 60,
  modalita: "teams", luogo: null, partecipanti: ["Mario"], priorita: "normale", mancanti: [],
  invitati: [{ nome: "Mario", email: "mario@esterna.com", nomeContatto: "Mario Rossi" }], stato: "confermato", ...o,
});
const promemoria = (o: Partial<Impegno> = {}): Impegno =>
  evento({ tipo: "promemoria", titolo: "Pagare la bolletta", descrizione: null, oraInizio: null, durataMinuti: null, modalita: null, partecipanti: [], invitati: [], ...o });
const opts = { noteId: "nota-1", index: 0, reminderMin: 15, defaultDurationMin: 60 };

describe("buildEventPayload", () => {
  it("inizio, fine, invitati e link Teams", () => {
    const p = buildEventPayload(evento(), opts);
    expect(p.start).toEqual({ dateTime: "2026-11-26T10:00:00", timeZone: GRAPH_TZ });
    expect(p.end).toEqual({ dateTime: "2026-11-26T11:00:00", timeZone: GRAPH_TZ });
    expect(p.attendees).toEqual([{ emailAddress: { address: "mario@esterna.com", name: "Mario Rossi" }, type: "required" }]);
    expect(p).toMatchObject({ isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness", subject: "Riunione con Mario", reminderMinutesBeforeStart: 15 });
  });
  it("transactionId stabile: un nuovo tentativo non crea un secondo evento", () => {
    expect(buildEventPayload(evento(), opts).transactionId).toBe("nota-1-0");
    expect(buildEventPayload(evento(), { ...opts, index: 2 }).transactionId).toBe("nota-1-2");
  });
  it("senza Teams: nessun link; con luogo: luogo", () => {
    const p = buildEventPayload(evento({ modalita: "presenza", luogo: "Sala riunioni" }), opts);
    expect(p).not.toHaveProperty("isOnlineMeeting");
    expect(p.location).toEqual({ displayName: "Sala riunioni" });
  });
  it("evento serale che finisce dopo mezzanotte", () => {
    const p = buildEventPayload(evento({ oraInizio: "23:30", durataMinuti: 90 }), opts);
    expect(p.end.dateTime).toBe("2026-11-27T01:00:00");
  });
  it("usa la durata predefinita se manca", () => {
    expect(buildEventPayload(evento({ durataMinuti: null }), { ...opts, defaultDurationMin: 45 }).end.dateTime).toBe("2026-11-26T10:45:00");
  });
  it("toglie gli invitati doppi (anche con maiuscole diverse)", () => {
    const inv = [{ nome: "A", email: "a@x.it", nomeContatto: null }, { nome: "A2", email: "A@X.it", nomeContatto: null }];
    expect(buildEventPayload(evento({ invitati: inv }), opts).attendees).toHaveLength(1);
  });
  it("priorità alta/bassa", () => {
    expect(buildEventPayload(evento({ priorita: "alta" }), opts).importance).toBe("high");
    expect(buildEventPayload(evento({ priorita: "bassa" }), opts).importance).toBe("low");
  });
});

describe("buildTaskPayload", () => {
  const NOW = new Date("2026-11-21T08:30:00Z"); // 09:30 Roma
  it("scadenza e avviso alle 9:00 se non c'è un'ora", () => {
    const p = buildTaskPayload(promemoria(), NOW);
    expect(p.dueDateTime.dateTime).toBe("2026-11-26T00:00:00");
    expect(p).toMatchObject({ isReminderOn: true, reminderDateTime: { dateTime: "2026-11-26T09:00:00" } });
  });
  it("avviso all'ora detta", () => {
    expect(buildTaskPayload(promemoria({ oraInizio: "15:30" }), NOW)).toMatchObject({ reminderDateTime: { dateTime: "2026-11-26T15:30:00" } });
  });
  it("oggi con ora già passata: niente avviso nel passato", () => {
    const p = buildTaskPayload(promemoria({ data: "2026-11-21" }), NOW); // 09:00 < 09:30
    expect(p.isReminderOn).toBe(false);
    expect(p).not.toHaveProperty("reminderDateTime");
  });
  it("oggi con ora futura: avviso attivo", () => {
    expect(buildTaskPayload(promemoria({ data: "2026-11-21", oraInizio: "17:00" }), NOW).isReminderOn).toBe(true);
  });
});

describe("createGraphWriter", () => {
  const make = (f: typeof fetch) => createGraphWriter({ getGraphToken: async () => "graph-tok", fetchImpl: f });
  const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

  it("crea l'evento con POST /me/events e token Graph", async () => {
    const f = vi.fn(async () => json(201, { id: "ev-1" }));
    const ref = await make(f as unknown as typeof fetch).createEvent("utente", buildEventPayload(evento(), opts));
    expect(ref).toEqual({ id: "ev-1" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.microsoft.com/v1.0/me/events");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer graph-tok");
  });
  it("crea il task nella lista predefinita di To Do", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json(200, { value: [{ id: "L2", wellknownListName: "none" }, { id: "L1", wellknownListName: "defaultList" }] }))
      .mockResolvedValueOnce(json(201, { id: "t-1" }));
    const ref = await make(f as unknown as typeof fetch).createTask("utente", buildTaskPayload(promemoria(), new Date("2026-11-21T08:30:00Z")));
    expect(ref).toEqual({ id: "t-1" });
    expect((f.mock.calls[1] as unknown as [string])[0]).toBe("https://graph.microsoft.com/v1.0/me/todo/lists/L1/tasks");
  });
  it.each([
    [403, "permessi"], [401, "permessi"], [400, "dati"], [429, "temporaneo"], [503, "temporaneo"],
  ])("HTTP %i → %s", async (status, kind) => {
    const f = (async () => json(status)) as unknown as typeof fetch;
    await expect(make(f).createEvent("u", buildEventPayload(evento(), opts))).rejects.toMatchObject({ kind });
  });
  it("rete assente → temporaneo; scambio del token fallito → temporaneo", async () => {
    const down = (async () => { throw new TypeError("x"); }) as unknown as typeof fetch;
    await expect(make(down).createEvent("u", buildEventPayload(evento(), opts))).rejects.toBeInstanceOf(GraphWriteError);
    const bad = createGraphWriter({ getGraphToken: async () => { throw new Error("obo"); }, fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(bad.createEvent("u", buildEventPayload(evento(), opts))).rejects.toMatchObject({ kind: "temporaneo" });
  });
});
