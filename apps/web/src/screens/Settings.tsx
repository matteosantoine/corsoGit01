import { useEffect, useState } from "react";
import { ANTICIPI_MINUTI, DEFAULT_SETTINGS, DURATE_MINUTI, type Settings as Prefs } from "@impegni/shared";
import { fetchSettings, isApiConfigured, saveSettings } from "../api/client";
import { ANTICIPO_LABEL, durataLabel } from "./format";

/** Poche impostazioni, con scelte già pronte. */
export function Settings({ active, onSignOut }: { active: boolean; onSignOut?: () => void }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<Prefs>(DEFAULT_SETTINGS);
  const [state, setState] = useState<"idle" | "loading" | "saving">("idle");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!active || !isApiConfigured) return;
    setState("loading");
    fetchSettings().then((r) => {
      setState("idle");
      if (r.kind === "ok") { setPrefs(r.impostazioni); setSaved(r.impostazioni); }
      else setMessage({ ok: false, text: r.kind === "auth" ? "Accesso scaduto. Esci e accedi di nuovo." : r.message });
    });
  }, [active]);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);
  const set = (patch: Partial<Prefs>) => { setPrefs((p) => ({ ...p, ...patch })); setMessage(null); };

  async function save() {
    setState("saving");
    const r = await saveSettings(prefs);
    setState("idle");
    if (r.kind === "ok") { setSaved(r.impostazioni); setPrefs(r.impostazioni); setMessage({ ok: true, text: "Salvato." }); }
    else setMessage({ ok: false, text: r.kind === "auth" ? "Accesso scaduto. Esci e accedi di nuovo." : r.message });
  }

  return (
    <main className="screen">
      <header className="topbar"><h1 className="h1">Impostazioni</h1></header>
      {!isApiConfigured && <p className="notice">Non disponibile in questa modalità di prova.</p>}

      <label className="field">
        Durata di un incontro, se non la dico
        <select value={prefs.durataMinuti} onChange={(e) => set({ durataMinuti: Number(e.target.value) as Prefs["durataMinuti"] })} disabled={state !== "idle"}>
          {DURATE_MINUTI.map((m) => <option key={m} value={m}>{durataLabel(m)}</option>)}
        </select>
      </label>

      <label className="field">
        Avviso prima di un incontro
        <select value={prefs.anticipoMinuti} onChange={(e) => set({ anticipoMinuti: Number(e.target.value) as Prefs["anticipoMinuti"] })} disabled={state !== "idle"}>
          {ANTICIPI_MINUTI.map((m) => <option key={m} value={m}>{ANTICIPO_LABEL[m]}</option>)}
        </select>
      </label>

      <label className="check">
        <input type="checkbox" checked={prefs.linkTeams} onChange={(e) => set({ linkTeams: e.target.checked })} disabled={state !== "idle"} />
        Aggiungi il link Teams agli incontri
      </label>

      {message && <p role={message.ok ? "status" : "alert"} className={message.ok ? "ok" : "error"}>{message.text}</p>}
      <button className="btn btn-primary" onClick={save} disabled={!dirty || state !== "idle" || !isApiConfigured}>
        {state === "saving" ? "Salvo…" : "Salva"}
      </button>

      {onSignOut && <button className="btn btn-choice" onClick={onSignOut}>Esci dall'account</button>}
    </main>
  );
}
