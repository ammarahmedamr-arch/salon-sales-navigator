import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as constants from "@/lib/constants";
import { deriveClientUpdate } from "@/lib/business-rules";
import type { ContactResult } from "@/lib/types";

describe("Schema & Enums Synchronization", () => {
  const migrationPath = path.resolve(process.cwd(), "backend/pb_migrations/1730000000_schema.js");
  const migrationContent = fs.readFileSync(migrationPath, "utf-8");

  it("ensures all CITIES are present in PocketBase migration", () => {
    for (const city of constants.CITIES) {
      expect(migrationContent).toContain(`"${city}"`);
    }
  });

  it("ensures all BUSINESS_TYPES are present in PocketBase migration", () => {
    for (const bType of constants.BUSINESS_TYPES) {
      expect(migrationContent).toContain(`"${bType}"`);
    }
  });

  it("ensures all PRIORITIES are present in PocketBase migration", () => {
    for (const p of constants.PRIORITIES) {
      expect(migrationContent).toContain(`"${p}"`);
    }
  });

  it("ensures all CONTACT_STATUSES are present in PocketBase migration", () => {
    for (const s of constants.CONTACT_STATUSES) {
      expect(migrationContent).toContain(`"${s}"`);
    }
  });

  it("ensures all OUTCOMES are present in PocketBase migration", () => {
    for (const o of constants.OUTCOMES) {
      expect(migrationContent).toContain(`"${o}"`);
    }
  });

  it("ensures all CHANNELS are present in PocketBase migration", () => {
    for (const c of constants.CHANNELS) {
      expect(migrationContent).toContain(`"${c}"`);
    }
  });

  it("ensures all ATTEMPT_TYPES are present in PocketBase migration", () => {
    for (const a of constants.ATTEMPT_TYPES) {
      expect(migrationContent).toContain(`"${a}"`);
    }
  });

  it("ensures all CONTACT_RESULTS are present in PocketBase migration", () => {
    for (const r of constants.CONTACT_RESULTS) {
      expect(migrationContent).toContain(`"${r}"`);
    }
  });

  it("ensures all NEXT_ACTIONS are present in PocketBase migration", () => {
    for (const n of constants.NEXT_ACTIONS) {
      expect(migrationContent).toContain(`"${n}"`);
    }
  });

  it("ensures deriveClientUpdate in pb_hooks exactly mirrors business-rules.ts", () => {
    const hookPath = path.resolve(process.cwd(), "backend/pb_hooks/helpers.js");
    const hookContent = fs.readFileSync(hookPath, "utf-8");

    // Check that every result outcome keyword is present in ojl.pb.js
    const results: ContactResult[] = [
      "مهتم",
      "طلب تفاصيل",
      "طلب عرض",
      "طلب تجربة",
      "مشترك",
      "غير مهتم",
      "لم يرد",
      "إعادة التواصل لاحقًا",
      "رقم غير صحيح",
      "طلب عدم التواصل",
    ];

    for (const res of results) {
      expect(hookContent).toContain(`case "${res}":`);
      const ruleOutput = deriveClientUpdate(res);
      if (ruleOutput.contact_status) {
        expect(hookContent).toContain(ruleOutput.contact_status);
      }
      if (ruleOutput.outcome) {
        expect(hookContent).toContain(ruleOutput.outcome);
      }
    }
  });
});
