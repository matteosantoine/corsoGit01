import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  const rules = { audio: { max: 3, windowMs: 1000 } };
  it("ammette fino al massimo e poi blocca", () => {
    let t = 0; const allow = createRateLimiter(rules, () => t);
    expect([1, 2, 3, 4].map(() => allow("u1", "audio"))).toEqual([true, true, true, false]);
  });
  it("la finestra scorre: dopo il tempo indicato si può di nuovo", () => {
    let t = 0; const allow = createRateLimiter(rules, () => t);
    for (let i = 0; i < 3; i++) allow("u1", "audio");
    expect(allow("u1", "audio")).toBe(false);
    t = 1001; expect(allow("u1", "audio")).toBe(true);
  });
  it("ogni utente ha il suo conteggio", () => {
    const allow = createRateLimiter(rules, () => 0);
    for (let i = 0; i < 3; i++) allow("u1", "audio");
    expect(allow("u1", "audio")).toBe(false);
    expect(allow("u2", "audio")).toBe(true);
  });
  it("un tentativo bloccato non allunga il blocco", () => {
    let t = 0; const allow = createRateLimiter(rules, () => t);
    for (let i = 0; i < 3; i++) allow("u1", "audio");
    t = 500; for (let i = 0; i < 50; i++) allow("u1", "audio"); // insiste
    t = 1001; expect(allow("u1", "audio")).toBe(true);
  });
  it("categorie senza regola non sono limitate", () => {
    expect(createRateLimiter(rules)("u1", "altro")).toBe(true);
  });
});
