#!/usr/bin/env node

/**
 * Development database seed script.
 * Populates a running local PocketBase instance with realistic demo salons and activity logs.
 *
 * SAFETY GUARD: Refuses to run unless `--i-know-this-is-dev` flag is provided.
 *
 * Usage:
 *   node backend/scripts/seed-dev.mjs --i-know-this-is-dev
 */

import PocketBase from "pocketbase";

if (!process.argv.includes("--i-know-this-is-dev")) {
  console.error("\x1b[31m%s\x1b[0m", "ERROR: Safety check failed.");
  console.error("This script clears and seeds the database with demo data.");
  console.error("You MUST pass `--i-know-this-is-dev` to confirm you are in local development.");
  process.exit(1);
}

const pbUrl = process.env.VITE_PB_URL || process.env.PB_URL || "http://127.0.0.1:8090";
const pb = new PocketBase(pbUrl);

const DEMO_USERS = [
  { email: "admin@ojlinker.sa", password: "AdminPass123!", name: "عمر الحربي", role: "admin" },
  { email: "noura@ojlinker.sa", password: "AgentPass123!", name: "نورة العتيبي", role: "agent" },
  { email: "sara@ojlinker.sa", password: "AgentPass123!", name: "سارة القحطاني", role: "agent" },
  { email: "faisal@ojlinker.sa", password: "AgentPass123!", name: "فيصل الشهري", role: "agent" },
];

function getRiyadhDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function makeDate(days) {
  const [y, m, d] = getRiyadhDateKey().split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + days));
  return target.toISOString().slice(0, 10);
}

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
];

const people = ["نورة", "ريم", "سارة", "خالد", "لمى", "أمل", "فيصل", "هيا", "عبدالله", "دانة"];
const sources = ["خرائط Google", "إنستجرام", "موقع إلكتروني", "دليل أعمال", "إحالة", "بحث يدوي", "مصدر آخر"];

async function main() {
  console.log(`Connecting to ${pbUrl}...`);

  // 1. Ensure Demo Users exist
  const userMap = new Map();
  for (const u of DEMO_USERS) {
    try {
      const existing = await pb.collection("users").getList(1, 1, {
        filter: pb.filter("email = {:email}", { email: u.email }),
      });
      if (existing.items.length > 0) {
        userMap.set(u.email, existing.items[0].id);
        console.log(`User exists: ${u.email}`);
      } else {
        const created = await pb.collection("users").create({
          email: u.email,
          password: u.password,
          passwordConfirm: u.password,
          name: u.name,
          role: u.role,
          emailVisibility: false,
        });
        userMap.set(u.email, created.id);
        console.log(`Created user: ${u.email} (${u.role})`);
      }
    } catch (e) {
      console.warn(`Note on user ${u.email}:`, e?.message);
    }
  }

  // Authenticate as Admin
  await pb.collection("users").authWithPassword("admin@ojlinker.sa", "AdminPass123!");
  console.log("Authenticated as Admin.");

  // Check if clients already exist
  const existingClients = await pb.collection("clients").getList(1, 5);
  if (existingClients.totalItems > 0) {
    console.log(`Database already contains ${existingClients.totalItems} clients. Skipping re-seeding to keep idempotency.`);
    return;
  }

  const userIds = Array.from(userMap.values());
  const createdClientIds = [];

  console.log("Seeding 25 demo salons...");
  for (let i = 0; i < salons.length; i++) {
    const [name, city, businessType] = salons[i];
    const code = `SAL-${String(i + 1).padStart(4, "0")}`;
    const contacted = i >= 6;
    const phone = `9665${String(10000000 + ((i * 391827) % 89999999)).padStart(8, "0")}`;

    let contactStatus = "لم يتم التواصل";
    let outcome = "غير محدد";
    let nextDate = null;

    if (contacted) {
      const outcomes = ["مهتم", "مهتم", "طلب عرض", "تجربة/ديمو", "مشترك", "يحتاج متابعة لاحقًا", "غير مهتم"];
      outcome = outcomes[i % outcomes.length];
      contactStatus = outcome === "مشترك" || outcome === "مهتم" || outcome === "طلب عرض" ? "ردّ" : "تم التواصل";

      // Follow-up dates: overdue, due today, upcoming
      if (i % 4 === 0) {
        nextDate = makeDate(-((i % 5) + 1)); // Overdue
      } else if (i % 4 === 1) {
        nextDate = makeDate(0); // Due today!
      } else if (i % 4 === 2) {
        nextDate = makeDate(3 + (i % 10)); // Later
      }
    }

    const client = await pb.collection("clients").create({
      code,
      name,
      city,
      business_type: businessType,
      contact_person: people[i % people.length],
      phone,
      website_url: i % 3 === 0 ? `https://instagram.com/salon${i + 1}` : "",
      source: sources[i % sources.length],
      priority: i % 3 === 0 ? "عالية" : i % 3 === 1 ? "متوسطة" : "منخفضة",
      contact_status: contactStatus,
      outcome: outcome,
      last_contact_at: contacted ? new Date(Date.now() - ((i % 10) + 1) * 86400000).toISOString() : null,
      next_follow_up_date: nextDate,
      notes: i % 2 === 0 ? "مهتمة بنظام الحجوزات وإدارة مواعيد العميلات." : "تم التواصل عبر واتساب وعرض الباقة التأسيسية.",
      owner: userIds[i % userIds.length] || null,
      chat_url: `https://wa.me/${phone}`,
    });
    createdClientIds.push(client.id);
  }

  console.log(`Created ${createdClientIds.length} demo clients.`);

  // 3. Seed demo contact logs
  console.log("Seeding demo contact logs...");
  const channels = ["واتساب", "اتصال هاتفي", "إنستجرام", "واتساب", "رسالة نصية"];
  const results = ["مهتم", "لم يرد", "طلب تفاصيل", "طلب عرض", "طلب تجربة", "إعادة التواصل لاحقًا", "مشترك"];
  const actions = ["إرسال تفاصيل", "تحديد موعد عرض", "متابعة لاحقًا", "انتظار الرد"];

  for (let i = 0; i < 40; i++) {
    const clientId = createdClientIds[i % createdClientIds.length];
    const result = results[i % results.length];
    const logDate = new Date(Date.now() - (i % 20) * 86400000);

    await pb.collection("contact_logs").create({
      code: `ACT-${String(i + 1).padStart(5, "0")}`,
      client: clientId,
      contacted_at: logDate.toISOString(),
      channel: channels[i % channels.length],
      attempt_type: i % 3 === 0 ? "رسالة أولى" : i % 3 === 1 ? "متابعة أولى" : "مكالمة",
      replied: result === "لم يرد" ? "لا" : "نعم",
      result,
      next_follow_up_date: result === "طلب عدم التواصل" ? null : makeDate(3),
      reply_summary: result === "لم يرد" ? "لم يتم استلام رد حتى الآن" : "تمت مناقشة الباقات وأبدى العميل اهتمامه",
      next_action: actions[i % actions.length],
      chat_url: "",
      created_by: userIds[i % userIds.length],
    });
  }

  console.log("Demo seeding completed successfully! ✨");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
