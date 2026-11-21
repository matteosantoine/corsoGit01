import { useState } from "react";
import { confirmError, type Impegno } from "@impegni/shared";
import { confirmItems } from "../api/client";
import { EditItem } from "./EditItem";
import { describeWhen, todayLocal } from "./questions";

type Choice = "confermato" | "scartato" | null;

/** Riepilogo con Conferma / Modifica / Scarta per ogni impegno. Nulla parte senza conferma esplicita. */
export function ConfirmStep({ noteId, initial, onDone }: { noteId: string; initial: Impegno[]; onDone: () => void }) {
  const [items, setItems] = useState(initial);
  const [choices, setChoices] = useState<Choice[]>(() => initial.map(() => null));
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ confermati: number; scartati: number } | null>(null);

  const choose = (i: number, c: Choice) => setChoices((cur) => cur.map((x, j) => (j === i ? c : x)));
  const allChosen = choices.every((c) => c !== null);

  async function submit() {
    setSaving(true);
    setError(null);
    const r = await confirmItems(noteId, items.map((impegno, i) => ({ stato: choices[i]!, impegno })));
    setSaving(false);
    if (r.kind === "ok") setResult({ confermati: r.confermati, scartati: r.scartati });
    else if (r.kind === "error") setError(r.message);
    else if (r.kind === "auth") setError("Accesso scaduto. Esci e accedi di nuovo.");
    else setError("Non c'è connessione. Le tue scelte restano qui: riprova tra poco.");
  }

  if (result) {
    return (
      <section className="review" aria-live="polite">
        <h2>Fatto</h2>
        <p className="lead">
          {result.confermati > 0 && `${result.confermati} ${result.confermati === 1 ? "impegno confermato" : "impegni confermati"}. `}
          {result.scartati > 0 && `${result.scartati} ${result.scartati === 1 ? "scartato" : "scartati"}.`}
        </p>
        <button className="btn btn-primary" onClick={onDone}>Ok</button>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="review">
        <h2>Non ho trovato impegni</h2>
        <button className="btn btn-primary" onClick={onDone}>Ok</button>
      </section>
    );
  }

  return (
    <section className="review" aria-label="Conferma gli impegni">
      <h2>{items.length === 1 ? "Va bene così?" : "Vanno bene così?"}</h2>
      {items.map((it, i) => {
        if (editing === i) {
          return (
            <EditItem
              key={i}
              item={it}
              onCancel={() => setEditing(null)}
              onSave={(upd) => { setItems((cur) => cur.map((x, j) => (j === i ? upd : x))); choose(i, null); setEditing(null); }}
            />
          );
        }
        const choice = choices[i];
        const problem = confirmError(it, todayLocal());
        return (
          <article className={`card ${choice ? `decided ${choice}` : ""}`} key={i}>
            <p className="tag">{it.tipo === "evento" ? "Incontro" : "Promemoria"}</p>
            <h3>{it.titolo}</h3>
            <p>{describeWhen(it)}</p>
            {(it.invitati?.length ?? 0) > 0 && (
              <p>Invitati: {it.invitati!.map((p) => p.nomeContatto ?? p.nome).join(", ")}</p>
            )}
            {it.modalita === "teams" && <p>Con link Teams</p>}
            {it.luogo && <p>Luogo: {it.luogo}</p>}
            {problem && <p className="error" role="alert">{problem} Tocca Modifica.</p>}

            {choice ? (
              <div className="actions">
                <strong>{choice === "confermato" ? "✓ Confermato" : "✗ Scartato"}</strong>
                <button className="btn btn-small" onClick={() => choose(i, null)}>Cambia</button>
              </div>
            ) : (
              <div className="actions wrap">
                <button className="btn btn-primary btn-small" disabled={Boolean(problem)} onClick={() => choose(i, "confermato")}>Conferma</button>
                <button className="btn btn-small" onClick={() => setEditing(i)}>Modifica</button>
                <button className="btn btn-small btn-danger" onClick={() => choose(i, "scartato")}>Scarta</button>
              </div>
            )}
          </article>
        );
      })}
      {error && <p role="alert" className="error">{error}</p>}
      <button className="btn btn-primary" disabled={!allChosen || saving || editing !== null} onClick={submit}>
        {saving ? "Salvo…" : "Fine"}
      </button>
    </section>
  );
}
