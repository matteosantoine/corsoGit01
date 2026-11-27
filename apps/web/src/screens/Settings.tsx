import { useEffect, useState } from "react";
import { ANTICIPI_MINUTI, CONSERVAZIONE_GIORNI, DEFAULT_SETTINGS, DURATE_MINUTI, type Settings as Prefs } from "@impegni/shared";
import { fetchSettings, isApiConfigured, saveSettings } from "../api/client";
import { ANTICIPO_LABEL, conservazioneLabel, durataLabel } from "./format";

/** Poche impostazioni, con scelte già pronte. */
export function Settings({ active, onSignOut, onSaved }: { active: boolean; onSignOut?: () => void; onSaved?: (s: Prefs) => void }) {
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
    if (r.kind === "ok") { setSaved(r.impostazioni); setPrefs(r.impostazioni); setMessage({ ok: true, text: "Salvato." }); onSaved?.(r.impostazioni); }
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

      <label className="field">
        Elimina da sole le note dopo
        <select value={prefs.conservazioneGiorni} onChange={(e) => set({ conservazioneGiorni: Number(e.target.value) as Prefs["conservazioneGiorni"] })} disabled={state !== "idle"}>
          {CONSERVAZIONE_GIORNI.map((g) => <option key={g} value={g}>{conservazioneLabel(g)}</option>)}
        </select>
        <span className="hint">Vale anche per le note già salvate. Gli incontri e i promemoria già creati restano nel calendario e in To Do.</span>
      </label>

      {message && <p role={message.ok ? "status" : "alert"} className={message.ok ? "ok" : "error"}>{message.text}</p>}
      <button className="btn btn-primary" onClick={save} disabled={!dirty || state !== "idle" || !isApiConfigured}>
        {state === "saving" ? "Salvo…" : "Salva"}
      </button>

      <section className="privacy" aria-labelledby="privacy-titolo">
        <h2 id="privacy-titolo">Privacy e intelligenza artificiale</h2>
        <ul>
          <li><strong>Cosa fa l'AI.</strong> Trascrive la tua voce e ne ricava gli impegni. Non scrive messaggi per te e non decide nulla: confermi sempre tu.</li>
          <li><strong>Può sbagliare.</strong> Controlla date, orari e invitati prima di confermare.</li>
          <li><strong>L'audio non viene conservato.</strong> Resta sul telefono solo finché non è inviato, poi viene cancellato.</li>
          <li><strong>Il testo resta nell'archivio</strong> e si elimina da solo dopo il periodo scelto qui sopra, o subito con il pulsante Elimina.</li>
          <li><strong>I dati restano nell'azienda</strong>: servizi Microsoft Azure in Europa, nello spazio dell'organizzazione.</li>
          <li><strong>Non dettare dati sensibili</strong>: salute, password, segreti professionali o dati riservati di clienti.</li>
        </ul>
      </section>

      {onSignOut && <button className="btn btn-choice" onClick={onSignOut}>Esci dall'account</button>}
    </main>
  );
}
