import type { Verifier } from "../auth";
import type { Log } from "../logger";
import { TOO_MANY, type RateLimitFn } from "../rateLimit";
import type { PeopleSearch } from "../services/people";

export type PeopleDeps = { verify: Verifier; people: PeopleSearch; log: Log; rateLimit?: RateLimitFn };
export type PeopleOutput = { status: number; json: Record<string, unknown> };

/**
 * Cerca l'indirizzo email di un nome. Se Graph non risponde NON è un errore bloccante:
 * si restituisce l'elenco vuoto e l'app chiede l'email a mano.
 */
export async function handlePeople(
  deps: PeopleDeps,
  input: { authorization: string | null; query: string | null },
): Promise<PeopleOutput> {
  let user;
  try {
    user = await deps.verify(input.authorization);
  } catch {
    return { status: 401, json: { error: "non_autorizzato", messaggio: "Accesso scaduto. Accedi di nuovo." } };
  }
  if (deps.rateLimit && !deps.rateLimit(user.userId, "contatti")) return { status: TOO_MANY.status, json: { ...TOO_MANY.json } };
  const q = (input.query ?? "").trim();
  if (!q) return { status: 400, json: { error: "nome_mancante", messaggio: "Scrivi il nome da cercare." } };

  try {
    const candidati = await deps.people.search(user.token, q);
    deps.log("people.ok", { status: candidati.length });
    return { status: 200, json: { candidati } };
  } catch {
    deps.log("people.errore", { code: "graph" });
    return { status: 200, json: { candidati: [], nonDisponibile: true } };
  }
}
