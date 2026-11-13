import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import PocketBase from "pocketbase";

const SCREENSHOTS_DIR = path.resolve(process.cwd(), "docs/screenshots");
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const PB_PORT = 18090;
const VITE_PORT = 15173;
const PB_URL = `http://127.0.0.1:${PB_PORT}`;
const APP_URL = `http://127.0.0.1:${VITE_PORT}`;
const TEMP_DATA_DIR = `/tmp/ojl_screenshots_pb_${Date.now()}`;

fs.mkdirSync(TEMP_DATA_DIR, { recursive: true });

async function runCommand(bin, args, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { cwd, stdio: "inherit" });
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${bin} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server at ${url} did not respond within ${timeoutMs}ms`);
}

async function main() {
  console.log("=== 1. Preparing Dev Database & Seed Data ===");
  const pbBin = path.resolve(process.cwd(), "backend/pocketbase");

  // Run migrations
  await runCommand(pbBin, [
    "migrate",
    "up",
    `--dir=${TEMP_DATA_DIR}`,
    `--migrationsDir=${path.resolve(process.cwd(), "backend/pb_migrations")}`,
  ]);

  // Create superuser
  await runCommand(pbBin, [
    "admin",
    "create",
    "superuser@test.sa",
    "SuperPassword123!",
    `--dir=${TEMP_DATA_DIR}`,
  ]);

  // Start PB
  console.log("=== 2. Starting PocketBase Server ===");
  const pbProcess = spawn(pbBin, [
    "serve",
    `--dir=${TEMP_DATA_DIR}`,
    `--hooksDir=${path.resolve(process.cwd(), "backend/pb_hooks")}`,
    `--http=127.0.0.1:${PB_PORT}`,
  ]);

  await waitForServer(`${PB_URL}/api/health`);
  console.log(`PocketBase is running on ${PB_URL}`);

  // Seed dev database
  console.log("=== 3. Seeding Realistic Dev Data ===");
  await runCommand("node", [
    "backend/scripts/seed-dev.mjs",
    "--i-know-this-is-dev",
    `--url=${PB_URL}`,
    "--superuser=superuser@test.sa",
    "--password=SuperPassword123!",
  ]);

  // Start Vite Preview or Dev server
  console.log("=== 4. Starting Frontend Server ===");
  const viteProcess = spawn(
    "npx",
    ["vite", "--port", String(VITE_PORT), "--strictPort"],
    {
      env: { ...process.env, VITE_PB_URL: PB_URL },
      stdio: "pipe",
    }
  );

  await waitForServer(APP_URL);
  console.log(`Frontend is running on ${APP_URL}`);

  console.log("=== 5. Launching Playwright Chromium ===");
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "1280", width: 1280, height: 900, isMobile: false },
    { name: "390", width: 390, height: 844, isMobile: true },
  ];

  const pagesToCapture = [
    { id: "01-dashboard", path: "/" },
    { id: "02-today", path: "/today" },
    { id: "03-clients", path: "/clients" },
    { id: "04-log", path: "/log" },
    { id: "05-settings", path: "/settings" },
  ];

  try {
    for (const vp of viewports) {
      console.log(`\n--- Capturing viewport: ${vp.name}px ---`);

      // 1. Light Mode Context
      const lightContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        colorScheme: "light",
      });
      const lightPage = await lightContext.newPage();

      // Login as admin
      await lightPage.goto(`${APP_URL}/login`);
      await lightPage.waitForSelector("#email");
      await lightPage.fill("#email", "admin@ojlinker.sa");
      await lightPage.fill("#password", "AdminSecret123!");
      await lightPage.click("button[type='submit']");
      await lightPage.waitForURL(`${APP_URL}/`);
      await lightPage.waitForTimeout(1000);

      for (const p of pagesToCapture) {
        await lightPage.goto(`${APP_URL}${p.path}`);
        await lightPage.waitForTimeout(800);
        // Ensure no pending queries / spinners
        const filename = `${p.id}-${vp.name}-light.png`;
        const filepath = path.join(SCREENSHOTS_DIR, filename);
        await lightPage.screenshot({ path: filepath, fullPage: false });
        console.log(`Saved: docs/screenshots/${filename}`);
      }
      await lightContext.close();

      // 2. Dark Mode Context
      const darkContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        colorScheme: "dark",
      });
      const darkPage = await darkContext.newPage();

      // Login as admin
      await darkPage.goto(`${APP_URL}/login`);
      await darkPage.waitForSelector("#email");
      await darkPage.fill("#email", "admin@ojlinker.sa");
      await darkPage.fill("#password", "AdminSecret123!");
      await darkPage.click("button[type='submit']");
      await darkPage.waitForURL(`${APP_URL}/`);
      await darkPage.waitForTimeout(1000);

      // Force dark class on html
      await darkPage.evaluate(() => {
        document.documentElement.classList.add("dark");
        window.localStorage.setItem("ojlinker_theme", "dark");
      });

      for (const p of pagesToCapture) {
        await darkPage.goto(`${APP_URL}${p.path}`);
        await darkPage.evaluate(() => {
          document.documentElement.classList.add("dark");
        });
        await darkPage.waitForTimeout(800);
        const filename = `${p.id}-${vp.name}-dark.png`;
        const filepath = path.join(SCREENSHOTS_DIR, filename);
        await darkPage.screenshot({ path: filepath, fullPage: false });
        console.log(`Saved: docs/screenshots/${filename}`);
      }
      await darkContext.close();
    }
    console.log("\nAll 20 screenshots captured successfully in docs/screenshots/!");
  } finally {
    await browser.close();
    viteProcess.kill("SIGTERM");
    pbProcess.kill("SIGTERM");
    try {
      fs.rmSync(TEMP_DATA_DIR, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
