import { isValidYmd } from "./dates";
import type { Impegno, Invitato } from "./extraction";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s: string) => EMAIL.test(s.trim());

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Nomi citati per cui non c'è ancora un indirizzo email scelto. */
export function unresolvedNames(item: Pick<Impegno, "tipo" | "partecipanti" | "invitati">): string[] {
  if (item.tipo !== "evento") return [];
  return item.partecipanti.filter((n) => !(item.invitati ?? []).some((i) => same(i.nome, n)));
}

export function withInvitato(item: Impegno, inv: Invitato): Impegno {
  const rest = (item.invitati ?? []).filter((i) => !same(i.nome, inv.nome));
  return { ...item, invitati: [...rest, inv] };
}

/**
 * Un impegno si può confermare solo se è completo e coerente.
 * Restituisce il motivo in italiano, oppure null se va bene.
 */
export function confirmError(item: Impegno, todayYmd: string): string | null {
  if (!item.titolo.trim()) return "Manca il titolo.";
  if (!item.data || !isValidYmd(item.data)) return "Manca la data.";
  if (item.data < todayYmd) return "La data è già passata.";
  if (item.oraInizio !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.oraInizio)) return "L'ora non è valida.";
  if (item.tipo === "evento") {
    if (!item.oraInizio) return "Manca l'ora.";
    const inv = item.invitati ?? [];
    if (inv.length === 0) return "Manca almeno un invitato.";
    if (inv.some((i) => !isEmail(i.email))) return "Un indirizzo email non è valido.";
    if (unresolvedNames(item).length) return "Manca l'indirizzo di una persona.";
  }
  return null;
}
