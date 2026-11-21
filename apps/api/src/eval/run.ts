/**
 * Prova il modello VERO sui casi di EVAL_CASES (serve Azure OpenAI configurato e `az login`).
 * Uso: OPENAI_ENDPOINT=... OPENAI_DEPLOYMENT=estrazione npm run eval -w apps/api
 */
import { DefaultAzureCredential } from "@azure/identity";
import { normalizeItems } from "@impegni/shared";
import { createOpenAiExtractor } from "../services/extractor";
import { EVAL_CASES, EVAL_NOW } from "./cases";

async function main() {
  const endpoint = process.env.OPENAI_ENDPOINT;
  const deployment = process.env.OPENAI_DEPLOYMENT;
  if (!endpoint || !deployment) throw new Error("Imposta OPENAI_ENDPOINT e OPENAI_DEPLOYMENT.");
  const credential = new DefaultAzureCredential();
  const extractor = createOpenAiExtractor({
    endpoint,
    deployment,
    getToken: async () => (await credential.getToken("https://cognitiveservices.azure.com/.default")).token,
  });

  let failed = 0;
  for (const c of EVAL_CASES) {
    const ctx = { now: EVAL_NOW, defaultDurationMin: 60 };
    const got = normalizeItems(await extractor.extract(c.frase, ctx), { now: EVAL_NOW, defaultDurationMin: 60 });
    const problems: string[] = [];
    if (got.length !== c.atteso.length) problems.push(`impegni: attesi ${c.atteso.length}, trovati ${got.length}`);
    c.atteso.forEach((exp, i) => {
      for (const [k, v] of Object.entries(exp)) {
        const actual = (got[i] as Record<string, unknown> | undefined)?.[k];
        if (JSON.stringify(actual) !== JSON.stringify(v)) problems.push(`#${i + 1} ${k}: atteso ${JSON.stringify(v)}, trovato ${JSON.stringify(actual)}`);
      }
    });
    if (problems.length) failed++;
    console.log(`${problems.length ? "KO" : "OK"}  ${c.frase}${problems.map((p) => `\n      ${p}`).join("")}`);
  }
  console.log(`\n${EVAL_CASES.length - failed}/${EVAL_CASES.length} casi superati`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(2); });
