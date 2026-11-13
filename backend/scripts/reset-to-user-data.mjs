#!/usr/bin/env node

/**
 * Script to reset database to the user's specific single initial record
 * and set admin name to "ojlinker" with agent "محمد سيد".
 */

import PocketBase from "pocketbase";

const pb = new PocketBase("http://127.0.0.1:8090");

async function main() {
  console.log("Connecting to PocketBase...");
  
  // Authenticate as PocketBase superuser/admin
  const adminRes = await pb.send("/api/admins/auth-with-password", {
    method: "POST",
    body: { identity: "admin@ojlinker.sa", password: "AdminPass12345!" },
  });
  pb.authStore.save(adminRes.token, adminRes.admin);
  console.log("Authenticated as superuser.");

  // 1. Delete all existing contact logs
  console.log("Deleting existing contact logs...");
  const logs = await pb.collection("contact_logs").getFullList();
  for (const log of logs) {
    await pb.collection("contact_logs").delete(log.id);
  }
  console.log(`Deleted ${logs.length} contact logs.`);

  // 2. Delete all existing clients
  console.log("Deleting existing clients...");
  const clients = await pb.collection("clients").getFullList();
  for (const client of clients) {
    await pb.collection("clients").delete(client.id);
  }
  console.log(`Deleted ${clients.length} clients.`);

  // 3. Ensure users:
  // - Admin: name "ojlinker", email "admin@ojlinker.sa"
  // - Agent: name "محمد سيد", email "mohamed@ojlinker.sa"
  console.log("Configuring team users...");
  let adminUser = null;
  let mohamedUser = null;

  const users = await pb.collection("users").getFullList();
  for (const u of users) {
    if (u.role === "admin" || u.email === "admin@ojlinker.sa") {
      adminUser = await pb.collection("users").update(u.id, {
        name: "ojlinker",
        role: "admin",
      });
      console.log(`Updated admin name to: ojlinker (${adminUser.email})`);
    } else if (u.name === "محمد سيد" || u.email === "mohamed@ojlinker.sa") {
      mohamedUser = u;
    } else {
      // Remove other previous demo users (noura, sara, faisal)
      await pb.collection("users").delete(u.id);
      console.log(`Removed previous demo user: ${u.name}`);
    }
  }

  if (!mohamedUser) {
    mohamedUser = await pb.collection("users").create({
      email: "mohamed@ojlinker.sa",
      password: "AgentSecret123!",
      passwordConfirm: "AgentSecret123!",
      name: "محمد سيد",
      role: "agent",
      emailVisibility: false,
    });
    console.log(`Created agent user: محمد سيد (mohamed@ojlinker.sa)`);
  }

  // 4. Insert user's provided initial salon:
  // SAL-0001,حلاقة منعشة,المدينة المنورة,صالون رجالي,أبو سيف ,966566756873,https://freshtrim.ojlinker.com.sa,بحث يدوي,2026-11-01,عالية,متابعة مطلوبة,مشترك,2026-11-01,,,1,صف تجريبي فقط — احذفه قبل الاستخدام الفعلي,محمد سيد,
  console.log("Inserting user's initial salon...");
  const salon = await pb.collection("clients").create({
    code: "SAL-0001",
    name: "حلاقة منعشة",
    city: "المدينة المنورة",
    business_type: "صالون رجالي",
    contact_person: "أبو سيف",
    phone: "966566756873",
    website_url: "https://freshtrim.ojlinker.com.sa",
    source: "بحث يدوي",
    priority: "عالية",
    contact_status: "متابعة مطلوبة",
    outcome: "مشترك",
    last_contact_at: "2026-11-01 22:23:00",
    next_follow_up_date: null,
    notes: "صف تجريبي فقط — احذفه قبل الاستخدام الفعلي",
    owner: mohamedUser.id,
  });
  console.log(`Created salon: ${salon.name} (${salon.code})`);

  // 5. Insert user's provided initial contact log:
  // ACT-00001,SAL-0001,حلاقة منعشة,2026-11-01 22:23:00,اتصال هاتفي,مكالمة,,مشترك,,,,
  console.log("Inserting user's initial contact log...");
  const log = await pb.collection("contact_logs").create({
    code: "ACT-00001",
    client: salon.id,
    contacted_at: "2026-11-01 22:23:00",
    channel: "اتصال هاتفي",
    attempt_type: "مكالمة",
    replied: "نعم",
    result: "مشترك",
    next_action: "لا إجراء",
    summary: "مكالمة أولى - تم الاشتراك",
    created_by: mohamedUser.id,
  });
  console.log(`Created contact log: ${log.code} for ${salon.name}`);

  console.log("Database successfully reset to user data!");
}

main().catch((err) => {
  console.error("Error resetting database:", err);
  process.exit(1);
});
