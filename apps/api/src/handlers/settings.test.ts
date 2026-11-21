import { describe, expect, it } from "vitest";
import { AuthError } from "../auth";
import { makeLog } from "../logger";
import { createMemorySettings } from "../services/settings";
import { handleGetSettings, handlePutSettings, type SettingsDeps } from "./settings";

function setup(over: Partial<SettingsDeps> = {}) {
  const settings = createMemorySettings();
  const deps: SettingsDeps = { verify: async () => ({ userId: "u1", token: null }), settings, log: makeLog(() => {}), ...over };
  return { settings, deps };
}
const ok = { durataMinuti: 45, anticipoMinuti: 30, linkTeams: false };

describe("impostazioni", () => {
  it("senza nulla di salvato restituisce i valori predefiniti", async () => {
    const { deps } = setup();
    expect((await handleGetSettings(deps, { authorization: "x" })).json).toEqual({ impostazioni: { durataMinuti: 60, anticipoMinuti: 15, linkTeams: true } });
  });
  it("salva e rilegge", async () => {
    const { deps } = setup();
    expect((await handlePutSettings(deps, { authorization: "x", body: ok })).status).toBe(200);
    expect((await handleGetSettings(deps, { authorization: "x" })).json).toEqual({ impostazioni: ok });
  });
  it.each([[{ ...ok, durataMinuti: 50 }], [{ ...ok, linkTeams: "si" }], [{}], [null]])("rifiuta %j senza salvare", async (body) => {
    const { deps, settings } = setup();
    expect((await handlePutSettings(deps, { authorization: "x", body })).status).toBe(400);
    expect(settings.store.size).toBe(0);
  });
  it("ognuno vede solo le proprie", async () => {
    const { deps } = setup();
    await handlePutSettings(deps, { authorization: "x", body: ok });
    const other = { ...deps, verify: async () => ({ userId: "u2", token: null }) };
    expect(((await handleGetSettings(other, { authorization: "x" })).json.impostazioni as { durataMinuti: number }).durataMinuti).toBe(60);
  });
  it("lettura fallita → predefiniti; salvataggio fallito → 500", async () => {
    const { deps } = setup({ settings: { get: async () => { throw new Error("x"); }, put: async () => { throw new Error("x"); } } });
    expect((await handleGetSettings(deps, { authorization: "x" })).status).toBe(200);
    expect((await handlePutSettings(deps, { authorization: "x", body: ok })).status).toBe(500);
  });
  it("senza accesso → 401", async () => {
    const { deps } = setup({ verify: async () => { throw new AuthError("x"); } });
    expect((await handleGetSettings(deps, { authorization: null })).status).toBe(401);
    expect((await handlePutSettings(deps, { authorization: null, body: ok })).status).toBe(401);
  });
});
