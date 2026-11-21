import { describe, expect, it } from "vitest";
import type { Impegno } from "@impegni/shared";
import { confirmError } from "@impegni/shared";
import { candidateMode, nextUnresolved, setInvitati } from "./resolve";

const ev = (partecipanti: string[], invitati: Impegno["invitati"] = []): Impegno => ({
  tipo: "evento", titolo: "x", descrizione: null, data: "2026-11-26", oraInizio: "10:00", durataMinuti: 60,
  modalita: null, luogo: null, partecipanti, priorita: "normale", mancanti: [], invitati,
});

describe("nextUnresolved", () => {
  it("trova il primo nome senza email, anche nel secondo impegno", () => {
    const done = ev(["Mario"], [{ nome: "Mario", email: "m@x.it", nomeContatto: null }]);
    expect(nextUnresolved([done, ev(["Anna", "Luca"])])).toEqual({ index: 1, nome: "Anna" });
  });
  it("null quando tutti hanno un indirizzo", () => {
    expect(nextUnresolved([ev(["Mario"], [{ nome: "Mario", email: "m@x.it", nomeContatto: null }])])).toBeNull();
  });
});

describe("candidateMode", () => {
  const c = (n: number) => Array.from({ length: n }, (_, i) => ({ nome: `P${i}`, email: `p${i}@x.it` }));
  it("0 → none, 1 → one, 2+ → many", () => {
    expect([0, 1, 2, 5].map((n) => candidateMode(c(n)))).toEqual(["none", "one", "many", "many"]);
  });
});

describe("setInvitati", () => {
  const mario = { nome: "Mario", email: "m@x.it", nomeContatto: null };
  const zeta = { nome: "Zeta", email: "z@x.it", nomeContatto: null };
  const base = ev(["Mario", "Zeta"], [mario, zeta]);
  it("togliere un invitato lascia l'impegno confermabile", () => {
    const r = setInvitati(base, [mario]);
    expect(r.partecipanti).toEqual(["Mario"]);
    expect(confirmError(r, "2026-11-21")).toBeNull();
  });
  it("aggiungere una persona per email la rende invitata", () => {
    const r = setInvitati(base, [mario, zeta, { nome: "nuovo@x.it", email: "nuovo@x.it", nomeContatto: null }]);
    expect(r.partecipanti).toEqual(["Mario", "Zeta", "nuovo@x.it"]);
    expect(confirmError(r, "2026-11-21")).toBeNull();
  });
  it("senza più invitati un evento non è confermabile", () => {
    expect(confirmError(setInvitati(base, []), "2026-11-21")).toBe("Manca almeno un invitato.");
  });
});
