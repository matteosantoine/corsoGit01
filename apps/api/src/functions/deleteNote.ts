import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { reply } from "../http";
import { handleDeleteNote } from "../handlers/deleteNote";

app.http("deleteNote", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "notes/{id}",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const out = await handleDeleteNote(getDeps((l) => ctx.log(l)), {
        authorization: req.headers.get("authorization"),
        noteId: req.params.id,
      });
      return reply(out.status, out.json);
    } catch {
      ctx.error("elimina.errore_inatteso");
      return reply(500, { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." });
    }
  },
});
