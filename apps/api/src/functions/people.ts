import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { reply } from "../http";
import { handlePeople } from "../handlers/people";

app.http("people", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "people",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const out = await handlePeople(getDeps((l) => ctx.log(l)), {
        authorization: req.headers.get("authorization"),
        query: req.query.get("q"),
      });
      return reply(out.status, out.json);
    } catch {
      ctx.error("people.errore_inatteso");
      return reply(500, { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." });
    }
  },
});
