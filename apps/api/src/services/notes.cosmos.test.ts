import { describe, expect, it } from "vitest";
import { buildListQuery } from "./notes.cosmos";

const HOSTILE = [
  "' OR 1=1 --", '"; DROP CONTAINER notes; --', "x') OR (1=1", "\\' UNION SELECT * FROM c WHERE c.userId != '", "}{ @u", "a\u0000b", "%' OR '1'='1",
];

describe("buildListQuery — nessuna iniezione", () => {
  it.each(HOSTILE)("il testo ostile %j finisce solo nei parametri, mai nella query", (evil) => {
    const { query, parameters } = buildListQuery("utente-1", { q: evil, before: evil, limit: 20 });
    expect(query).not.toContain(evil);
    expect(query).not.toMatch(/OR 1=1|DROP|UNION/i);
    expect(parameters.find((p) => p.name === "@q")!.value).toBe(evil.toLowerCase());
    expect(parameters.find((p) => p.name === "@b")!.value).toBe(evil);
  });
  it("la query ha sempre il filtro sull'utente, anche con input ostili", () => {
    for (const evil of HOSTILE) expect(buildListQuery("utente-1", { q: evil, limit: 5 }).query).toContain("c.userId = @u");
  });
  it("l'identificativo dell'utente è un parametro", () => {
    const { query, parameters } = buildListQuery("u'; DROP", { limit: 5 });
    expect(query).not.toContain("DROP");
    expect(parameters[0]).toEqual({ name: "@u", value: "u'; DROP" });
  });
  it("il limite è sempre un numero tra 1 e 100", () => {
    const n = (limit: number) => buildListQuery("u", { limit }).parameters.find((p) => p.name === "@n")!.value;
    expect([n(0), n(21), n(5000), n(-3), n(NaN as unknown as number)]).toEqual([1, 21, 100, 1, 1]);
  });
  it("senza ricerca né cursore la query resta semplice", () => {
    expect(buildListQuery("u", { limit: 20 }).query).toBe("SELECT * FROM c WHERE c.userId = @u ORDER BY c.createdAt DESC OFFSET 0 LIMIT @n");
  });
});
