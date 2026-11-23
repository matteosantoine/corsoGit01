import { DEFAULT_SETTINGS, withDefaults, type Settings } from "@impegni/shared";

export interface SettingsRepo {
  /** Impostazioni dell'utente; i valori mancanti o non validi tornano predefiniti. */
  get(userId: string): Promise<Settings>;
  put(userId: string, settings: Settings): Promise<void>;
}

export function createMemorySettings(initial?: Partial<Record<string, Settings>>): SettingsRepo & { store: Map<string, Settings> } {
  const store = new Map(Object.entries(initial ?? {}).map(([k, v]) => [k, v!]));
  return {
    store,
    async get(userId) { return store.get(userId) ?? DEFAULT_SETTINGS; },
    async put(userId, s) { store.set(userId, s); },
  };
}
