import { describe, expect, it } from "vitest";
import { resolveDevBypass } from "./config";

describe("resolveDevBypass", () => {
  it("non impostato → nessuna scorciatoia", () => {
    expect(resolveDevBypass({})).toBeUndefined();
    expect(resolveDevBypass({ DEV_AUTH_BYPASS_USER: "  " })).toBeUndefined();
  });
  it("in sviluppo locale → utente indicato", () => {
    expect(resolveDevBypass({ DEV_AUTH_BYPASS_USER: "dev", AZURE_FUNCTIONS_ENVIRONMENT: "Development" })).toBe("dev");
  });
  it.each([
    ["produzione", { AZURE_FUNCTIONS_ENVIRONMENT: "Production" }],
    ["ambiente non indicato", {}],
    ["dentro Azure, anche se dice Development", { AZURE_FUNCTIONS_ENVIRONMENT: "Development", WEBSITE_SITE_NAME: "impegni-api" }],
  ])("%s → l'app non parte", (_n, env) => {
    expect(() => resolveDevBypass({ DEV_AUTH_BYPASS_USER: "dev", ...env })).toThrow(/solo in sviluppo locale/);
  });
});
