import { describe, expect, it } from "vitest";
import type { Impegno } from "@impegni/shared";
import { encodeWav } from "../audio/wav";
import { createDemoServer } from "./server";

const NOW = new Date("2026-11-21T08:30:00Z"); // sabato 21/11/2026, 09:30 a Roma

function setup(sentence: string) {
  const server = createDemoServer({ getSentence: () => sentence, now: () => NOW });
  const call = (method: string, path: string, body?: unknown) =>
    server.handle({
      method, url: new URL(`http://demo.local${path}`), headers: new Headers(),
      body: body instanceof Blob ? body : body === undefined ? null : JSON.stringify(body),
    });
  const wav = () => new Blob([encodeWav(new Float32Array(16000), 16000)], { type: "audio/wav" });
  return { call, wav };
}

describe("anteprima: percorso completo sul finto server (gestori veri)", () => {
  it("vocale → impegni → contatti → conferma → creazione → agenda → archivio → eliminazione", async () => {
    const { call, wav } = setup("Oggi alle 17 riunione con Mario Rossi su Teams e ricordami di pagare la bolletta domani");

    const t = await call("POST", "/api/transcribe", wav());
    expect(t.status).toBe(200);
    const noteId = t.json.noteId as string;

    const ex = await call("POST", `/api/notes/${noteId}/extract`);
    const items = ex.json.items as Impegno[];
    expect(items.map((i) => [i.tipo, i.data, i.oraInizio])).toEqual([["evento", "2026-11-21", "17:00"], ["promemoria", "2026-11-22", null]]);
    expect(items[0].modalita).toBe("teams");

    const ppl = await call("GET", "/api/people?q=Mario%20Rossi");
    expect(ppl.json.candidati).toEqual([{ nome: "Mario Rossi", email: "mario.rossi@esterna.com" }]);

    // senza invitato con email la conferma dell'incontro è rifiutata
    const bad = await call("POST", `/api/notes/${noteId}/confirm`, { decisioni: items.map((impegno) => ({ stato: "confermato", impegno })) });
    expect(bad.status).toBe(400);

    items[0].invitati = [{ nome: "Mario Rossi", email: "mario.rossi@esterna.com", nomeContatto: "Mario Rossi" }];
    const ok = await call("POST", `/api/notes/${noteId}/confirm`, { decisioni: items.map((impegno) => ({ stato: "confermato", impegno })) });
    expect(ok.json).toMatchObject({ confermati: 2, scartati: 0 });

    const c1 = await call("POST", `/api/notes/${noteId}/commit`);
    expect((c1.json.risultati as { esito: string }[]).map((r) => r.esito)).toEqual(["creato", "creato"]);
    const c2 = await call("POST", `/api/notes/${noteId}/commit`);
    expect((c2.json.risultati as { esito: string }[]).map((r) => r.esito)).toEqual(["gia_creato", "gia_creato"]); // nessun doppione

    const today = await call("GET", "/api/today");
    const [oggi, domani] = today.json.giorni as { eventi: { titolo: string; inizio: string; teams: boolean }[]; promemoria: { titolo: string }[] }[];
    expect(oggi.eventi.map((e) => e.titolo)).toEqual(["Riunione di reparto", "Riunione con Mario Rossi"]); // anche quella di partenza, in ordine d'ora
    expect(oggi.eventi[1]).toMatchObject({ inizio: "17:00", teams: true });
    expect(domani.promemoria.map((p) => p.titolo)).toContain("Pagare la bolletta");

    const list = await call("GET", "/api/notes");
    const note = (list.json.note as { id: string; impegni: { stato: string }[] }[]);
    expect(note.map((n) => n.id)).toContain(noteId);
    expect(note.find((n) => n.id === noteId)!.impegni.map((i) => i.stato)).toEqual(["creato", "creato"]);

    expect((await call("DELETE", `/api/notes/${noteId}`)).status).toBe(200);
    expect(((await call("GET", "/api/notes")).json.note as { id: string }[]).map((n) => n.id)).not.toContain(noteId);
  });

  it("correggere il testo rifà gli impegni", async () => {
    const { call, wav } = setup("Chiama Mario");
    const noteId = (await call("POST", "/api/transcribe", wav())).json.noteId as string;
    const first = (await call("POST", `/api/notes/${noteId}/extract`)).json.items as Impegno[];
    expect(first[0]).toMatchObject({ data: null, mancanti: ["data"] });
    await call("PUT", `/api/notes/${noteId}/text`, { text: "Domani alle 9 chiamare Mario" });
    const second = (await call("POST", `/api/notes/${noteId}/extract`)).json.items as Impegno[];
    expect(second[0]).toMatchObject({ data: "2026-11-22", oraInizio: "09:00", mancanti: [] });
  });

  it("impostazioni: salva e rilegge", async () => {
    const { call } = setup("x");
    await call("PUT", "/api/settings", { durataMinuti: 90, anticipoMinuti: 30, linkTeams: false });
    expect((await call("GET", "/api/settings")).json).toEqual({ impostazioni: { durataMinuti: 90, anticipoMinuti: 30, linkTeams: false } });
  });

  it("funzioni sconosciute → 404 comprensibile", async () => {
    expect((await setup("x").call("GET", "/api/boh")).status).toBe(404);
  });
});
