import type { Verifier } from "../auth";
import type { Log } from "../logger";
import { TOO_MANY, type RateLimitFn } from "../rateLimit";
import type { NotesRepo } from "../services/notes";
import { SpeechError, type SpeechClient } from "../services/speech";

export const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // ~6 minuti di WAV 16 kHz mono

export type Deps = {
  verify: Verifier;
  speech: SpeechClient;
  notes: Pick<NotesRepo, "create">;
  now: () => Date;
  newId: () => string;
  log: Log;
  /** Limite di richieste per utente (facoltativo). */
  rateLimit?: RateLimitFn;
};

export type Input = { authorization: string | null; contentType: string | null; body: ArrayBuffer };
export type Output = { status: number; json: Record<string, unknown> };

const fail = (status: number, error: string, messaggio: string): Output => ({
  status,
  json: { error, messaggio },
});

/**
 * Flusso: verifica utente → controlla il file → trascrive → salva SOLO il testo → risponde.
 * L'audio non viene mai scritto da nessuna parte (né disco, né blob, né database):
 * vive solo nella variabile `body` finché la richiesta non termina.
 */
export async function handleTranscribe(deps: Deps, input: Input): Promise<Output> {
  let userId: string;
  try {
    ({ userId } = await deps.verify(input.authorization));
  } catch {
    deps.log("transcribe.rifiutato", { code: "non_autorizzato" });
    return fail(401, "non_autorizzato", "Accesso scaduto. Accedi di nuovo.");
  }

  if (deps.rateLimit && !deps.rateLimit(userId, "audio")) return { status: TOO_MANY.status, json: { ...TOO_MANY.json } };
  const size = input.body.byteLength;
  if (size === 0) return fail(400, "audio_vuoto", "La registrazione è vuota. Riprova.");
  if (size > MAX_AUDIO_BYTES)
    return fail(413, "audio_troppo_lungo", "La registrazione è troppo lunga. Registra una nota più breve.");
  const wav = new Uint8Array(input.body);
  const isWav =
    String.fromCharCode(...wav.slice(0, 4)) === "RIFF" && String.fromCharCode(...wav.slice(8, 12)) === "WAVE";
  if (!isWav) return fail(415, "formato_non_valido", "Formato audio non supportato.");

  const noteId = deps.newId();
  let text: string;
  let durationMs: number;
  try {
    ({ text, durationMs } = await deps.speech.transcribe(wav));
  } catch (e) {
    deps.log("transcribe.errore", { code: e instanceof SpeechError ? "speech" : "sconosciuto", sizeBytes: size });
    return fail(502, "trascrizione_fallita", "Non sono riuscito a trascrivere. Riprovo più tardi.");
  }

  if (!text) {
    deps.log("transcribe.vuoto", { sizeBytes: size });
    return fail(422, "nessun_parlato", "Non ho sentito nulla. Riprova parlando più vicino al telefono.");
  }

  try {
    await deps.notes.create({
      id: noteId,
      userId,
      text,
      createdAt: deps.now().toISOString(),
      durationSec: Math.round(durationMs / 1000),
      status: "nuova",
    });
  } catch {
    deps.log("transcribe.errore", { code: "salvataggio", noteId });
    return fail(500, "salvataggio_fallito", "Non sono riuscito a salvare la nota. Riprovo più tardi.");
  }

  deps.log("transcribe.ok", { noteId, durationMs, sizeBytes: size });
  // Se arriva questa risposta, il testo è al sicuro: il client può cancellare l'audio locale.
  return { status: 200, json: { noteId, text, durationSec: Math.round(durationMs / 1000) } };
}
