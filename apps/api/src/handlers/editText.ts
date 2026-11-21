import type { Verifier } from "../auth";
import type { Log } from "../logger";
import type { NotesRepo } from "../services/notes";

export const MAX_TEXT_CHARS = 4000;

export type EditTextDeps = {
  verify: Verifier;
  notes: Pick<NotesRepo, "get" | "updateText">;
  log: Log;
};

export type EditTextOutput = { status: number; json: Record<string, unknown> };

const fail = (status: number, error: string, messaggio: string): EditTextOutput => ({ status, json: { error, messaggio } });

/** Salva la correzione fatta dall'utente al testo trascritto della propria nota. */
export async function handleEditText(
  deps: EditTextDeps,
  input: { authorization: string | null; noteId: string; text: unknown },
): Promise<EditTextOutput> {
  let userId: string;
  try {
    ({ userId } = await deps.verify(input.authorization));
  } catch {
    return fail(401, "non_autorizzato", "Accesso scaduto. Accedi di nuovo.");
  }

  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text) return fail(400, "testo_vuoto", "Il testo non può essere vuoto.");
  if (text.length > MAX_TEXT_CHARS) return fail(400, "testo_troppo_lungo", "Il testo è troppo lungo. Accorcialo.");

  const note = await deps.notes.get(userId, input.noteId).catch(() => null);
  if (!note) return fail(404, "nota_non_trovata", "Non trovo questa nota.");

  try {
    await deps.notes.updateText(userId, note.id, text);
  } catch {
    deps.log("modifica.errore", { noteId: note.id, code: "salvataggio" });
    return fail(500, "salvataggio_fallito", "Non sono riuscito a salvare la correzione. Riprova.");
  }
  deps.log("modifica.ok", { noteId: note.id });
  return { status: 200, json: { noteId: note.id, text } };
}
