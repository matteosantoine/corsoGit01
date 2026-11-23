import { useState } from "react";
import { demoState, SAMPLES } from "./state";

/** Barra in alto nell'anteprima: spiega cosa è simulato e permette di scegliere cosa "dice" il vocale. */
export default function DemoBanner() {
  const [choice, setChoice] = useState<string>("0");
  const [custom, setCustom] = useState("");

  const pick = (v: string) => {
    setChoice(v);
    demoState.sentence = v === "custom" ? custom : SAMPLES[Number(v)].text;
  };

  return (
    <aside className="demo-banner" aria-label="Anteprima">
      <p className="demo-title"><strong>ANTEPRIMA</strong> · trascrizione, AI e Microsoft sono simulati</p>
      <label className="demo-field">
        Dici:
        <select value={choice} onChange={(e) => pick(e.target.value)}>
          {SAMPLES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
          <option value="custom">Scrivo io la frase…</option>
        </select>
      </label>
      {choice === "custom" ? (
        <input
          className="demo-input" type="text" value={custom} placeholder="Es.: Domani alle 11 riunione con Paolo"
          onChange={(e) => { setCustom(e.target.value); demoState.sentence = e.target.value; }}
        />
      ) : (
        <p className="demo-sentence">«{SAMPLES[Number(choice)].text}»</p>
      )}
    </aside>
  );
}
