import { z } from "zod";

/** Schema dell'estrazione impegni (usato da backend e frontend). */
export const CampoMancante = z.enum(["data", "ora", "partecipanti"]);

export const ImpegnoSchema = z.object({
  tipo: z.enum(["evento", "promemoria"]),
  titolo: z.string().min(1),
  descrizione: z.string().nullable(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  oraInizio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  durataMinuti: z.number().int().positive().nullable(),
  modalita: z.enum(["presenza", "teams"]).nullable(),
  luogo: z.string().nullable(),
  partecipanti: z.array(z.string()),
  priorita: z.enum(["bassa", "normale", "alta"]),
  mancanti: z.array(CampoMancante),
});

export const EstrazioneSchema = z.object({ items: z.array(ImpegnoSchema) });

export type Impegno = z.infer<typeof ImpegnoSchema>;
export type Estrazione = z.infer<typeof EstrazioneSchema>;
