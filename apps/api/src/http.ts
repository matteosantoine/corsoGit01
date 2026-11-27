import type { HttpResponseInit } from "@azure/functions";

/** Risposta JSON con intestazioni sicure: niente cache (dati personali) e niente interpretazione "creativa" del contenuto. */
export function reply(status: number, body: unknown): HttpResponseInit {
  return { status, jsonBody: body, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } };
}

/** Rifiuta subito le richieste che dichiarano un corpo troppo grande, prima di leggerlo in memoria. */
export function tooLarge(req: { headers: { get(name: string): string | null } }, maxBytes: number): HttpResponseInit | null {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return reply(413, { error: "troppo_grande", messaggio: "I dati inviati sono troppo grandi." });
  }
  return null;
}

/** Dimensioni massime accettate per tipo di richiesta. */
export const MAX_BODY = { audio: 13 * 1024 * 1024, conferma: 256 * 1024, testo: 32 * 1024, impostazioni: 4 * 1024 } as const;
