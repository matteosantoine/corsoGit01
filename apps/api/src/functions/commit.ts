import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { handleCommit } from "../handlers/commit";

app.http("commit", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "notes/{id}/commit",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const out = await handleCommit(getDeps((l) => ctx.log(l)), {
        authorization: req.headers.get("authorization"),
        noteId: req.params.id,
      });
      return { status: out.status, jsonBody: out.json };
    } catch {
      ctx.error("commit.errore_inatteso");
      return { status: 500, jsonBody: { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." } };
    }
  },
});
