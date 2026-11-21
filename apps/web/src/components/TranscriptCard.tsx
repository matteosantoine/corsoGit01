import { useState } from "react";

const MAX = 4000;

type Props = {
  text: string;
  /** Salva la correzione e rifà gli impegni. Restituisce un messaggio d'errore, o null se è andata bene. */
  onSave: (text: string) => Promise<string | null>;
};

/** Una nota trascritta, con la possibilità di correggere il testo. */
export function TranscriptCard({ text, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = draft.trim();
  const canSave = !busy && trimmed.length > 0 && trimmed !== text.trim() && trimmed.length <= MAX;

  async function save() {
    setBusy(true);
    setError(null);
    const err = await onSave(trimmed);
    setBusy(false);
    if (err) setError(err);
    else setEditing(false);
  }

  if (!editing) {
    return (
      <div className="transcript">
        <p className="heard">{text}</p>
        <button className="btn btn-small" onClick={() => { setDraft(text); setError(null); setEditing(true); }}>
          Correggi il testo
        </button>
      </div>
    );
  }

  return (
    <form className="transcript" onSubmit={(e) => { e.preventDefault(); if (canSave) void save(); }}>
      <label className="field">
        Correggi quello che ho scritto
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          maxLength={MAX}
          autoFocus
          disabled={busy}
        />
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions">
        <button className="btn btn-primary btn-small" type="submit" disabled={!canSave}>
          {busy ? "Salvo…" : "Salva e rifai gli impegni"}
        </button>
        <button className="btn btn-small" type="button" disabled={busy} onClick={() => setEditing(false)}>
          Annulla
        </button>
      </div>
    </form>
  );
}
