import { describe, expect, it } from "vitest";
import { createQueue, memoryKV } from "./queue";

const blob = () => new Blob(["x"]);

describe("coda delle registrazioni", () => {
  it("aggiunge, elenca dalla più vecchia e rimuove", async () => {
    const q = createQueue(memoryKV());
    const a = await q.add(blob(), 3, "utente-1");
    await new Promise((r) => setTimeout(r, 5));
    const b = await q.add(blob(), 4, "utente-1");
    expect((await q.list("utente-1")).map((n) => n.id)).toEqual([a.id, b.id]);
    await q.remove(a.id);
    expect((await q.list("utente-1")).map((n) => n.id)).toEqual([b.id]);
  });
  it("un altro account NON vede le registrazioni altrui: vengono eliminate dal dispositivo", async () => {
    const kv = memoryKV();
    const q = createQueue(kv);
    await q.add(blob(), 3, "utente-1");
    await q.add(blob(), 3, "utente-1");
    expect(await q.list("utente-2")).toEqual([]);
    expect(await kv.keys()).toEqual([]); // l'audio del primo utente non è rimasto sul computer condiviso
    expect(await q.list("utente-1")).toEqual([]); // e non torna nemmeno al primo
  });
  it("le registrazioni dell'account corrente restano quando ne esistono anche di altri", async () => {
    const q = createQueue(memoryKV());
    const mia = await q.add(blob(), 3, "io");
    await q.add(blob(), 3, "altro");
    expect((await q.list("io")).map((n) => n.id)).toEqual([mia.id]);
  });
  it("registrazioni senza proprietario (versioni vecchie) non vengono mai inviate", async () => {
    const kv = memoryKV();
    await kv.set("coda-audio:vecchia", { id: "vecchia", createdAt: "x", durationSec: 1, audio: blob() });
    expect(await createQueue(kv).list("io")).toEqual([]);
    expect(await kv.keys()).toEqual([]);
  });
  it("ignora chiavi che non sono della coda", async () => {
    const kv = memoryKV();
    await kv.set("altro:1", { x: 1 });
    await createQueue(kv).list("io");
    expect(await kv.keys()).toEqual(["altro:1"]);
  });
});
