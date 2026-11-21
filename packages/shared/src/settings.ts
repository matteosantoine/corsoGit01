import { z } from "zod";

/** Valori proposti all'utente: poche scelte chiare, niente campi liberi. */
export const DURATE_MINUTI = [15, 30, 45, 60, 90, 120] as const;
export const ANTICIPI_MINUTI = [0, 5, 10, 15, 30, 60, 1440] as const;

const oneOf = <T extends readonly number[]>(values: T) =>
  z.number().refine((n): n is T[number] => (values as readonly number[]).includes(n), "valore non ammesso");

export const SettingsSchema = z.object({
  /** Durata di un incontro quando non è detta. */
  durataMinuti: oneOf(DURATE_MINUTI),
  /** Quanto prima avvisare per un incontro (0 = all'ora dell'incontro). */
  anticipoMinuti: oneOf(ANTICIPI_MINUTI),
  /** Aggiungere il link Teams agli incontri online senza luogo indicato. */
  linkTeams: z.boolean(),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = { durataMinuti: 60, anticipoMinuti: 15, linkTeams: true };

/** Impostazioni lette dal database: ciò che manca o non è valido torna al valore predefinito. */
export function withDefaults(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <K extends keyof Settings>(k: K): Settings[K] => {
    const one = SettingsSchema.shape[k].safeParse(r[k]);
    return one.success ? (one.data as Settings[K]) : DEFAULT_SETTINGS[k];
  };
  return { durataMinuti: pick("durataMinuti"), anticipoMinuti: pick("anticipoMinuti"), linkTeams: pick("linkTeams") };
}
