import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { handleEditText } from "../handlers/editText";

app.http("editText", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "notes/{id}/text",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await req.json().catch(() => ({}))) as { text?: unknown };
      const out = await handleEditText(getDeps((l) => ctx.log(l)), {
        authorization: req.headers.get("authorization"),
        noteId: req.params.id,
        text: body.text,
      });
      return { status: out.status, jsonBody: out.json };
    } catch {
      ctx.error("modifica.errore_inatteso");
      return { status: 500, jsonBody: { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." } };
    }
  },
});
