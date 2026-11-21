import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { handleConfirm } from "../handlers/confirm";

app.http("confirm", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "notes/{id}/confirm",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const out = await handleConfirm(getDeps((l) => ctx.log(l)), {
        authorization: req.headers.get("authorization"),
        noteId: req.params.id,
        body: await req.json().catch(() => null),
      });
      return { status: out.status, jsonBody: out.json };
    } catch {
      ctx.error("conferma.errore_inatteso");
      return { status: 500, jsonBody: { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." } };
    }
  },
});
