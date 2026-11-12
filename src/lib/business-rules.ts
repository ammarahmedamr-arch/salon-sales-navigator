import type { ContactResult, ContactStatus, ClientOutcome } from "./types";

export interface DerivedClientUpdate {
  contact_status?: ContactStatus;
  outcome?: ClientOutcome;
  next_follow_up_date?: null;
}

/**
 * Derives client contact_status and outcome updates based on the contact attempt result.
 * Used when the "update client status automatically" checkbox is active.
 *
 * Rules:
 * - مهتم               → outcome مهتم + status ردّ
 * - طلب تفاصيل / طلب عرض → outcome طلب عرض + status ردّ
 * - طلب تجربة          → outcome تجربة/ديمو + status ردّ
 * - مشترك              → outcome مشترك + status ردّ
 * - غير مهتم           → outcome غير مهتم + status ردّ
 * - لم يرد             → status في انتظار الرد (outcome unchanged)
 * - إعادة التواصل لاحقًا → outcome يحتاج متابعة لاحقًا + status متابعة مطلوبة
 * - رقم غير صحيح       → status تم إيقاف التواصل (outcome unchanged)
 * - طلب عدم التواصل    → status تم إيقاف التواصل + outcome لا يرغب بالتواصل + next_follow_up_date = null
 */
export function deriveClientUpdate(result: ContactResult): DerivedClientUpdate {
  switch (result) {
    case "مهتم":
      return {
        contact_status: "ردّ",
        outcome: "مهتم",
      };
    case "طلب تفاصيل":
    case "طلب عرض":
      return {
        contact_status: "ردّ",
        outcome: "طلب عرض",
      };
    case "طلب تجربة":
      return {
        contact_status: "ردّ",
        outcome: "تجربة/ديمو",
      };
    case "مشترك":
      return {
        contact_status: "ردّ",
        outcome: "مشترك",
      };
    case "غير مهتم":
      return {
        contact_status: "ردّ",
        outcome: "غير مهتم",
      };
    case "لم يرد":
      return {
        contact_status: "في انتظار الرد",
      };
    case "إعادة التواصل لاحقًا":
      return {
        contact_status: "متابعة مطلوبة",
        outcome: "يحتاج متابعة لاحقًا",
      };
    case "رقم غير صحيح":
      return {
        contact_status: "تم إيقاف التواصل",
      };
    case "طلب عدم التواصل":
      return {
        contact_status: "تم إيقاف التواصل",
        outcome: "لا يرغب بالتواصل",
        next_follow_up_date: null,
      };
    default:
      return {};
  }
}
