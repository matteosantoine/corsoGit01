import type { Verifier } from "../auth";
import type { Log } from "../logger";
import { CLAIM_STALE_MS, type NotesRepo } from "../services/notes";

export type DeleteNoteDeps = {
  verify: Verifier;
  notes: Pick<NotesRepo, "get" | "delete">;
  now: () => Date;
  log: Log;
};
export type DeleteNoteOutput = { status: number; json: Record<string, unknown> };

const fail = (status: number, error: string, messaggio: string): DeleteNoteOutput => ({ status, json: { error, messaggio } });

/**
 * Elimina definitivamente una nota dell'utente (testo e traccia degli impegni).
 * Gli eventi e i promemoria già creati in Outlook / To Do NON vengono toccati.
 */
export async function handleDeleteNote(
  deps: DeleteNoteDeps,
  input: { authorization: string | null; noteId: string },
): Promise<DeleteNoteOutput> {
  let userId: string;
  try {
    ({ userId } = await deps.verify(input.authorization));
  } catch {
    return fail(401, "non_autorizzato", "Accesso scaduto. Accedi di nuovo.");
  }

  const note = await deps.notes.get(userId, input.noteId).catch(() => null);
  if (!note) return fail(404, "nota_non_trovata", "Non trovo questa nota.");

  // Mentre si sta creando un impegno la nota serve ancora (stato e ricevuta di creazione).
  const nowMs = deps.now().getTime();
  const inCorso = note.items?.some(
    (i) => i.stato === "in_creazione" && nowMs - Date.parse(i.creazione?.iniziatoIl ?? "") <= CLAIM_STALE_MS,
  );
  if (inCorso) return fail(409, "in_corso", "Sto ancora creando gli impegni di questa nota. Riprova tra qualche istante.");

  try {
    await deps.notes.delete(userId, note.id);
  } catch {
    deps.log("elimina.errore", { noteId: note.id, code: "cancellazione" });
    return fail(500, "cancellazione_fallita", "Non sono riuscito a eliminare la nota. Riprova.");
  }
  deps.log("elimina.ok", { noteId: note.id });
  return { status: 200, json: { noteId: note.id } };
}
