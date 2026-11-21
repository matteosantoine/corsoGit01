import { addMinutesLocal, localParts, type Impegno } from "@impegni/shared";

import { GRAPH_TZ, GraphWriteError, makeGraphCall } from "./graphHttp";

export { GRAPH_TZ, GraphWriteError };

export type CreatedRef = { id: string };

export interface GraphWriter {
  createEvent(userToken: string, payload: ReturnType<typeof buildEventPayload>): Promise<CreatedRef>;
  createTask(userToken: string, payload: ReturnType<typeof buildTaskPayload>): Promise<CreatedRef>;
}

const importance = (p: Impegno["priorita"]) => (p === "alta" ? "high" : p === "bassa" ? "low" : "normal");

/** Evento Outlook con inviti. `transactionId` fa sì che un nuovo tentativo non crei un secondo evento. */
export function buildEventPayload(item: Impegno, o: { noteId: string; index: number; reminderMin: number; defaultDurationMin: number }) {
  const start = { ymd: item.data!, hm: item.oraInizio! };
  const end = addMinutesLocal(start.ymd, start.hm, item.durataMinuti ?? o.defaultDurationMin);
  const seen = new Set<string>();
  const attendees = (item.invitati ?? [])
    .filter((i) => !seen.has(i.email.toLowerCase()) && seen.add(i.email.toLowerCase()))
    .map((i) => ({ emailAddress: { address: i.email, name: i.nomeContatto ?? i.nome }, type: "required" as const }));
  return {
    subject: item.titolo,
    body: { contentType: "text" as const, content: item.descrizione ?? "" },
    start: { dateTime: `${start.ymd}T${start.hm}:00`, timeZone: GRAPH_TZ },
    end: { dateTime: `${end.ymd}T${end.hm}:00`, timeZone: GRAPH_TZ },
    attendees,
    importance: importance(item.priorita),
    isReminderOn: true,
    reminderMinutesBeforeStart: o.reminderMin,
    transactionId: `${o.noteId}-${o.index}`,
    ...(item.luogo ? { location: { displayName: item.luogo } } : {}),
    ...(item.modalita === "teams" ? { isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" as const } : {}),
  };
}

/** Promemoria in To Do: scadenza nel giorno indicato; avviso all'ora detta (o alle 9:00) se è ancora nel futuro. */
export function buildTaskPayload(item: Impegno, now: Date) {
  const today = localParts(now);
  const reminderHm = item.oraInizio ?? "09:00";
  const future = item.data! > today.ymd || (item.data === today.ymd && reminderHm > today.hm);
  return {
    title: item.titolo,
    body: { contentType: "text" as const, content: item.descrizione ?? "" },
    importance: importance(item.priorita),
    dueDateTime: { dateTime: `${item.data}T00:00:00`, timeZone: GRAPH_TZ },
    isReminderOn: future,
    ...(future ? { reminderDateTime: { dateTime: `${item.data}T${reminderHm}:00`, timeZone: GRAPH_TZ } } : {}),
  };
}

type Options = { getGraphToken: (userToken: string) => Promise<string>; fetchImpl?: typeof fetch };

export function createGraphWriter(opts: Options): GraphWriter {
  const call = makeGraphCall(opts);

  return {
    async createEvent(userToken, payload) {
      const r = (await call(userToken, "POST", "/me/events", payload)) as { id?: string };
      if (!r.id) throw new GraphWriteError("risposta senza id", "temporaneo");
      return { id: r.id };
    },
    async createTask(userToken, payload) {
      const lists = (await call(userToken, "GET", "/me/todo/lists")) as { value?: { id: string; wellknownListName?: string }[] };
      const list = lists.value?.find((l) => l.wellknownListName === "defaultList") ?? lists.value?.[0];
      if (!list) throw new GraphWriteError("nessuna lista To Do", "dati");
      const r = (await call(userToken, "POST", `/me/todo/lists/${encodeURIComponent(list.id)}/tasks`, payload)) as { id?: string };
      if (!r.id) throw new GraphWriteError("risposta senza id", "temporaneo");
      return { id: r.id };
    },
  };
}
