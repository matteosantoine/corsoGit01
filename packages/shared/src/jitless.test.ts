import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("jitless (compatibilità con le regole di sicurezza del browser)", () => {
  it("nel browser disattiva l'ottimizzazione basata su `eval`", async () => {
    vi.stubGlobal("document", {});
    vi.resetModules();
    const { z } = await import("zod");
    z.config({ jitless: false });
    await import("./jitless");
    expect(z.config().jitless).toBe(true);
  });
  it("sul server (senza document) non cambia nulla", async () => {
    vi.resetModules();
    const { z } = await import("zod");
    z.config({ jitless: false });
    await import("./jitless");
    expect(z.config().jitless).toBe(false);
  });
  it("gli schemi funzionano allo stesso modo con l'ottimizzazione disattivata", async () => {
    vi.stubGlobal("document", {});
    vi.resetModules();
    const { ImpegnoSchema } = await import("./extraction");
    expect(ImpegnoSchema.safeParse({ tipo: "boh" }).success).toBe(false);
    expect(ImpegnoSchema.safeParse({ tipo: "promemoria", titolo: "x", descrizione: null, data: null, oraInizio: null, durataMinuti: null, modalita: null, luogo: null, partecipanti: [], priorita: "normale", mancanti: ["data"] }).success).toBe(true);
  });
});
