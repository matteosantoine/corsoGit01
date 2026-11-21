import { describe, expect, it } from "vitest";
import type { Impegno } from "@impegni/shared";
import { addReview, removeForNote, replaceForNote } from "./queue";

const it1 = (titolo: string): Impegno => ({
  tipo: "promemoria", titolo, descrizione: null, data: null, oraInizio: null, durataMinuti: null,
  modalita: null, luogo: null, partecipanti: [], priorita: "normale", mancanti: ["data"],
});

describe("code degli impegni da completare", () => {
  it("accoda per nota", () => {
    const l = addReview(addReview([], "a", [it1("1")]), "b", [it1("2")]);
    expect(l.map((r) => r.noteId)).toEqual(["a", "b"]);
  });
  it("la correzione sostituisce gli impegni della nota e li porta in testa", () => {
    const l = replaceForNote(addReview(addReview([], "a", [it1("vecchio")]), "b", [it1("altro")]), "b", [it1("nuovo")]);
    expect(l.map((r) => r.noteId)).toEqual(["b", "a"]);
    expect(l[0].items[0].titolo).toBe("nuovo");
  });
  it("incrementa la versione, così la schermata delle domande riparte da zero", () => {
    const l1 = addReview([], "a", [it1("x")]);
    const l2 = replaceForNote(l1, "a", [it1("y")]);
    expect(l2[0].version).toBe(l1[0].version + 1);
  });
  it("correggere una nota già completata crea una nuova coda per quella nota", () => {
    const l = replaceForNote([], "z", [it1("nuovo")]);
    expect(l).toHaveLength(1);
    expect(l[0].version).toBe(1);
  });
  it("se non ci sono più impegni, quelli vecchi spariscono", () => {
    expect(removeForNote(addReview([], "a", [it1("x")]), "a")).toEqual([]);
  });
});
