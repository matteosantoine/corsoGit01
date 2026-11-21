import { useState } from "react";
import { AuthGate, signOut } from "./auth/AuthGate";
import { Home } from "./screens/Home";
import { Notes } from "./screens/Notes";
import { Settings } from "./screens/Settings";
import { Today } from "./screens/Today";

type Tab = "registra" | "oggi" | "note" | "impostazioni";
const TABS: { id: Tab; label: string }[] = [
  { id: "registra", label: "Registra" },
  { id: "oggi", label: "Oggi" },
  { id: "note", label: "Note" },
  { id: "impostazioni", label: "Impostazioni" },
];

export default function App() {
  return <AuthGate>{(account) => <Shell userName={account?.name ?? null} signedIn={Boolean(account)} />}</AuthGate>;
}

/** Quattro schede sempre visibili in basso. La scheda "Registra" resta attiva anche se si cambia pagina. */
function Shell({ userName, signedIn }: { userName: string | null; signedIn: boolean }) {
  const [tab, setTab] = useState<Tab>("registra");
  const out = signedIn ? () => void signOut() : undefined;
  return (
    <div className="shell">
      <div hidden={tab !== "registra"}><Home userName={userName} onSignOut={out} /></div>
      <div hidden={tab !== "oggi"}><Today active={tab === "oggi"} /></div>
      <div hidden={tab !== "note"}><Notes active={tab === "note"} /></div>
      <div hidden={tab !== "impostazioni"}><Settings active={tab === "impostazioni"} onSignOut={out} /></div>

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
