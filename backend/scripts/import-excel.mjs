#!/usr/bin/env node

/**
 * Excel Importer for OJLinker CRM.
 * Imports clients from sheet "العملاء" and contact logs from "سجل التواصل".
 *
 * Usage:
 *   node backend/scripts/import-excel.mjs
 *   node backend/scripts/import-excel.mjs --dry-run
 *   node backend/scripts/import-excel.mjs --file=./path/to/file.xlsx
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import xlsx from "xlsx";
import PocketBase from "pocketbase";

const CITIES = ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الطائف", "أبها", "تبوك", "بريدة", "أخرى"];
const BUSINESS_TYPES = ["صالون نسائي", "صالون رجالي", "مركز تجميل", "سبا", "حلاقة", "أخرى"];
const PRIORITIES = ["عالية", "متوسطة", "منخفضة"];
const CONTACT_STATUSES = ["لم يتم التواصل", "تم التواصل", "في انتظار الرد", "ردّ", "متابعة مطلوبة", "تم إيقاف التواصل"];
const OUTCOMES = ["غير محدد", "مهتم", "غير مهتم", "طلب عرض", "تجربة/ديمو", "يحتاج متابعة لاحقًا", "مشترك", "لا يرغب بالتواصل"];
const SOURCES = ["خرائط Google", "إنستجرام", "موقع إلكتروني", "دليل أعمال", "إحالة", "بحث يدوي", "مصدر آخر"];
const CHANNELS = ["واتساب", "اتصال هاتفي", "رسالة نصية", "إنستجرام", "بريد إلكتروني", "أخرى"];
const ATTEMPT_TYPES = ["رسالة أولى", "متابعة أولى", "متابعة ثانية", "مكالمة", "عرض توضيحي", "متابعة بعد العرض", "أخرى"];
const REPLIED_OPTIONS = ["نعم", "لا", "لم يتضح"];
const CONTACT_RESULTS = ["لم يرد", "مهتم", "غير مهتم", "طلب تفاصيل", "طلب عرض", "طلب تجربة", "مشترك", "طلب عدم التواصل", "رقم غير صحيح", "إعادة التواصل لاحقًا"];
const NEXT_ACTIONS = ["انتظار الرد", "إرسال تفاصيل", "تحديد موعد عرض", "متابعة لاحقًا", "إغلاق العميل", "إيقاف التواصل", "لا إجراء"];

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const fileArg = args.find((a) => a.startsWith("--file="))?.slice(7);
const defaultLocations = [
  path.resolve(process.cwd(), "data/OJLinker_Salon_Sales_Tracker.xlsx"),
  "/var/www/ojlinker-crm/data/OJLinker_Salon_Sales_Tracker.xlsx",
];
const filePath = fileArg || defaultLocations.find((p) => fs.existsSync(p)) || defaultLocations[0];

const pbUrl = process.env.VITE_PB_URL || process.env.PB_URL || "http://127.0.0.1:8090";
const pb = new PocketBase(pbUrl);

function normalizePhone(val) {
  if (!val) return null;
  const digits = String(val).replace(/\D/g, "");
  if (/^05\d{8}$/.test(digits)) return "966" + digits.slice(1);
  if (/^9665\d{8}$/.test(digits)) return digits;
  return null;
}

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString();
  }
  if (typeof val === "number") {
    // Excel serial date to JS Date
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.length === 10 ? `${str}T00:00:00.000Z` : new Date(str).toISOString();
  }
  // Try DD/MM/YYYY
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const d = match[1].padStart(2, "0");
    const m = match[2].padStart(2, "0");
    const y = match[3];
    return `${y}-${m}-${d}T00:00:00.000Z`;
  }
  return null;
}

async function main() {
  console.log(`=== OJLinker Excel Importer ===`);
  console.log(`Target File: ${filePath}`);
  console.log(`Mode: ${isDryRun ? "DRY RUN (no database changes)" : "LIVE IMPORT"}`);

  if (!fs.existsSync(filePath)) {
    console.warn(`\x1b[33m%s\x1b[0m`, `Notice: Excel file not found at ${filePath}.`);
    console.warn("Please place the tracker at `data/OJLinker_Salon_Sales_Tracker.xlsx` or pass `--file=<path>`.");
    console.log("Importer exited gracefully without errors.");
    process.exit(0);
  }

  // Read workbook
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  console.log(`Available sheets: ${workbook.SheetNames.join(", ")}`);

  // Authenticate as Admin if not dry run
  const createdUsers = new Map();
  if (!isDryRun) {
    try {
      const adminEmail = process.env.PB_ADMIN_EMAIL || "admin@ojlinker.sa";
      const adminPassword = process.env.PB_ADMIN_PASSWORD || "AdminPass123!";
      await pb.collection("users").authWithPassword(adminEmail, adminPassword);
      console.log(`Authenticated as ${adminEmail}`);
    } catch (e) {
      console.error("Failed to authenticate with PocketBase:", e.message);
      console.error("Please run create-admin.mjs first or set PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD.");
      process.exit(1);
    }
  }

  async function getOrCreateUser(name) {
    if (!name || isDryRun) return null;
    const cleanName = String(name).trim();
    if (!cleanName) return null;
    if (createdUsers.has(cleanName)) return createdUsers.get(cleanName);

    try {
      const existing = await pb.collection("users").getList(1, 1, {
        filter: pb.filter("name = {:name}", { name: cleanName }),
      });
      if (existing.items.length > 0) {
        createdUsers.set(cleanName, existing.items[0].id);
        return existing.items[0].id;
      }

      // Create new user with random password
      const randomPassword = crypto.randomBytes(8).toString("hex") + "A1!";
      const cleanEmail = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}@ojlinker.sa`;
      const created = await pb.collection("users").create({
        name: cleanName,
        email: cleanEmail,
        password: randomPassword,
        passwordConfirm: randomPassword,
        role: "agent",
        emailVisibility: false,
      });

      console.log(`[USER CREATED] Name: "${cleanName}" | Email: ${cleanEmail} | Temp Password: ${randomPassword}`);
      createdUsers.set(cleanName, created.id);
      return created.id;
    } catch (err) {
      console.warn(`Could not map user "${cleanName}":`, err.message);
      return null;
    }
  }

  // 1. Process sheet "العملاء"
  const clientsSheetName = workbook.SheetNames.find((s) => s.includes("العملاء") || s.toLowerCase().includes("client"));
  const clientCodeToId = new Map();

  if (clientsSheetName) {
    console.log(`\n--- Reading sheet: "${clientsSheetName}" ---`);
    const sheet = workbook.Sheets[clientsSheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    console.log(`Found ${rows.length} rows.`);

    let imported = 0;
    let skipped = 0;
    let invalid = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1
      const row = rows[i];

      // Extract values with flexible column aliases
      const code = String(row["كود العميل"] || row["الكود"] || row["Code"] || row["code"] || "").trim();
      const name = String(row["اسم الصالون"] || row["الاسم"] || row["Name"] || "").trim();
      const rawPhone = row["رقم الهاتف"] || row["الجوال"] || row["الهاتف"] || row["Phone"] || "";
      const city = String(row["المدينة"] || row["City"] || "").trim();
      const bType = String(row["نوع النشاط"] || row["النشاط"] || row["Type"] || "").trim();
      const person = String(row["الشخص المسؤول"] || row["جهة الاتصال"] || row["المسؤول"] || "").trim();
      const source = String(row["المصدر"] || row["Source"] || "").trim();
      const priority = String(row["الأولوية"] || row["Priority"] || "").trim();
      const status = String(row["حالة التواصل"] || row["الحالة"] || row["Status"] || "").trim();
      const outcome = String(row["النتيجة"] || row["Outcome"] || "").trim();
      const lastContact = parseExcelDate(row["تاريخ آخر تواصل"] || row["آخر تواصل"]);
      const nextDate = parseExcelDate(row["موعد المتابعة القادم"] || row["المتابعة القادمة"]);
      const notes = String(row["ملاحظات"] || row["Notes"] || "").trim();
      const ownerName = String(row["المسؤول"] || row["Owner"] || "").trim();

      // Skip fully empty rows
      if (!name && !rawPhone && !code) {
        skipped++;
        continue;
      }

      // Validation
      const phone = normalizePhone(rawPhone);
      if (!name) {
        console.warn(`Row ${rowNum}: Skipped (Missing salon name)`);
        invalid++;
        continue;
      }
      if (!phone) {
        console.warn(`Row ${rowNum}: Skipped "${name}" (Invalid Saudi phone: ${rawPhone})`);
        invalid++;
        continue;
      }

      const validCity = CITIES.includes(city) ? city : "أخرى";
      const validBType = BUSINESS_TYPES.includes(bType) ? bType : "أخرى";
      const validSource = SOURCES.includes(source) ? source : "مصدر آخر";
      const validPriority = PRIORITIES.includes(priority) ? priority : "متوسطة";
      const validStatus = CONTACT_STATUSES.includes(status) ? status : "لم يتم التواصل";
      const validOutcome = OUTCOMES.includes(outcome) ? outcome : "غير محدد";

      const payload = {
        name,
        phone,
        city: validCity,
        business_type: validBType,
        contact_person: person,
        source: validSource,
        priority: validPriority,
        contact_status: validStatus,
        outcome: validOutcome,
        last_contact_at: lastContact,
        next_follow_up_date: nextDate ? nextDate.slice(0, 10) : null,
        notes,
        chat_url: `https://wa.me/${phone}`,
      };

      if (code) payload.code = code;

      if (!isDryRun) {
        try {
          const ownerId = await getOrCreateUser(ownerName);
          if (ownerId) payload.owner = ownerId;

          // Check if exists by code or phone (idempotency)
          let existing = null;
          if (code) {
            const byCode = await pb.collection("clients").getList(1, 1, {
              filter: pb.filter("code = {:code}", { code }),
            });
            if (byCode.items.length > 0) existing = byCode.items[0];
          }

          // Skip duplicates by phone (idempotent re-runs)
          if (!existing) {
            const byPhone = await pb.collection("clients").getList(1, 1, {
              filter: pb.filter("phone = {:phone}", { phone }),
            });
            if (byPhone.items.length > 0) {
              skipped++;
              console.log(`Row ${rowNum}: Skipped "${name}" (Duplicate phone: ${phone})`);
              continue;
            }
          }

          if (existing) {
            await pb.collection("clients").update(existing.id, payload);
            clientCodeToId.set(existing.code, existing.id);
          } else {
            const created = await pb.collection("clients").create(payload);
            clientCodeToId.set(created.code, created.id);
          }
          imported++;
        } catch (e) {
          console.warn(`Row ${rowNum}: Import failed for "${name}":`, e.message);
          invalid++;
        }
      } else {
        imported++;
      }
    }

    console.log(`Clients Summary: ${imported} imported/updated, ${skipped} empty skipped, ${invalid} invalid.`);
  }

  // 2. Process sheet "سجل التواصل"
  const logsSheetName = workbook.SheetNames.find((s) => s.includes("التواصل") || s.toLowerCase().includes("log"));
  if (logsSheetName) {
    console.log(`\n--- Reading sheet: "${logsSheetName}" ---`);
    const sheet = workbook.Sheets[logsSheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    console.log(`Found ${rows.length} log rows.`);

    let importedLogs = 0;
    let skippedLogs = 0;
    let invalidLogs = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];

      const code = String(row["كود النشاط"] || row["الكود"] || "").trim();
      const clientRef = String(row["كود العميل"] || row["العميل"] || "").trim();
      const contactedAt = parseExcelDate(row["تاريخ التواصل"] || row["التاريخ"]) || new Date().toISOString();
      const channel = String(row["القناة"] || "").trim();
      const attemptType = String(row["نوع المحاولة"] || "").trim();
      const replied = String(row["تم الرد"] || row["الرد"] || "").trim();
      const result = String(row["النتيجة"] || "").trim();
      const nextDate = parseExcelDate(row["موعد المتابعة القادم"]);
      const summary = String(row["ملخص الرد"] || row["الملاحظات"] || "").trim();
      const nextAction = String(row["الإجراء التالي"] || "").trim();

      if (!clientRef && !result && !code) {
        skippedLogs++;
        continue;
      }

      const validChannel = CHANNELS.includes(channel) ? channel : "واتساب";
      const validAttempt = ATTEMPT_TYPES.includes(attemptType) ? attemptType : "رسالة أولى";
      const validReplied = REPLIED_OPTIONS.includes(replied) ? replied : "لم يتضح";
      const validResult = CONTACT_RESULTS.includes(result) ? result : "لم يرد";
      const validAction = NEXT_ACTIONS.includes(nextAction) ? nextAction : "لا إجراء";

      if (!isDryRun) {
        const clientId = clientCodeToId.get(clientRef);
        if (!clientId) {
          console.warn(`Row ${rowNum}: Skipped log (Client code "${clientRef}" not found)`);
          invalidLogs++;
          continue;
        }

        try {
          const payload = {
            client: clientId,
            contacted_at: contactedAt,
            channel: validChannel,
            attempt_type: validAttempt,
            replied: validReplied,
            result: validResult,
            next_follow_up_date: nextDate ? nextDate.slice(0, 10) : null,
            reply_summary: summary,
            next_action: validAction,
          };
          if (code) payload.code = code;

          let existing = null;
          if (code) {
            const byCode = await pb.collection("contact_logs").getList(1, 1, {
              filter: pb.filter("code = {:code}", { code }),
            });
            if (byCode.items.length > 0) existing = byCode.items[0];
          }

          if (existing) {
            await pb.collection("contact_logs").update(existing.id, payload);
          } else {
            await pb.collection("contact_logs").create(payload);
          }
          importedLogs++;
        } catch (e) {
          console.warn(`Row ${rowNum}: Log import failed:`, e.message);
          invalidLogs++;
        }
      } else {
        importedLogs++;
      }
    }

    console.log(`Logs Summary: ${importedLogs} imported/updated, ${skippedLogs} empty skipped, ${invalidLogs} invalid.`);
  }

  console.log(`\nImport complete.`);
}

main().catch((err) => {
  console.error("Import error:", err);
  process.exit(1);
});
