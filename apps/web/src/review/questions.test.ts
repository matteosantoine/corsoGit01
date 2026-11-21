import { describe, expect, it } from "vitest";
import type { Impegno } from "@impegni/shared";
import { applyAnswer, describeWhen, nextQuestion, parseNames, quickDates, todayLocal } from "./questions";

const base: Impegno = {
  tipo: "evento", titolo: "Riunione", descrizione: null, data: null, oraInizio: null, durataMinuti: 60,
  modalita: null, luogo: null, partecipanti: [], priorita: "normale", mancanti: ["data", "ora", "partecipanti"],
};

describe("nextQuestion", () => {
  it("chiede un dato alla volta, nell'ordine data → ora → partecipanti", () => {
    let item = base;
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const q = nextQuestion([item]);
      if (!q) break;
      asked.push(q.field);
      item = applyAnswer(item, q.field === "partecipanti" ? { field: "partecipanti", value: ["Mario"] } : { field: q.field, value: q.field === "data" ? "2026-11-26" : "10:00" });
    }
    expect(asked).toEqual(["data", "ora", "partecipanti"]);
    expect(item.mancanti).toEqual([]);
  });
  it("passa al secondo impegno quando il primo è completo", () => {
    const done = { ...base, mancanti: [] as Impegno["mancanti"] };
    expect(nextQuestion([done, base])).toEqual({ index: 1, field: "data" });
    expect(nextQuestion([done])).toBeNull();
  });
});

describe("applyAnswer", () => {
  it("'nessuno' trasforma l'evento in promemoria e non chiede più nulla oltre alla data", () => {
    const e = applyAnswer({ ...base, data: "2026-11-26", oraInizio: "10:00", mancanti: ["partecipanti"] }, { field: "partecipanti", value: "nessuno" });
    expect(e.tipo).toBe("promemoria");
    expect(e.mancanti).toEqual([]);
    expect(e.durataMinuti).toBeNull();
  });
  it("più nomi", () => {
    expect(applyAnswer(base, { field: "partecipanti", value: ["Mario", " Anna "] }).partecipanti).toEqual(["Mario", "Anna"]);
  });
  it("non modifica l'originale", () => {
    applyAnswer(base, { field: "data", value: "2026-11-26" });
    expect(base.data).toBeNull();
  });
});

describe("date rapide", () => {
  const now = new Date(2026, 10, 30, 23, 30); // 30/11/2026 23:30 ora locale
  it("todayLocal usa la data del dispositivo", () => expect(todayLocal(now)).toBe("2026-11-30"));
  it("oggi, domani, dopodomani attraversano il mese", () => {
    expect(quickDates(now).map((d) => d.value)).toEqual(["2026-11-30", "2026-12-01", "2026-12-02"]);
  });
});

describe("parseNames", () => {
  it("separa con virgole e 'e'", () => {
    expect(parseNames("Mario, Anna e Luca")).toEqual(["Mario", "Anna", "Luca"]);
    expect(parseNames("  Giulia  ")).toEqual(["Giulia"]);
    expect(parseNames("")).toEqual([]);
  });
});

describe("describeWhen", () => {
  it("scrive giorno, mese e ora in italiano", () => {
    expect(describeWhen({ data: "2026-11-26", oraInizio: "10:00" })).toBe("giovedì 26 novembre, ore 10:00");
  });
  it("senza data", () => expect(describeWhen({ data: null, oraInizio: null })).toBe("data da decidere"));
});
