import { del as idbDel, get as idbGet, keys as idbKeys, set as idbSet } from "idb-keyval";

// Anteprima: coda in memoria (IndexedDB può non essere disponibile in una pagina incorporata).
const demo = import.meta.env.VITE_DEMO === "1";
const mem = new Map<string, unknown>();
const set = async (k: string, v: unknown) => (demo ? void mem.set(k, v) : idbSet(k, v));
const get = async <T>(k: IDBValidKey) => (demo ? (mem.get(String(k)) as T | undefined) : idbGet<T>(k));
const del = async (k: string) => (demo ? void mem.delete(k) : idbDel(k));
const keys = async () => (demo ? [...mem.keys()] : idbKeys());

/**
 * Coda locale delle registrazioni in attesa di invio.
 * L'audio resta sul dispositivo solo finché il server non conferma
 * di aver salvato la trascrizione; poi va cancellato con removeFromQueue().
 */
const PREFIX = "coda-audio:";

export type QueuedNote = { id: string; createdAt: string; durationSec: number; audio: Blob };

export async function addToQueue(audio: Blob, durationSec: number): Promise<QueuedNote> {
  const note: QueuedNote = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    durationSec,
    audio,
  };
  await set(PREFIX + note.id, note);
  return note;
}

export async function listQueue(): Promise<QueuedNote[]> {
  const all = await keys();
  const items = await Promise.all(
    all.filter((k) => String(k).startsWith(PREFIX)).map((k) => get<QueuedNote>(k)),
  );
  return items
    .filter((n): n is QueuedNote => Boolean(n))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeFromQueue(id: string): Promise<void> {
  await del(PREFIX + id);
}
