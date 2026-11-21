import type { QueuedNote } from "../audio/queue";
import type { SendResult } from "../audio/sync";
import { getApiToken } from "../auth/AuthGate";
import { isAuthConfigured } from "../auth/config";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/** Sincronizzazione attiva solo se l'indirizzo dell'API è configurato. */
export const isApiConfigured = API_URL !== "";

export async function sendNote(note: QueuedNote): Promise<SendResult> {
  const headers: Record<string, string> = { "Content-Type": "audio/wav" };
  if (isAuthConfigured) {
    const token = await getApiToken();
    if (!token) return { kind: "auth" };
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/transcribe`, { method: "POST", headers, body: note.audio });
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
