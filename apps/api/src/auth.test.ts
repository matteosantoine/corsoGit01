import { beforeAll, describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { AuthError, createVerifier } from "./auth";

const TENANT = "11111111-1111-1111-1111-111111111111";
const CLIENT = "22222222-2222-2222-2222-222222222222";
let privateKey: CryptoKey;
let publicKey: CryptoKey;
const getKey: JWTVerifyGetKey = (async () => publicKey) as JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey as CryptoKey;
  publicKey = pair.publicKey as CryptoKey;
});

const token = (claims: Record<string, unknown> = {}, opts: { aud?: string; iss?: string } = {}) =>
  new SignJWT({ scp: "access", tid: TENANT, oid: "utente-1", ...claims })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(opts.iss ?? `https://login.microsoftonline.com/${TENANT}/v2.0`)
    .setAudience(opts.aud ?? CLIENT)
    .setExpirationTime("5m")
    .sign(privateKey);

const verify = createVerifier({ tenantId: TENANT, clientId: CLIENT, getKey });

describe("createVerifier", () => {
  it("accetta un token valido e restituisce l'oid", async () => {
    const t = await token();
    expect(await verify(`Bearer ${t}`)).toEqual({ userId: "utente-1", token: t });
  });
  it("accetta anche audience api://<client>", async () => {
    await expect(verify(`Bearer ${await token({}, { aud: `api://${CLIENT}` })}`)).resolves.toBeTruthy();
  });
  it.each([
    ["header assente", async () => null],
    ["audience sbagliata", async () => `Bearer ${await token({}, { aud: "altro" })}`],
    ["emittente sbagliato", async () => `Bearer ${await token({}, { iss: "https://evil.example/" })}`],
    ["scope mancante", async () => `Bearer ${await token({ scp: "altro" })}`],
    ["tenant diverso", async () => `Bearer ${await token({ tid: "x" })}`],
    ["oid mancante", async () => `Bearer ${await token({ oid: undefined })}`],
    ["token spazzatura", async () => "Bearer abc.def.ghi"],
  ])("rifiuta: %s", async (_n, build) => {
    await expect(verify(await build())).rejects.toBeInstanceOf(AuthError);
  });
  it("bypass di sviluppo solo se esplicitamente impostato", async () => {
    const dev = createVerifier({ tenantId: TENANT, clientId: CLIENT, getKey, devBypassUser: "dev" });
    expect(await dev(null)).toEqual({ userId: "dev", token: null });
  });
});
