import { useCallback, useEffect, useState } from "react";
import { fetchAgenda, isApiConfigured, type Giorno } from "../api/client";
import { todayLocal } from "../review/questions";
import { dayTitle, timeRange } from "./format";

/** Oggi e domani: calendario Outlook e promemoria To Do, in un elenco semplice. */
export function Today({ active }: { active: boolean }) {
  const [giorni, setGiorni] = useState<Giorno[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isApiConfigured) return;
    setLoading(true);
    setError(null);
    const r = await fetchAgenda();
    setLoading(false);
    if (r.kind === "ok") setGiorni(r.giorni);
    else if (r.kind === "auth") setError("Accesso scaduto. Esci e accedi di nuovo.");
    else setError(r.message);
  }, []);

  useEffect(() => { if (active) void load(); }, [active, load]);

  const today = todayLocal();
  return (
    <main className="screen">
      <header className="topbar"><h1 className="h1">Oggi</h1></header>
      {!isApiConfigured && <p className="notice">Non disponibile in questa modalità di prova.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {loading && !giorni && <p className="lead" role="status">Carico gli impegni…</p>}

      {giorni?.map((g) => {
        const vuoto = g.eventi.length === 0 && g.promemoria.length === 0;
        return (
          <section key={g.data} className="day" aria-label={dayTitle(g.data, today)}>
            <h2>{dayTitle(g.data, today)}</h2>
            {vuoto && <p className="lead">Niente in programma.</p>}
            {g.eventi.map((e) => (
              <article className="card agenda" key={`${e.id}-${e.inizio}`}>
                <p className="when">{timeRange(e.inizio, e.fine)}</p>
                <h3>{e.titolo}</h3>
                <p className="meta">
                  {[e.teams ? "Teams" : null, e.luogo, e.persone > 0 ? `${e.persone} ${e.persone === 1 ? "invitato" : "invitati"}` : null].filter(Boolean).join(" · ")}
                </p>
              </article>
            ))}
            {g.promemoria.map((p) => (
              <article className="card agenda todo" key={p.id}>
                <p className="when">Promemoria{p.ora ? `, ore ${p.ora}` : ""}{p.importante ? " · importante" : ""}</p>
                <h3>{p.titolo}</h3>
              </article>
            ))}
          </section>
        );
      })}

      {isApiConfigured && (
        <button className="btn btn-choice" onClick={load} disabled={loading}>{loading ? "Aggiorno…" : "Aggiorna"}</button>
      )}
    </main>
  );
}
