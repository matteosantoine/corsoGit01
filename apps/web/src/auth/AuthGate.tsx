import { useEffect, useState, type ReactNode } from "react";
import {
  InteractionStatus,
  PublicClientApplication,
  type AccountInfo,
} from "@azure/msal-browser";
import { MsalProvider, useIsAuthenticated, useMsal } from "@azure/msal-react";
import { apiScopes, isAuthConfigured, loginRequest, msalConfig } from "./config";

const msal = new PublicClientApplication(msalConfig);

function Login() {
  const { instance, inProgress } = useMsal();
  const [error, setError] = useState<string | null>(null);
  const busy = inProgress !== InteractionStatus.None;
  return (
    <main className="screen center">
      <h1>Impegni</h1>
      <p className="lead">Accedi con il tuo account aziendale.</p>
      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={() =>
          instance.loginRedirect(loginRequest).catch(() =>
            setError("Non sono riuscito ad accedere. Riprova."),
          )
        }
      >
        {busy ? "Attendi…" : "Accedi"}
      </button>
      {error && <p role="alert" className="error">{error}</p>}
    </main>
  );
}

function Gate({ children }: { children: (account: AccountInfo | null) => ReactNode }) {
  const authed = useIsAuthenticated();
  const { accounts } = useMsal();
  return authed ? <>{children(accounts[0] ?? null)}</> : <Login />;
}

export function AuthGate({ children }: { children: (account: AccountInfo | null) => ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isAuthConfigured) return;
    msal.initialize().then(() => msal.handleRedirectPromise()).finally(() => setReady(true));
  }, []);

  if (!isAuthConfigured) {
    // Solo in sviluppo locale si può provare l'app senza login.
    if (import.meta.env.DEV) return <>{children(null)}</>;
    return (
      <main className="screen center">
        <h1>Impegni</h1>
        <p className="error" role="alert">
          L'app non è ancora configurata. Contatta chi l'ha installata.
        </p>
      </main>
    );
  }
  if (!ready) return <main className="screen center"><p className="lead">Caricamento…</p></main>;
  return (
    <MsalProvider instance={msal}>
      <Gate>{children}</Gate>
    </MsalProvider>
  );
}

export async function signOut() {
  await msal.logoutRedirect();
}

/** Token per chiamare il nostro backend. null = serve un nuovo accesso. */
export async function getApiToken(): Promise<string | null> {
  const account = msal.getAllAccounts()[0];
  if (!account) return null;
  try {
    return (await msal.acquireTokenSilent({ scopes: apiScopes, account })).accessToken;
  } catch {
    return null;
  }
}
