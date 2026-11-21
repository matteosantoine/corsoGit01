import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SettingsSchema, withDefaults } from "./settings";

describe("SettingsSchema", () => {
  it("accetta valori ammessi", () => {
    expect(SettingsSchema.safeParse({ durataMinuti: 45, anticipoMinuti: 0, linkTeams: false }).success).toBe(true);
  });
  it.each([
    [{ durataMinuti: 50, anticipoMinuti: 15, linkTeams: true }],
    [{ durataMinuti: 60, anticipoMinuti: -5, linkTeams: true }],
    [{ durataMinuti: 60, anticipoMinuti: 15, linkTeams: "si" }],
    [{ durataMinuti: 60, anticipoMinuti: 15 }],
  ])("rifiuta %j", (v) => expect(SettingsSchema.safeParse(v).success).toBe(false));
});

describe("withDefaults", () => {
  it("niente salvato → predefiniti", () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
  });
  it("tiene i valori validi e ripristina solo quelli non validi", () => {
    expect(withDefaults({ durataMinuti: 30, anticipoMinuti: 7, linkTeams: false })).toEqual({ durataMinuti: 30, anticipoMinuti: 15, linkTeams: false });
  });
});
