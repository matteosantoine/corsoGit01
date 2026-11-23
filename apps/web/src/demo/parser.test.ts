import { describe, expect, it } from "vitest";
import { parseSentence } from "./parser";

const NOW = new Date("2026-11-21T08:30:00Z"); // sabato 21/11/2026, 09:30 a Roma
const one = (s: string) => parseSentence(s, NOW)[0];

describe("interprete dell'anteprima (non è l'AI vera)", () => {
  it("'giovedì prossimo' = giovedì della settimana successiva; Teams e nome con cognome", () => {
    expect(one("Giovedì prossimo alle dieci riunione con Mario Rossi su Teams")).toMatchObject({
      tipo: "evento", data: "2026-11-26", oraInizio: "10:00", modalita: "teams", partecipanti: ["Mario Rossi"], titolo: "Riunione con Mario Rossi",
    });
  });
  it("giorno semplice = prima occorrenza da domani; più nomi; ora mancante", () => {
    expect(one("Lunedì pranzo con Anna e Luca")).toMatchObject({ tipo: "evento", data: "2026-11-23", oraInizio: null, partecipanti: ["Anna", "Luca"], titolo: "Pranzo con Anna e Luca" });
  });
  it("promemoria con 'domani alle 15'", () => {
    expect(one("Domani alle 15 chiamare il commercialista")).toMatchObject({ tipo: "promemoria", data: "2026-11-22", oraInizio: "15:00", titolo: "Chiamare il commercialista" });
  });
  it("senza data → null (verrà chiesta)", () => {
    expect(one("Chiama Mario")).toMatchObject({ tipo: "promemoria", data: null, titolo: "Chiama Mario" });
  });
  it("'tra due settimane martedì alle 9'", () => {
    expect(one("Tra due settimane martedì alle 9 call con Elena")).toMatchObject({ data: "2026-12-01", oraInizio: "09:00", partecipanti: ["Elena"] });
  });
  it("più impegni in una frase", () => {
    const r = parseSentence("Giovedì prossimo alle dieci riunione con Mario Rossi su Teams e ricordami di pagare la bolletta venerdì", NOW);
    expect(r.map((x) => [x.tipo, x.titolo, x.data])).toEqual([["evento", "Riunione con Mario Rossi", "2026-11-26"], ["promemoria", "Pagare la bolletta", "2026-11-27"]]);
  });
  it("ore 'tre e mezza' = 15:30; in sede = presenza", () => {
    expect(one("Oggi alle tre e mezza riunione con Giulia in sede")).toMatchObject({ oraInizio: "15:30", modalita: "presenza", luogo: "In sede" });
  });
  it("riunione senza nomi: evento senza partecipanti (l'app li chiederà)", () => {
    expect(one("Domani alle 11 riunione")).toMatchObject({ tipo: "evento", partecipanti: [] });
  });
  it("frasi che non sono impegni vengono ignorate", () => {
    expect(parseSentence("Che bella giornata", NOW)).toEqual([]);
  });
});
