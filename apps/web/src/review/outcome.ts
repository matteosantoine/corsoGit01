import type { Impegno } from "@impegni/shared";
import type { Risultato } from "../api/client";

export type Riga = { titolo: string; ok: boolean; testo: string };

/** Una frase per ogni impegno confermato, in parole semplici. */
export function describeOutcome(items: Impegno[], risultati: Risultato[]): Riga[] {
  return risultati.map((r) => {
    const item = items[r.indice];
    const titolo = item?.titolo ?? "Impegno";
    if (r.esito === "errore") return { titolo, ok: false, testo: r.messaggio ?? "Non sono riuscito a crearlo." };
    if (r.tipo === "evento") {
      const nomi = (item?.invitati ?? []).map((i) => i.nomeContatto ?? i.nome);
      return { titolo, ok: true, testo: `Nel calendario${nomi.length ? `. Invito inviato a ${nomi.join(", ")}` : ""}${item?.modalita === "teams" ? ", con link Teams" : ""}.` };
    }
    return { titolo, ok: true, testo: "Aggiunto a Microsoft To Do." };
  });
}

/** Ci sono ancora impegni da riprovare? */
export const hasFailures = (risultati: Risultato[]) => risultati.some((r) => r.esito === "errore");
