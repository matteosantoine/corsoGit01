import { DefaultAzureCredential, ManagedIdentityCredential, OnBehalfOfCredential } from "@azure/identity";
import { createVerifier } from "./auth";
import { resolveDevBypass } from "./config";
import { createRateLimiter, DEFAULT_LIMITS } from "./rateLimit";
import type { CommitDeps } from "./handlers/commit";
import type { DeleteNoteDeps } from "./handlers/deleteNote";
import type { NotesListDeps } from "./handlers/notesList";
import type { SettingsDeps } from "./handlers/settings";
import type { TodayDeps } from "./handlers/today";
import type { ConfirmDeps } from "./handlers/confirm";
import type { EditTextDeps } from "./handlers/editText";
import type { ExtractDeps } from "./handlers/extract";
import type { PeopleDeps } from "./handlers/people";
import type { PurgeDeps } from "./handlers/purge";
import type { Deps } from "./handlers/transcribe";
import { makeLog } from "./logger";
import { createCosmosNotes } from "./services/notes.cosmos";
import { createOpenAiExtractor } from "./services/extractor";
import { createGraphAgenda } from "./services/graphRead";
import { createGraphWriter } from "./services/graphWrite";
import { createCosmosSettings } from "./services/settings.cosmos";
import { createGraphPeople } from "./services/people";
import { createSpeechClient } from "./services/speech";

const need = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Variabile di configurazione mancante: ${name}`);
  return v;
};

export type AllDeps = Deps & ExtractDeps & EditTextDeps & PeopleDeps & ConfirmDeps & CommitDeps & TodayDeps & NotesListDeps & SettingsDeps & DeleteNoteDeps & PurgeDeps;
let cached: AllDeps | undefined;

/** Flusso On-Behalf-Of: la "password" dell'app è un'asserzione dell'identità gestita (nessun segreto). */
async function getGraphToken(userToken: string): Promise<string> {
  const managed = new ManagedIdentityCredential(process.env.AZURE_CLIENT_ID ?? "");
  const obo = new OnBehalfOfCredential({
    tenantId: need("ENTRA_TENANT_ID"),
    clientId: need("ENTRA_API_CLIENT_ID"),
    userAssertionToken: userToken,
    getAssertion: async () => (await managed.getToken("api://AzureADTokenExchange/.default")).token,
  });
  return (await obo.getToken("https://graph.microsoft.com/.default")).token;
}

/** Dipendenze reali, create una volta sola (identità gestita in Azure, `az login` in locale). */
export function getDeps(sink: (line: string) => void): AllDeps {
  if (cached) return cached;
  const credential = new DefaultAzureCredential({ managedIdentityClientId: process.env.AZURE_CLIENT_ID });
  cached = {
    verify: createVerifier({
      tenantId: need("ENTRA_TENANT_ID"),
      clientId: need("ENTRA_API_CLIENT_ID"),
      devBypassUser: resolveDevBypass(process.env), // errore all'avvio se impostato fuori dallo sviluppo locale
    }),
    speech: createSpeechClient({
      endpoint: need("SPEECH_ENDPOINT"),
      getToken: async () => (await credential.getToken("https://cognitiveservices.azure.com/.default")).token,
    }),
    notes: createCosmosNotes({ endpoint: need("COSMOS_ENDPOINT"), database: need("COSMOS_DATABASE"), credential }),
    extractor: createOpenAiExtractor({
      endpoint: need("OPENAI_ENDPOINT"),
      deployment: need("OPENAI_DEPLOYMENT"),
      getToken: async () => (await credential.getToken("https://cognitiveservices.azure.com/.default")).token,
    }),
    people: createGraphPeople({ getGraphToken }),
    calendar: createGraphWriter({ getGraphToken }),
    agenda: createGraphAgenda({ getGraphToken }),
    settings: createCosmosSettings({ endpoint: need("COSMOS_ENDPOINT"), database: need("COSMOS_DATABASE"), credential }),
    rateLimit: createRateLimiter(DEFAULT_LIMITS),
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
    log: makeLog(sink),
  };
  return cached;
}
