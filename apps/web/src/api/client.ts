import type { Impegno } from "@impegni/shared";
import type { QueuedNote } from "../audio/queue";
import type { SendResult } from "../audio/sync";
import { getApiToken } from "../auth/AuthGate";
import { isAuthConfigured } from "../auth/config";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/** Sincronizzazione attiva solo se l'indirizzo dell'API è configurato. */
export const isApiConfigured = API_URL !== "";

/** Intestazione di accesso, o null se serve un nuovo login. */
async function authHeader(): Promise<Record<string, string> | null> {
  if (!isAuthConfigured) return {};
  const token = await getApiToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function sendNote(note: QueuedNote): Promise<SendResult> {
  const auth = await authHeader();
  if (!auth) return { kind: "auth" };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "audio/wav", ...auth },
      body: note.audio,
    });
  } catch {
    return { kind: "retry" }; // rete assente o instabile
  }

  const data = (await res.json().catch(() => ({}))) as {
    noteId?: string; text?: string; error?: string; messaggio?: string;
  };
  if (res.ok && data.noteId && typeof data.text === "string") {
    return { kind: "ok", text: data.text, noteId: data.noteId };
  }
  if (res.status === 401) return { kind: "auth" };
  if (data.error === "nessun_parlato") return { kind: "silent", message: data.messaggio ?? "Non ho sentito nulla." };
  if (res.status === 400 || res.status === 413 || res.status === 415) {
    return { kind: "reject", message: data.messaggio ?? "Questa registrazione non si può elaborare." };
  }
  return { kind: "retry" }; // 5xx e simili: riprova più tardi
}

export type ExtractResult =
  | { kind: "ok"; items: Impegno[] }
  | { kind: "retry" }
  | { kind: "auth" }
  | { kind: "error"; message: string };

/** Chiede al server di estrarre gli impegni da una nota già trascritta. */
export async function extractNote(noteId: string): Promise<ExtractResult> {
  const auth = await authHeader();
  if (!auth) return { kind: "auth" };
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/notes/${encodeURIComponent(noteId)}/extract`, { method: "POST", headers: auth });
  } catch {
    return { kind: "retry" };
  }
  const data = (await res.json().catch(() => ({}))) as { items?: Impegno[]; messaggio?: string };
  if (res.ok && Array.isArray(data.items)) return { kind: "ok", items: data.items };
  if (res.status === 401) return { kind: "auth" };
  if (res.status === 404) return { kind: "error", message: data.messaggio ?? "Non trovo questa nota." };
  return { kind: "retry" };
}

export type EditResult = { kind: "ok" } | { kind: "retry" } | { kind: "auth" } | { kind: "error"; message: string };

/** Salva la correzione del testo trascritto. */
export async function updateNoteText(noteId: string, text: string): Promise<EditResult> {
  const auth = await authHeader();
  if (!auth) return { kind: "auth" };
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/notes/${encodeURIComponent(noteId)}/text`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ text }),
    });
  } catch {
    return { kind: "retry" };
  }
  if (res.ok) return { kind: "ok" };
  const data = (await res.json().catch(() => ({}))) as { messaggio?: string };
  if (res.status === 401) return { kind: "auth" };
  if (res.status === 400 || res.status === 404 || res.status === 409) {
    return { kind: "error", message: data.messaggio ?? "Non posso salvare questa correzione." };
  }
  return { kind: "retry" };
}

export type Candidate = { nome: string; email: string };
export type PeopleResult =
  | { kind: "ok"; candidati: Candidate[]; nonDisponibile: boolean }
  | { kind: "auth" }
  | { kind: "retry" };

/** Cerca l'indirizzo email di un nome tra contatti e persone frequenti. */
export async function findPeople(name: string): Promise<PeopleResult> {
  const auth = await authHeader();
  if (!auth) return { kind: "auth" };
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/people?q=${encodeURIComponent(name)}`, { headers: auth });
  } catch {
    return { kind: "retry" };
  }
  if (res.status === 401) return { kind: "auth" };
  const data = (await res.json().catch(() => ({}))) as { candidati?: Candidate[]; nonDisponibile?: boolean };
  if (!res.ok || !Array.isArray(data.candidati)) return { kind: "retry" };
  return { kind: "ok", candidati: data.candidati, nonDisponibile: Boolean(data.nonDisponibile) };
}

export type Decision = { stato: "confermato" | "scartato"; impegno: Impegno };
export type ConfirmResult =
  | { kind: "ok"; confermati: number; scartati: number }
  | { kind: "auth" }
  | { kind: "retry" }
  | { kind: "error"; message: string };

/** Salva le scelte (Conferma / Scarta) sugli impegni di una nota. */
export async function confirmItems(noteId: string, decisioni: Decision[]): Promise<ConfirmResult> {
  const auth = await authHeader();
  if (!auth) return { kind: "auth" };
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/notes/${encodeURIComponent(noteId)}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ decisioni }),
    });
  } catch {
    return { kind: "retry" };
  }
  const data = (await res.json().catch(() => ({}))) as { confermati?: number; scartati?: number; messaggio?: string };
  if (res.ok) return { kind: "ok", confermati: data.confermati ?? 0, scartati: data.scartati ?? 0 };
  if (res.status === 401) return { kind: "auth" };
  if (res.status >= 400 && res.status < 500) return { kind: "error", message: data.messaggio ?? "Non posso salvare queste scelte." };
  return { kind: "retry" };
}

export type Risultato = { indice: number; tipo: "evento" | "promemoria"; esito: "creato" | "gia_creato" | "errore"; messaggio?: string };
export type CommitResult =
  | { kind: "ok"; risultati: Risultato[] }
  | { kind: "auth" }
  | { kind: "retry" }
  | { kind: "error"; message: string };

/** Chiede al server di creare in Outlook / To Do gli impegni confermati. Si può ripetere senza doppioni. */
export async function commitNote(noteId: string): Promise<CommitResult> {
  const auth = await authHeader();
  if (!auth) return { kind: "auth" };
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/notes/${encodeURIComponent(noteId)}/commit`, { method: "POST", headers: auth });
  } catch {
    return { kind: "retry" };
  }
  const data = (await res.json().catch(() => ({}))) as { risultati?: Risultato[]; messaggio?: string };
  if (res.ok && Array.isArray(data.risultati)) return { kind: "ok", risultati: data.risultati };
  if (res.status === 401) return { kind: "auth" };
  if (res.status >= 400 && res.status < 500) return { kind: "error", message: data.messaggio ?? "Non posso creare gli impegni." };
  return { kind: "retry" };
}
