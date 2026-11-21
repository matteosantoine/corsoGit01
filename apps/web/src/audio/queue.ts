import { del, get, keys, set } from "idb-keyval";

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
