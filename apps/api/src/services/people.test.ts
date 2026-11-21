import { describe, expect, it, vi } from "vitest";
import { cleanQuery, createGraphPeople, PeopleError, toCandidates } from "./people";

const person = (name: string | null, ...emails: [string, number?][]) => ({
  displayName: name,
  scoredEmailAddresses: emails.map(([address, relevanceScore]) => ({ address, relevanceScore })),
});

describe("cleanQuery", () => {
  it("toglie virgolette e controlli, comprime gli spazi", () => {
    expect(cleanQuery('  Mario "Rossi"\n\n  ')).toBe("Mario Rossi");
  });
  it("limita la lunghezza", () => expect(cleanQuery("a".repeat(200))).toHaveLength(60));
});

describe("toCandidates", () => {
  it("sceglie l'indirizzo più rilevante di ogni persona", () => {
    expect(toCandidates([person("Mario Rossi", ["vecchio@a.it", 1], ["mario@b.com", 9])])).toEqual([{ nome: "Mario Rossi", email: "mario@b.com" }]);
  });
  it("scarta chi non ha email valida e i doppioni (anche con maiuscole)", () => {
    const r = toCandidates([person("A"), person("B", ["non-una-email"]), person("C", ["x@y.it"]), person("C bis", ["X@Y.it"])]);
    expect(r).toEqual([{ nome: "C", email: "x@y.it" }]);
  });
  it("senza nome usa l'email", () => expect(toCandidates([person(null, ["a@b.it"])])[0].nome).toBe("a@b.it"));
  it("limita il numero di risultati", () => {
    const many = Array.from({ length: 12 }, (_, i) => person(`P${i}`, [`p${i}@x.it`]));
    expect(toCandidates(many)).toHaveLength(5);
  });
});

describe("createGraphPeople", () => {
  const make = (f: typeof fetch) => createGraphPeople({ getGraphToken: async () => "graph-tok", fetchImpl: f });

  it("interroga /me/people con il token Graph e restituisce i candidati", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ value: [person("Mario Rossi", ["mario@esterna.com", 5])] })));
    const out = await make(f as unknown as typeof fetch).search("utente-tok", "Mario");
    expect(out).toEqual([{ nome: "Mario Rossi", email: "mario@esterna.com" }]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("https://graph.microsoft.com/v1.0/me/people?$search=");
    expect(decodeURIComponent(url)).toContain('$search="Mario"');
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer graph-tok");
  });
  it("non chiama Graph senza token utente o con nome vuoto", async () => {
    const f = vi.fn();
    const s = make(f as unknown as typeof fetch);
    expect(await s.search(null, "Mario")).toEqual([]);
    expect(await s.search("t", '  "" ')).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
  it("il nome con caratteri speciali non rompe l'URL", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ value: [] })));
    await make(f as unknown as typeof fetch).search("t", 'Mario&$top=999 "x"');
    const url = (f.mock.calls[0] as unknown as [string])[0];
    expect(url.match(/\$top=/g)).toHaveLength(1); // nessuna iniezione di parametri
  });
  it.each([
    ["HTTP 403", async () => new Response("no", { status: 403 })],
    ["rete assente", async () => { throw new TypeError("x"); }],
  ])("errore: %s → PeopleError", async (_n, f) => {
    await expect(make(f as unknown as typeof fetch).search("t", "Mario")).rejects.toBeInstanceOf(PeopleError);
  });
  it("scambio del token fallito → PeopleError", async () => {
    const s = createGraphPeople({ getGraphToken: async () => { throw new Error("obo"); }, fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(s.search("t", "Mario")).rejects.toBeInstanceOf(PeopleError);
  });
});
