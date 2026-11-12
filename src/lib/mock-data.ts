import { TEAM_MEMBERS } from "./constants";
import { makeFollowUpDate } from "./utils";
import type { Client, ContactLog } from "./types";

const salons = [
  ["لمسة ورد", "الرياض", "صالون نسائي"],
  ["أُنس بيوتي", "جدة", "مركز تجميل"],
  ["صالون أرجوان", "مكة المكرمة", "صالون نسائي"],
  ["خطوة أناقة", "الدمام", "صالون نسائي"],
  ["مرايا الجمال", "الخبر", "سبا"],
  ["صالون نخبة الرجال", "الرياض", "صالون رجالي"],
  ["روشان بيوتي", "المدينة المنورة", "مركز تجميل"],
  ["كادي سبا", "جدة", "سبا"],
  ["صالون لمار", "أبها", "صالون نسائي"],
  ["رويال كت", "الطائف", "حلاقة"],
  ["مركز لافندر", "الرياض", "مركز تجميل"],
  ["ريڤا بيوتي", "جدة", "صالون نسائي"],
  ["صالون بلو", "تبوك", "صالون رجالي"],
  ["دار ليان", "بريدة", "صالون نسائي"],
  ["أريج سبا", "مكة المكرمة", "سبا"],
  ["كريستال بيوتي", "الدمام", "مركز تجميل"],
  ["صالون سمو", "الخبر", "صالون نسائي"],
  ["مركز نواعم", "الرياض", "مركز تجميل"],
  ["بيت الأناقة", "جدة", "صالون نسائي"],
  ["رويال بيوتي", "المدينة المنورة", "صالون نسائي"],
  ["صالون وسام", "الرياض", "حلاقة"],
  ["تالا سبا", "أبها", "سبا"],
  ["مركز بلوم", "الدمام", "مركز تجميل"],
  ["لوفت كات", "الطائف", "صالون رجالي"],
  ["جوري بيوتي", "جدة", "صالون نسائي"],
] as const;

const people = ["نورة", "ريم", "سارة", "خالد", "لمى", "أمل", "فيصل", "هيا", "عبدالله", "دانة"];
const outcomes = [
  "غير محدد",
  "مهتم",
  "مهتم",
  "غير مهتم",
  "طلب عرض",
  "تجربة/ديمو",
  "يحتاج متابعة لاحقًا",
  "مشترك",
] as const;
const statuses = [
  "لم يتم التواصل",
  "تم التواصل",
  "في انتظار الرد",
  "ردّ",
  "متابعة مطلوبة",
] as const;

export const initialClients: Client[] = salons.map(([name, city, businessType], i) => {
  const outcome = (i < 7 ? "غير محدد" : outcomes[i % outcomes.length] ?? "غير محدد") as Client["outcome"];
  const contacted = i >= 7;
  const next =
    i % 5 === 0
      ? makeFollowUpDate(-((i % 9) + 1))
      : i % 5 === 1
        ? makeFollowUpDate(0)
        : i % 5 === 2
          ? makeFollowUpDate(5)
          : null;
  const phone = `9665${String(10000000 + ((i * 391827) % 89999999)).padStart(8, "0")}`;
  const createdAt = new Date(Date.now() - i * 86_400_000 * 3).toISOString();

  return {
    id: `client-${String(i + 1).padStart(3, "0")}`,
    code: `SAL-${String(i + 1).padStart(4, "0")}`,
    name,
    city,
    business_type: businessType,
    contact_person: people[i % people.length] ?? "",
    phone,
    website_url: i % 3 === 0 ? `https://instagram.com/salon${i + 1}` : "",
    source: ([
      "خرائط Google",
      "إنستجرام",
      "موقع إلكتروني",
      "دليل أعمال",
      "إحالة",
      "بحث يدوي",
      "مصدر آخر",
    ][i % 7] ?? "مصدر آخر") as Client["source"],
    created_at: createdAt,
    updated: createdAt,
    priority: i % 4 === 0 ? "عالية" : i % 4 === 1 ? "منخفضة" : "متوسطة",
    contact_status: (contacted ? statuses[i % statuses.length] : "لم يتم التواصل") as Client["contact_status"],
    outcome,
    last_contact_at: contacted ? new Date(Date.now() - ((i % 12) + 1) * 86_400_000).toISOString() : null,
    next_follow_up_date: next,
    notes:
      i % 2
        ? "مهتمة بحجوزات المواعيد، طلبت التواصل بعد انتهاء الموسم."
        : "التركيز على نظام الاشتراكات وعروض الافتتاح.",
    owner: TEAM_MEMBERS[i % TEAM_MEMBERS.length]!,
    chat_url: "",
    follow_up_state: "",
    attempts_count: 0,
  };
});

const channels: ContactLog["channel"][] = [
  "واتساب",
  "اتصال هاتفي",
  "إنستجرام",
  "واتساب",
  "بريد إلكتروني",
];
const results: ContactLog["result"][] = [
  "لم يرد",
  "مهتم",
  "طلب تفاصيل",
  "إعادة التواصل لاحقًا",
  "طلب عرض",
  "غير مهتم",
  "طلب تجربة",
  "لم يرد",
];

export const initialLogs: ContactLog[] = Array.from({ length: 60 }, (_, i) => {
  const clientIndex = (i * 7 + Math.floor(i / 3)) % 25;
  const client = initialClients[clientIndex];
  const contactedAt = new Date(Date.now() - (i % 28) * 86_400_000);
  const result = (results[i % results.length] ?? "لم يرد") as ContactLog["result"];
  return {
    id: `activity-${String(i + 1).padStart(3, "0")}`,
    code: `ACT-${String(i + 1).padStart(5, "0")}`,
    client_id: client?.id ?? "",
    contacted_at: contactedAt.toISOString(),
    channel: (channels[i % channels.length] ?? "واتساب") as ContactLog["channel"],
    attempt_type:
      i % 4 === 0
        ? "رسالة أولى"
        : i % 4 === 1
          ? "متابعة أولى"
          : i % 4 === 2
            ? "مكالمة"
            : "متابعة بعد العرض",
    replied: result === "لم يرد" ? "لا" : i % 3 === 0 ? "لم يتضح" : "نعم",
    result,
    next_follow_up_date: client?.next_follow_up_date ?? null,
    reply_summary:
      result === "لم يرد" ? "لا يوجد رد حتى الآن" : "طلب إرسال تفاصيل الباقات عبر واتساب",
    next_action:
      result === "طلب عرض"
        ? "تحديد موعد عرض"
        : result === "غير مهتم"
          ? "إغلاق العميل"
          : "متابعة لاحقًا",
    chat_url: client?.phone ? `https://wa.me/${client.phone}` : "",
    created_by: `team-${(i % 4) + 1}`,
    created: contactedAt.toISOString(),
  };
});
