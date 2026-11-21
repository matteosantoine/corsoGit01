import { describe, expect, it } from "vitest";
import { dayTitle, durataLabel, noteWhen, statoLabel, timeRange } from "./format";

describe("dayTitle", () => {
  it("oggi e domani", () => {
    expect(dayTitle("2026-11-21", "2026-11-21")).toBe("Oggi, sabato 21 novembre");
    expect(dayTitle("2026-11-22", "2026-11-21")).toBe("Domani, domenica 22 novembre");
  });
  it("altro giorno senza etichetta", () => expect(dayTitle("2026-11-25", "2026-11-21")).toBe("mercoledì 25 novembre"));
  it("attraversa il mese", () => expect(dayTitle("2026-12-01", "2026-11-30")).toBe("Domani, martedì 1 dicembre"));
});

describe("timeRange", () => {
  it("intervallo, tutto il giorno, mezzanotte, ora sola", () => {
    expect(timeRange("10:00", "11:00")).toBe("10:00–11:00");
    expect(timeRange(null, null)).toBe("Tutto il giorno");
    expect(timeRange("22:00", "24:00")).toBe("22:00–00:00");
    expect(timeRange("10:00", "10:00")).toBe("10:00");
  });
});

describe("noteWhen", () => {
  it("giorno e ora in italiano", () => {
    expect(noteWhen(new Date(2026, 10, 26, 10, 15).toISOString())).toBe("giovedì 26 novembre, 10:15");
  });
});

describe("statoLabel", () => {
  it("parole semplici per ogni stato", () => {
    expect(statoLabel("creato", "evento")).toEqual({ testo: "Nel calendario", tono: "ok" });
    expect(statoLabel("creato", "promemoria")).toEqual({ testo: "In To Do", tono: "ok" });
    expect(statoLabel("scartato", "evento").testo).toBe("Scartato");
    expect(statoLabel("confermato", "evento").tono).toBe("attesa");
    expect(statoLabel("da_confermare", "evento").testo).toBe("Non confermato");
  });
});

describe("durataLabel", () => {
  it("minuti e ore", () => {
    expect([15, 45, 60, 90, 120].map(durataLabel)).toEqual(["15 minuti", "45 minuti", "1 ora", "1 ora e 30 minuti", "2 ore"]);
  });
});
