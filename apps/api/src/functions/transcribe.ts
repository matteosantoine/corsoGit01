import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { getDeps } from "../deps";
import { MAX_BODY, reply, tooLarge } from "../http";
import { handleTranscribe } from "../handlers/transcribe";

// authLevel anonymous: l'accesso è protetto dal token Microsoft Entra, verificato nel codice.
app.http("transcribe", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "transcribe",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const big = tooLarge(req, MAX_BODY.audio);
      if (big) return big;
      const out = await handleTranscribe(getDeps((l) => ctx.log(l)), {
        authorization: req.headers.get("authorization"),
        contentType: req.headers.get("content-type"),
        body: await req.arrayBuffer(),
      });
      return reply(out.status, out.json);
    } catch {
      ctx.error("transcribe.errore_inatteso");
      return reply(500, { error: "errore", messaggio: "Qualcosa non ha funzionato. Riprova." });
    }
  },
});
