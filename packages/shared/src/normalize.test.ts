import { describe, expect, it } from "vitest";
import type { ImpegnoModel } from "./extraction";
import { computeMancanti, normalizeItems } from "./normalize";

const NOW = new Date("2026-11-21T08:30:00Z"); // sabato 21/11/2026 09:30 Roma
const opts = { now: NOW, defaultDurationMin: 60 };
const m = (o: Partial<ImpegnoModel> = {}): ImpegnoModel => ({
  tipo: "evento", titolo: "Riunione", descrizione: null, data: "2026-11-26", oraInizio: "10:00",
  durataMinuti: null, modalita: null, luogo: null, partecipanti: ["Mario"], priorita: "normale", ...o,
});

describe("computeMancanti", () => {
  it("evento completo: nulla manca", () =>
    expect(computeMancanti({ tipo: "evento", data: "2026-11-26", oraInizio: "10:00", partecipanti: ["A"] })).toEqual([]));
  it("evento vuoto: data, ora, partecipanti", () =>
    expect(computeMancanti({ tipo: "evento", data: null, oraInizio: null, partecipanti: [] })).toEqual(["data", "ora", "partecipanti"]));
  it("promemoria: serve solo la data", () => {
    expect(computeMancanti({ tipo: "promemoria", data: null, oraInizio: null, partecipanti: [] })).toEqual(["data"]);
    expect(computeMancanti({ tipo: "promemoria", data: "2026-11-26", oraInizio: null, partecipanti: [] })).toEqual([]);
  });
});

describe("normalizeItems — link Teams predefinito", () => {
  const t = { ...opts, defaultTeams: true };
  it("aggiunge Teams a un incontro senza modalità né luogo", () => {
    expect(normalizeItems([m({ modalita: null })], t)[0].modalita).toBe("teams");
  });
  it("non lo aggiunge se c'è un luogo o se l'utente ha detto 'presenza'", () => {
    expect(normalizeItems([m({ modalita: null, luogo: "Sala A" })], t)[0].modalita).toBeNull();
    expect(normalizeItems([m({ modalita: "presenza" })], t)[0].modalita).toBe("presenza");
  });
  it("disattivato: resta com'è; i promemoria non hanno mai Teams", () => {
    expect(normalizeItems([m({ modalita: null })], { ...opts, defaultTeams: false })[0].modalita).toBeNull();
    expect(normalizeItems([m({ tipo: "promemoria", modalita: null, partecipanti: [] })], t)[0].modalita).toBeNull();
  });
});

describe("normalizeItems — limiti sui contenuti", () => {
  it("accorcia titolo, descrizione, luogo e nomi esagerati invece di fallire", () => {
    const [i] = normalizeItems([m({ titolo: "T".repeat(500), descrizione: "D".repeat(5000), luogo: "L".repeat(500), partecipanti: ["N".repeat(300)] })], opts);
    expect(i.titolo).toHaveLength(200);
    expect(i.descrizione).toHaveLength(2000);
    expect(i.luogo).toHaveLength(200);
    expect(i.partecipanti[0]).toHaveLength(100);
  });
  it("al massimo 20 partecipanti (niente raffica di inviti)", () => {
    const many = Array.from({ length: 80 }, (_, k) => `Persona${k}`);
    expect(normalizeItems([m({ partecipanti: many })], opts)[0].partecipanti).toHaveLength(20);
  });
  it("durata assurda → quella predefinita", () => {
    expect(normalizeItems([m({ durataMinuti: 99999 })], opts)[0].durataMinuti).toBe(60);
    expect(normalizeItems([m({ durataMinuti: -5 })], opts)[0].durataMinuti).toBe(60);
    expect(normalizeItems([m({ durataMinuti: 90 })], opts)[0].durataMinuti).toBe(90);
  });
});

describe("normalizeItems", () => {
  it("applica la durata predefinita agli eventi", () => {
    expect(normalizeItems([m()], opts)[0].durataMinuti).toBe(60);
    expect(normalizeItems([m({ durataMinuti: 30 })], opts)[0].durataMinuti).toBe(30);
  });
  it("promemoria: niente durata né modalità", () => {
    const [i] = normalizeItems([m({ tipo: "promemoria", durataMinuti: 45, modalita: "teams", partecipanti: [] })], opts);
    expect(i.durataMinuti).toBeNull();
    expect(i.modalita).toBeNull();
    expect(i.mancanti).toEqual([]);
  });
  it("data nel passato → mancante, non indovinata", () => {
    const [i] = normalizeItems([m({ data: "2026-11-10" })], opts);
    expect(i.data).toBeNull();
    expect(i.mancanti).toContain("data");
  });
  it("data inesistente → mancante", () => {
    expect(normalizeItems([m({ data: "2026-02-30" })], opts)[0].mancanti).toContain("data");
  });
  it("oggi con ora già passata → ora mancante", () => {
    const [i] = normalizeItems([m({ data: "2026-11-21", oraInizio: "08:00" })], opts);
    expect(i.data).toBe("2026-11-21");
    expect(i.mancanti).toContain("ora");
  });
  it("oggi con ora futura va bene", () => {
    expect(normalizeItems([m({ data: "2026-11-21", oraInizio: "17:00" })], opts)[0].mancanti).toEqual([]);
  });
  it("corregge ore scritte male e scarta quelle impossibili", () => {
    expect(normalizeItems([m({ oraInizio: "9:30" })], opts)[0].oraInizio).toBe("09:30");
    expect(normalizeItems([m({ oraInizio: "9.05" })], opts)[0].oraInizio).toBe("09:05");
    expect(normalizeItems([m({ oraInizio: "25:00" })], opts)[0].oraInizio).toBeNull();
    expect(normalizeItems([m({ oraInizio: "alle dieci" })], opts)[0].mancanti).toContain("ora");
  });
  it("toglie 'io', doppioni e nomi vuoti dai partecipanti", () => {
    const [i] = normalizeItems([m({ partecipanti: ["Mario", " mario ", "io", "", "Anna"] })], opts);
    expect(i.partecipanti).toEqual(["Mario", "Anna"]);
  });
  it("scarta titoli vuoti e impegni doppi", () => {
    expect(normalizeItems([m({ titolo: "  " }), m(), m()], opts)).toHaveLength(1);
  });
  it("evento senza partecipanti → chiede chi", () => {
    expect(normalizeItems([m({ partecipanti: [] })], opts)[0].mancanti).toEqual(["partecipanti"]);
  });
});
