import { CosmosClient } from "@azure/cosmos";
import type { TokenCredential } from "@azure/identity";
import type { Impegno } from "@impegni/shared";

/** Una nota salvata: SOLO testo. Nessun campo per l'audio, per scelta. */
export type NoteDoc = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  durationSec: number;
  status: "nuova" | "elaborata";
  /** Impegni estratti (testo e metadati, mai audio). */
  items?: Impegno[];
};

export interface NotesRepo {
  create(note: NoteDoc): Promise<void>;
  get(userId: string, id: string): Promise<NoteDoc | null>;
  saveItems(userId: string, id: string, items: Impegno[]): Promise<void>;
  /** Sostituisce il testo (correzione dell'utente) e scarta gli impegni già estratti, ormai superati. */
  updateText(userId: string, id: string, text: string): Promise<void>;
}

export function createCosmosNotes(opts: {
  endpoint: string;
  database: string;
  credential: TokenCredential;
}): NotesRepo {
  const client = new CosmosClient({ endpoint: opts.endpoint, aadCredentials: opts.credential });
  const container = client.database(opts.database).container("notes");
  return {
    async create(note) {
      await container.items.create(note);
    },
    async get(userId, id) {
      const { resource } = await container.item(id, userId).read<NoteDoc>();
      return resource ?? null;
    },
    async saveItems(userId, id, items) {
      const item = container.item(id, userId);
      const { resource } = await item.read<NoteDoc>();
      if (!resource) throw new Error("nota non trovata");
      await item.replace({ ...resource, items, status: "elaborata" });
    },
    async updateText(userId, id, text) {
      const item = container.item(id, userId);
      const { resource } = await item.read<NoteDoc>();
      if (!resource) throw new Error("nota non trovata");
      const { items: _scartati, ...rest } = resource;
      await item.replace({ ...rest, text, status: "nuova" });
    },
  };
}

export function createMemoryNotes(): NotesRepo & { all: NoteDoc[] } {
  const all: NoteDoc[] = [];
  return {
    all,
    async create(note) { all.push(note); },
    async get(userId, id) { return all.find((n) => n.id === id && n.userId === userId) ?? null; },
    async saveItems(userId, id, items) {
      const n = all.find((x) => x.id === id && x.userId === userId);
      if (!n) throw new Error("nota non trovata");
      n.items = items;
      n.status = "elaborata";
    },
    async updateText(userId, id, text) {
      const n = all.find((x) => x.id === id && x.userId === userId);
      if (!n) throw new Error("nota non trovata");
      n.text = text;
      n.status = "nuova";
      delete n.items;
    },
  };
}
