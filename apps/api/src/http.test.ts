import { describe, expect, it } from "vitest";
import { MAX_BODY, reply, tooLarge } from "./http";

const req = (len?: string) => ({ headers: { get: (n: string) => (n.toLowerCase() === "content-length" ? (len ?? null) : null) } });

describe("reply", () => {
  it("niente cache e nosniff su ogni risposta", () => {
    const r = reply(200, { a: 1 });
    expect(r.headers).toMatchObject({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    expect(r.status).toBe(200);
  });
});
describe("tooLarge", () => {
  it("rifiuta un corpo dichiarato più grande del massimo", () => {
    expect(tooLarge(req(String(MAX_BODY.testo + 1)), MAX_BODY.testo)?.status).toBe(413);
  });
  it.each([[String(MAX_BODY.testo)], ["0"], [undefined], ["abc"]])("lascia passare %j", (len) => {
    expect(tooLarge(req(len), MAX_BODY.testo)).toBeNull();
  });
});
