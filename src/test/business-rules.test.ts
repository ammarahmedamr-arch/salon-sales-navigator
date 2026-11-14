import { describe, expect, it } from "vitest";
import { deriveClientUpdate } from "@/lib/business-rules";
import type { ContactResult } from "@/lib/types";

describe("deriveClientUpdate business rule mapping", () => {
  it("maps 'مهتم' to outcome 'مهتم' and status 'ردّ'", () => {
    expect(deriveClientUpdate("مهتم")).toEqual({
      contact_status: "ردّ",
      outcome: "مهتم",
    });
  });

  it("maps 'طلب تفاصيل' to outcome 'طلب عرض' and status 'ردّ'", () => {
    expect(deriveClientUpdate("طلب تفاصيل")).toEqual({
      contact_status: "ردّ",
      outcome: "طلب عرض",
    });
  });

  it("maps 'طلب عرض' to outcome 'طلب عرض' and status 'ردّ'", () => {
    expect(deriveClientUpdate("طلب عرض")).toEqual({
      contact_status: "ردّ",
      outcome: "طلب عرض",
    });
  });

  it("maps 'طلب تجربة' to outcome 'تجربة/ديمو' and status 'ردّ'", () => {
    expect(deriveClientUpdate("طلب تجربة")).toEqual({
      contact_status: "ردّ",
      outcome: "تجربة/ديمو",
    });
  });

  it("maps 'مشترك' to outcome 'مشترك' and status 'ردّ'", () => {
    expect(deriveClientUpdate("مشترك")).toEqual({
      contact_status: "ردّ",
      outcome: "مشترك",
    });
  });

  it("maps 'غير مهتم' to outcome 'غير مهتم' and status 'ردّ'", () => {
    expect(deriveClientUpdate("غير مهتم")).toEqual({
      contact_status: "ردّ",
      outcome: "غير مهتم",
    });
  });

  it("maps 'لم يرد' to status 'في انتظار الرد' with outcome unchanged", () => {
    const update = deriveClientUpdate("لم يرد");
    expect(update.contact_status).toBe("في انتظار الرد");
    expect(update.outcome).toBeUndefined();
    expect(update.next_follow_up_date).toBeUndefined();
  });

  it("maps 'إعادة التواصل لاحقًا' to outcome 'يحتاج متابعة لاحقًا' and status 'متابعة مطلوبة'", () => {
    expect(deriveClientUpdate("إعادة التواصل لاحقًا")).toEqual({
      contact_status: "متابعة مطلوبة",
      outcome: "يحتاج متابعة لاحقًا",
    });
  });

  it("maps 'رقم غير صحيح' to status 'تم إيقاف التواصل' with outcome unchanged", () => {
    const update = deriveClientUpdate("رقم غير صحيح");
    expect(update.contact_status).toBe("تم إيقاف التواصل");
    expect(update.outcome).toBeUndefined();
    expect(update.next_follow_up_date).toBeUndefined();
  });

  it("maps 'طلب عدم التواصل' to status 'تم إيقاف التواصل', outcome 'لا يرغب بالتواصل', and clears next_follow_up_date", () => {
    expect(deriveClientUpdate("طلب عدم التواصل")).toEqual({
      contact_status: "تم إيقاف التواصل",
      outcome: "لا يرغب بالتواصل",
      next_follow_up_date: null,
    });
  });

  it("covers all 10 ContactResult enum values without omissions", () => {
    const allResults: ContactResult[] = [
      "لم يرد",
      "مهتم",
      "غير مهتم",
      "طلب تفاصيل",
      "طلب عرض",
      "طلب تجربة",
      "مشترك",
      "طلب عدم التواصل",
      "رقم غير صحيح",
      "إعادة التواصل لاحقًا",
    ];
    for (const result of allResults) {
      const derived = deriveClientUpdate(result);
      expect(derived).toBeDefined();
      expect(typeof derived).toBe("object");
    }
  });
});
