import type { Impegno } from "@impegni/shared";

/** Impegni di una nota in attesa di essere completati dall'utente. `version` cambia a ogni rifacimento. */
export type ReviewEntry = { noteId: string; items: Impegno[]; version: number };

export function addReview(list: ReviewEntry[], noteId: string, items: Impegno[]): ReviewEntry[] {
  return [...list, { noteId, items, version: 0 }];
}

/**
 * Dopo una correzione del testo gli impegni vecchi di quella nota non valgono più:
 * si tolgono (anche le risposte già date) e i nuovi passano davanti a tutti.
 */
export function replaceForNote(list: ReviewEntry[], noteId: string, items: Impegno[]): ReviewEntry[] {
  const previous = list.find((r) => r.noteId === noteId);
  return [{ noteId, items, version: (previous?.version ?? 0) + 1 }, ...list.filter((r) => r.noteId !== noteId)];
}

/** Se la correzione non trova impegni, quelli vecchi vanno comunque tolti. */
export function removeForNote(list: ReviewEntry[], noteId: string): ReviewEntry[] {
  return list.filter((r) => r.noteId !== noteId);
}
