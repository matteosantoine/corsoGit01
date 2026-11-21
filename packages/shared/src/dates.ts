export const TZ = "Europe/Rome";
export const WEEKDAYS_IT = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"] as const;

/** Data (YYYY-MM-DD), ora (HH:mm) e giorno della settimana (0 = lunedì) di un istante, nel fuso indicato. */
export function localParts(now: Date, tz: string = TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  return { ymd, hm: `${parts.hour}:${parts.minute}`, weekday: weekdayOf(ymd) };
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = lunedì … 6 = domenica */
export function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Vero solo per date di calendario reali (rifiuta 2026-02-30). */
export function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const WEEK_LABELS = ["questa settimana", "settimana prossima", "tra due settimane", "tra tre settimane", "tra quattro settimane"];
const DAY_LABELS = ["oggi", "domani", "dopodomani"];

/**
 * Tabella dei prossimi giorni, da dare al modello: così non deve calcolare i giorni
 * della settimana (dove sbaglierebbe) ma solo leggerli.
 */
export function buildCalendar(now: Date, days = 35, tz: string = TZ): string {
  const today = localParts(now, tz);
  return Array.from({ length: days }, (_, i) => {
    const ymd = addDays(today.ymd, i);
    const week = WEEK_LABELS[Math.floor((today.weekday + i) / 7)] ?? "più avanti";
    const tag = DAY_LABELS[i] ? `${DAY_LABELS[i]}, ` : "";
    return `- ${WEEKDAYS_IT[weekdayOf(ymd)]} ${ymd} (${tag}${week})`;
  }).join("\n");
}

/** Somma minuti a data e ora "da calendario" (senza fuso): serve per calcolare la fine di un evento, anche oltre la mezzanotte. */
export function addMinutesLocal(ymd: string, hm: string, minutes: number): { ymd: string; hm: string } {
  const [y, mo, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h, mi + minutes));
  const iso = t.toISOString();
  return { ymd: iso.slice(0, 10), hm: iso.slice(11, 16) };
}
