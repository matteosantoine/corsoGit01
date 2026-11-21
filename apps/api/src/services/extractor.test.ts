import { describe, expect, it, vi } from "vitest";
import { createOpenAiExtractor, ExtractionError, IMPEGNI_JSON_SCHEMA } from "./extractor";

const ctx = { now: new Date("2026-11-21T08:30:00Z"), defaultDurationMin: 60 };
const item = {
  tipo: "evento", titolo: "Riunione", descrizione: null, data: "2026-11-26", oraInizio: "10:00",
  durataMinuti: null, modalita: "teams", luogo: null, partecipanti: ["Mario"], priorita: "normale",
};
const reply = (content: unknown, extra: object = {}) =>
  new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) }, ...extra }] }));
const make = (f: typeof fetch) =>
  createOpenAiExtractor({ endpoint: "https://x.openai.azure.com/", deployment: "estrazione", getToken: async () => "tok", fetchImpl: f });

describe("createOpenAiExtractor", () => {
  it("chiama il deployment con structured outputs strict, temperatura 0, e il testo tra delimitatori", async () => {
    const f = vi.fn(async () => reply({ items: [item] }));
    const out = await make(f as unknown as typeof fetch).extract("giovedì alle dieci Mario", ctx);
    expect(out).toHaveLength(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x.openai.azure.com/openai/deployments/estrazione/chat/completions?api-version=2024-10-21");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const body = JSON.parse(init.body as string);
    expect(body.temperature).toBe(0);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages[0].content).toContain("- giovedì 2026-11-26 (settimana prossima)");
    expect(body.messages[1].content).toContain('"""\ngiovedì alle dieci Mario\n"""');
  });

  it("lo schema strict elenca tutti i campi come obbligatori", () => {
    const item = IMPEGNI_JSON_SCHEMA.properties.items.items;
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort());
    expect(item.additionalProperties).toBe(false);
  });

  it.each([
    ["HTTP 429", async () => new Response("x", { status: 429 })],
    ["rete assente", async () => { throw new TypeError("fetch failed"); }],
    ["JSON non valido", async () => new Response(JSON.stringify({ choices: [{ message: { content: "non json" } }] }))],
    ["struttura sbagliata", async () => reply({ items: [{ titolo: 1 }] })],
    ["rifiuto del modello", async () => new Response(JSON.stringify({ choices: [{ message: { content: null, refusal: "no" } }] }))],
    ["risposta troncata", async () => reply({ items: [] }, { finish_reason: "length" })],
  ])("errore: %s → ExtractionError", async (_n, f) => {
    await expect(make(f as unknown as typeof fetch).extract("x", ctx)).rejects.toBeInstanceOf(ExtractionError);
  });
});
