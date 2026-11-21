import { SettingsSchema, withDefaults } from "@impegni/shared";
import type { Verifier } from "../auth";
import type { Log } from "../logger";
import type { SettingsRepo } from "../services/settings";

export type SettingsDeps = { verify: Verifier; settings: SettingsRepo; log: Log };
export type SettingsOutput = { status: number; json: Record<string, unknown> };

const unauthorized: SettingsOutput = { status: 401, json: { error: "non_autorizzato", messaggio: "Accesso scaduto. Accedi di nuovo." } };

export async function handleGetSettings(deps: SettingsDeps, input: { authorization: string | null }): Promise<SettingsOutput> {
  let userId: string;
  try {
    ({ userId } = await deps.verify(input.authorization));
  } catch {
    return unauthorized;
  }
  // Se la lettura fallisce l'app funziona comunque con i valori predefiniti.
  const settings = await deps.settings.get(userId).catch(() => withDefaults(undefined));
  return { status: 200, json: { impostazioni: settings } };
}

export async function handlePutSettings(
  deps: SettingsDeps,
  input: { authorization: string | null; body: unknown },
): Promise<SettingsOutput> {
  let userId: string;
  try {
    ({ userId } = await deps.verify(input.authorization));
  } catch {
    return unauthorized;
  }
  const parsed = SettingsSchema.safeParse(input.body);
  if (!parsed.success) return { status: 400, json: { error: "valori_non_validi", messaggio: "Questi valori non sono ammessi." } };
  try {
    await deps.settings.put(userId, parsed.data);
  } catch {
    deps.log("impostazioni.errore", { code: "salvataggio" });
    return { status: 500, json: { error: "salvataggio_fallito", messaggio: "Non sono riuscito a salvare. Riprova." } };
  }
  deps.log("impostazioni.ok");
  return { status: 200, json: { impostazioni: parsed.data } };
}
