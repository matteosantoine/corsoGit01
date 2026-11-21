import { useCallback, useEffect, useRef, useState } from "react";
import { deleteNote, fetchNotes, isApiConfigured, type NoteSummary } from "../api/client";
import { noteWhen, statoLabel } from "./format";

/** Archivio dei vocali trascritti: più recenti per primi, con ricerca nel testo. */
export function Notes({ active, onDeleted }: { active: boolean; onDeleted?: (noteId: string) => void }) {
  const [q, setQ] = useState("");
  const [note, setNote] = useState<NoteSummary[] | null>(null);
  const [altre, setAltre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0); // scarta le risposte di ricerche superate
  const [asking, setAsking] = useState<string | null>(null); // nota per cui si chiede conferma
  const [deleting, setDeleting] = useState<string | null>(null);
  const [cardError, setCardError] = useState<{ id: string; text: string } | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    setCardError(null);
    const r = await deleteNote(id);
    setDeleting(null);
    if (r.kind === "ok") {
      setNote((cur) => cur?.filter((n) => n.id !== id) ?? cur);
      setAsking(null);
      onDeleted?.(id);
    } else {
      // L'errore compare dentro la nota, vicino al pulsante premuto.
      setCardError({ id, text: r.kind === "auth" ? "Accesso scaduto. Esci e accedi di nuovo." : r.message });
    }
  }

  const load = useCallback(async (query: string, before?: string) => {
    if (!isApiConfigured) return;
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    const r = await fetchNotes({ q: query.trim() || undefined, before });
    if (mine !== seq.current) return;
    setLoading(false);
    if (r.kind === "ok") {
      setNote((cur) => (before && cur ? [...cur, ...r.note] : r.note));
      setAltre(r.altre);
    } else if (r.kind === "auth") setError("Accesso scaduto. Esci e accedi di nuovo.");
    else setError(r.message);
  }, []);

  // Ricarica all'apertura della scheda e, con una breve pausa, mentre si scrive nella ricerca.
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => void load(q), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [active, q, load]);

  return (
    <main className="screen">
      <header className="topbar"><h1 className="h1">Note</h1></header>
      {!isApiConfigured && <p className="notice">Non disponibile in questa modalità di prova.</p>}

      <label className="field">
        Cerca nelle note
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder="Per esempio: Mario" />
      </label>

      {error && <p role="alert" className="error">{error}</p>}
      {loading && !note && <p className="lead" role="status">Carico le note…</p>}
      {note && note.length === 0 && !loading && (
        <p className="lead">{q.trim() ? "Nessuna nota trovata." : "Non hai ancora registrato nessuna nota."}</p>
      )}

      {note?.map((n) => (
        <article className="card" key={n.id}>
          <p className="tag">{noteWhen(n.creatoIl)}</p>
          <p className="heard">{n.testo}</p>
          {n.impegni.length > 0 && (
            <ul className="chips" aria-label="Impegni di questa nota">
              {n.impegni.map((i, k) => {
                const s = statoLabel(i.stato, i.tipo);
                return <li key={k} className={`chip ${s.tono}`}><strong>{s.testo}</strong>: {i.titolo}</li>;
              })}
            </ul>
          )}

          {asking === n.id ? (
            <div className="confirm-box" role="alertdialog" aria-label="Conferma eliminazione">
              <p><strong>Eliminare questa nota?</strong></p>
              <p>Gli incontri e i promemoria già creati restano nel calendario e in To Do: si tolgono da lì.</p>
              {cardError?.id === n.id && <p role="alert" className="error">{cardError.text}</p>}
              <div className="actions wrap">
                <button className="btn btn-small btn-danger-solid" disabled={deleting === n.id} onClick={() => remove(n.id)}>
                  {deleting === n.id ? "Elimino…" : "Sì, elimina"}
                </button>
                <button className="btn btn-small" disabled={deleting === n.id} onClick={() => setAsking(null)}>No, tienila</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-small btn-danger" onClick={() => { setCardError(null); setAsking(n.id); }}>Elimina</button>
          )}
        </article>
      ))}

      {altre && <button className="btn btn-choice" disabled={loading} onClick={() => load(q, altre)}>Mostra altre</button>}
    </main>
  );
}
