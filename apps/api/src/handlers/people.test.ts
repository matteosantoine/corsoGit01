import { describe, expect, it, vi } from "vitest";
import { AuthError } from "../auth";
import { makeLog } from "../logger";
import { PeopleError, type PeopleSearch } from "../services/people";
import { handlePeople, type PeopleDeps } from "./people";

function setup(search: PeopleSearch["search"], over: Partial<PeopleDeps> = {}) {
  const lines: string[] = [];
  const people = { search: vi.fn(search) };
  const deps: PeopleDeps = { verify: async () => ({ userId: "u1", token: "tok-utente" }), people, log: makeLog((l) => lines.push(l)), ...over };
  return { lines, people, call: (q: string | null = "Mario") => handlePeople(deps, { authorization: "Bearer x", query: q }) };
}

describe("handlePeople", () => {
  it("passa il token dell'utente a Graph e restituisce i candidati", async () => {
    const { call, people } = setup(async () => [{ nome: "Mario Rossi", email: "m@x.it" }]);
    const out = await call();
    expect(out.json).toEqual({ candidati: [{ nome: "Mario Rossi", email: "m@x.it" }] });
    expect(people.search).toHaveBeenCalledWith("tok-utente", "Mario");
  });
  it("nessun risultato → elenco vuoto", async () => {
    expect((await setup(async () => []).call()).json).toEqual({ candidati: [] });
  });
  it("se Graph non risponde non blocca: elenco vuoto e segnalazione", async () => {
    const out = await setup(async () => { throw new PeopleError("x"); }).call();
    expect(out.status).toBe(200);
    expect(out.json).toEqual({ candidati: [], nonDisponibile: true });
  });
  it.each([[null], [""], ["   "]])("nome %j → 400", async (q) => {
    const { call, people } = setup(async () => []);
    expect((await call(q)).status).toBe(400);
    expect(people.search).not.toHaveBeenCalled();
  });
  it("senza accesso → 401 e Graph non viene chiamato", async () => {
    const { call, people } = setup(async () => [], { verify: async () => { throw new AuthError("x"); } });
    expect((await call()).status).toBe(401);
    expect(people.search).not.toHaveBeenCalled();
  });
  it("i log non contengono il nome cercato né le email", async () => {
    const { call, lines } = setup(async () => [{ nome: "Mario Rossi", email: "mario@segreto.it" }]);
    await call("Mario Rossi");
    const all = lines.join("\n");
    expect(all).toContain("people.ok");
    expect(all).not.toContain("Mario");
    expect(all).not.toContain("segreto");
  });
});
