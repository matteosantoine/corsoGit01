import { CosmosClient } from "@azure/cosmos";
import type { TokenCredential } from "@azure/identity";
import { DEFAULT_SETTINGS, withDefaults, type Settings } from "@impegni/shared";

export interface SettingsRepo {
  /** Impostazioni dell'utente; i valori mancanti o non validi tornano predefiniti. */
  get(userId: string): Promise<Settings>;
  put(userId: string, settings: Settings): Promise<void>;
}

const DOC_ID = "preferenze";

export function createCosmosSettings(opts: { endpoint: string; database: string; credential: TokenCredential }): SettingsRepo {
  const client = new CosmosClient({ endpoint: opts.endpoint, aadCredentials: opts.credential });
  const container = client.database(opts.database).container("settings");
  return {
    async get(userId) {
      const { resource } = await container.item(DOC_ID, userId).read();
      return withDefaults(resource);
    },
    async put(userId, settings) {
      await container.items.upsert({ id: DOC_ID, userId, ...settings });
    },
  };
}

export function createMemorySettings(initial?: Partial<Record<string, Settings>>): SettingsRepo & { store: Map<string, Settings> } {
  const store = new Map(Object.entries(initial ?? {}).map(([k, v]) => [k, v!]));
  return {
    store,
    async get(userId) { return store.get(userId) ?? DEFAULT_SETTINGS; },
    async put(userId, s) { store.set(userId, s); },
  };
}
