// Helpers for PocketBase hooks and custom routes (Goja JS engine)

function getRiyadhTodayKey() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const riyadh = new Date(utc + (3 * 3600000));
  const year = riyadh.getFullYear();
  const month = ("0" + (riyadh.getMonth() + 1)).slice(-2);
  const day = ("0" + riyadh.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

function normalizeSaudiPhone(phone) {
  if (!phone) {
    throw new BadRequestError("رقم الهاتف مطلوب");
  }
  const digits = String(phone).replace(/\D/g, "");
  if (/^05\d{8}$/.test(digits)) {
    return "966" + digits.slice(1);
  }
  if (/^5\d{8}$/.test(digits)) {
    return "966" + digits;
  }
  if (/^9665\d{8}$/.test(digits)) {
    return digits;
  }
  if (/^009665\d{8}$/.test(digits)) {
    return digits.slice(2);
  }
  throw new BadRequestError("رقم الهاتف غير صحيح، يجب أن يكون رقم جوال سعودي يبدأ بـ 05");
}

/**
 * Non-throwing variant used by bulk import: unknown/empty phones are stored
 * as "" instead of aborting the whole batch.
 */
function normalizeSaudiPhoneLoose(phone) {
  if (!phone) {
    return "";
  }
  const digits = String(phone).replace(/\D/g, "");
  if (/^05\d{8}$/.test(digits)) {
    return "966" + digits.slice(1);
  }
  if (/^5\d{8}$/.test(digits)) {
    return "966" + digits;
  }
  if (/^9665\d{8}$/.test(digits)) {
    return digits;
  }
  if (/^009665\d{8}$/.test(digits)) {
    return digits.slice(2);
  }
  return "";
}

/**
 * Coerces an arbitrary Excel value into an allowed select value.
 * Empty input → emptyFallback; unmatched input → unknownFallback.
 * Used by bulk import.
 */
function pickAllowed(value, allowed, emptyFallback, unknownFallback) {
  const str = String(value || "").trim();
  if (!str) {
    return emptyFallback;
  }
  if (allowed.includes(str)) {
    return str;
  }
  for (const candidate of allowed) {
    if (str.includes(candidate) || candidate.includes(str)) {
      return candidate;
    }
  }
  return unknownFallback === undefined ? emptyFallback : unknownFallback;
}

function deriveClientUpdate(result) {
  switch (result) {
    case "مهتم":
      return { contact_status: "ردّ", outcome: "مهتم" };
    case "طلب تفاصيل":
    case "طلب عرض":
      return { contact_status: "ردّ", outcome: "طلب عرض" };
    case "طلب تجربة":
      return { contact_status: "ردّ", outcome: "تجربة/ديمو" };
    case "مشترك":
      return { contact_status: "ردّ", outcome: "مشترك" };
    case "غير مهتم":
      return { contact_status: "ردّ", outcome: "غير مهتم" };
    case "لم يرد":
      return { contact_status: "في انتظار الرد" };
    case "إعادة التواصل لاحقًا":
      return { contact_status: "متابعة مطلوبة", outcome: "يحتاج متابعة لاحقًا" };
    case "رقم غير صحيح":
      return { contact_status: "تم إيقاف التواصل" };
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

module.exports = {
  getRiyadhTodayKey,
  normalizeSaudiPhone,
  normalizeSaudiPhoneLoose,
  pickAllowed,
  deriveClientUpdate,
};
