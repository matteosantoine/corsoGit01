import { useState } from "react";
import { confirmError, isEmail, type Impegno } from "@impegni/shared";
import { setInvitati } from "./resolve";
import { todayLocal } from "./questions";

const DURATIONS = [15, 30, 45, 60, 90, 120];

/** Modifica di un impegno prima della conferma. */
export function EditItem({ item, onSave, onCancel }: { item: Impegno; onSave: (i: Impegno) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Impegno>({ ...item, invitati: item.invitati ?? [] });
  const [newEmail, setNewEmail] = useState("");
  const isEvent = draft.tipo === "evento";
  const set = (patch: Partial<Impegno>) => setDraft((d) => ({ ...d, ...patch }));
  const error = confirmError(draft, todayLocal());

  const addInvitato = () => {
    const email = newEmail.trim().toLowerCase();
    if (!isEmail(email) || draft.invitati!.some((i) => i.email === email)) return;
    setDraft((d) => setInvitati(d, [...d.invitati!, { nome: email, email, nomeContatto: null }]));
    setNewEmail("");
  };
  const removeInvitato = (email: string) => setDraft((d) => setInvitati(d, d.invitati!.filter((i) => i.email !== email)));

  const save = () => {
    onSave({ ...draft, titolo: draft.titolo.trim() });
  };

  return (
    <form className="card edit" onSubmit={(e) => { e.preventDefault(); if (!error) save(); }}>
      <label className="field">Titolo
        <input type="text" value={draft.titolo} onChange={(e) => set({ titolo: e.target.value })} />
      </label>
      <label className="field">Giorno
        <input type="date" min={todayLocal()} value={draft.data ?? ""} onChange={(e) => set({ data: e.target.value || null })} />
      </label>
      <label className="field">{isEvent ? "Ora" : "Ora (facoltativa)"}
        <input type="time" value={draft.oraInizio ?? ""} onChange={(e) => set({ oraInizio: e.target.value || null })} />
      </label>

      {isEvent && (
        <>
          <label className="field">Durata
            <select value={draft.durataMinuti ?? 60} onChange={(e) => set({ durataMinuti: Number(e.target.value) })}>
              {DURATIONS.map((d) => <option key={d} value={d}>{d} minuti</option>)}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={draft.modalita === "teams"} onChange={(e) => set({ modalita: e.target.checked ? "teams" : null })} />
            Aggiungi il link Teams
          </label>
          <label className="field">Luogo (facoltativo)
            <input type="text" value={draft.luogo ?? ""} onChange={(e) => set({ luogo: e.target.value || null })} />
          </label>

          <fieldset className="invitati">
            <legend>Invitati</legend>
            {draft.invitati!.map((i) => (
              <div className="invitato" key={i.email}>
                <span><strong>{i.nomeContatto ?? i.nome}</strong><br />{i.email}</span>
                <button type="button" className="btn btn-small btn-danger" onClick={() => removeInvitato(i.email)}>Togli</button>
              </div>
            ))}
            <label className="field">Aggiungi una persona (email)
              <input type="email" inputMode="email" autoCapitalize="none" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </label>
            <button type="button" className="btn btn-small" disabled={!isEmail(newEmail)} onClick={addInvitato}>Aggiungi</button>
          </fieldset>
        </>
      )}

      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions">
        <button className="btn btn-primary btn-small" type="submit" disabled={Boolean(error)}>Salva</button>
        <button className="btn btn-small" type="button" onClick={onCancel}>Annulla</button>
      </div>
    </form>
  );
}
