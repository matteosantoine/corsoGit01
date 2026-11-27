import { app, type InvocationContext, type Timer } from "@azure/functions";
import { getDeps } from "../deps";
import { handlePurge } from "../handlers/purge";

// Ogni notte alle 03:30 UTC. Elimina le note più vecchie del periodo di conservazione di ciascun utente.
app.timer("purgeNotes", {
  schedule: "0 30 3 * * *",
  runOnStartup: false,
  handler: async (_timer: Timer, ctx: InvocationContext): Promise<void> => {
    try {
      await handlePurge(getDeps((l) => ctx.log(l)));
    } catch {
      ctx.error("pulizia.errore_inatteso");
    }
  },
});
