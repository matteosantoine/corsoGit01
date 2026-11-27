import { lazy, Suspense, useEffect, useState } from "react";
import { fetchSettings, isApiConfigured } from "./api/client";
import { AuthGate, signOut } from "./auth/AuthGate";
import { Home } from "./screens/Home";
import { Notes } from "./screens/Notes";
import { Settings } from "./screens/Settings";
import { Today } from "./screens/Today";

// Solo nella build di anteprima; nell'app vera questo ramo non esiste.
const DemoBanner = import.meta.env.VITE_DEMO === "1" ? lazy(() => import("./demo/DemoBanner")) : null;

type Tab = "registra" | "oggi" | "note" | "impostazioni";
const TABS: { id: Tab; label: string }[] = [
  { id: "registra", label: "Registra" },
  { id: "oggi", label: "Oggi" },
  { id: "note", label: "Note" },
  { id: "impostazioni", label: "Impostazioni" },
];

export default function App() {
  return (
    <AuthGate>
      {(account) => <Shell userName={account?.name ?? null} owner={account?.homeAccountId ?? "locale"} signedIn={Boolean(account)} />}
    </AuthGate>
  );
}

/** Quattro schede sempre visibili in basso. La scheda "Registra" resta attiva anche se si cambia pagina. */
function Shell({ userName, owner, signedIn }: { userName: string | null; owner: string; signedIn: boolean }) {
  const [tab, setTab] = useState<Tab>("registra");
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [retention, setRetention] = useState<number | null>(null);
  useEffect(() => {
    if (!isApiConfigured) return;
    void fetchSettings().then((r) => { if (r.kind === "ok") setRetention(r.impostazioni.conservazioneGiorni); });
  }, []);
  const out = signedIn ? () => void signOut() : undefined;
  return (
    <div className="shell">
      {DemoBanner && <Suspense fallback={null}><DemoBanner /></Suspense>}
      <div hidden={tab !== "registra"}><Home userName={userName} owner={owner} onSignOut={out} deletedIds={deletedIds} retention={retention} /></div>
      <div hidden={tab !== "oggi"}><Today active={tab === "oggi"} /></div>
      <div hidden={tab !== "note"}><Notes active={tab === "note"} retention={retention} onDeleted={(id) => setDeletedIds((d) => [...d, id])} /></div>
      <div hidden={tab !== "impostazioni"}><Settings active={tab === "impostazioni"} onSignOut={out} onSaved={(p) => setRetention(p.conservazioneGiorni)} /></div>

      <nav className="tabs" aria-label="Sezioni">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "tab current" : "tab"} aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
