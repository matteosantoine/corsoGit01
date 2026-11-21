import { confirmError, localParts, type Impegno } from "@impegni/shared";
import type { Verifier } from "../auth";
import type { Log } from "../logger";
import { GraphWriteError, buildEventPayload, buildTaskPayload, type GraphWriter } from "../services/graphWrite";
import type { NotesRepo } from "../services/notes";

export type CommitDeps = {
  verify: Verifier;
  notes: Pick<NotesRepo, "get" | "claim" | "finish">;
  calendar: GraphWriter;
  now: () => Date;
  reminderMin: number;
  defaultDurationMin: number;
  log: Log;
};

export type Risultato = {
  indice: number;
  tipo: "evento" | "promemoria";
  esito: "creato" | "gia_creato" | "errore";
  messaggio?: string;
};
export type CommitOutput = { status: number; json: Record<string, unknown> };

const fail = (status: number, error: string, messaggio: string): CommitOutput => ({ status, json: { error, messaggio } });

const MESSAGGI: Record<GraphWriteError["kind"], string> = {
  permessi: "L'app non ha il permesso di scrivere nel tuo calendario o in To Do. Chiedi all'amministratore di concederlo.",
  dati: "Microsoft ha rifiutato questo impegno. Controlla i dati con Modifica.",
  temporaneo: "Servizio Microsoft momentaneamente non disponibile. Riprova tra poco.",
};

/**
 * Crea in Outlook (eventi con inviti) e in To Do (promemoria) SOLO gli impegni che l'utente
 * ha confermato e che sono salvati sul server. Può essere richiamato senza rischio di doppioni.
 */
export async function handleCommit(
  deps: CommitDeps,
  input: { authorization: string | null; noteId: string },
): Promise<CommitOutput> {
  let user;
  try {
    user = await deps.verify(input.authorization);
  } catch {
    return fail(401, "non_autorizzato", "Accesso scaduto. Accedi di nuovo.");
  }
  if (!user.token) return fail(503, "non_disponibile", "La creazione nel calendario non è disponibile in questa modalità.");
  const userToken = user.token;

  const note = await deps.notes.get(user.userId, input.noteId).catch(() => null);
  if (!note) return fail(404, "nota_non_trovata", "Non trovo questa nota.");

  const risultati: Risultato[] = [];
  const items = note.items ?? [];
  for (const [indice, saved] of items.entries()) {
    const tipo = saved.tipo;
    if (saved.stato === "creato") { risultati.push({ indice, tipo, esito: "gia_creato" }); continue; }
    if (saved.stato !== "confermato" && saved.stato !== "in_creazione") continue; // scartati e non confermati: mai toccati

    const now = deps.now();
    const claimed = await deps.notes.claim(user.userId, note.id, indice, now);
    if (!claimed) {
      // Un'altra richiesta lo sta già creando (o è appena stato creato): niente doppioni.
      risultati.push({ indice, tipo, esito: "errore", messaggio: "È già in corso. Controlla tra qualche secondo." });
      continue;
    }

    const problem = confirmError(claimed, localParts(now).ymd);
    if (problem) {
      await deps.notes.finish(user.userId, note.id, indice, { ok: false }, now);
      risultati.push({ indice, tipo, esito: "errore", messaggio: `${problem} Modifica l'impegno e conferma di nuovo.` });
      continue;
    }

    try {
      const ref = await create(deps, userToken, claimed, note.id, indice, now);
      await deps.notes.finish(user.userId, note.id, indice, { ok: true, tipo: tipo === "evento" ? "evento" : "task", id: ref.id }, now);
      deps.log("commit.ok", { noteId: note.id, step: tipo });
      risultati.push({ indice, tipo, esito: "creato" });
    } catch (e) {
      const kind = e instanceof GraphWriteError ? e.kind : "temporaneo";
      await deps.notes.finish(user.userId, note.id, indice, { ok: false }, now).catch(() => undefined);
      deps.log("commit.errore", { noteId: note.id, code: kind, step: tipo });
      risultati.push({ indice, tipo, esito: "errore", messaggio: MESSAGGI[kind] });
    }
  }

  return { status: 200, json: { noteId: note.id, risultati } };
}

function create(deps: CommitDeps, userToken: string, item: Impegno, noteId: string, index: number, now: Date) {
  return item.tipo === "evento"
    ? deps.calendar.createEvent(userToken, buildEventPayload(item, { noteId, index, reminderMin: deps.reminderMin, defaultDurationMin: deps.defaultDurationMin }))
    : deps.calendar.createTask(userToken, buildTaskPayload(item, now));
}
