import { EstrazioneModelSchema, type ImpegnoModel } from "@impegni/shared";
import { buildSystemPrompt, buildUserMessage } from "../prompts/extraction";

export class ExtractionError extends Error {}

export interface Extractor {
  extract(text: string, ctx: { now: Date; defaultDurationMin: number }): Promise<ImpegnoModel[]>;
}

/** Schema JSON per le "structured outputs" (strict): tutti i campi obbligatori, nullable dove serve. */
const nullableString = { type: ["string", "null"] } as const;
export const IMPEGNI_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "titolo", "descrizione", "data", "oraInizio", "durataMinuti", "modalita", "luogo", "partecipanti", "priorita"],
        properties: {
          tipo: { type: "string", enum: ["evento", "promemoria"] },
          titolo: { type: "string" },
          descrizione: nullableString,
          data: { type: ["string", "null"], description: "YYYY-MM-DD oppure null" },
          oraInizio: { type: ["string", "null"], description: "HH:mm (24 ore) oppure null" },
          durataMinuti: { type: ["integer", "null"] },
          modalita: { type: ["string", "null"], enum: ["presenza", "teams", null] },
          luogo: nullableString,
          partecipanti: { type: "array", items: { type: "string" } },
          priorita: { type: "string", enum: ["bassa", "normale", "alta"] },
        },
      },
    },
  },
} as const;

type Options = {
  endpoint: string; // https://<nome>.openai.azure.com
  deployment: string;
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
};

export function createOpenAiExtractor({ endpoint, deployment, getToken, fetchImpl = fetch }: Options): Extractor {
  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=2024-10-21`;
  return {
    async extract(text, ctx) {
      let res: Response;
      try {
        res = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
          body: JSON.stringify({
            messages: [
              { role: "system", content: buildSystemPrompt(ctx.now, ctx.defaultDurationMin) },
              { role: "user", content: buildUserMessage(text) },
            ],
            temperature: 0,
            max_tokens: 1500,
            response_format: {
              type: "json_schema",
              json_schema: { name: "impegni", strict: true, schema: IMPEGNI_JSON_SCHEMA },
            },
          }),
        });
      } catch {
        throw new ExtractionError("servizio non raggiungibile");
      }
      if (!res.ok) throw new ExtractionError(`risposta ${res.status}`);

      const data = (await res.json()) as {
        choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
      };
      const choice = data.choices?.[0];
      if (!choice?.message?.content || choice.message.refusal) throw new ExtractionError("nessun contenuto");
      if (choice.finish_reason === "length") throw new ExtractionError("risposta troncata");

      let json: unknown;
      try {
        json = JSON.parse(choice.message.content);
      } catch {
        throw new ExtractionError("json non valido");
      }
      const parsed = EstrazioneModelSchema.safeParse(json);
      if (!parsed.success) throw new ExtractionError("struttura non valida");
      return parsed.data.items;
    },
  };
}
