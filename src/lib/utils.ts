import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Client, FollowUpState } from "./types";
export { deriveClientUpdate } from "./business-rules";
export type { DerivedClientUpdate } from "./business-rules";

/** Merge Tailwind classes safely (shadcn/ui standard). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns date-only string YYYY-MM-DD in Asia/Riyadh timezone (UTC+3).
 * Never relies on local browser timezone or UTC day boundaries.
 */
export function getRiyadhDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date or date string to YYYY-MM-DD in Asia/Riyadh.
 * If already a YYYY-MM-DD string, returns the 10-char date part directly.
 */
export function dateKey(value: Date | string = new Date()): string {
  if (typeof value === "string") {
    if (value.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return getRiyadhDateKey(parsed);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return getRiyadhDateKey(value);
  }
  return "";
}

/**
 * Computes the follow-up state ("متأخرة" | "مستحقة" | "لاحقًا" | "") in Asia/Riyadh timezone.
 * Returns empty string if nextDate is null/empty or if client outcome indicates no further follow-up.
 */
export function computeFollowUpState(
  nextDate: string | null | undefined,
  outcome?: Client["outcome"],
  referenceDate: Date = new Date(),
): FollowUpState {
  if (!nextDate || outcome === "مشترك" || outcome === "غير مهتم" || outcome === "لا يرغب بالتواصل") {
    return "";
  }
  const target = nextDate.slice(0, 10);
  const today = getRiyadhDateKey(referenceDate);
  if (target < today) return "متأخرة";
  if (target === today) return "مستحقة";
  return "لاحقًا";
}

/**
 * Formats a calendar date as DD/MM/YYYY in Western digits.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Riyadh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
}

/**
 * Formats date and time as DD/MM/YYYY · HH:MM in Western digits (Riyadh timezone).
 */
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const timeFormatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${formatDate(value)} · ${timeFormatted}`;
}

/**
 * Normalizes Saudi mobile numbers to 9665XXXXXXXX format.
 * Accepts:
 * - 05XXXXXXXX
 * - +9665XXXXXXXX
 * - 9665XXXXXXXX
 * With or without spaces/dashes.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`;
  if (/^9665\d{8}$/.test(digits)) return digits;
  throw new Error("رقم الهاتف يجب أن يكون سعوديًا ويبدأ بـ 05");
}

export function waLink(phone: string): string {
  return `https://wa.me/${normalizePhone(phone)}`;
}

/**
 * Measures relative calendar days between reference date (Riyadh) and a given date.
 */
export function relativeDays(date: string | null, referenceDate: Date = new Date()): number {
  if (!date) return 0;
  const targetDay = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const todayDay = new Date(`${getRiyadhDateKey(referenceDate)}T00:00:00Z`);
  return Math.round((todayDay.getTime() - targetDay.getTime()) / 86_400_000);
}

/**
 * Generates a date-only string YYYY-MM-DD offset by `days` from Riyadh today.
 */
export function makeFollowUpDate(days: number, referenceDate: Date = new Date()): string {
  const [y, m, d] = getRiyadhDateKey(referenceDate).split("-").map(Number);
  const target = new Date(Date.UTC(y!, m! - 1, d! + days));
  return target.toISOString().slice(0, 10);
}

export function exportCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null>>,
) {
  const escape = (value: string | number | null) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
