import type { Configuration } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;

export const isAuthConfigured = Boolean(clientId && tenantId);

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId ?? "00000000-0000-0000-0000-000000000000",
    authority: `https://login.microsoftonline.com/${tenantId ?? "common"}`,
    redirectUri: window.location.origin,
  },
  // localStorage: il login resta valido anche dopo aver chiuso l'app sul telefono.
  cache: { cacheLocation: "localStorage" },
};

const apiScope = import.meta.env.VITE_API_SCOPE;
export const apiScopes = apiScope ? [apiScope] : [];
export const loginRequest = { scopes: apiScopes.length ? apiScopes : ["User.Read"] };
