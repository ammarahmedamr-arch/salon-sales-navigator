import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let pbProcess: ChildProcess;
let viteProcess: ChildProcess;
const PB_PORT = 18090;
const VITE_PORT = 15173;
const PB_URL = `http://127.0.0.1:${PB_PORT}`;
const APP_URL = `http://127.0.0.1:${VITE_PORT}`;
const TEMP_DATA_DIR = `/tmp/ojl_e2e_pb_${Date.now()}`;

test.beforeAll(async () => {
  fs.mkdirSync(TEMP_DATA_DIR, { recursive: true });
  const pbBin = path.resolve(process.cwd(), "backend/pocketbase");

  // 1. Run migrations
  await new Promise<void>((resolve, reject) => {
    const p = spawn(pbBin, [
      "migrate",
      "up",
      `--dir=${TEMP_DATA_DIR}`,
      `--migrationsDir=${path.resolve(process.cwd(), "backend/pb_migrations")}`,
    ]);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Migration exited ${code}`))));
  });

  // 2. Create superuser
  await new Promise<void>((resolve, reject) => {
    const p = spawn(pbBin, [
      "admin",
      "create",
      "superuser@test.sa",
      "SuperPassword123!",
      `--dir=${TEMP_DATA_DIR}`,
    ]);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Admin create exited ${code}`))));
  });

  // 3. Start PB Server
  pbProcess = spawn(pbBin, [
    "serve",
    `--dir=${TEMP_DATA_DIR}`,
    `--hooksDir=${path.resolve(process.cwd(), "backend/pb_hooks")}`,
    `--http=127.0.0.1:${PB_PORT}`,
  ]);

  // Wait for PB health
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${PB_URL}/api/health`);
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  // 4. Seed dev data
  await new Promise<void>((resolve, reject) => {
    const p = spawn("node", [
      "backend/scripts/seed-dev.mjs",
      "--i-know-this-is-dev",
      `--url=${PB_URL}`,
      "--superuser=superuser@test.sa",
      "--password=SuperPassword123!",
    ]);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Seed exited ${code}`))));
  });

  // 5. Start Vite Server
  viteProcess = spawn(
    "npx",
    ["vite", "--port", String(VITE_PORT), "--strictPort"],
    {
      env: { ...process.env, VITE_PB_URL: PB_URL },
      stdio: "pipe",
    }
  );

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(APP_URL);
      if (res.ok || res.status === 404) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
});

test.afterAll(() => {
  if (viteProcess) viteProcess.kill("SIGTERM");
  if (pbProcess) pbProcess.kill("SIGTERM");
  try {
    fs.rmSync(TEMP_DATA_DIR, { recursive: true, force: true });
  } catch {}
});

test.describe("OJLinker CRM End-to-End User Flow", () => {
  test("authenticates, navigates dashboard, adds a salon, and logs a contact attempt", async ({ page }) => {
    page.on("console", (msg) => console.log("PAGE CONSOLE:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err));
    page.on("requestfailed", (req) =>
      console.log("REQ FAILED:", req.method(), req.url(), req.failure()?.errorText)
    );

    // 1. Visit Login
    await page.goto(`${APP_URL}/login`);
    await expect(page.locator("h1")).toContainText("مرحبًا بعودتك");

    // Test bad credentials rejection
    await page.fill("#email", "admin@ojlinker.sa");
    await page.fill("#password", "WrongPassword123!");
    await page.click("button[type='submit']");
    await expect(page.locator("button[type='submit']")).not.toBeDisabled({ timeout: 5000 });

    // Test valid login
    await page.fill("#password", "AdminSecret123!");
    await page.click("button[type='submit']");

    // 2. Redirected to Dashboard
    await page.waitForURL("**/", { waitUntil: "commit" });
    await expect(page.locator("h1")).toContainText("لوحة المتابعة");

    // Verify 8 KPI cards
    await expect(page.getByText("إجمالي العملاء")).toBeVisible();
    await expect(page.getByRole("link", { name: /تم التواصل/ })).toBeVisible();
    await expect(page.getByText("ردّ الصالون")).toBeVisible();
    await expect(page.getByText("صالونات مهتمة")).toBeVisible();
    await expect(page.getByText("متابعات مستحقة")).toBeVisible();
    await expect(page.getByText("عروض وتجارب")).toBeVisible();
    await expect(page.getByText("مشتركون")).toBeVisible();
    await expect(page.getByText("غير مهتمين")).toBeVisible();

    // 3. Navigate to Clients page
    await page.goto(`${APP_URL}/clients`);
    await expect(page.locator("h1")).toContainText("العملاء والصالونات");

    // 4. Open Client Form Dialog and Create Salon
    await page.getByRole("button", { name: "إضافة صالون جديد" }).click();
    await expect(page.getByRole("heading", { name: "إضافة صالون جديد" })).toBeVisible();

    const uniqueSalonName = `صالون أوتوميشن ${Date.now().toString().slice(-4)}`;
    await page.fill("#client-name", uniqueSalonName);
    await page.fill("#client-phone", "0599887766");
    await page.fill("#client-contact-person", "أم عبد الرحمن");
    await page.getByRole("button", { name: "إضافة الصالون" }).click();

    // Wait for creation and table update
    await expect(page.getByText(uniqueSalonName)).toBeVisible({ timeout: 5000 });

    // 5. Open Sheet for this salon
    await page.getByText(uniqueSalonName).click();
    await expect(page.getByText("سجل المتابعات السابقة")).toBeVisible();

    await page.getByRole("button", { name: "تسجيل تواصل" }).click();
    await expect(page.getByRole("heading", { name: "تسجيل تواصل جديد" })).toBeVisible();

    await page.fill("#reply_summary", "تم التواصل والعميل مهتم بالاشتراك في باقة صالونات الرياض.");
    await page.getByRole("button", { name: "حفظ سجل التواصل" }).click();

    await page.waitForTimeout(1000);

    // 6. Navigate to Today follow-ups
    await page.goto(`${APP_URL}/today`);
    await expect(page.locator("h1")).toContainText("متابعات اليوم");

    // 7. Navigate to Contact Log
    await page.goto(`${APP_URL}/log`);
    await expect(page.locator("h1")).toContainText("سجل التواصل");
    await expect(page.getByText("باقة صالونات الرياض")).toBeVisible();

    // 8. Navigate to Settings
    await page.goto(`${APP_URL}/settings`);
    await expect(page.locator("h1")).toContainText("الإعدادات وإدارة النظام");
    await expect(page.getByRole("table").getByText("عمر الحربي")).toBeVisible();
    await expect(page.getByText("تصدير البيانات والنسخ الاحتياطي")).toBeVisible();
  });
});
