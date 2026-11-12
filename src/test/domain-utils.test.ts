import { describe, expect, it } from "vitest";
import { computeFollowUpState, formatDate, normalizePhone, relativeDays, dateKey } from "@/lib/utils";

describe("OJLinker data helpers", () => {
  it("normalizes Saudi mobile numbers to 9665XXXXXXXX", () => {
    expect(normalizePhone("05 1234 5678")).toBe("966512345678");
    expect(normalizePhone("+966512345678")).toBe("966512345678");
  });
  it("classifies past, current, future, and excluded follow-ups", () => {
    expect(computeFollowUpState("2020-01-01")).toBe("متأخرة");
    expect(computeFollowUpState(dateKey(new Date()))).toBe("مستحقة");
    expect(computeFollowUpState("2999-01-01")).toBe("لاحقًا");
    expect(computeFollowUpState("2999-01-01", "مشترك")).toBe("");
    expect(computeFollowUpState("2999-01-01", "غير مهتم")).toBe("");
    expect(computeFollowUpState("2999-01-01", "لا يرغب بالتواصل")).toBe("");
    expect(computeFollowUpState(null)).toBe("");
  });
  it("formats calendar dates as DD/MM/YYYY western digits", () => {
    expect(formatDate("2026-11-12")).toBe("12/11/2026");
  });
  it("measures overdue dates in whole calendar days", () => {
    expect(relativeDays("2999-01-01")).toBeLessThan(0);
  });
});
