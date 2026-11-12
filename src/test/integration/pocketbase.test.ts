import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import PocketBase from "pocketbase";

describe("PocketBase Backend Integration Tests", () => {
  let pbProcess: ChildProcess;
  let pbUrl: string;
  let tempDir: string;
  let adminPb: PocketBase;
  let agentPb: PocketBase;
  let anonPb: PocketBase;

  const port = Math.floor(Math.random() * 2000) + 18000;
  pbUrl = `http://127.0.0.1:${port}`;
  tempDir = `/tmp/pb_integration_${Date.now()}_${port}`;

  beforeAll(async () => {
    fs.mkdirSync(tempDir, { recursive: true });

    const pbBin = path.resolve(process.cwd(), "backend/pocketbase");
    const migrationsDir = path.resolve(process.cwd(), "backend/pb_migrations");
    const hooksDir = path.resolve(process.cwd(), "backend/pb_hooks");

    // 1. Run migrations
    const migrate = spawn(pbBin, [
      "migrate", "up",
      `--dir=${tempDir}`,
      `--migrationsDir=${migrationsDir}`,
    ]);
    await new Promise<void>((resolve, reject) => {
      migrate.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Migration failed with code ${code}`));
      });
    });

    // 2. Create Superuser via CLI before starting serve
    const superuserProc = spawn(pbBin, [
      "admin", "create",
      "superuser@test.sa", "SuperPassword123!",
      `--dir=${tempDir}`,
    ]);
    await new Promise<void>((resolve, reject) => {
      superuserProc.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Superuser creation failed with code ${code}`));
      });
    });

    // 3. Start PB server
    pbProcess = spawn(pbBin, [
      "serve",
      `--dir=${tempDir}`,
      `--hooksDir=${hooksDir}`,
      `--http=127.0.0.1:${port}`,
    ]);

    // Wait for server health endpoint
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`${pbUrl}/api/health`);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!ready) {
      throw new Error(`PocketBase did not start on ${pbUrl} in time`);
    }

    // 4. Create App Users (Admin & Agent)
    const superuserPb = new PocketBase(pbUrl);
    const authRes = await superuserPb.send("/api/admins/auth-with-password", {
      method: "POST",
      body: { identity: "superuser@test.sa", password: "SuperPassword123!" },
    });
    superuserPb.authStore.save(authRes.token, authRes.admin);

    adminPb = new PocketBase(pbUrl);
    agentPb = new PocketBase(pbUrl);
    anonPb = new PocketBase(pbUrl);

    await superuserPb.collection("users").create({
      email: "admin@test.sa",
      password: "AdminPassword123!",
      passwordConfirm: "AdminPassword123!",
      name: "مدير الاختبار",
      role: "admin",
      emailVisibility: false,
    });

    await superuserPb.collection("users").create({
      email: "agent@test.sa",
      password: "AgentPassword123!",
      passwordConfirm: "AgentPassword123!",
      name: "وكيل المبيعات",
      role: "agent",
      emailVisibility: false,
    });

    // Authenticate as App Admin & App Agent
    await adminPb.collection("users").authWithPassword("admin@test.sa", "AdminPassword123!");
    await agentPb.collection("users").authWithPassword("agent@test.sa", "AgentPassword123!");
  });

  afterAll(async () => {
    if (pbProcess) {
      pbProcess.kill("SIGTERM");
    }
    // Clean up temp dir
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // --- Test Suite 1: Authentication & Authorization Rules ---
  describe("Security & Collection API Rules", () => {
    it("rejects unauthenticated requests to list clients with 403 Forbidden", async () => {
      let error: any = null;
      try {
        await anonPb.collection("clients").getList(1, 10);
      } catch (err: any) {
        error = err;
      }
      expect(error).not.toBeNull();
      expect(error.status).toBe(403);
    });

    it("rejects unauthenticated requests to list contact logs with 403 Forbidden", async () => {
      let error: any = null;
      try {
        await anonPb.collection("contact_logs").getList(1, 10);
      } catch (err: any) {
        error = err;
      }
      expect(error).not.toBeNull();
      expect(error.status).toBe(403);
    });

    it("prevents agents from deleting a client (403 Forbidden)", async () => {
      // 1. Create client as agent
      const client = await agentPb.collection("clients").create({
        name: "صالون تجربة الحذف",
        phone: "0512345678",
        city: "الرياض",
        business_type: "صالون نسائي",
        source: "خرائط Google",
        priority: "متوسطة",
        contact_status: "لم يتم التواصل",
        outcome: "غير محدد",
      });

      // 2. Agent tries to delete
      let deleteError: any = null;
      try {
        await agentPb.collection("clients").delete(client.id);
      } catch (err: any) {
        deleteError = err;
      }
      expect(deleteError).not.toBeNull();
      expect([400, 403, 404]).toContain(deleteError.status);

      // 3. Admin can delete
      const adminDelete = await adminPb.collection("clients").delete(client.id);
      expect(adminDelete).toBe(true);
    });

    it("prevents public user registration", async () => {
      let createError: any = null;
      try {
        await anonPb.collection("users").create({
          email: "stranger@external.sa",
          password: "Password123!",
          passwordConfirm: "Password123!",
          name: "مستخدم غير مصرح",
          role: "admin",
        });
      } catch (err: any) {
        createError = err;
      }
      expect(createError).not.toBeNull();
      expect([400, 403]).toContain(createError.status);
    });
  });

  // --- Test Suite 2: Code Auto-Increment ---
  describe("Sequential Code Auto-Increment", () => {
    it("generates sequential SAL-0001 and SAL-0002 for clients", async () => {
      const c1 = await agentPb.collection("clients").create({
        name: "صالون تسلسل 1",
        phone: "0501111111",
        city: "جدة",
        business_type: "سبا",
        source: "إنستجرام",
        priority: "عالية",
        contact_status: "لم يتم التواصل",
        outcome: "غير محدد",
      });

      const c2 = await agentPb.collection("clients").create({
        name: "صالون تسلسل 2",
        phone: "0502222222",
        city: "الدمام",
        business_type: "مركز تجميل",
        source: "دليل أعمال",
        priority: "متوسطة",
        contact_status: "لم يتم التواصل",
        outcome: "غير محدد",
      });

      expect(c1["code"]).toMatch(/^SAL-\d{4}$/);
      expect(c2["code"]).toMatch(/^SAL-\d{4}$/);

      const num1 = parseInt(c1["code"].replace("SAL-", ""), 10);
      const num2 = parseInt(c2["code"].replace("SAL-", ""), 10);
      expect(num2).toBe(num1 + 1);
    });

    it("generates sequential ACT-00001 for contact logs", async () => {
      const client = await agentPb.collection("clients").create({
        name: "صالون تجربة كود النشاط",
        phone: "0503333333",
        city: "الرياض",
        business_type: "صالون نسائي",
        source: "خرائط Google",
        priority: "منخفضة",
        contact_status: "لم يتم التواصل",
        outcome: "غير محدد",
      });

      const log = await agentPb.collection("contact_logs").create({
        client: client.id,
        contacted_at: new Date().toISOString(),
        channel: "واتساب",
        attempt_type: "رسالة أولى",
        replied: "نعم",
        result: "مهتم",
      });

      expect(log["code"]).toMatch(/^ACT-\d{5}$/);
    });
  });

  // --- Test Suite 3: Phone Normalization ---
  describe("Server-Side Phone Normalization", () => {
    it("normalizes Saudi mobile starting with 05 to 9665XXXXXXXX", async () => {
      const client = await agentPb.collection("clients").create({
        name: "صالون التحقق من الهاتف",
        phone: "05 9876 5432",
        city: "الرياض",
        business_type: "حلاقة",
        source: "بحث يدوي",
        priority: "متوسطة",
        contact_status: "لم يتم التواصل",
        outcome: "غير محدد",
      });

      expect(client["phone"]).toBe("966598765432");
    });

    it("rejects non-Saudi or invalid mobile numbers with HTTP 400", async () => {
      let err: any = null;
      try {
        await agentPb.collection("clients").create({
          name: "صالون رقم خاطئ",
          phone: "0112345678", // Landline / non-mobile
          city: "الرياض",
          business_type: "صالون نسائي",
          source: "خرائط Google",
          priority: "متوسطة",
          contact_status: "لم يتم التواصل",
          outcome: "غير محدد",
        });
      } catch (e: any) {
        err = e;
      }
      expect(err).not.toBeNull();
      expect(err.status).toBe(400);
      expect(err.message).toBe("Failed to create record.");
    });
  });

  // --- Test Suite 4: Atomic Parent Update Hook ---
  describe("Contact Log Creation & Atomic Client Update Hook", () => {
    it("POST /api/ojl/contact-logs updates client status 'ردّ' and outcome 'مهتم' when result is 'مهتم'", async () => {
      // 1. Create client
      const client = await agentPb.collection("clients").create({
        name: "صالون اختبار التحديث الذري",
        phone: "0555555555",
        city: "الرياض",
        business_type: "صالون نسائي",
        source: "خرائط Google",
        priority: "عالية",
        contact_status: "لم يتم التواصل",
        outcome: "غير محدد",
      });

      // 2. Call custom hook endpoint
      const response = await fetch(`${pbUrl}/api/ojl/contact-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${agentPb.authStore.token}`,
        },
        body: JSON.stringify({
          client_id: client.id,
          contacted_at: "2026-11-12T14:30:00.000Z",
          channel: "واتساب",
          attempt_type: "رسالة أولى",
          replied: "نعم",
          result: "مهتم",
          next_follow_up_date: "2026-11-16",
          reply_summary: "مهتم بالباقة الأساسية",
          next_action: "إرسال تفاصيل",
          update_client: true,
        }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.log).toBeDefined();
      expect(json.log.code).toMatch(/^ACT-\d{5}$/);
      expect(json.client).toBeDefined();
      expect(json.client.contact_status).toBe("ردّ");
      expect(json.client.outcome).toBe("مهتم");

      // Verify DB record
      const refreshedClient = await agentPb.collection("clients").getOne(client.id);
      expect(refreshedClient["contact_status"]).toBe("ردّ");
      expect(refreshedClient["outcome"]).toBe("مهتم");
      expect(refreshedClient["last_contact_at"]).toContain("2026-11-12");
      expect(refreshedClient["next_follow_up_date"]).toContain("2026-11-16");
    });

    it("forces status 'تم إيقاف التواصل' and outcome 'لا يرغب بالتواصل' and clears follow_up when result is 'طلب عدم التواصل'", async () => {
      const client = await agentPb.collection("clients").create({
        name: "صالون إيقاف التواصل",
        phone: "0566666666",
        city: "جدة",
        business_type: "مركز تجميل",
        source: "إنستجرام",
        priority: "عالية",
        contact_status: "تم التواصل",
        outcome: "مهتم",
        next_follow_up_date: "2026-11-20",
      });

      const response = await fetch(`${pbUrl}/api/ojl/contact-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${agentPb.authStore.token}`,
        },
        body: JSON.stringify({
          client_id: client.id,
          contacted_at: "2026-11-12T15:00:00.000Z",
          channel: "اتصال هاتفي",
          attempt_type: "مكالمة",
          replied: "نعم",
          result: "طلب عدم التواصل",
          next_follow_up_date: "2026-11-28", // Client should ignore this
          update_client: false, // Must force update even if false!
        }),
      });

      expect(response.status).toBe(200);
      const refreshedClient = await agentPb.collection("clients").getOne(client.id);
      expect(refreshedClient["contact_status"]).toBe("تم إيقاف التواصل");
      expect(refreshedClient["outcome"]).toBe("لا يرغب بالتواصل");
      expect(refreshedClient["next_follow_up_date"]).toBe("");
    });
  });

  // --- Test Suite 5: Dashboard Endpoint ---
  describe("Dashboard Endpoint GET /api/ojl/dashboard", () => {
    it("returns 8 KPIs, funnel data, city stats, and top follow-ups", async () => {
      const res = await fetch(`${pbUrl}/api/ojl/dashboard`, {
        headers: {
          Authorization: `Bearer ${agentPb.authStore.token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(typeof data.total).toBe("number");
      expect(typeof data.contacted).toBe("number");
      expect(typeof data.replied).toBe("number");
      expect(typeof data.interested).toBe("number");
      expect(typeof data.notInterested).toBe("number");
      expect(typeof data.due).toBe("number");
      expect(typeof data.demos).toBe("number");
      expect(typeof data.subscribed).toBe("number");

      expect(Array.isArray(data.funnel)).toBe(true);
      expect(data.funnel.length).toBe(6);

      expect(Array.isArray(data.cities)).toBe(true);
      expect(Array.isArray(data.followUps)).toBe(true);
      expect(Array.isArray(data.recentLogs)).toBe(true);
    });
  });
});
