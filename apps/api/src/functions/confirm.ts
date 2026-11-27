import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { MAX_BODY, reply, tooLarge } from "../http";
import { handleConfirm } from "../handlers/confirm";

app.http("confirm", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "notes/{id}/confirm",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const big = tooLarge(req, MAX_BODY.conferma);
      if (big) return big;
      const out = await handleConfirm(getDeps((l) => ctx.log(l)), {
        authorization: req.headers.get("authorization"),
        noteId: req.params.id,
        body: await req.json().catch(() => null),
      });
      return reply(out.status, out.json);
    } catch {
      ctx.error("conferma.errore_inatteso");
      return reply(500, { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." });
    }
  },
});
