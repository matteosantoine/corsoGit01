import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/** `token` è il token Microsoft dell'utente (serve per chiamare Graph per suo conto); null nel bypass di sviluppo. */
export type AuthUser = { userId: string; token: string | null };
export type Verifier = (authorization: string | null) => Promise<AuthUser>;

export class AuthError extends Error {}

type Options = {
  tenantId: string;
  clientId: string;
  /** Solo per i test: chiave di verifica al posto del JWKS di Microsoft. */
  getKey?: JWTVerifyGetKey;
  /** Solo sviluppo locale: utente fisso senza token. Non impostare mai in Azure. */
  devBypassUser?: string;
};

export function createVerifier(opts: Options): Verifier {
  const getKey =
    opts.getKey ??
    createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${opts.tenantId}/discovery/v2.0/keys`));

  return async (authorization) => {
    if (opts.devBypassUser) return { userId: opts.devBypassUser, token: null };
    const match = authorization?.match(/^Bearer (.+)$/i);
    if (!match) throw new AuthError("token mancante");
    try {
      const { payload } = await jwtVerify(match[1], getKey, {
        issuer: `https://login.microsoftonline.com/${opts.tenantId}/v2.0`,
        audience: [opts.clientId, `api://${opts.clientId}`],
        // Solo RS256 (quello di Microsoft Entra): niente "none" né algoritmi a chiave condivisa.
        algorithms: ["RS256"],
        requiredClaims: ["exp", "oid", "scp"],
      });
      const scopes = String(payload.scp ?? "").split(" ");
      if (!scopes.includes("access")) throw new AuthError("scope mancante");
      if (payload.tid !== opts.tenantId) throw new AuthError("tenant non valido");
      // Il token deve essere stato chiesto dalla nostra app (azp), non da un'altra app dello stesso tenant.
      if (payload.azp !== undefined && payload.azp !== opts.clientId) throw new AuthError("app non valida");
      const oid = payload.oid;
      if (typeof oid !== "string" || !oid) throw new AuthError("utente non valido");
      return { userId: oid, token: match[1] };
    } catch (e) {
      throw e instanceof AuthError ? e : new AuthError("token non valido");
    }
  };
}
