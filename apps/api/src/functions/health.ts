import { app } from "@azure/functions";
import { reply } from "../http";

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: async () => reply(200, { ok: true }),
});
