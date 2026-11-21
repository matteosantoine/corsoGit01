import { addDays, computeMancanti, type CampoMancante, type Impegno } from "@impegni/shared";

export type Question = { index: number; field: CampoMancante };

/** Prossima domanda da fare: il primo dato mancante del primo impegno incompleto. */
export function nextQuestion(items: Impegno[]): Question | null {
  for (let index = 0; index < items.length; index++) {
    const field = items[index].mancanti[0];
    if (field) return { index, field };
  }
  return null;
}

export const QUESTION_TEXT: Record<CampoMancante, string> = {
  data: "Per quando è?",
  ora: "A che ora?",
  partecipanti: "Chi deve esserci?",
};

/** Data di oggi sul dispositivo (YYYY-MM-DD), senza passare da UTC. */
export function todayLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export const quickDates = (now: Date = new Date()) => {
  const t = todayLocal(now);
  return [
    { label: "Oggi", value: t },
    { label: "Domani", value: addDays(t, 1) },
    { label: "Dopodomani", value: addDays(t, 2) },
  ];
};

export const QUICK_TIMES = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];

export type Answer =
  | { field: "data"; value: string }
  | { field: "ora"; value: string }
  | { field: "partecipanti"; value: string[] | "nessuno" };

/** Applica una risposta all'impegno e ricalcola cosa manca. */
export function applyAnswer(item: Impegno, a: Answer): Impegno {
  let next: Impegno = { ...item };
  if (a.field === "data") next.data = a.value;
  else if (a.field === "ora") next.oraInizio = a.value;
  else if (a.value === "nessuno") {
    // Senza altre persone non è un evento: diventa un promemoria personale.
    next = { ...next, tipo: "promemoria", partecipanti: [], modalita: null, durataMinuti: null };
  } else {
    next.partecipanti = a.value.map((n) => n.trim()).filter(Boolean);
  }
  next.mancanti = computeMancanti(next);
  return next;
}

/** "Mario, Anna e Luca" → ["Mario","Anna","Luca"] */
export function parseNames(input: string): string[] {
  return input.split(/,|;|\se\s|\+/i).map((s) => s.trim()).filter(Boolean);
}

const fmtDate = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });
export function describeWhen(item: Pick<Impegno, "data" | "oraInizio">): string {
  if (!item.data) return "data da decidere";
  const [y, m, d] = item.data.split("-").map(Number);
  const day = fmtDate.format(new Date(y, m - 1, d));
  return item.oraInizio ? `${day}, ore ${item.oraInizio}` : day;
}
