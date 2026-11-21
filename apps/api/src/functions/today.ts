import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { handleToday } from "../handlers/today";

app.http("today", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "today",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const out = await handleToday(getDeps((l) => ctx.log(l)), { authorization: req.headers.get("authorization") });
      return { status: out.status, jsonBody: out.json };
    } catch {
      ctx.error("oggi.errore_inatteso");
      return { status: 500, jsonBody: { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." } };
    }
  },
});
