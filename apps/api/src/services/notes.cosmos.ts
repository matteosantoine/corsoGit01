import { CosmosClient } from "@azure/cosmos";
import type { TokenCredential } from "@azure/identity";
import { hasCreationInProgress, isClaimable, type NoteDoc, type NotesRepo } from "./notes";

/**
 * Interrogazione dell'archivio. Il testo scritto dall'utente (ricerca, cursore) entra SOLO come parametro:
 * mai incollato nella stringa della query, così non può alterarla (niente iniezioni).
 */
export function buildListQuery(userId: string, o: { q?: string; limit: number; before?: string }) {
  const where = ["c.userId = @u"];
  const parameters: { name: string; value: string | number }[] = [{ name: "@u", value: userId }, { name: "@n", value: Number.isFinite(o.limit) ? Math.max(1, Math.min(100, Math.trunc(o.limit))) : 1 }];
  if (o.q) { where.push("CONTAINS(LOWER(c.text), @q)"); parameters.push({ name: "@q", value: o.q.toLowerCase() }); }
  if (o.before) { where.push("c.createdAt < @b"); parameters.push({ name: "@b", value: o.before }); }
  return { query: `SELECT * FROM c WHERE ${where.join(" AND ")} ORDER BY c.createdAt DESC OFFSET 0 LIMIT @n`, parameters };
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
    async delete(userId, id) {
      try {
        await container.item(id, userId).delete();
        return true;
      } catch (e) {
        if ((e as { code?: number }).code === 404) return false;
        throw e;
      }
    },
    async list(userId, opts) {
      const { resources } = await container.items.query<NoteDoc>(buildListQuery(userId, opts), { partitionKey: userId }).fetchAll();
      return resources;
    },
    async userIds() {
      const { resources } = await container.items.query<string>("SELECT DISTINCT VALUE c.userId FROM c").fetchAll();
      return resources;
    },
    async deleteOlderThan(userId, cutoffIso, now) {
      const { resources } = await container.items
        .query<Pick<NoteDoc, "id" | "items">>(
          { query: "SELECT c.id, c.items FROM c WHERE c.userId = @u AND c.createdAt < @c", parameters: [{ name: "@u", value: userId }, { name: "@c", value: cutoffIso }] },
          { partitionKey: userId },
        )
        .fetchAll();
      let deleted = 0;
      for (const n of resources) {
        if (hasCreationInProgress(n.items, now.getTime())) continue;
        try {
          await container.item(n.id, userId).delete();
          deleted++;
        } catch (e) {
          if ((e as { code?: number }).code !== 404) throw e; // già eliminata da altri: va bene
        }
      }
      return deleted;
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

