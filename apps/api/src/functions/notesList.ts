import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { handleNotesList } from "../handlers/notesList";

app.http("notesList", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "notes",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const out = await handleNotesList(getDeps((l) => ctx.log(l)), {
        authorization: req.headers.get("authorization"),
        q: req.query.get("q"),
        before: req.query.get("before"),
      });
      return { status: out.status, jsonBody: out.json };
    } catch {
      ctx.error("note.errore_inatteso");
      return { status: 500, jsonBody: { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." } };
    }
  },
});
