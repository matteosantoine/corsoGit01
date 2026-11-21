import { normalizeItems, type Impegno } from "@impegni/shared";
import type { Verifier } from "../auth";
import type { Log } from "../logger";
import type { NotesRepo } from "../services/notes";
import type { Extractor } from "../services/extractor";

export type ExtractDeps = {
  verify: Verifier;
  notes: Pick<NotesRepo, "get" | "saveItems">;
  extractor: Extractor;
  now: () => Date;
  defaultDurationMin: number;
  log: Log;
};

export type ExtractOutput = { status: number; json: Record<string, unknown> };

const fail = (status: number, error: string, messaggio: string): ExtractOutput => ({ status, json: { error, messaggio } });

/** Legge la nota dell'utente, estrae gli impegni, li ricontrolla in codice e li salva. */
export async function handleExtract(
  deps: ExtractDeps,
  input: { authorization: string | null; noteId: string },
): Promise<ExtractOutput> {
  let userId: string;
  try {
    ({ userId } = await deps.verify(input.authorization));
  } catch {
    return fail(401, "non_autorizzato", "Accesso scaduto. Accedi di nuovo.");
  }

  const note = await deps.notes.get(userId, input.noteId).catch(() => null);
  if (!note) return fail(404, "nota_non_trovata", "Non trovo questa nota.");

  const ctx = { now: deps.now(), defaultDurationMin: deps.defaultDurationMin };
  let items: Impegno[] | undefined;
  // Un secondo tentativo: capita che il modello risponda in modo malformato.
  for (let attempt = 1; attempt <= 2 && !items; attempt++) {
    try {
      items = normalizeItems(await deps.extractor.extract(note.text, ctx), {
        now: ctx.now,
        defaultDurationMin: ctx.defaultDurationMin,
      });
    } catch {
      deps.log("extract.errore", { noteId: note.id, code: `tentativo_${attempt}` });
    }
  }
  if (!items) return fail(502, "estrazione_fallita", "Non sono riuscito a capire gli impegni. Riprovo più tardi.");

  try {
    await deps.notes.saveItems(userId, note.id, items);
  } catch {
    deps.log("extract.errore", { noteId: note.id, code: "salvataggio" });
    return fail(500, "salvataggio_fallito", "Non sono riuscito a salvare gli impegni. Riprovo più tardi.");
  }

  deps.log("extract.ok", { noteId: note.id, status: items.length });
  return { status: 200, json: { noteId: note.id, items } };
}
