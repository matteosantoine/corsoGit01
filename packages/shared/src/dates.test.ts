import { describe, expect, it } from "vitest";
import { addDays, addMinutesLocal, buildCalendar, isValidYmd, localParts, weekdayOf } from "./dates";

// Sabato 21 novembre 2026, 09:30 a Roma (08:30 UTC)
const NOW = new Date("2026-11-21T08:30:00Z");

describe("date", () => {
  it("legge data, ora e giorno nel fuso di Roma", () => {
    expect(localParts(NOW)).toEqual({ ymd: "2026-11-21", hm: "09:30", weekday: 5 });
  });
  it("a mezzanotte italiana la data è già quella nuova", () => {
    expect(localParts(new Date("2026-11-21T23:30:00Z")).ymd).toBe("2026-11-22");
  });
  it("ora legale: luglio è UTC+2", () => {
    expect(localParts(new Date("2026-07-15T08:00:00Z")).hm).toBe("10:00");
  });
  it("addDays attraversa mese e anno", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("weekdayOf: 21/11/2026 è sabato", () => expect(weekdayOf("2026-11-21")).toBe(5));
  it("isValidYmd rifiuta date inesistenti", () => {
    expect(isValidYmd("2026-02-30")).toBe(false);
    expect(isValidYmd("2026-13-01")).toBe(false);
    expect(isValidYmd("26/11/2026")).toBe(false);
    expect(isValidYmd("2026-11-26")).toBe(true);
  });
});

describe("buildCalendar", () => {
  const cal = buildCalendar(NOW);
  it("etichetta oggi, domani e le settimane", () => {
    expect(cal).toContain("- sabato 2026-11-21 (oggi, questa settimana)");
    expect(cal).toContain("- domenica 2026-11-22 (domani, questa settimana)");
    expect(cal).toContain("- lunedì 2026-11-23 (dopodomani, settimana prossima)");
  });
  it("giovedì della settimana prossima = 26/11", () => {
    expect(cal).toContain("- giovedì 2026-11-26 (settimana prossima)");
  });
  it("giovedì tra due settimane = 3/12", () => {
    expect(cal).toContain("- giovedì 2026-12-03 (tra due settimane)");
  });
});

describe("addMinutesLocal", () => {
  it("somma nello stesso giorno", () => expect(addMinutesLocal("2026-11-26", "10:00", 60)).toEqual({ ymd: "2026-11-26", hm: "11:00" }));
  it("attraversa la mezzanotte", () => expect(addMinutesLocal("2026-11-26", "23:30", 90)).toEqual({ ymd: "2026-11-27", hm: "01:00" }));
  it("attraversa fine mese e anno", () => expect(addMinutesLocal("2026-12-31", "23:45", 30)).toEqual({ ymd: "2027-01-01", hm: "00:15" }));
});
