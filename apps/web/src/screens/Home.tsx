import { useCallback, useEffect, useRef, useState } from "react";
import { microphoneErrorMessage, startRecording, type Recorder } from "../audio/recorder";
import { toWav16kMono } from "../audio/convert";
import { addToQueue, listQueue, removeFromQueue, type QueuedNote } from "../audio/queue";
import { useOnline } from "../components/useOnline";
import { extractNote, isApiConfigured, sendNote, updateNoteText } from "../api/client";
import { Review } from "../review/Review";
import { addReview, removeForNote, replaceForNote, type ReviewEntry } from "../review/queue";
import { TranscriptCard } from "../components/TranscriptCard";
import { syncQueue } from "../audio/sync";

const MAX_SECONDS = 5 * 60; // limite per nota: tiene il file sotto il massimo accettato dal server

type Phase = "idle" | "recording" | "saving";

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function Home({ userName, onSignOut }: { userName: string | null; onSignOut?: () => void }) {
  const online = useOnline();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedNote[]>([]);
  const [heard, setHeard] = useState<{ noteId: string; text: string }[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [thinking, setThinking] = useState(false);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(() => listQueue().then(setQueue), []);

  const sync = useCallback(async () => {
    if (!isApiConfigured || !navigator.onLine) return;
    const report = await syncQueue({ list: listQueue, remove: removeFromQueue, send: sendNote });
    if (report.sent.length) {
      setHeard((h) => [...report.sent.map((s) => ({ noteId: s.noteId, text: s.text })), ...h]);
      setThinking(true);
      for (const sent of report.sent) {
        const r = await extractNote(sent.noteId);
        if (r.kind === "ok") setReviews((cur) => addReview(cur, sent.noteId, r.items));
        else if (r.kind === "error") setInfo(r.message);
        else setInfo("Non sono ancora riuscito a capire gli impegni. La nota è salvata: riprovo più tardi.");
      }
      setThinking(false);
    }
    if (report.message) setInfo(report.message);
    if (report.stoppedForAuth) setInfo("Accesso scaduto. Esci e accedi di nuovo per inviare le note.");
    await refresh();
  }, [refresh]);

  useEffect(() => { void refresh().then(sync); }, [refresh, sync]);
  useEffect(() => {
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [sync]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); recorder.current?.cancel(); }, []);
  useEffect(() => () => { if (playing) URL.revokeObjectURL(playing.url); }, [playing]);

  async function start() {
    setError(null);
    try {
      recorder.current = await startRecording();
    } catch (e) {
      setError(microphoneErrorMessage(e));
      return;
    }
    setSeconds(0);
    setPhase("recording");
    timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  useEffect(() => {
    if (phase === "recording" && seconds >= MAX_SECONDS) void stop();
  }, [phase, seconds]); // eslint-disable-line react-hooks/exhaustive-deps

  async function stop() {
    if (timer.current) clearInterval(timer.current);
    setPhase("saving");
    try {
      const raw = await recorder.current!.stop();
      const wav = await toWav16kMono(raw);
      await addToQueue(wav, seconds);
      await refresh();
      void sync();
    } catch {
      setError("La registrazione non è andata a buon fine. Riprova.");
    } finally {
      recorder.current = null;
      setPhase("idle");
    }
  }

  /** Salva il testo corretto e rifà l'estrazione. Restituisce un messaggio d'errore, o null. */
  async function correct(noteId: string, text: string): Promise<string | null> {
    const saved = await updateNoteText(noteId, text);
    if (saved.kind === "error") return saved.message;
    if (saved.kind === "auth") return "Accesso scaduto. Esci e accedi di nuovo.";
    if (saved.kind !== "ok") return "Non c'è connessione. Riprova tra poco.";
    setHeard((h) => h.map((x) => (x.noteId === noteId ? { ...x, text } : x)));
    setThinking(true);
    setInfo(null);
    const r = await extractNote(noteId);
    setThinking(false);
    if (r.kind === "ok") {
      setReviews((cur) => (r.items.length ? replaceForNote(cur, noteId, r.items) : removeForNote(cur, noteId)));
      if (!r.items.length) setInfo("Nel testo corretto non ho trovato impegni.");
    } else {
      setReviews((cur) => removeForNote(cur, noteId)); // quelli vecchi non valgono più
      setInfo("Il testo è salvato, ma non sono riuscito a rifare gli impegni. Riprova a correggerlo tra poco.");
    }
    return null;
  }

  async function discard(id: string) {
    if (playing?.id === id) setPlaying(null);
    await removeFromQueue(id);
    await refresh();
  }

  function listen(n: QueuedNote) {
    setPlaying({ id: n.id, url: URL.createObjectURL(n.audio) });
  }

  return (
    <main className="screen">
      <header className="topbar">
        <span>{userName ? `Ciao, ${userName.split(" ")[0]}` : "Impegni"}</span>
        {onSignOut && <button className="link" onClick={onSignOut}>Esci</button>}
      </header>

      {!online && (
        <p className="notice" role="status">
          Non c'è connessione. Le registrazioni restano sul telefono e partiranno appena torna la rete.
        </p>
      )}

      {reviews.length > 0 ? (
        <Review
          key={`${reviews[0].noteId}-${reviews[0].version}`}
          initial={reviews[0].items}
          onDone={() => setReviews((cur) => cur.slice(1))}
        />
      ) : (
      <section className="center grow">
        {thinking && <p className="lead" role="status">Sto capendo gli impegni…</p>}
        {phase === "recording" ? (
          <>
            <p className="timer" aria-live="off">{mmss(seconds)}</p>
            <p className="lead">Sto registrando… parla pure.</p>
            <button className="btn btn-stop" onClick={stop}>Stop</button>
          </>
        ) : (
          <>
            <button className="btn btn-record" onClick={start} disabled={phase === "saving"}>
              {phase === "saving" ? "Salvo…" : "Registra"}
            </button>
            <p className="lead">Premi il pulsante e racconta cosa devi fare.</p>
          </>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        {info && <p role="status" className="notice">{info}</p>}
      </section>
      )}

      {heard.length > 0 && (
        <section className="queue" aria-label="Il tuo vocale, scritto">
          <h2>Il tuo vocale, scritto</h2>
          {heard.map((h) => (
            <TranscriptCard key={h.noteId} text={h.text} onSave={(t) => correct(h.noteId, t)} />
          ))}
        </section>
      )}

      {queue.length > 0 && (
        <section className="queue" aria-label="Note in attesa di invio">
          <h2>In attesa di invio ({queue.length})</h2>
          {queue.map((n) => (
            <div className="queue-item" key={n.id}>
              <span>
                {new Date(n.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                {" · "}{mmss(n.durationSec)}
              </span>
              <span className="actions">
                <button className="btn btn-small" onClick={() => listen(n)}>Ascolta</button>
                <button className="btn btn-small btn-danger" onClick={() => discard(n.id)}>Elimina</button>
              </span>
              {playing?.id === n.id && <audio controls autoPlay src={playing.url} />}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
