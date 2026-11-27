import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { reply } from "../http";
import { handleToday } from "../handlers/today";

app.http("today", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "today",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const out = await handleToday(getDeps((l) => ctx.log(l)), { authorization: req.headers.get("authorization") });
      return reply(out.status, out.json);
    } catch {
      ctx.error("oggi.errore_inatteso");
      return reply(500, { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." });
    }
  },
});
