import { useCallback, useEffect, useRef, useState } from "react";
import { microphoneErrorMessage, startRecording, type Recorder } from "../audio/recorder";
import { toWav16kMono } from "../audio/convert";
import { addToQueue, listQueue, removeFromQueue, type QueuedNote } from "../audio/queue";
import { useOnline } from "../components/useOnline";

type Phase = "idle" | "recording" | "saving";

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function Home({ userName, onSignOut }: { userName: string | null; onSignOut?: () => void }) {
  const online = useOnline();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedNote[]>([]);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(() => listQueue().then(setQueue), []);
  useEffect(() => { void refresh(); }, [refresh]);
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

  async function stop() {
    if (timer.current) clearInterval(timer.current);
    setPhase("saving");
    try {
      const raw = await recorder.current!.stop();
      const wav = await toWav16kMono(raw);
      await addToQueue(wav, seconds);
      await refresh();
    } catch {
      setError("La registrazione non è andata a buon fine. Riprova.");
    } finally {
      recorder.current = null;
      setPhase("idle");
    }
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

      <section className="center grow">
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
      </section>

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
