import type { Client, FollowUpState } from "./types";

export function dateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function computeFollowUpState(nextDate: string | null | undefined, outcome?: Client["outcome"]): FollowUpState {
  if (!nextDate || outcome === "مشترك" || outcome === "غير مهتم" || outcome === "لا يرغب بالتواصل") return "";
  const target = nextDate.slice(0, 10);
  const today = dateKey(new Date());
  if (target < today) return "متأخرة";
  if (target === today) return "مستحقة";
  return "لاحقًا";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(value)} · ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }).format(date)}`;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`;
  if (/^9665\d{8}$/.test(digits)) return digits;
  throw new Error("رقم الهاتف يجب أن يكون سعوديًا ويبدأ بـ 05");
}

export function waLink(phone: string): string {
  return `https://wa.me/${normalizePhone(phone)}`;
}

export function relativeDays(date: string | null): number {
  if (!date) return 0;
  const day = new Date(`${date.slice(0, 10)}T00:00:00`);
  return Math.round((new Date(`${dateKey(new Date())}T00:00:00`).getTime() - day.getTime()) / 86_400_000);
}

export function makeFollowUpDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function exportCsv(filename: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const escape = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
