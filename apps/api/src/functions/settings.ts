import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { handleGetSettings, handlePutSettings } from "../handlers/settings";

app.http("settings", {
  methods: ["GET", "PUT"],
  authLevel: "anonymous",
  route: "settings",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const deps = getDeps((l) => ctx.log(l));
      const authorization = req.headers.get("authorization");
      const out = req.method === "PUT"
        ? await handlePutSettings(deps, { authorization, body: await req.json().catch(() => null) })
        : await handleGetSettings(deps, { authorization });
      return { status: out.status, jsonBody: out.json };
    } catch {
      ctx.error("impostazioni.errore_inatteso");
      return { status: 500, jsonBody: { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." } };
    }
  },
});
