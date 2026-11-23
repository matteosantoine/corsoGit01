import { addDays, localParts } from "@impegni/shared";
import { handleConfirm } from "../../../api/src/handlers/confirm";
import { handleCommit } from "../../../api/src/handlers/commit";
import { handleDeleteNote } from "../../../api/src/handlers/deleteNote";
import { handleEditText } from "../../../api/src/handlers/editText";
import { handleExtract } from "../../../api/src/handlers/extract";
import { handleNotesList } from "../../../api/src/handlers/notesList";
import { handlePeople } from "../../../api/src/handlers/people";
import { handleGetSettings, handlePutSettings } from "../../../api/src/handlers/settings";
import { handleToday } from "../../../api/src/handlers/today";
import { handleTranscribe } from "../../../api/src/handlers/transcribe";
import { makeLog } from "../../../api/src/logger";
import type { Extractor } from "../../../api/src/services/extractor";
import { eventiPerGiorno, promemoriaPerGiorno, type AgendaReader, type GraphEvent, type GraphTask } from "../../../api/src/services/graphRead";
import type { GraphWriter } from "../../../api/src/services/graphWrite";
import { createMemoryNotes } from "../../../api/src/services/notes";
import type { PeopleSearch } from "../../../api/src/services/people";
import { createMemorySettings } from "../../../api/src/services/settings";
import type { SpeechClient } from "../../../api/src/services/speech";
import { parseSentence } from "./parser";

/**
 * ANTEPRIMA: gli stessi gestori del server vero (controlli di conferma, creazione senza doppioni,
 * ricerca, eliminazione…) con servizi simulati al posto di Azure Speech, Azure OpenAI e Microsoft Graph.
 * Tutto vive in memoria e sparisce ricaricando la pagina.
 */

const DIRECTORY: Record<string, { nome: string; email: string }[]> = {
  mario: [{ nome: "Mario Rossi", email: "mario.rossi@esterna.com" }],
  anna: [{ nome: "Anna Bianchi", email: "anna.bianchi@studiouno.it" }, { nome: "Anna Verdi", email: "anna.verdi@dueconsulting.com" }],
  elena: [{ nome: "Elena Neri", email: "elena.neri@azienda.it" }],
  giulia: [{ nome: "Giulia Ferri", email: "giulia.ferri@partner.eu" }],
  paolo: [{ nome: "Paolo Gallo", email: "paolo.gallo@fornitore.com" }],
};

export type DemoRequest = { method: string; url: URL; headers: Headers; body: BodyInit | null };

export function createDemoServer(opts: { getSentence: () => string; now?: () => Date }) {
  const now = opts.now ?? (() => new Date());
  const notes = createMemoryNotes();
  const settings = createMemorySettings();
  const events: GraphEvent[] = [];
  const tasks: GraphTask[] = [];
  let seq = 0;

  // --- Dati di partenza: un calendario e un archivio non vuoti ---
  const today = localParts(now()).ymd;
  const tomorrow = addDays(today, 1);
  events.push(
    { id: "seed-e1", subject: "Riunione di reparto", start: { dateTime: `${today}T14:00:00.0` }, end: { dateTime: `${today}T15:00:00.0` }, isOnlineMeeting: true, attendees: [{}, {}, {}, {}, {}] },
    { id: "seed-e2", subject: "Visita dal dentista", start: { dateTime: `${tomorrow}T09:00:00.0` }, end: { dateTime: `${tomorrow}T09:45:00.0` }, location: { displayName: "Via Roma 12" }, attendees: [] },
  );
  tasks.push({ id: "seed-t1", title: "Inviare le fatture", status: "notStarted", importance: "high", dueDateTime: { dateTime: `${today}T00:00:00.0` }, isReminderOn: true, reminderDateTime: { dateTime: `${today}T18:00:00.0` } });
  const yesterday = new Date(now().getTime() - 86_400_000).toISOString();
  void notes.create({
    id: "seed-n1", userId: "demo", text: "Ricordare di mandare il preventivo al signor Rossi", createdAt: yesterday, durationSec: 4, status: "elaborata",
    items: [{ tipo: "promemoria", titolo: "Mandare il preventivo al signor Rossi", descrizione: null, data: today, oraInizio: null, durataMinuti: null, modalita: null, luogo: null, partecipanti: [], priorita: "normale", mancanti: [], stato: "creato" }],
  });

  // --- Servizi simulati ---
  const speech: SpeechClient = { transcribe: async () => ({ text: opts.getSentence(), durationMs: 4200 }) };
  const extractor: Extractor = { extract: async (text, ctx) => parseSentence(text, ctx.now) };
  const people: PeopleSearch = {
    search: async (_t, name) => Object.entries(DIRECTORY).filter(([k]) => name.toLowerCase().includes(k)).flatMap(([, v]) => v),
  };
  const calendar: GraphWriter = {
    async createEvent(_t, p) {
      const id = `demo-e${++seq}`;
      events.push({ id, subject: p.subject, start: { dateTime: p.start.dateTime }, end: { dateTime: p.end.dateTime }, isOnlineMeeting: "isOnlineMeeting" in p && Boolean(p.isOnlineMeeting), location: "location" in p ? p.location : undefined, attendees: p.attendees });
      return { id };
    },
    async createTask(_t, p) {
      const id = `demo-t${++seq}`;
      tasks.push({ id, title: p.title, status: "notStarted", importance: p.importance, dueDateTime: { dateTime: p.dueDateTime.dateTime }, isReminderOn: p.isReminderOn, reminderDateTime: "reminderDateTime" in p ? p.reminderDateTime : undefined });
      return { id };
    },
  };
  const agenda: AgendaReader = {
    async agenda(_t, at) {
      const d0 = localParts(at).ymd;
      const days = [d0, addDays(d0, 1)];
      const ev = eventiPerGiorno(events, days);
      const pr = promemoriaPerGiorno(tasks, days);
      return days.map((data) => ({ data, eventi: ev.get(data)!, promemoria: pr.get(data)! }));
    },
  };

  const deps = {
    verify: async () => ({ userId: "demo", token: "token-demo" }),
    notes, settings, speech, extractor, people, calendar, agenda,
    now, newId: () => `demo-n${++seq}`, log: makeLog(() => {}),
  };

  return {
    async handle(req: DemoRequest): Promise<{ status: number; json: Record<string, unknown> }> {
      const path = req.url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
      const authorization = "Bearer demo";
      const json = async () => (typeof req.body === "string" ? JSON.parse(req.body) : null);
      const [a, id, action] = path;

      if (a === "transcribe" && req.method === "POST") {
        const body = req.body instanceof Blob ? await req.body.arrayBuffer() : new ArrayBuffer(0);
        return handleTranscribe(deps, { authorization, contentType: "audio/wav", body });
      }
      if (a === "people") return handlePeople(deps, { authorization, query: req.url.searchParams.get("q") });
      if (a === "today") return handleToday(deps, { authorization });
      if (a === "settings") {
        return req.method === "PUT" ? handlePutSettings(deps, { authorization, body: await json() }) : handleGetSettings(deps, { authorization });
      }
      if (a === "notes" && !id) {
        return handleNotesList(deps, { authorization, q: req.url.searchParams.get("q"), before: req.url.searchParams.get("before") });
      }
      if (a === "notes" && id) {
        if (req.method === "DELETE") return handleDeleteNote(deps, { authorization, noteId: id });
        if (action === "extract") return handleExtract(deps, { authorization, noteId: id });
        if (action === "text") return handleEditText(deps, { authorization, noteId: id, text: ((await json()) as { text?: unknown })?.text });
        if (action === "confirm") return handleConfirm(deps, { authorization, noteId: id, body: await json() });
        if (action === "commit") return handleCommit(deps, { authorization, noteId: id });
      }
      return { status: 404, json: { error: "non_trovato", messaggio: "Funzione non disponibile nell'anteprima." } };
    },
  };
}
