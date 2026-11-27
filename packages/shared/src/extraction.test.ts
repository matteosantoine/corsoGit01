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

import { ImpegnoSchema, LIMITS, EstrazioneModelSchema } from "./extraction";
describe("limiti di lunghezza dei dati definitivi", () => {
  const ok = { tipo: "evento", titolo: "x", descrizione: null, data: "2026-11-26", oraInizio: "10:00", durataMinuti: 60, modalita: null, luogo: null, partecipanti: [], priorita: "normale", mancanti: [] };
  it("rifiuta titolo, descrizione, luogo e durata fuori misura", () => {
    expect(ImpegnoSchema.safeParse({ ...ok, titolo: "x".repeat(LIMITS.titolo + 1) }).success).toBe(false);
    expect(ImpegnoSchema.safeParse({ ...ok, descrizione: "x".repeat(LIMITS.descrizione + 1) }).success).toBe(false);
    expect(ImpegnoSchema.safeParse({ ...ok, luogo: "x".repeat(LIMITS.luogo + 1) }).success).toBe(false);
    expect(ImpegnoSchema.safeParse({ ...ok, durataMinuti: 5000 }).success).toBe(false);
    expect(ImpegnoSchema.safeParse(ok).success).toBe(true);
  });
  it("rifiuta più di 20 invitati o partecipanti", () => {
    const inv = Array.from({ length: 21 }, (_, k) => ({ nome: `P${k}`, email: `p${k}@x.it`, nomeContatto: null }));
    expect(ImpegnoSchema.safeParse({ ...ok, invitati: inv }).success).toBe(false);
    expect(ImpegnoSchema.safeParse({ ...ok, partecipanti: inv.map((i) => i.nome) }).success).toBe(false);
  });
  it("email troppo lunga rifiutata", () => {
    expect(ImpegnoSchema.safeParse({ ...ok, invitati: [{ nome: "A", email: `${"a".repeat(250)}@x.it`, nomeContatto: null }] }).success).toBe(false);
  });
  it("il modello non può restituire più di 20 impegni", () => {
    const one = { tipo: "promemoria", titolo: "x", descrizione: null, data: null, oraInizio: null, durataMinuti: null, modalita: null, luogo: null, partecipanti: [], priorita: "normale" };
    expect(EstrazioneModelSchema.safeParse({ items: Array(21).fill(one) }).success).toBe(false);
    expect(EstrazioneModelSchema.safeParse({ items: Array(20).fill(one) }).success).toBe(true);
  });
});
