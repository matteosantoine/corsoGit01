import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
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
      return { status: out.status, jsonBody: out.json };
    } catch {
      ctx.error("extract.errore_inatteso");
      return { status: 500, jsonBody: { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." } };
    }
  },
});
