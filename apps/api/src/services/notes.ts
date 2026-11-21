import { CosmosClient } from "@azure/cosmos";
import type { TokenCredential } from "@azure/identity";
import type { Impegno } from "@impegni/shared";

/** Oltre questo tempo un impegno rimasto "in creazione" (processo interrotto) si può riprovare. */
export const CLAIM_STALE_MS = 10 * 60 * 1000;

export type Outcome = { ok: true; tipo: "evento" | "task"; id: string } | { ok: false };

/** Un impegno è prenotabile se è confermato, o se una creazione precedente è rimasta appesa. */
export function isClaimable(item: Impegno | undefined, nowMs: number): boolean {
  if (!item) return false;
  if (item.stato === "confermato") return true;
  return item.stato === "in_creazione" && nowMs - Date.parse(item.creazione?.iniziatoIl ?? "") > CLAIM_STALE_MS;
}

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
  /**
   * Prenota in modo atomico un impegno confermato prima di crearlo in Outlook/To Do: se due richieste
   * arrivano insieme, solo una ottiene l'impegno. Restituisce l'impegno prenotato, o null.
   */
  claim(userId: string, id: string, index: number, now: Date): Promise<Impegno | null>;
  /** Chiude la prenotazione: "creato" con l'id esterno, oppure torna "confermato" per riprovare. */
  finish(userId: string, id: string, index: number, outcome: Outcome, now: Date): Promise<void>;
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
    async claim(userId, id, index, now) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const item = container.item(id, userId);
        const { resource } = await item.read<NoteDoc & { _etag?: string }>();
        const current = resource?.items?.[index];
        if (!resource || !isClaimable(current, now.getTime())) return null;
        const items = [...resource.items!];
        items[index] = { ...current!, stato: "in_creazione", creazione: { tipo: current!.tipo === "evento" ? "evento" : "task", id: null, iniziatoIl: now.toISOString(), creatoIl: null } };
        try {
          await item.replace({ ...resource, items }, { accessCondition: { type: "IfMatch", condition: resource._etag! } });
          return items[index];
        } catch (e) {
          if ((e as { code?: number }).code !== 412) throw e; // qualcun altro ha modificato: si riprova
        }
      }
      return null;
    },
    async finish(userId, id, index, outcome, now) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const item = container.item(id, userId);
        const { resource } = await item.read<NoteDoc & { _etag?: string }>();
        const current = resource?.items?.[index];
        if (!resource || !current) throw new Error("impegno non trovato");
        const items = [...resource.items!];
        const { creazione: _c, ...rest } = current;
        items[index] = outcome.ok
          ? { ...current, stato: "creato", creazione: { tipo: outcome.tipo, id: outcome.id, iniziatoIl: current.creazione?.iniziatoIl ?? now.toISOString(), creatoIl: now.toISOString() } }
          : { ...rest, stato: "confermato" };
        try {
          await item.replace({ ...resource, items }, { accessCondition: { type: "IfMatch", condition: resource._etag! } });
          return;
        } catch (e) {
          if ((e as { code?: number }).code !== 412) throw e;
        }
      }
      throw new Error("conflitto di scrittura");
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
    async claim(userId, id, index, now) {
      const n = all.find((x) => x.id === id && x.userId === userId);
      const current = n?.items?.[index];
      if (!n || !isClaimable(current, now.getTime())) return null;
      n.items![index] = { ...current!, stato: "in_creazione", creazione: { tipo: current!.tipo === "evento" ? "evento" : "task", id: null, iniziatoIl: now.toISOString(), creatoIl: null } };
      return n.items![index];
    },
    async finish(userId, id, index, outcome, now) {
      const n = all.find((x) => x.id === id && x.userId === userId);
      const current = n?.items?.[index];
      if (!n || !current) throw new Error("impegno non trovato");
      const { creazione: _c, ...rest } = current;
      n.items![index] = outcome.ok
        ? { ...current, stato: "creato", creazione: { tipo: outcome.tipo, id: outcome.id, iniziatoIl: current.creazione?.iniziatoIl ?? now.toISOString(), creatoIl: now.toISOString() } }
        : { ...rest, stato: "confermato" };
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
