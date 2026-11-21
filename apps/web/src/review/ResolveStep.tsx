import { useEffect, useState } from "react";
import { isEmail } from "@impegni/shared";
import { findPeople } from "../api/client";
import { candidateMode, type Candidate } from "./resolve";

type Props = { nome: string; onChoose: (email: string, nomeContatto: string | null) => void };

/** "Chi è Mario?": propone i contatti trovati, oppure chiede l'indirizzo email. */
export function ResolveStep({ nome, onChoose }: Props) {
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [manual, setManual] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    findPeople(nome).then((r) => {
      if (cancelled) return;
      if (r.kind === "ok") {
        setCandidates(r.candidati);
        if (r.nonDisponibile) setNotice("Non riesco a cercare nei contatti.");
        if (candidateMode(r.candidati) === "none") setManual(true);
      } else {
        setNotice("Non riesco a cercare nei contatti.");
        setManual(true);
      }
      setState("ready");
    });
    return () => { cancelled = true; };
  }, [nome]);

  const mode = candidateMode(candidates);

  if (state === "loading") {
    return (
      <section className="review" aria-live="polite">
        <p className="question">Chi è {nome}?</p>
        <p className="lead" role="status">Cerco nei tuoi contatti…</p>
      </section>
    );
  }

  return (
    <section className="review" aria-live="polite">
      <p className="tag">Invitato</p>
      <p className="question">Chi è {nome}?</p>
      {notice && <p className="notice" role="status">{notice}</p>}

      {!manual && mode === "one" && (
        <>
          <p className="lead">Ho trovato una persona. È questa?</p>
          <div className="card person"><strong>{candidates[0].nome}</strong><span>{candidates[0].email}</span></div>
          <div className="choices">
            <button className="btn btn-primary" onClick={() => onChoose(candidates[0].email, candidates[0].nome)}>Sì, è lei o lui</button>
            <button className="btn btn-choice" onClick={() => setManual(true)}>No, è un'altra persona</button>
          </div>
        </>
      )}

      {!manual && mode === "many" && (
        <>
          <p className="lead">Ho trovato più persone. Quale?</p>
          <div className="choices">
            {candidates.map((c) => (
              <button key={c.email} className="btn btn-choice person-btn" onClick={() => onChoose(c.email, c.nome)}>
                <strong>{c.nome}</strong><span>{c.email}</span>
              </button>
            ))}
            <button className="btn btn-choice" onClick={() => setManual(true)}>Un'altra persona</button>
          </div>
        </>
      )}

      {manual && (
        <form
          className="choices"
          onSubmit={(e) => { e.preventDefault(); if (isEmail(email)) onChoose(email.trim().toLowerCase(), null); }}
        >
          {mode === "none" && <p className="lead">Non trovo {nome} nei tuoi contatti. Scrivi l'indirizzo email.</p>}
          <label className="field">
            Indirizzo email di {nome}
            <input type="email" inputMode="email" autoComplete="off" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={!isEmail(email)}>Avanti</button>
          {mode !== "none" && <button className="btn btn-choice" type="button" onClick={() => setManual(false)}>Torna ai contatti trovati</button>}
        </form>
      )}
    </section>
  );
}
