import { describe, expect, it, vi } from "vitest";
import { AuthError } from "../auth";
import { makeLog } from "../logger";
import { GraphWriteError } from "../services/graphHttp";
import type { AgendaReader } from "../services/graphRead";
import { handleToday, type TodayDeps } from "./today";

function setup(agenda: AgendaReader["agenda"], over: Partial<TodayDeps> = {}) {
  const lines: string[] = [];
  const reader = { agenda: vi.fn(agenda) };
  const deps: TodayDeps = { verify: async () => ({ userId: "u1", token: "tok" }), agenda: reader, now: () => new Date("2026-11-21T08:30:00Z"), log: makeLog((l) => lines.push(l)), ...over };
  return { lines, reader, call: () => handleToday(deps, { authorization: "Bearer x" }) };
}
const giorno = { data: "2026-11-21", eventi: [{ id: "e", titolo: "Riunione con Mario", inizio: "10:00", fine: "11:00", luogo: null, teams: true, persone: 1 }], promemoria: [] };

describe("handleToday", () => {
  it("restituisce i giorni letti da Graph, col token dell'utente", async () => {
    const { call, reader } = setup(async () => [giorno]);
    const out = await call();
    expect(out.status).toBe(200);
    expect(out.json).toEqual({ giorni: [giorno] });
    expect(reader.agenda).toHaveBeenCalledWith("tok", new Date("2026-11-21T08:30:00Z"));
  });
  it("permessi mancanti → messaggio chiaro", async () => {
    const out = await setup(async () => { throw new GraphWriteError("x", "permessi"); }).call();
    expect(out.status).toBe(502);
    expect(String(out.json.messaggio)).toContain("permesso");
  });
  it("altri errori → riprova più tardi", async () => {
    const out = await setup(async () => { throw new Error("x"); }).call();
    expect(out.json.error).toBe("non_disponibile");
  });
  it("senza token (sviluppo) → 503; senza accesso → 401", async () => {
    expect((await setup(async () => [], { verify: async () => ({ userId: "u1", token: null }) }).call()).status).toBe(503);
    expect((await setup(async () => [], { verify: async () => { throw new AuthError("x"); } }).call()).status).toBe(401);
  });
  it("i log non contengono titoli", async () => {
    const { call, lines } = setup(async () => [giorno]);
    await call();
    expect(lines.join("\n")).toContain("oggi.ok");
    expect(lines.join("\n")).not.toContain("Mario");
  });
});
