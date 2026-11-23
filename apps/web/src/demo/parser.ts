import { addDays, localParts, weekdayOf, WEEKDAYS_IT, type ImpegnoModel } from "@impegni/shared";

/**
 * SOLO PER L'ANTEPRIMA: interprete a regole al posto dell'intelligenza artificiale.
 * Capisce poche forme di frase italiana; l'app vera usa Azure OpenAI.
 */

const DAY_NAMES = [...WEEKDAYS_IT, "lunedi", "martedi", "mercoledi", "giovedi", "venerdi"] as const;
const dayIndex = (name: string) => {
  const n = name.toLowerCase().replace("ì", "i");
  return ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato", "domenica"].indexOf(n);
};
// \b non funziona con le lettere accentate (giovedì, caffè): si usano confini di parola espliciti.
const B = "(?<![\\wà-ÿ])";
const E = "(?![\\wà-ÿ])";
const DAY_RE = new RegExp(`${B}(${DAY_NAMES.join("|")})${E}`, "i");
const hasWord = (w: string, text: string) => new RegExp(`${B}${w}${E}`, "i").test(text);

const HOUR_WORDS: Record<string, number> = {
  una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12,
  tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18,
};
const EVENT_WORDS = ["riunione", "incontro", "call", "chiamata", "pranzo", "cena", "caffè", "colloquio", "appuntamento", "videochiamata"];
const ACTION_RE = /\b(chiam\w+|pag\w+|invi\w+|mand\w+|ricord\w+|devo|compil\w+|prepar\w+|prenot\w+|compr\w+|firm\w+|scriv\w+|rispond\w+|telefon\w+)\b/i;
const NAME = "[A-ZÀ-Ý][\\wà-ÿ']+";
const NAMES_RE = new RegExp(`\\bcon\\s+(${NAME}(?:\\s+(?:e\\s+)?${NAME})*)`);

function parseDate(clause: string, today: string): string | null {
  const lower = clause.toLowerCase();
  const todayIdx = weekdayOf(today);
  const monday = addDays(today, -todayIdx);
  if (/\bdopodomani\b/.test(lower)) return addDays(today, 2);
  if (/\bdomani\b/.test(lower)) return addDays(today, 1);
  if (/\boggi\b/.test(lower)) return today;
  const m = DAY_RE.exec(clause);
  if (!m) return null;
  const idx = dayIndex(m[1]);
  if (/\btra due settimane\b/.test(lower)) return addDays(monday, 14 + idx);
  if (/\bprossim[oa]\b/.test(lower)) return addDays(monday, 7 + idx); // "giovedì prossimo" = settimana successiva
  return addDays(today, ((idx - todayIdx - 1 + 7) % 7) + 1); // primo giorno così, da domani in poi
}

function parseTime(clause: string): string | null {
  const m = /\balle?\s+(\d{1,2}|[a-zà-ÿ]+)(?:[:.](\d{2}))?(?:\s+e\s+(mezza|mezzo|un quarto))?/i.exec(clause);
  if (!m) return null;
  let h = /^\d+$/.test(m[1]) ? Number(m[1]) : HOUR_WORDS[m[1].toLowerCase()];
  if (h === undefined || h > 23) return null;
  let min = m[2] ? Number(m[2]) : 0;
  if (m[3]) min = m[3].startsWith("mez") ? 30 : 15;
  if (h >= 1 && h <= 6) h += 12; // in ufficio "alle tre" è il pomeriggio
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function titleFor(clause: string, tipo: ImpegnoModel["tipo"], names: string[]): string {
  if (tipo === "evento") {
    const kw = EVENT_WORDS.find((w) => hasWord(w, clause)) ?? "incontro";
    const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0];
    return who ? `${cap(kw)} con ${who}` : cap(kw);
  }
  const cleaned = clause
    .replace(/\b(ricordami|ricordati|ricorda)\s+di\b/gi, "")
    .replace(/\bdevo\b/gi, "")
    .replace(/\b(entro|tra due settimane|dopodomani|domani|oggi|prossim[oa])\b/gi, "")
    .replace(DAY_RE, "")
    .replace(/\balle?\s+(\d{1,2}|[a-zà-ÿ]+)(?:[:.]\d{2})?(?:\s+e\s+(mezza|mezzo|un quarto))?/gi, "")
    .replace(/[,.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cap(cleaned) : "Promemoria";
}

export function parseSentence(text: string, now: Date): ImpegnoModel[] {
  const today = localParts(now).ymd;
  const clauses = text.split(/(?:\.\s+|;\s+|,?\s+e\s+(?=(?:ricordami|ricordati|ricorda|devo)\b)|,?\s+poi\s+)/i).map((c) => c.trim()).filter(Boolean);
  const out: ImpegnoModel[] = [];

  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    const names = (NAMES_RE.exec(clause)?.[1] ?? "").split(/\s+e\s+|,\s*/).map((n) => n.trim()).filter(Boolean);
    const isEventWord = EVENT_WORDS.some((w) => hasWord(w, clause));
    const data = parseDate(clause, today);
    const ora = parseTime(clause);
    if (!names.length && !isEventWord && !ACTION_RE.test(clause) && !data && !ora) continue; // non è un impegno

    const tipo = names.length > 0 || isEventWord ? "evento" : "promemoria";
    const teams = /\b(teams|videochiamata|online)\b/.test(lower);
    const sede = /\bin (sede|ufficio)\b/.test(lower);
    out.push({
      tipo,
      titolo: titleFor(clause, tipo, names),
      descrizione: null,
      data,
      oraInizio: ora,
      durataMinuti: null,
      modalita: tipo === "evento" ? (teams ? "teams" : sede ? "presenza" : null) : null,
      luogo: sede ? "In sede" : null,
      partecipanti: tipo === "evento" ? names : [],
      priorita: /\b(urgente|importante)\b/.test(lower) ? "alta" : "normale",
    });
  }
  return out;
}
