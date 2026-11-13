#!/usr/bin/env node

/**
 * Development database seed script.
 * Populates a running local PocketBase instance with realistic demo salons and activity logs.
 *
 * SAFETY GUARD: Refuses to run unless `--i-know-this-is-dev` flag is provided.
 *
 * Usage:
 *   node backend/scripts/seed-dev.mjs --i-know-this-is-dev [--url=http://127.0.0.1:8090] [--superuser=...] [--password=...]
 */

import PocketBase from "pocketbase";

if (!process.argv.includes("--i-know-this-is-dev")) {
  console.error("\x1b[31m%s\x1b[0m", "ERROR: Safety check failed.");
  console.error("This script clears and seeds the database with demo data.");
  console.error("You MUST pass `--i-know-this-is-dev` to confirm you are in local development.");
  process.exit(1);
}

const urlArg = process.argv.find((a) => a.startsWith("--url="))?.split("=")[1];
const pbUrl = urlArg || process.env.VITE_PB_URL || process.env.PB_URL || "http://127.0.0.1:8090";
const pb = new PocketBase(pbUrl);

const DEMO_USERS = [
  { email: "admin@ojlinker.sa", password: "AdminSecret123!", name: "عمر الحربي", role: "admin" },
  { email: "noura@ojlinker.sa", password: "AgentSecret123!", name: "نورة العتيبي", role: "agent" },
  { email: "sara@ojlinker.sa", password: "AgentSecret123!", name: "سارة القحطاني", role: "agent" },
  { email: "faisal@ojlinker.sa", password: "AgentSecret123!", name: "فيصل الشهري", role: "agent" },
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
  ["صالون لوسين للتجميل", "الرياض", "صالون نسائي"],
  ["مركز أورا بيوتي", "الرياض", "مركز تجميل"],
  ["دار الريم للسبا والعناية", "الرياض", "سبا"],
  ["صالون لمسات نجد", "الرياض", "صالون نسائي"],
  ["مركز إيفانا بيوتي سنتر", "جدة", "مركز تجميل"],
  ["صالون لافندر بيوتي لاونج", "جدة", "صالون نسائي"],
  ["سبا النخيل الفاخر", "جدة", "سبا"],
  ["صالون فيولا هير آند سبا", "جدة", "صالون نسائي"],
  ["صالون ميس روز للتجميل", "الدمام", "صالون نسائي"],
  ["مركز إيلاف بيوتي كلينك", "الدمام", "مركز تجميل"],
  ["صالون أنغام الشرقية", "الخبر", "صالون نسائي"],
  ["صالون روز قيرل", "الخبر", "صالون نسائي"],
  ["مركز لوزان للتزيين النسائي", "الرياض", "مركز تجميل"],
  ["صالون الجوهرة للتجميل", "مكة المكرمة", "صالون نسائي"],
  ["صالون ريماس هير استديو", "المدينة المنورة", "صالون نسائي"],
  ["مركز بيلا سبا", "أبها", "سبا"],
  ["صالون زهرة اللوتس", "الطائف", "صالون نسائي"],
  ["مركز سحر الشرق بيوتي", "بريدة", "مركز تجميل"],
  ["صالون نسرين للتزيين", "تبوك", "صالون نسائي"],
  ["صالون هيفين بيوتي لاونج", "الرياض", "صالون نسائي"],
  ["صالون ستايل كير", "الرياض", "صالون نسائي"],
  ["مركز رتوش النسائي", "جدة", "مركز تجميل"],
  ["صالون أسرار الجمال", "الدمام", "صالون نسائي"],
  ["مركز درة الشرقية للسبا", "الخبر", "سبا"],
  ["صالون أنامل الفضة", "الرياض", "صالون نسائي"],
];

const sources = ["خرائط Google", "إنستجرام", "موقع إلكتروني", "دليل أعمال", "إحالة", "بحث يدوي", "مصدر آخر"];

async function main() {
  console.log(`Connecting to ${pbUrl}...`);

  // Optional superuser bootstrap
  const superuserArg = process.argv.find((a) => a.startsWith("--superuser="))?.split("=")[1];
  const passwordArg = process.argv.find((a) => a.startsWith("--password="))?.split("=")[1];

  if (superuserArg && passwordArg) {
    try {
      const authRes = await pb.send("/api/admins/auth-with-password", {
        method: "POST",
        body: { identity: superuserArg, password: passwordArg },
      });
      pb.authStore.save(authRes.token, authRes.admin);
      console.log(`Superuser authenticated: ${superuserArg}`);
    } catch (e) {
      console.warn("Could not authenticate superuser:", e.message);
    }
  }

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

  // Authenticate as Admin user
  await pb.collection("users").authWithPassword("admin@ojlinker.sa", "AdminSecret123!");
  console.log("Authenticated as Admin user.");

  // Check if clients already exist
  const existingClients = await pb.collection("clients").getList(1, 5);
  if (existingClients.totalItems > 0) {
    console.log(`Database already contains ${existingClients.totalItems} clients. Skipping re-seeding.`);
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

      // 4 overdue (-3, -2, -1 days), 5 due today (0 days), rest future (+2 to +14)
      if (i % 5 === 0) {
        nextDate = makeDate(-1 * ((i % 3) + 1));
      } else if (i % 4 === 0) {
        nextDate = makeDate(0);
      } else if (outcome !== "مشترك" && outcome !== "غير مهتم") {
        nextDate = makeDate((i % 7) + 2);
      }
    }

    const priorities = ["عالية", "متوسطة", "منخفضة"];
    const priority = priorities[i % 3];
    const source = sources[i % sources.length];
    const owner = userIds.length > 0 ? userIds[i % userIds.length] : "";

    const client = await pb.collection("clients").create({
      code,
      name,
      city,
      business_type: businessType,
      contact_person: `مسؤول صالون ${i + 1}`,
      phone,
      source,
      priority,
      contact_status: contactStatus,
      outcome,
      next_follow_up_date: nextDate,
      notes: contacted ? "تم التواصل عبر واتساب، الصالون أبدى اهتمامًا بالباقات السنوية." : "",
      owner,
    });

    createdClientIds.push(client.id);
  }

  console.log("Seeding 35 demo contact logs...");
  const channels = ["واتساب", "اتصال هاتفي", "رسالة نصية", "إنستجرام"];
  const results = ["مهتم", "طلب عرض", "طلب تجربة", "مشترك", "غير مهتم", "لم يرد", "إعادة التواصل لاحقًا"];

  for (let j = 0; j < 35; j++) {
    const clientId = createdClientIds[j % createdClientIds.length];
    const daysAgo = (j % 12);
    const date = new Date(Date.now() - (daysAgo * 86400000) - (j * 3600000)).toISOString();
    const result = results[j % results.length];

    await pb.collection("contact_logs").create({
      code: `ACT-${String(j + 1).padStart(5, "0")}`,
      client: clientId,
      contacted_at: date,
      channel: channels[j % channels.length],
      attempt_type: j % 2 === 0 ? "رسالة أولى" : "متابعة أولى",
      replied: result === "لم يرد" ? "لا" : "نعم",
      result,
      reply_summary: `تواصل تجريبي: ${result} مع تقديم تفاصيل الأسعار والعروض الخاصة.`,
      next_action: result === "مشترك" ? "إغلاق العميل" : "متابعة لاحقًا",
      created_by: userIds[j % userIds.length] || "",
    });
  }

  console.log("Done! Seeded 25 salons, 35 contact logs, and 4 team users.");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
