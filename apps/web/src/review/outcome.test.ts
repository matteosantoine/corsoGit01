import { describe, expect, it } from "vitest";
import type { Impegno } from "@impegni/shared";
import { describeOutcome, hasFailures } from "./outcome";

const ev: Impegno = {
  tipo: "evento", titolo: "Riunione", descrizione: null, data: "2026-11-26", oraInizio: "10:00", durataMinuti: 60, modalita: "teams",
  luogo: null, partecipanti: ["Mario", "Anna"], priorita: "normale", mancanti: [],
  invitati: [{ nome: "Mario", email: "m@x.it", nomeContatto: "Mario Rossi" }, { nome: "Anna", email: "a@x.it", nomeContatto: null }],
};
const pr: Impegno = { ...ev, tipo: "promemoria", titolo: "Bolletta", modalita: null, invitati: [], partecipanti: [] };

describe("describeOutcome", () => {
  it("evento: calendario, invitati e Teams", () => {
    const [r] = describeOutcome([ev], [{ indice: 0, tipo: "evento", esito: "creato" }]);
    expect(r).toEqual({ titolo: "Riunione", ok: true, testo: "Nel calendario. Invito inviato a Mario Rossi, Anna, con link Teams." });
  });
  it("promemoria: To Do", () => {
    expect(describeOutcome([pr], [{ indice: 0, tipo: "promemoria", esito: "creato" }])[0].testo).toBe("Aggiunto a Microsoft To Do.");
  });
  it("errore: mostra il messaggio del server", () => {
    const [r] = describeOutcome([ev], [{ indice: 0, tipo: "evento", esito: "errore", messaggio: "Riprova tra poco." }]);
    expect(r).toMatchObject({ ok: false, testo: "Riprova tra poco." });
  });
  it("già creato conta come riuscito", () => {
    expect(describeOutcome([pr], [{ indice: 0, tipo: "promemoria", esito: "gia_creato" }])[0].ok).toBe(true);
  });
  it("hasFailures", () => {
    expect(hasFailures([{ indice: 0, tipo: "evento", esito: "creato" }])).toBe(false);
    expect(hasFailures([{ indice: 0, tipo: "evento", esito: "errore" }])).toBe(true);
  });
});
