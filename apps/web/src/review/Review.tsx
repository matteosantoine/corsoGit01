import { useState } from "react";
import type { Impegno } from "@impegni/shared";
import {
  applyAnswer, describeWhen, nextQuestion, parseNames, QUESTION_TEXT, QUICK_TIMES, quickDates, todayLocal,
} from "./questions";

/** Fa le domande sui dati mancanti, una alla volta, poi mostra il riepilogo. */
export function Review({ initial, onDone }: { initial: Impegno[]; onDone: () => void }) {
  const [items, setItems] = useState(initial);
  const [names, setNames] = useState("");
  const q = nextQuestion(items);

  const answer = (a: Parameters<typeof applyAnswer>[1]) => {
    if (!q) return;
    setItems((cur) => cur.map((it, i) => (i === q.index ? applyAnswer(it, a) : it)));
    setNames("");
  };

  if (!q) {
    return (
      <section className="review" aria-label="Impegni pronti">
        <h2>{items.length ? "Ho capito questo" : "Non ho trovato impegni"}</h2>
        {items.map((it, i) => (
          <article className="card" key={i}>
            <p className="tag">{it.tipo === "evento" ? "Incontro" : "Promemoria"}</p>
            <h3>{it.titolo}</h3>
            <p>{describeWhen(it)}</p>
            {it.partecipanti.length > 0 && <p>Con: {it.partecipanti.join(", ")}</p>}
            {it.modalita === "teams" && <p>Su Teams</p>}
            {it.luogo && <p>Luogo: {it.luogo}</p>}
          </article>
        ))}
        <button className="btn btn-primary" onClick={onDone}>Ok</button>
      </section>
    );
  }

  const item = items[q.index];
  return (
    <section className="review" aria-live="polite">
      <p className="tag">{items.length > 1 ? `Impegno ${q.index + 1} di ${items.length}` : "Un'ultima cosa"}</p>
      <h2>{item.titolo}</h2>
      <p className="question">{QUESTION_TEXT[q.field]}</p>

      {q.field === "data" && (
        <div className="choices">
          {quickDates().map((d) => (
            <button key={d.value} className="btn btn-choice" onClick={() => answer({ field: "data", value: d.value })}>{d.label}</button>
          ))}
          <label className="field">
            Un altro giorno
            <input
              type="date" min={todayLocal()}
              onChange={(e) => e.target.value && answer({ field: "data", value: e.target.value })}
            />
          </label>
        </div>
      )}

      {q.field === "ora" && (
        <div className="choices grid">
          {QUICK_TIMES.map((t) => (
            <button key={t} className="btn btn-choice" onClick={() => answer({ field: "ora", value: t })}>{t}</button>
          ))}
          <label className="field wide">
            Un'altra ora
            <input type="time" onChange={(e) => e.target.value && answer({ field: "ora", value: e.target.value })} />
          </label>
        </div>
      )}

      {q.field === "partecipanti" && (
        <form
          className="choices"
          onSubmit={(e) => {
            e.preventDefault();
            const list = parseNames(names);
            if (list.length) answer({ field: "partecipanti", value: list });
          }}
        >
          <label className="field">
            Nome (o più nomi separati da virgola)
            <input type="text" value={names} onChange={(e) => setNames(e.target.value)} autoComplete="off" />
          </label>
          <button className="btn btn-primary" type="submit" disabled={!parseNames(names).length}>Avanti</button>
          <button className="btn btn-choice" type="button" onClick={() => answer({ field: "partecipanti", value: "nessuno" })}>
            Nessuno, solo io
          </button>
        </form>
      )}
    </section>
  );
}
