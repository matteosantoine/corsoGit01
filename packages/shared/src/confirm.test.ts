import { describe, expect, it } from "vitest";
import { confirmError, isEmail, unresolvedNames, withInvitato } from "./confirm";
import type { Impegno } from "./extraction";

const TODAY = "2026-11-21";
const ev: Impegno = {
  tipo: "evento", titolo: "Riunione", descrizione: null, data: "2026-11-26", oraInizio: "10:00", durataMinuti: 60,
  modalita: "teams", luogo: null, partecipanti: ["Mario"], priorita: "normale", mancanti: [],
  invitati: [{ nome: "Mario", email: "mario@esempio.it", nomeContatto: "Mario Rossi" }],
};
const pr: Impegno = { ...ev, tipo: "promemoria", oraInizio: null, partecipanti: [], invitati: [], modalita: null, durataMinuti: null };

describe("isEmail", () => {
  it.each(["a@b.it", " mario.rossi@azienda.com "])("accetta %s", (e) => expect(isEmail(e)).toBe(true));
  it.each(["", "mario", "mario@", "@x.it", "a b@c.it", "a@b"])("rifiuta %s", (e) => expect(isEmail(e)).toBe(false));
});

describe("unresolvedNames / withInvitato", () => {
  it("elenca i nomi senza email", () => {
    expect(unresolvedNames({ ...ev, invitati: [] })).toEqual(["Mario"]);
    expect(unresolvedNames(ev)).toEqual([]);
  });
  it("ignora maiuscole e spazi", () => {
    expect(unresolvedNames({ ...ev, partecipanti: [" MARIO "] })).toEqual([]);
  });
  it("un promemoria non ha invitati da risolvere", () => expect(unresolvedNames({ ...pr, partecipanti: ["X"] })).toEqual([]));
  it("withInvitato sostituisce lo stesso nome senza duplicarlo", () => {
    const r = withInvitato(ev, { nome: "mario", email: "nuovo@esempio.it", nomeContatto: null });
    expect(r.invitati).toHaveLength(1);
    expect(r.invitati![0].email).toBe("nuovo@esempio.it");
  });
});

describe("confirmError", () => {
  it("evento completo: ok", () => expect(confirmError(ev, TODAY)).toBeNull());
  it("promemoria con sola data: ok", () => expect(confirmError(pr, TODAY)).toBeNull());
  it("oggi va bene, ieri no", () => {
    expect(confirmError({ ...pr, data: TODAY }, TODAY)).toBeNull();
    expect(confirmError({ ...pr, data: "2026-11-20" }, TODAY)).toBe("La data è già passata.");
  });
  it.each([
    ["senza data", { ...ev, data: null }, "Manca la data."],
    ["data inesistente", { ...ev, data: "2026-02-30" }, "Manca la data."],
    ["evento senza ora", { ...ev, oraInizio: null }, "Manca l'ora."],
    ["evento senza invitati", { ...ev, invitati: [] }, "Manca almeno un invitato."],
    ["email non valida", { ...ev, invitati: [{ nome: "Mario", email: "mario", nomeContatto: null }] }, "Un indirizzo email non è valido."],
    ["nome senza email", { ...ev, partecipanti: ["Mario", "Anna"] }, "Manca l'indirizzo di una persona."],
    ["titolo vuoto", { ...ev, titolo: "  " }, "Manca il titolo."],
    ["ora malformata", { ...pr, oraInizio: "25:00" }, "L'ora non è valida."],
  ] as [string, Impegno, string][])("%s", (_n, item, msg) => expect(confirmError(item, TODAY)).toBe(msg));
});
