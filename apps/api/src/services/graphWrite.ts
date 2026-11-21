import { addMinutesLocal, localParts, type Impegno } from "@impegni/shared";

/** Fuso (nome Windows, accettato da Graph) che copre l'Italia. */
export const GRAPH_TZ = "W. Europe Standard Time";

export class GraphWriteError extends Error {
  constructor(message: string, readonly kind: "permessi" | "dati" | "temporaneo") {
    super(message);
  }
}

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

function mapStatus(status: number): GraphWriteError {
  if (status === 401 || status === 403) return new GraphWriteError(`risposta ${status}`, "permessi");
  if (status === 400 || status === 404 || status === 409) return new GraphWriteError(`risposta ${status}`, "dati");
  return new GraphWriteError(`risposta ${status}`, "temporaneo"); // 429, 5xx...
}

export function createGraphWriter({ getGraphToken, fetchImpl = fetch }: Options): GraphWriter {
  async function call(userToken: string, method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    let res: Response;
    try {
      const token = await getGraphToken(userToken);
      res = await fetchImpl(`https://graph.microsoft.com/v1.0${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: `outlook.timezone="${GRAPH_TZ}"`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GraphWriteError("servizio non raggiungibile", "temporaneo");
    }
    if (!res.ok) throw mapStatus(res.status);
    return res.json();
  }

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
