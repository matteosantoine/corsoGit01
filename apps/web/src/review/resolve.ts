import { unresolvedNames, type Impegno, type Invitato } from "@impegni/shared";

export type Candidate = { nome: string; email: string };

/** Primo nome citato per cui manca ancora l'indirizzo email. */
export function nextUnresolved(items: Impegno[]): { index: number; nome: string } | null {
  for (let index = 0; index < items.length; index++) {
    const nome = unresolvedNames(items[index])[0];
    if (nome) return { index, nome };
  }
  return null;
}

/** Cosa mostrare in base ai risultati della ricerca: uno → proponi, più → scelta, nessuno → chiedi l'email. */
export function candidateMode(c: Candidate[]): "one" | "many" | "none" {
  return c.length === 0 ? "none" : c.length === 1 ? "one" : "many";
}

/** Sostituisce l'elenco degli invitati tenendo allineati i nomi citati (altrimenti l'impegno sembrerebbe incompleto). */
export function setInvitati(item: Impegno, invitati: Invitato[]): Impegno {
  return { ...item, invitati, partecipanti: item.tipo === "evento" ? invitati.map((i) => i.nome) : [] };
}
