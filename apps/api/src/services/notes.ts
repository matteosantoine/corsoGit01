import { CosmosClient } from "@azure/cosmos";
import type { TokenCredential } from "@azure/identity";

/** Una nota salvata: SOLO testo. Nessun campo per l'audio, per scelta. */
export type NoteDoc = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  durationSec: number;
  status: "nuova" | "elaborata";
};

export interface NotesRepo {
  create(note: NoteDoc): Promise<void>;
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
  };
}

export function createMemoryNotes(): NotesRepo & { all: NoteDoc[] } {
  const all: NoteDoc[] = [];
  return { all, async create(note) { all.push(note); } };
}
