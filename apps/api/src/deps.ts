import { DefaultAzureCredential } from "@azure/identity";
import { createVerifier } from "./auth";
import type { Deps } from "./handlers/transcribe";
import { makeLog } from "./logger";
import { createCosmosNotes } from "./services/notes";
import { createSpeechClient } from "./services/speech";

const need = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Variabile di configurazione mancante: ${name}`);
  return v;
};

let cached: Deps | undefined;

/** Dipendenze reali, create una volta sola (identità gestita in Azure, `az login` in locale). */
export function getDeps(sink: (line: string) => void): Deps {
  if (cached) return cached;
  const credential = new DefaultAzureCredential({ managedIdentityClientId: process.env.AZURE_CLIENT_ID });
  cached = {
    verify: createVerifier({
      tenantId: need("ENTRA_TENANT_ID"),
      clientId: need("ENTRA_API_CLIENT_ID"),
      devBypassUser: process.env.DEV_AUTH_BYPASS_USER || undefined,
    }),
    speech: createSpeechClient({
      endpoint: need("SPEECH_ENDPOINT"),
      getToken: async () => (await credential.getToken("https://cognitiveservices.azure.com/.default")).token,
    }),
    notes: createCosmosNotes({ endpoint: need("COSMOS_ENDPOINT"), database: need("COSMOS_DATABASE"), credential }),
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
    log: makeLog(sink),
  };
  return cached;
}
