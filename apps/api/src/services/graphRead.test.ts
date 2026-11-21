import { describe, expect, it, vi } from "vitest";
import { createGraphAgenda, eventiPerGiorno, promemoriaPerGiorno } from "./graphRead";

const DAYS = ["2026-11-21", "2026-11-22"];
const ev = (o: Record<string, unknown> = {}) => ({
  id: "e1", subject: "Riunione", isAllDay: false, isCancelled: false,
  start: { dateTime: "2026-11-21T10:00:00.0000000" }, end: { dateTime: "2026-11-21T11:00:00.0000000" },
  location: { displayName: "" }, isOnlineMeeting: true, attendees: [{}, {}], ...o,
});

describe("eventiPerGiorno", () => {
  it("assegna ogni evento al suo giorno con orari, Teams e numero di persone", () => {
    const m = eventiPerGiorno([ev(), ev({ id: "e2", subject: "Dentista", start: { dateTime: "2026-11-22T09:00:00.0" }, end: { dateTime: "2026-11-22T09:30:00.0" }, isOnlineMeeting: false, attendees: [], location: { displayName: "Via Roma" } })], DAYS);
    expect(m.get("2026-11-21")).toEqual([{ id: "e1", titolo: "Riunione", inizio: "10:00", fine: "11:00", luogo: null, teams: true, persone: 2 }]);
    expect(m.get("2026-11-22")![0]).toMatchObject({ titolo: "Dentista", inizio: "09:00", luogo: "Via Roma", teams: false, persone: 0 });
  });
  it("ordina per ora e ignora gli annullati", () => {
    const list = eventiPerGiorno([ev({ id: "tardi", start: { dateTime: "2026-11-21T15:00:00.0" }, end: { dateTime: "2026-11-21T16:00:00.0" } }), ev({ id: "presto", start: { dateTime: "2026-11-21T08:00:00.0" }, end: { dateTime: "2026-11-21T08:30:00.0" } }), ev({ id: "x", isCancelled: true })], DAYS).get("2026-11-21")!;
    expect(list.map((e) => e.id)).toEqual(["presto", "tardi"]);
  });
  it("evento di tutto il giorno: senza orari, solo nel suo giorno (fine a mezzanotte esclusa)", () => {
    const m = eventiPerGiorno([ev({ isAllDay: true, start: { dateTime: "2026-11-21T00:00:00.0" }, end: { dateTime: "2026-11-22T00:00:00.0" } })], DAYS);
    expect(m.get("2026-11-21")![0]).toMatchObject({ inizio: null, fine: null });
    expect(m.get("2026-11-22")).toEqual([]);
  });
  it("evento su più giorni compare in entrambi, con orari spezzati", () => {
    const m = eventiPerGiorno([ev({ start: { dateTime: "2026-11-21T22:00:00.0" }, end: { dateTime: "2026-11-22T02:00:00.0" } })], DAYS);
    expect(m.get("2026-11-21")![0]).toMatchObject({ inizio: "22:00", fine: "24:00" });
    expect(m.get("2026-11-22")![0]).toMatchObject({ inizio: "00:00", fine: "02:00" });
  });
  it("fuori dai due giorni: ignorato; senza titolo: segnaposto", () => {
    expect(eventiPerGiorno([ev({ start: { dateTime: "2026-11-25T10:00:00.0" }, end: { dateTime: "2026-11-25T11:00:00.0" } })], DAYS).get("2026-11-21")).toEqual([]);
    expect(eventiPerGiorno([ev({ subject: "  " })], DAYS).get("2026-11-21")![0].titolo).toBe("(senza titolo)");
  });
});

describe("promemoriaPerGiorno", () => {
  const t = (o: Record<string, unknown> = {}) => ({ id: "t1", title: "Pagare", status: "notStarted", importance: "normal", dueDateTime: { dateTime: "2026-11-22T00:00:00.0" }, isReminderOn: true, reminderDateTime: { dateTime: "2026-11-22T15:30:00.0" }, ...o });
  it("solo quelli con scadenza oggi/domani e non completati", () => {
    const m = promemoriaPerGiorno([t(), t({ id: "done", status: "completed" }), t({ id: "lontano", dueDateTime: { dateTime: "2026-12-01T00:00:00.0" } }), t({ id: "senza", dueDateTime: undefined })], DAYS);
    expect(m.get("2026-11-22")!.map((x) => x.id)).toEqual(["t1"]);
    expect(m.get("2026-11-21")).toEqual([]);
  });
  it("mostra l'ora dell'avviso solo se è nel giorno di scadenza; segna l'importante", () => {
    const [a] = promemoriaPerGiorno([t({ importance: "high" })], DAYS).get("2026-11-22")!;
    expect(a).toMatchObject({ ora: "15:30", importante: true });
    const [b] = promemoriaPerGiorno([t({ isReminderOn: false })], DAYS).get("2026-11-22")!;
    expect(b.ora).toBeNull();
  });
});

describe("createGraphAgenda", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  it("legge calendario e To Do e restituisce oggi e domani", async () => {
    const f = vi.fn(async (url: string) => {
      if (url.includes("/me/calendarView")) return json({ value: [ev()] });
      if (url.endsWith("/me/todo/lists")) return json({ value: [{ id: "L1", wellknownListName: "defaultList" }] });
      if (url.includes("/tasks")) return json({ value: [{ id: "t1", title: "Pagare", dueDateTime: { dateTime: "2026-11-22T00:00:00.0" }, isReminderOn: false }] });
      return json({}, 404);
    });
    const agenda = createGraphAgenda({ getGraphToken: async () => "g", fetchImpl: f as unknown as typeof fetch });
    const g = await agenda.agenda("utente", new Date("2026-11-21T08:30:00Z"));
    expect(g.map((d) => d.data)).toEqual(["2026-11-21", "2026-11-22"]);
    expect(g[0].eventi).toHaveLength(1);
    expect(g[1].promemoria).toHaveLength(1);
    const urls = f.mock.calls.map((c) => c[0] as string);
    expect(urls.find((u) => u.includes("calendarView"))).toContain("startDateTime=2026-11-20T00:00:00Z");
    expect(urls.find((u) => u.includes("/tasks"))).toContain(encodeURIComponent("status ne 'completed'"));
  });
  it("errore di Graph → GraphWriteError classificato", async () => {
    const f = (async () => json({}, 403)) as unknown as typeof fetch;
    await expect(createGraphAgenda({ getGraphToken: async () => "g", fetchImpl: f }).agenda("u", new Date())).rejects.toMatchObject({ kind: "permessi" });
  });
});
