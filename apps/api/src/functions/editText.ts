import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { MAX_BODY, reply, tooLarge } from "../http";
import { handleEditText } from "../handlers/editText";

app.http("editText", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "notes/{id}/text",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const big = tooLarge(req, MAX_BODY.testo);
      if (big) return big;
      const body = (await req.json().catch(() => ({}))) as { text?: unknown };
      const out = await handleEditText(getDeps((l) => ctx.log(l)), {
        authorization: req.headers.get("authorization"),
        noteId: req.params.id,
        text: body.text,
      });
      return reply(out.status, out.json);
    } catch {
      ctx.error("modifica.errore_inatteso");
      return reply(500, { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." });
    }
  },
});
