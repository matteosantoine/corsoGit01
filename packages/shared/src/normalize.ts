import { addDays, isValidYmd, localParts } from "./dates";
import { LIMITS, type CampoMancante, type Impegno, type ImpegnoModel } from "./extraction";

/**
 * Cosa serve ancora chiedere.
 * - promemoria: serve solo la data (l'ora è facoltativa);
 * - evento (c'è qualcun altro): data, ora e partecipanti.
 */
export function computeMancanti(i: Pick<Impegno, "tipo" | "data" | "oraInizio" | "partecipanti">): CampoMancante[] {
  const m: CampoMancante[] = [];
  if (!i.data) m.push("data");
  if (i.tipo === "evento") {
    if (!i.oraInizio) m.push("ora");
    if (i.partecipanti.length === 0) m.push("partecipanti");
  }
  return m;
}

const SELF = new Set(["io", "me", "me stesso", "noi"]);

function cleanTime(raw: string | null): string | null {
  const m = raw?.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h <= 23 && min <= 59 ? `${String(h).padStart(2, "0")}:${m[2]}` : null;
}

/**
 * Non ci fidiamo del modello: date e ore vengono ricontrollate qui.
 * Date impossibili o già passate diventano "mancanti" (si chiede all'utente, non si indovina).
 */
export function normalizeItems(
  raw: ImpegnoModel[],
  opts: { now: Date; defaultDurationMin: number; defaultTeams?: boolean },
): Impegno[] {
  const today = localParts(opts.now);
  const seen = new Set<string>();
  const out: Impegno[] = [];

  for (const r of raw) {
    const titolo = r.titolo.trim().slice(0, LIMITS.titolo);
    if (!titolo) continue;

    const data = r.data && isValidYmd(r.data) && r.data >= today.ymd ? r.data : null;
    let oraInizio = cleanTime(r.oraInizio);
    // Oggi con un'ora già passata: non è affidabile, si richiede.
    if (data === today.ymd && oraInizio && oraInizio <= today.hm) oraInizio = null;

    const names = new Map<string, string>();
    for (const p of r.partecipanti.map((x) => x.trim().slice(0, LIMITS.nome))) {
      const k = p.toLowerCase();
      if (p && !SELF.has(k) && !names.has(k)) names.set(k, p);
    }
    const partecipanti = [...names.values()].slice(0, LIMITS.persone);
    const tipo = r.tipo;

    const item: Impegno = {
      tipo,
      titolo,
      descrizione: r.descrizione?.trim().slice(0, LIMITS.descrizione) || null,
      data,
      oraInizio,
      durataMinuti: tipo === "evento" ? (r.durataMinuti && r.durataMinuti > 0 && r.durataMinuti <= 1440 ? r.durataMinuti : opts.defaultDurationMin) : null,
      // Incontro senza luogo né modalità detta: se l'utente lo vuole, per impostazione ha il link Teams.
      modalita: tipo === "evento" ? (r.modalita ?? (opts.defaultTeams && !r.luogo?.trim() ? "teams" : null)) : null,
      luogo: r.luogo?.trim().slice(0, LIMITS.luogo) || null,
      partecipanti,
      priorita: r.priorita,
      mancanti: [],
    };
    item.mancanti = computeMancanti(item);

    const key = `${item.tipo}|${item.titolo.toLowerCase()}|${item.data}|${item.oraInizio}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export { addDays };
