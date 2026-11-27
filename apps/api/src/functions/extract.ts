import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { reply } from "../http";
import { handleExtract } from "../handlers/extract";

app.http("extract", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "notes/{id}/extract",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const out = await handleExtract(getDeps((l) => ctx.log(l)), {
        authorization: req.headers.get("authorization"),
        noteId: req.params.id,
      });
      return reply(out.status, out.json);
    } catch {
      ctx.error("extract.errore_inatteso");
      return reply(500, { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." });
    }
  },
});
