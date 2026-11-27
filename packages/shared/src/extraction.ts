import "./jitless"; // deve venire prima della creazione degli schemi
import { z } from "zod";

/** Limiti sui dati: difendono memoria, database e inviti da contenuti enormi o da un modello che esagera. */
export const LIMITS = { titolo: 200, descrizione: 2000, luogo: 200, nome: 100, email: 254, persone: 20, impegni: 20 } as const;

export const CampoMancante = z.enum(["data", "ora", "partecipanti"]);
export type CampoMancante = z.infer<typeof CampoMancante>;

const base = {
  tipo: z.enum(["evento", "promemoria"]),
  titolo: z.string().min(1).max(LIMITS.titolo),
  descrizione: z.string().max(LIMITS.descrizione).nullable(),
  durataMinuti: z.number().int().positive().max(1440).nullable(),
  modalita: z.enum(["presenza", "teams"]).nullable(),
  luogo: z.string().max(LIMITS.luogo).nullable(),
  partecipanti: z.array(z.string().max(LIMITS.nome)).max(LIMITS.persone),
  priorita: z.enum(["bassa", "normale", "alta"]),
};

/**
 * Come lo restituisce il modello: tollerante sulle lunghezze (si accorcia dopo, in normalizeItems),
 * perché un titolo troppo lungo non deve far fallire l'intera estrazione.
 */
export const ImpegnoModelSchema = z.object({
  tipo: z.enum(["evento", "promemoria"]),
  titolo: z.string(),
  descrizione: z.string().nullable(),
  data: z.string().nullable(),
  oraInizio: z.string().nullable(),
  durataMinuti: z.number().int().nullable(),
  modalita: z.enum(["presenza", "teams"]).nullable(),
  luogo: z.string().nullable(),
  partecipanti: z.array(z.string()).max(200),
  priorita: z.enum(["bassa", "normale", "alta"]),
});
export const EstrazioneModelSchema = z.object({ items: z.array(ImpegnoModelSchema).max(LIMITS.impegni) });

/** Persona invitata: il nome detto dall'utente e l'indirizzo scelto/inserito. */
export const InvitatoSchema = z.object({
  nome: z.string().min(1).max(LIMITS.nome),
  email: z.string().email().max(LIMITS.email),
  /** Nome con cui compare nei contatti, se è stato trovato lì. */
  nomeContatto: z.string().nullable(),
});
export const StatoImpegno = z.enum(["da_confermare", "confermato", "scartato", "in_creazione", "creato"]);
/** Traccia della creazione in Outlook / To Do (la scrive solo il server). */
export const CreazioneSchema = z.object({
  tipo: z.enum(["evento", "task"]),
  id: z.string().nullable(),
  iniziatoIl: z.string(),
  creatoIl: z.string().nullable(),
});

/** Impegno definitivo: validato, con l'elenco di ciò che manca calcolato dal codice. */
export const ImpegnoSchema = z.object({
  ...base,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  oraInizio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  mancanti: z.array(CampoMancante),
  /** Compilati dalla fase "contatti" in poi (opzionali: l'estrazione non li produce). */
  invitati: z.array(InvitatoSchema).max(LIMITS.persone).optional(),
  stato: StatoImpegno.optional(),
  creazione: CreazioneSchema.optional(),
});
export const EstrazioneSchema = z.object({ items: z.array(ImpegnoSchema).max(LIMITS.impegni) });

export type Invitato = z.infer<typeof InvitatoSchema>;
export type StatoImpegno = z.infer<typeof StatoImpegno>;
export type Creazione = z.infer<typeof CreazioneSchema>;
export type ImpegnoModel = z.infer<typeof ImpegnoModelSchema>;
export type Impegno = z.infer<typeof ImpegnoSchema>;
export type Estrazione = z.infer<typeof EstrazioneSchema>;
