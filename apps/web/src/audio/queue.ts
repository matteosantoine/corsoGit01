import { del as idbDel, get as idbGet, keys as idbKeys, set as idbSet } from "idb-keyval";

/**
 * Coda locale delle registrazioni in attesa di invio.
 * L'audio resta sul dispositivo solo finché il server non conferma di aver salvato la trascrizione;
 * poi va cancellato con remove().
 *
 * Ogni registrazione appartiene a un account. Su un computer condiviso, chi accede con un altro account
 * non vede e non invia le registrazioni altrui: quelle vengono eliminate dal dispositivo.
 */
const PREFIX = "coda-audio:";

export type QueuedNote = { id: string; owner: string; createdAt: string; durationSec: number; audio: Blob };

/** Archivio chiave-valore: IndexedDB nell'app, una mappa in memoria nei test e nell'anteprima. */
export type KV = {
  set(key: string, value: unknown): Promise<void>;
  get<T>(key: string): Promise<T | undefined>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
};

export function createQueue(kv: KV) {
  return {
    async add(audio: Blob, durationSec: number, owner: string): Promise<QueuedNote> {
      const note: QueuedNote = { id: crypto.randomUUID(), owner, createdAt: new Date().toISOString(), durationSec, audio };
      await kv.set(PREFIX + note.id, note);
      return note;
    },
    /** Registrazioni dell'account indicato, dalla più vecchia. Quelle di altri account vengono eliminate. */
    async list(owner: string): Promise<QueuedNote[]> {
      const all = (await kv.keys()).filter((k) => k.startsWith(PREFIX));
      const items = await Promise.all(all.map(async (k) => ({ k, n: await kv.get<QueuedNote>(k) })));
      const mine: QueuedNote[] = [];
      for (const { k, n } of items) {
        if (!n) continue;
        if (n.owner === owner) mine.push(n);
        else await kv.del(k); // di un altro account (o senza proprietario): non deve restare qui
      }
      return mine.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async remove(id: string): Promise<void> {
      await kv.del(PREFIX + id);
    },
  };
}

export function memoryKV(): KV {
  const mem = new Map<string, unknown>();
  return {
    set: async (k, v) => void mem.set(k, v),
    get: async <T,>(k: string) => mem.get(k) as T | undefined,
    del: async (k) => void mem.delete(k),
    keys: async () => [...mem.keys()],
  };
}

const idbKV: KV = {
  set: (k, v) => idbSet(k, v),
  get: <T,>(k: string) => idbGet<T>(k),
  del: (k) => idbDel(k),
  keys: async () => (await idbKeys()).map(String),
};

// Anteprima: coda in memoria (IndexedDB può non essere disponibile in una pagina incorporata).
const queue = createQueue(import.meta.env.VITE_DEMO === "1" ? memoryKV() : idbKV);

export const addToQueue = queue.add;
export const listQueue = queue.list;
export const removeFromQueue = queue.remove;
