/** Frasi di esempio per l'anteprima: nell'anteprima non c'è un vero microfono né un vero riconoscimento vocale. */
export const SAMPLES = [
  { label: "Riunione su Teams e un promemoria", text: "Giovedì prossimo alle dieci riunione con Mario Rossi su Teams e ricordami di pagare la bolletta venerdì" },
  { label: "Pranzo con due persone (manca l'ora)", text: "Lunedì pranzo con Anna e Luca" },
  { label: "Promemoria per domani", text: "Domani alle 15 chiamare il commercialista" },
  { label: "Manca tutto (nessuna data)", text: "Chiama Mario" },
] as const;

export const demoState: { sentence: string } = { sentence: SAMPLES[0].text };
