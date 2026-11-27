import { withDefaults } from "@impegni/shared";
import type { Log } from "../logger";
import type { NotesRepo } from "../services/notes";
import type { SettingsRepo } from "../services/settings";

export type PurgeDeps = {
  notes: Pick<NotesRepo, "userIds" | "deleteOlderThan">;
  settings: Pick<SettingsRepo, "get">;
  now: () => Date;
  log: Log;
};

export type PurgeReport = { utenti: number; eliminate: number; errori: number };

const DAY_MS = 86_400_000;

/**
 * Pulizia automatica: elimina le note più vecchie del periodo scelto da ciascun utente
 * (90 giorni se non l'ha scelto). Un errore su un utente non ferma gli altri.
 * Non tocca gli eventi e i promemoria già creati in Outlook / To Do.
 */
export async function handlePurge(deps: PurgeDeps): Promise<PurgeReport> {
  const report: PurgeReport = { utenti: 0, eliminate: 0, errori: 0 };
  const now = deps.now();
  let users: string[];
  try {
    users = await deps.notes.userIds();
  } catch {
    deps.log("pulizia.errore", { code: "elenco_utenti" });
    return { ...report, errori: 1 };
  }

  for (const userId of users) {
    report.utenti++;
    try {
      const prefs = await deps.settings.get(userId).catch(() => withDefaults(undefined));
      const cutoff = new Date(now.getTime() - prefs.conservazioneGiorni * DAY_MS).toISOString();
      report.eliminate += await deps.notes.deleteOlderThan(userId, cutoff, now);
    } catch {
      report.errori++;
      deps.log("pulizia.errore", { code: "utente" });
    }
  }
  deps.log("pulizia.ok", { status: report.eliminate, code: `utenti_${report.utenti}_errori_${report.errori}` });
  return report;
}
