const day = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });

const ymdToDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** "Oggi, sabato 21 novembre" / "Domani, domenica 22 novembre" */
export function dayTitle(ymd: string, todayYmd: string): string {
  const base = day.format(ymdToDate(ymd));
  const diff = Math.round((ymdToDate(ymd).getTime() - ymdToDate(todayYmd).getTime()) / 86_400_000);
  return diff === 0 ? `Oggi, ${base}` : diff === 1 ? `Domani, ${base}` : base;
}

/** "10:00–11:00", "Tutto il giorno". Una fine a "24:00" si scrive "00:00". */
export function timeRange(inizio: string | null, fine: string | null): string {
  if (!inizio) return "Tutto il giorno";
  const f = fine === "24:00" ? "00:00" : fine;
  return f && f !== inizio ? `${inizio}–${f}` : inizio;
}

/** "giovedì 26 novembre, 10:15" (ora del dispositivo) */
export function noteWhen(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${day.format(d)}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Stato = string;
export function statoLabel(stato: Stato, tipo: "evento" | "promemoria"): { testo: string; tono: "ok" | "neutro" | "attesa" } {
  switch (stato) {
    case "creato": return { testo: tipo === "evento" ? "Nel calendario" : "In To Do", tono: "ok" };
    case "scartato": return { testo: "Scartato", tono: "neutro" };
    case "confermato": return { testo: "Confermato, da creare", tono: "attesa" };
    case "in_creazione": return { testo: "In creazione", tono: "attesa" };
    default: return { testo: "Non confermato", tono: "neutro" };
  }
}

export const ANTICIPO_LABEL: Record<number, string> = {
  0: "All'ora dell'incontro", 5: "5 minuti prima", 10: "10 minuti prima", 15: "15 minuti prima",
  30: "30 minuti prima", 60: "1 ora prima", 1440: "1 giorno prima",
};
export function durataLabel(m: number): string {
  const h = Math.floor(m / 60), r = m % 60;
  const ore = h === 1 ? "1 ora" : `${h} ore`;
  return h === 0 ? `${m} minuti` : r === 0 ? ore : `${ore} e ${r} minuti`;
}

export const conservazioneLabel = (giorni: number) => (giorni === 365 ? "1 anno" : `${giorni} giorni`);
