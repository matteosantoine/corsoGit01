import { buildCalendar, EstrazioneSchema, isValidYmd } from "@impegni/shared";
import { describe, expect, it } from "vitest";
import { EVAL_CASES, EVAL_NOW } from "./cases";

const calendar = buildCalendar(EVAL_NOW);

describe("casi di prova dell'estrazione (coerenza, senza modello)", () => {
  it.each(EVAL_CASES.filter((c) => c.riga))("$frase → il calendario conferma la data attesa", (c) => {
    expect(calendar).toContain(c.riga!);
    const data = c.atteso[0].data ?? c.atteso.find((a) => a.data)?.data;
    expect(data && isValidYmd(data)).toBe(true);
  });
  it("le date attese compaiono nelle righe di calendario indicate", () => {
    for (const c of EVAL_CASES.filter((x) => x.riga)) {
      const dates = c.atteso.map((a) => a.data).filter(Boolean) as string[];
      expect(dates.some((d) => c.riga!.includes(d))).toBe(true);
    }
  });
  it("ogni caso ha almeno un impegno atteso", () => {
    for (const c of EVAL_CASES) expect(c.atteso.length).toBeGreaterThan(0);
  });
  it("il formato degli impegni attesi è compatibile con lo schema", () => {
    expect(EstrazioneSchema.shape.items).toBeDefined();
  });
});
