import { demoState } from "./state";
import { createDemoServer } from "./server";

export const DEMO_ORIGIN = "http://demo.local";

/** Anteprima: le chiamate all'"API" vengono risolte nel browser dal finto server. Tutto il resto passa normalmente. */
export function installDemo(): void {
  const server = createDemoServer({ getSentence: () => demoState.sentence });
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    if (url.origin !== DEMO_ORIGIN) return realFetch(input, init);
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 350)); // tempi realistici
    const out = await server.handle({
      method: (init?.method ?? "GET").toUpperCase(),
      url,
      headers: new Headers(init?.headers),
      body: (init?.body as BodyInit | null | undefined) ?? null,
    });
    return new Response(JSON.stringify(out.json), { status: out.status, headers: { "Content-Type": "application/json" } });
  };
}
