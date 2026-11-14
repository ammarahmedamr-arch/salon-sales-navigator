import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeFollowUpState,
  formatDate,
  formatDateTime,
  normalizePhone,
  relativeDays,
  dateKey,
  getRiyadhDateKey,
  makeFollowUpDate,
  waLink,
} from "@/lib/utils";

describe("OJLinker data helpers", () => {
  it("normalizes Saudi mobile numbers to 9665XXXXXXXX", () => {
    expect(normalizePhone("05 1234 5678")).toBe("966512345678");
    expect(normalizePhone("+966512345678")).toBe("966512345678");
    expect(normalizePhone("0512345678")).toBe("966512345678");
    expect(normalizePhone("966512345678")).toBe("966512345678");
  });

  it("throws on invalid phone numbers", () => {
    expect(() => normalizePhone("0123456789")).toThrow();
    expect(() => normalizePhone("966412345678")).toThrow();
    expect(() => normalizePhone("12345")).toThrow();
  });

  it("generates WhatsApp wa.me links with normalized numbers", () => {
    expect(waLink("0512345678")).toBe("https://wa.me/966512345678");
    expect(waLink("+966512345678")).toBe("https://wa.me/966512345678");
  });

  it("classifies past, current, future, and excluded follow-ups", () => {
    expect(computeFollowUpState("2020-01-01")).toBe("متأخرة");
    expect(computeFollowUpState(dateKey(new Date()))).toBe("مستحقة");
    expect(computeFollowUpState("2999-01-01")).toBe("لاحقًا");
    expect(computeFollowUpState("2999-01-01", "مشترك")).toBe("");
    expect(computeFollowUpState("2999-01-01", "غير مهتم")).toBe("");
    expect(computeFollowUpState("2999-01-01", "لا يرغب بالتواصل")).toBe("");
    expect(computeFollowUpState(null)).toBe("");
    expect(computeFollowUpState("")).toBe("");
  });

  it("formats calendar dates as DD/MM/YYYY western digits", () => {
    expect(formatDate("2026-11-12")).toBe("12/11/2026");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("formats date and time in Riyadh timezone", () => {
    // 2026-11-12T12:00:00Z is 15:00 in Riyadh (UTC+3)
    const formatted = formatDateTime("2026-11-12T12:00:00Z");
    expect(formatted).toContain("12/11/2026");
    expect(formatted).toContain("03:00");
  });

  it("measures overdue dates in whole calendar days", () => {
    expect(relativeDays("2999-01-01")).toBeLessThan(0);
    expect(relativeDays("2020-01-01")).toBeGreaterThan(0);
    expect(relativeDays(null)).toBe(0);
  });
});

describe("Asia/Riyadh timezone safety around midnight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates Riyadh date at 20:59 UTC (23:59 Riyadh) as the current day", () => {
    // 20:59 UTC on Nov 12 = 23:59 in Riyadh (Nov 12)
    vi.setSystemTime(new Date("2026-11-12T20:59:00Z"));

    expect(getRiyadhDateKey()).toBe("2026-11-12");
    expect(dateKey()).toBe("2026-11-12");

    // Nov 12 is due today
    expect(computeFollowUpState("2026-11-12")).toBe("مستحقة");
    // Nov 11 is overdue
    expect(computeFollowUpState("2026-11-11")).toBe("متأخرة");
    // Nov 13 is upcoming (later)
    expect(computeFollowUpState("2026-11-13")).toBe("لاحقًا");

    expect(makeFollowUpDate(0)).toBe("2026-11-12");
    expect(makeFollowUpDate(1)).toBe("2026-11-13");
  });

  it("calculates Riyadh date at 21:30 UTC (00:30 next day in Riyadh) as the next day", () => {
    // 21:30 UTC on Nov 12 = 00:30 on Nov 13 in Riyadh (midnight has crossed)
    vi.setSystemTime(new Date("2026-11-12T21:30:00Z"));

    expect(getRiyadhDateKey()).toBe("2026-11-13");
    expect(dateKey()).toBe("2026-11-13");

    // Nov 12 is now overdue because in Riyadh it is already Nov 13!
    expect(computeFollowUpState("2026-11-12")).toBe("متأخرة");
    // Nov 13 is now due today
    expect(computeFollowUpState("2026-11-13")).toBe("مستحقة");
    // Nov 14 is upcoming (later)
    expect(computeFollowUpState("2026-11-14")).toBe("لاحقًا");

    expect(makeFollowUpDate(0)).toBe("2026-11-13");
    expect(makeFollowUpDate(1)).toBe("2026-11-14");
  });
});
