export type RateLimitFn = (userId: string, bucket: string) => boolean;

/**
 * Limite di richieste per utente in una finestra di tempo (a scorrimento). Protegge i servizi a pagamento
 * (trascrizione, AI) da un uso eccessivo, anche per errore o da un account compromesso.
 * È in memoria: vale per ogni istanza del server (misura di contenimento, non una barriera assoluta).
 */
export function createRateLimiter(
  limits: Record<string, { max: number; windowMs: number }>,
  now: () => number = Date.now,
): RateLimitFn {
  const hits = new Map<string, number[]>();
  return (userId, bucket) => {
    const rule = limits[bucket];
    if (!rule) return true;
    const t = now();
    const key = `${bucket}\u0000${userId}`;
    const recent = (hits.get(key) ?? []).filter((x) => t - x < rule.windowMs);
    if (recent.length >= rule.max) { hits.set(key, recent); return false; }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (v.every((x) => t - x >= rule.windowMs)) hits.delete(k); // memoria limitata
    return true;
  };
}

const TEN_MIN = 10 * 60 * 1000;
/** Limiti pensati per una persona che lavora: molto sopra l'uso normale, molto sotto un abuso. */
export const DEFAULT_LIMITS = {
  audio: { max: 30, windowMs: TEN_MIN },
  ai: { max: 40, windowMs: TEN_MIN },
  contatti: { max: 80, windowMs: TEN_MIN },
  scrittura: { max: 40, windowMs: TEN_MIN },
} as const;

export const TOO_MANY = { status: 429, json: { error: "troppe_richieste", messaggio: "Troppe richieste in poco tempo. Riprova tra qualche minuto." } } as const;
