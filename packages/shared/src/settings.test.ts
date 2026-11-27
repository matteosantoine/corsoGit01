import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SettingsSchema, withDefaults } from "./settings";

describe("SettingsSchema", () => {
  it("accetta valori ammessi", () => {
    expect(SettingsSchema.safeParse({ durataMinuti: 45, anticipoMinuti: 0, linkTeams: false, conservazioneGiorni: 30 }).success).toBe(true);
  });
  it.each([
    [{ durataMinuti: 50, anticipoMinuti: 15, linkTeams: true }],
    [{ durataMinuti: 60, anticipoMinuti: -5, linkTeams: true, conservazioneGiorni: 90 }],
    [{ durataMinuti: 60, anticipoMinuti: 15, linkTeams: "si", conservazioneGiorni: 90 }],
    [{ durataMinuti: 60, anticipoMinuti: 15, linkTeams: true, conservazioneGiorni: 0 }], // "mai" non è ammesso
    [{ durataMinuti: 60, anticipoMinuti: 15, linkTeams: true, conservazioneGiorni: 7 }],
    [{ durataMinuti: 60, anticipoMinuti: 15, linkTeams: true, conservazioneGiorni: 3650 }],
    [{ durataMinuti: 60, anticipoMinuti: 15 }],
  ])("rifiuta %j", (v) => expect(SettingsSchema.safeParse(v).success).toBe(false));
});

describe("withDefaults", () => {
  it("la conservazione predefinita è di 90 giorni", () => expect(DEFAULT_SETTINGS.conservazioneGiorni).toBe(90));
  it("niente salvato → predefiniti", () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
  });
  it("tiene i valori validi e ripristina solo quelli non validi", () => {
    expect(withDefaults({ durataMinuti: 30, anticipoMinuti: 7, linkTeams: false })).toEqual({ durataMinuti: 30, anticipoMinuti: 15, linkTeams: false, conservazioneGiorni: 90 });
  });
});
