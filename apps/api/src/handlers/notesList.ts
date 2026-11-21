import type { Verifier } from "../auth";
import type { Log } from "../logger";
import type { NoteDoc, NotesRepo } from "../services/notes";

export type NotesListDeps = { verify: Verifier; notes: Pick<NotesRepo, "list">; log: Log };
export type NotesListOutput = { status: number; json: Record<string, unknown> };

export const PAGE_SIZE = 20;

/** Riga dell'archivio: il testo, quando è stato detto e cosa ne è venuto fuori. */
export function toSummary(n: NoteDoc) {
  return {
    id: n.id,
    creatoIl: n.createdAt,
    testo: n.text,
    impegni: (n.items ?? []).map((i) => ({
      titolo: i.titolo,
      tipo: i.tipo,
      stato: i.stato ?? "da_confermare",
      data: i.data,
      oraInizio: i.oraInizio,
    })),
  };
}

/** Archivio delle note dell'utente, dalla più recente, con ricerca nel testo e paginazione. */
export async function handleNotesList(
  deps: NotesListDeps,
  input: { authorization: string | null; q: string | null; before: string | null },
): Promise<NotesListOutput> {
  let userId: string;
  try {
    ({ userId } = await deps.verify(input.authorization));
  } catch {
    return { status: 401, json: { error: "non_autorizzato", messaggio: "Accesso scaduto. Accedi di nuovo." } };
  }
  const q = (input.q ?? "").trim().slice(0, 80) || undefined;
  const before = input.before && !Number.isNaN(Date.parse(input.before)) ? input.before : undefined;
  try {
    // Una in più del necessario, per sapere se esiste una pagina successiva.
    const rows = await deps.notes.list(userId, { q, limit: PAGE_SIZE + 1, before });
    const page = rows.slice(0, PAGE_SIZE);
    deps.log("note.ok", { status: page.length });
    return {
      status: 200,
      json: { note: page.map(toSummary), altre: rows.length > PAGE_SIZE ? page[page.length - 1].createdAt : null },
    };
  } catch {
    deps.log("note.errore", { code: "lettura" });
    return { status: 500, json: { error: "lettura_fallita", messaggio: "Non riesco a leggere le note. Riprova." } };
  }
}
