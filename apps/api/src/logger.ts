/**
 * Log sicuri: accettano solo campi in elenco (id, durate, codici).
 * Mai testo delle note, nomi o email: se un campo non è ammesso viene scartato.
 */
const ALLOWED = new Set(["noteId", "status", "durationMs", "sizeBytes", "code", "step"]);

export type Fields = Record<string, string | number | boolean | undefined>;
export type Log = (event: string, fields?: Fields) => void;

export function safeFields(fields: Fields = {}): Fields {
  return Object.fromEntries(Object.entries(fields).filter(([k]) => ALLOWED.has(k)));
}

export function makeLog(sink: (line: string) => void): Log {
  return (event, fields) => sink(`${event} ${JSON.stringify(safeFields(fields))}`);
}
