import type { QueuedNote } from "./queue";

export type SendResult =
  | { kind: "ok"; text: string; noteId: string }
  | { kind: "retry" } // rete assente o errore del server: riprova più tardi, l'audio resta
  | { kind: "auth" } // accesso scaduto: serve un nuovo login, l'audio resta
  | { kind: "reject"; message: string } // la nota non può essere elaborata, l'audio resta per decidere
  | { kind: "silent"; message: string }; // nessun parlato: l'audio è inutile

export type SyncReport = {
  sent: { text: string; noteId: string }[];
  message: string | null;
  stoppedForAuth: boolean;
};

type Deps = {
  list: () => Promise<QueuedNote[]>;
  remove: (id: string) => Promise<void>;
  send: (note: QueuedNote) => Promise<SendResult>;
};

let running = false;

/**
 * Invia le note in coda, una alla volta. L'audio locale viene cancellato SOLO dopo che
 * il server ha confermato di aver salvato il testo (o se non c'era alcun parlato).
 */
export async function syncQueue(deps: Deps): Promise<SyncReport> {
  const report: SyncReport = { sent: [], message: null, stoppedForAuth: false };
  if (running) return report;
  running = true;
  try {
    for (const note of await deps.list()) {
      const r = await deps.send(note);
      if (r.kind === "ok") {
        await deps.remove(note.id);
        report.sent.push({ text: r.text, noteId: r.noteId });
      } else if (r.kind === "silent") {
        await deps.remove(note.id);
        report.message = r.message;
      } else if (r.kind === "auth") {
        report.stoppedForAuth = true;
        break;
      } else if (r.kind === "retry") {
        break;
      } else {
        report.message = r.message;
      }
    }
    return report;
  } finally {
    running = false;
  }
}
