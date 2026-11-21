import { z } from "zod";

export const CampoMancante = z.enum(["data", "ora", "partecipanti"]);
export type CampoMancante = z.infer<typeof CampoMancante>;

const base = {
  tipo: z.enum(["evento", "promemoria"]),
  titolo: z.string().min(1),
  descrizione: z.string().nullable(),
  durataMinuti: z.number().int().positive().nullable(),
  modalita: z.enum(["presenza", "teams"]).nullable(),
  luogo: z.string().nullable(),
  partecipanti: z.array(z.string()),
  priorita: z.enum(["bassa", "normale", "alta"]),
};

/** Come lo restituisce il modello: data e ora grezze, da validare in codice. */
export const ImpegnoModelSchema = z.object({
  ...base,
  data: z.string().nullable(),
  oraInizio: z.string().nullable(),
});
export const EstrazioneModelSchema = z.object({ items: z.array(ImpegnoModelSchema) });

/** Persona invitata: il nome detto dall'utente e l'indirizzo scelto/inserito. */
export const InvitatoSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  /** Nome con cui compare nei contatti, se è stato trovato lì. */
  nomeContatto: z.string().nullable(),
});
export const StatoImpegno = z.enum(["da_confermare", "confermato", "scartato", "creato"]);

/** Impegno definitivo: validato, con l'elenco di ciò che manca calcolato dal codice. */
export const ImpegnoSchema = z.object({
  ...base,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  oraInizio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  mancanti: z.array(CampoMancante),
  /** Compilati dalla fase "contatti" in poi (opzionali: l'estrazione non li produce). */
  invitati: z.array(InvitatoSchema).optional(),
  stato: StatoImpegno.optional(),
});
export const EstrazioneSchema = z.object({ items: z.array(ImpegnoSchema) });

export type Invitato = z.infer<typeof InvitatoSchema>;
export type StatoImpegno = z.infer<typeof StatoImpegno>;
export type ImpegnoModel = z.infer<typeof ImpegnoModelSchema>;
export type Impegno = z.infer<typeof ImpegnoSchema>;
export type Estrazione = z.infer<typeof EstrazioneSchema>;
