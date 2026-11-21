import { describe, expect, it } from "vitest";
import { EstrazioneSchema } from "./extraction";

const valido = {
  tipo: "evento", titolo: "Riunione", descrizione: null, data: "2026-11-26",
  oraInizio: "10:00", durataMinuti: 60, modalita: "teams", luogo: null,
  partecipanti: ["Mario"], priorita: "normale", mancanti: [],
};

describe("EstrazioneSchema", () => {
  it("accetta un impegno valido", () => {
    expect(EstrazioneSchema.safeParse({ items: [valido] }).success).toBe(true);
  });
  it("rifiuta ora non valida", () => {
    expect(EstrazioneSchema.safeParse({ items: [{ ...valido, oraInizio: "25:99" }] }).success).toBe(false);
  });
  it("rifiuta data in formato sbagliato", () => {
    expect(EstrazioneSchema.safeParse({ items: [{ ...valido, data: "26/11/2026" }] }).success).toBe(false);
  });
});
