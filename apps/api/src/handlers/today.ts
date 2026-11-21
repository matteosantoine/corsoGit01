import type { Verifier } from "../auth";
import type { Log } from "../logger";
import { GraphWriteError } from "../services/graphHttp";
import type { AgendaReader } from "../services/graphRead";

export type TodayDeps = { verify: Verifier; agenda: AgendaReader; now: () => Date; log: Log };
export type TodayOutput = { status: number; json: Record<string, unknown> };

const fail = (status: number, error: string, messaggio: string): TodayOutput => ({ status, json: { error, messaggio } });

/** Impegni di oggi e domani, letti da Outlook e To Do per conto dell'utente. */
export async function handleToday(deps: TodayDeps, input: { authorization: string | null }): Promise<TodayOutput> {
  let user;
  try {
    user = await deps.verify(input.authorization);
  } catch {
    return fail(401, "non_autorizzato", "Accesso scaduto. Accedi di nuovo.");
  }
  if (!user.token) return fail(503, "non_disponibile", "L'agenda non è disponibile in questa modalità.");

  try {
    const giorni = await deps.agenda.agenda(user.token, deps.now());
    deps.log("oggi.ok", { status: giorni.reduce((n, g) => n + g.eventi.length + g.promemoria.length, 0) });
    return { status: 200, json: { giorni } };
  } catch (e) {
    const kind = e instanceof GraphWriteError ? e.kind : "temporaneo";
    deps.log("oggi.errore", { code: kind });
    return kind === "permessi"
      ? fail(502, "permessi", "L'app non ha il permesso di leggere il tuo calendario. Chiedi all'amministratore di concederlo.")
      : fail(502, "non_disponibile", "Non riesco a leggere il calendario in questo momento. Riprova tra poco.");
  }
}
