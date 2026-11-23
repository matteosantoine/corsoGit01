import { addDays, localParts } from "@impegni/shared";
import { GraphWriteError, makeGraphCall } from "./graphHttp";

export type EventoOggi = {
  id: string;
  titolo: string;
  /** "HH:mm" nel giorno mostrato; null per gli eventi di tutto il giorno. */
  inizio: string | null;
  fine: string | null;
  luogo: string | null;
  teams: boolean;
  persone: number;
};
export type PromemoriaOggi = { id: string; titolo: string; ora: string | null; importante: boolean };
export type Giorno = { data: string; eventi: EventoOggi[]; promemoria: PromemoriaOggi[] };

export interface AgendaReader {
  /** Impegni di oggi e domani (calendario Outlook + promemoria To Do non completati). */
  agenda(userToken: string, now: Date): Promise<Giorno[]>;
}

export type GraphEvent = {
  id: string; subject?: string | null; isAllDay?: boolean; isCancelled?: boolean;
  start?: { dateTime?: string }; end?: { dateTime?: string };
  location?: { displayName?: string | null }; isOnlineMeeting?: boolean; attendees?: unknown[];
};
export type GraphTask = {
  id: string; title?: string | null; status?: string; importance?: string;
  dueDateTime?: { dateTime?: string }; reminderDateTime?: { dateTime?: string }; isReminderOn?: boolean;
};

const ymdOf = (dt?: string) => (dt ?? "").slice(0, 10);
const hmOf = (dt?: string) => (dt ?? "").slice(11, 16);

/** Raggruppa gli eventi per giorno (anche quelli che attraversano più giorni); i valori sono già nel fuso italiano. */
export function eventiPerGiorno(events: GraphEvent[], days: string[]): Map<string, EventoOggi[]> {
  const out = new Map(days.map((d) => [d, [] as EventoOggi[]]));
  for (const e of events) {
    if (e.isCancelled || !e.start?.dateTime || !e.end?.dateTime) continue;
    const startDay = ymdOf(e.start.dateTime);
    const endDay = ymdOf(e.end.dateTime);
    // Una fine esattamente a mezzanotte appartiene al giorno prima (es. evento di tutto il giorno).
    const lastDay = hmOf(e.end.dateTime) === "00:00" && endDay > startDay ? addDays(endDay, -1) : endDay;
    for (const d of days) {
      if (d < startDay || d > lastDay) continue;
      const allDay = Boolean(e.isAllDay);
      out.get(d)!.push({
        id: e.id,
        titolo: (e.subject ?? "").trim() || "(senza titolo)",
        inizio: allDay ? null : d === startDay ? hmOf(e.start.dateTime) : "00:00",
        fine: allDay ? null : d === lastDay ? hmOf(e.end.dateTime) : "24:00",
        luogo: e.location?.displayName?.trim() || null,
        teams: Boolean(e.isOnlineMeeting),
        persone: e.attendees?.length ?? 0,
      });
    }
  }
  for (const list of out.values()) list.sort((a, b) => (a.inizio ?? "").localeCompare(b.inizio ?? "") || a.titolo.localeCompare(b.titolo));
  return out;
}

/** Promemoria non completati con scadenza in uno dei giorni indicati. */
export function promemoriaPerGiorno(tasks: GraphTask[], days: string[]): Map<string, PromemoriaOggi[]> {
  const out = new Map(days.map((d) => [d, [] as PromemoriaOggi[]]));
  for (const t of tasks) {
    if (t.status === "completed") continue;
    const day = ymdOf(t.dueDateTime?.dateTime);
    if (!out.has(day)) continue;
    const reminderDay = ymdOf(t.reminderDateTime?.dateTime);
    out.get(day)!.push({
      id: t.id,
      titolo: (t.title ?? "").trim() || "(senza titolo)",
      ora: t.isReminderOn && reminderDay === day ? hmOf(t.reminderDateTime?.dateTime) : null,
      importante: t.importance === "high",
    });
  }
  for (const list of out.values()) list.sort((a, b) => (a.ora ?? "99").localeCompare(b.ora ?? "99") || a.titolo.localeCompare(b.titolo));
  return out;
}

type Options = { getGraphToken: (userToken: string) => Promise<string>; fetchImpl?: typeof fetch };

export function createGraphAgenda(opts: Options): AgendaReader {
  const call = makeGraphCall(opts);
  return {
    async agenda(userToken, now) {
      const today = localParts(now).ymd;
      const days = [today, addDays(today, 1)];
      // Finestra larga in UTC (copre il fuso italiano); il filtro preciso per giorno lo fa il codice.
      const from = `${addDays(today, -1)}T00:00:00Z`;
      const to = `${addDays(today, 3)}T00:00:00Z`;

      const [events, lists] = await Promise.all([
        call(userToken, "GET",
          `/me/calendarView?startDateTime=${from}&endDateTime=${to}&$top=100&$orderby=${encodeURIComponent("start/dateTime")}` +
          `&$select=id,subject,start,end,isAllDay,isCancelled,location,isOnlineMeeting,attendees`) as Promise<{ value?: GraphEvent[] }>,
        call(userToken, "GET", "/me/todo/lists") as Promise<{ value?: { id: string; wellknownListName?: string }[] }>,
      ]);
      const list = lists.value?.find((l) => l.wellknownListName === "defaultList") ?? lists.value?.[0];
      const tasks = list
        ? ((await call(userToken, "GET",
            `/me/todo/lists/${encodeURIComponent(list.id)}/tasks?$top=100&$filter=${encodeURIComponent("status ne 'completed'")}`,
          )) as { value?: GraphTask[] }).value ?? []
        : [];

      const ev = eventiPerGiorno(events.value ?? [], days);
      const pr = promemoriaPerGiorno(tasks, days);
      return days.map((data) => ({ data, eventi: ev.get(data)!, promemoria: pr.get(data)! }));
    },
  };
}

export { GraphWriteError };
