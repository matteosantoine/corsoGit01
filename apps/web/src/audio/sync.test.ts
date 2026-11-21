import { describe, expect, it } from "vitest";
import type { QueuedNote } from "./queue";
import { syncQueue, type SendResult } from "./sync";

const note = (id: string): QueuedNote => ({ id, createdAt: id, durationSec: 3, audio: new Blob(["x"]) });

function setup(ids: string[], results: Record<string, SendResult>) {
  const queue = new Map(ids.map((i) => [i, note(i)]));
  const sendOrder: string[] = [];
  const deps = {
    list: async () => [...queue.values()],
    remove: async (id: string) => void queue.delete(id),
    send: async (n: QueuedNote) => { sendOrder.push(n.id); return results[n.id]; },
  };
  return { queue, sendOrder, deps };
}

describe("syncQueue", () => {
  it("cancella l'audio locale solo dopo la conferma del server", async () => {
    const { queue, deps } = setup(["a", "b"], {
      a: { kind: "ok", text: "uno", noteId: "1" },
      b: { kind: "ok", text: "due", noteId: "2" },
    });
    const r = await syncQueue(deps);
    expect(r.sent.map((s) => s.text)).toEqual(["uno", "due"]);
    expect(queue.size).toBe(0);
  });

  it("con errore di rete l'audio resta in coda e si ferma", async () => {
    const { queue, sendOrder, deps } = setup(["a", "b"], { a: { kind: "retry" }, b: { kind: "ok", text: "x", noteId: "2" } });
    await syncQueue(deps);
    expect(queue.size).toBe(2);
    expect(sendOrder).toEqual(["a"]);
  });

  it("accesso scaduto: l'audio resta e lo segnala", async () => {
    const { queue, deps } = setup(["a"], { a: { kind: "auth" } });
    const r = await syncQueue(deps);
    expect(r.stoppedForAuth).toBe(true);
    expect(queue.size).toBe(1);
  });

  it("nota senza parlato: audio eliminato e messaggio all'utente", async () => {
    const { queue, deps } = setup(["a"], { a: { kind: "silent", message: "Non ho sentito nulla." } });
    const r = await syncQueue(deps);
    expect(r.message).toBe("Non ho sentito nulla.");
    expect(queue.size).toBe(0);
  });

  it("nota rifiutata: resta in coda ma prosegue con le altre", async () => {
    const { queue, deps } = setup(["a", "b"], {
      a: { kind: "reject", message: "Troppo lunga." },
      b: { kind: "ok", text: "ok", noteId: "2" },
    });
    const r = await syncQueue(deps);
    expect([...queue.keys()]).toEqual(["a"]);
    expect(r.sent).toHaveLength(1);
    expect(r.message).toBe("Troppo lunga.");
  });
});
