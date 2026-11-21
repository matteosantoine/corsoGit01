import { confirmError, ImpegnoSchema, localParts, type Impegno } from "@impegni/shared";
import { z } from "zod";
import type { Verifier } from "../auth";
import type { Log } from "../logger";
import type { NotesRepo } from "../services/notes";

export type ConfirmDeps = {
  verify: Verifier;
  notes: Pick<NotesRepo, "get" | "saveItems">;
  now: () => Date;
  log: Log;
};
export type ConfirmOutput = { status: number; json: Record<string, unknown> };

const BodySchema = z.object({
  decisioni: z.array(z.object({ stato: z.enum(["confermato", "scartato"]), impegno: ImpegnoSchema })).max(20),
});

const fail = (status: number, error: string, messaggio: string): ConfirmOutput => ({ status, json: { error, messaggio } });

/**
 * Salva le scelte dell'utente (Conferma / Scarta) sugli impegni di una nota.
 * Solo gli impegni "confermato" potranno essere creati in Outlook/To Do: è qui che si
 * garantisce che nulla parta senza una conferma esplicita.
 */
export async function handleConfirm(
  deps: ConfirmDeps,
  input: { authorization: string | null; noteId: string; body: unknown },
): Promise<ConfirmOutput> {
  let userId: string;
  try {
    ({ userId } = await deps.verify(input.authorization));
  } catch {
    return fail(401, "non_autorizzato", "Accesso scaduto. Accedi di nuovo.");
  }

  const note = await deps.notes.get(userId, input.noteId).catch(() => null);
  if (!note) return fail(404, "nota_non_trovata", "Non trovo questa nota.");

  const parsed = BodySchema.safeParse(input.body);
  if (!parsed.success) return fail(400, "richiesta_non_valida", "I dati inviati non sono validi.");
  const { decisioni } = parsed.data;

  const stored = note.items ?? [];
  if (decisioni.length !== stored.length) {
    return fail(409, "impegni_cambiati", "Gli impegni sono cambiati. Ricarica e riprova.");
  }
  // Un impegno già creato (o in corso di creazione) non si tocca più.
  const locked = (s: Impegno) => s.stato === "creato" || s.stato === "in_creazione";
  if (stored.some((s, i) => locked(s) && decisioni[i].stato !== "confermato")) {
    return fail(409, "gia_creato", "Un impegno è già stato creato e non si può cambiare.");
  }

  const today = localParts(deps.now()).ymd;
  const final: Impegno[] = [];
  for (const [i, d] of decisioni.entries()) {
    if (locked(stored[i])) { final.push(stored[i]); continue; } // il testo del telefono non lo sovrascrive
    if (d.stato === "confermato") {
      const problem = confirmError(d.impegno, today);
      if (problem) return fail(400, "impegno_incompleto", `Impegno ${i + 1}: ${problem}`);
    }
    // stato e tracce di creazione le decide il server: il telefono non può impostarli.
    const { creazione: _ignorata, ...pulito } = d.impegno;
    final.push({ ...pulito, mancanti: [], stato: d.stato });
  }

  try {
    await deps.notes.saveItems(userId, note.id, final);
  } catch {
    deps.log("conferma.errore", { noteId: note.id, code: "salvataggio" });
    return fail(500, "salvataggio_fallito", "Non sono riuscito a salvare le scelte. Riprova.");
  }

  const confermati = final.filter((i) => i.stato === "confermato" || i.stato === "creato").length;
  deps.log("conferma.ok", { noteId: note.id, status: confermati });
  return { status: 200, json: { noteId: note.id, confermati, scartati: final.length - confermati } };
}
