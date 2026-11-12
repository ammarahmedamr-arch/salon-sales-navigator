// Replace the mock implementation with PocketBase SDK calls.
import { initialClients, initialLogs } from "./mock-data";
import { computeFollowUpState, normalizePhone } from "./utils";
import type { AppUser, Client, ClientFilters, ClientInput, ContactLog, ContactLogInput, DashboardStats } from "./types";
import { TEAM_MEMBERS } from "./constants";

const clientsStore: Client[] = structuredClone(initialClients);
const logsStore: ContactLog[] = structuredClone(initialLogs);
const fakeUsers: AppUser[] = TEAM_MEMBERS.map((name, index) => ({ id: `team-${index + 1}`, name, email: `team${index + 1}@ojlinker.sa` }));
const dateOrder = (value: string | null) => value ? new Date(value).getTime() : 0;
function enrich(client: Client): Client {
  const latest = logsStore.filter((entry) => entry.client_id === client.id).length;
  const state = computeFollowUpState(client.next_follow_up_date, client.outcome);
  return { ...client, attempts_count: latest, follow_up_state: state };
}
function nextCode(prefix: string, collection: Array<{ code: string }>, width: number) {
  const max = collection.reduce((value, item) => Math.max(value, Number(item.code.replace(`${prefix}-`, "")) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}
function clientMatches(client: Client, filter: ClientFilters) {
  const query = filter.search?.trim().toLowerCase();
  if (query && !`${client.name} ${client.phone} ${client.code}`.toLowerCase().includes(query)) return false;
  const fields: Array<[keyof ClientFilters, keyof Client]> = [["city", "city"], ["business_type", "business_type"], ["priority", "priority"], ["contact_status", "contact_status"], ["outcome", "outcome"], ["owner", "owner"], ["source", "source"]];
  for (const [filterKey, clientKey] of fields) {
    const value = filter[filterKey];
    if (value && value !== "الكل" && client[clientKey] !== value) return false;
  }
  if (filter.follow_up_state && filter.follow_up_state !== "الكل" && enrich(client).follow_up_state !== filter.follow_up_state) return false;
  return true;
}
export const api = {
  clients: {
    async list(filters: ClientFilters = {}): Promise<Client[]> {
      return clientsStore.filter((client) => clientMatches(client, filters))
        .sort((a, b) => {
          const key = filters.sortBy ?? "created_at";
          const first = a[key]; const second = b[key];
          const value = typeof first === "number" && typeof second === "number" ? first - second : String(first ?? "").localeCompare(String(second ?? ""), "ar");
          return (filters.sortDirection ?? "desc") === "asc" ? value : -value;
        }).map(enrich);
    },
    async get(id: string): Promise<Client | null> { const client = clientsStore.find((item) => item.id === id); return client ? enrich(client) : null; },
    async create(input: ClientInput): Promise<Client> {
      const client: Client = { ...input, phone: normalizePhone(input.phone), id: crypto.randomUUID(), code: nextCode("SAL", clientsStore, 4), created_at: new Date().toISOString(), follow_up_state: "", attempts_count: 0 };
      clientsStore.unshift(client); return enrich(client);
    },
    async update(id: string, input: Partial<ClientInput>): Promise<Client> {
      const index = clientsStore.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("العميل غير موجود");
      clientsStore[index] = { ...clientsStore[index]!, ...input, ...(input.phone ? { phone: normalizePhone(input.phone) } : {}) };
      return enrich(clientsStore[index]!);
    },
    async delete(id: string): Promise<void> { const index = clientsStore.findIndex((item) => item.id === id); if (index >= 0) clientsStore.splice(index, 1); for (let i = logsStore.length - 1; i >= 0; i--) if (logsStore[i]?.client_id === id) logsStore.splice(i, 1); },
  },
  contactLogs: {
    async listByClient(clientId: string): Promise<ContactLog[]> { return logsStore.filter((log) => log.client_id === clientId).sort((a, b) => dateOrder(b.contacted_at) - dateOrder(a.contacted_at)); },
    async listRecent(limit: number): Promise<ContactLog[]> { return [...logsStore].sort((a, b) => dateOrder(b.contacted_at) - dateOrder(a.contacted_at)).slice(0, limit); },
    async listAll(): Promise<ContactLog[]> { return [...logsStore].sort((a, b) => dateOrder(b.contacted_at) - dateOrder(a.contacted_at)); },
    async create(input: ContactLogInput): Promise<ContactLog> {
      const client = clientsStore.find((item) => item.id === input.client_id);
      if (!client) throw new Error("العميل غير موجود");
      const log: ContactLog = { ...input, id: crypto.randomUUID(), code: nextCode("ACT", logsStore, 5) };
      logsStore.unshift(log);
      client.last_contact_at = input.contacted_at;
      client.next_follow_up_date = input.next_follow_up_date;
      if (input.result === "طلب عدم التواصل") { client.contact_status = "تم إيقاف التواصل"; client.outcome = "لا يرغب بالتواصل"; client.next_follow_up_date = null; }
      else if (input.update_client) { if (input.contact_status) client.contact_status = input.contact_status; if (input.outcome) client.outcome = input.outcome; }
      return log;
    },
  },
  dashboard: {
    async stats(): Promise<DashboardStats> {
      const clients = clientsStore.map(enrich);
      const contacted = clients.filter((client) => ["تم التواصل", "في انتظار الرد", "ردّ"].includes(client.contact_status)).length;
      const funnel = [
        { label: "لم يتم التواصل", count: clients.filter((c) => c.contact_status === "لم يتم التواصل").length, fill: "var(--color-primary)" },
        { label: "تم التواصل", count: contacted, fill: "var(--color-chart-1)" },
        { label: "ردّ", count: clients.filter((c) => c.contact_status === "ردّ").length, fill: "var(--color-chart-2)" },
        { label: "مهتم", count: clients.filter((c) => c.outcome === "مهتم").length, fill: "var(--color-chart-3)" },
        { label: "طلب عرض/تجربة", count: clients.filter((c) => ["طلب عرض", "تجربة/ديمو"].includes(c.outcome)).length, fill: "var(--color-chart-4)" },
        { label: "مشترك", count: clients.filter((c) => c.outcome === "مشترك").length, fill: "var(--color-chart-5)" },
      ];
      const cities = Array.from(new Set(clients.map((client) => client.city))).map((name) => ({ name, value: clients.filter((client) => client.city === name).length }));
      const priorityRank = { عالية: 0, متوسطة: 1, منخفضة: 2 };
      const followUps = clients.filter((client) => client.follow_up_state === "متأخرة" || client.follow_up_state === "مستحقة").sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? "")).slice(0, 5);
      return { total: clients.length, contacted, replied: clients.filter((c) => c.contact_status === "ردّ").length, interested: clients.filter((c) => c.outcome === "مهتم").length, notInterested: clients.filter((c) => c.outcome === "غير مهتم").length, due: clients.filter((c) => c.follow_up_state === "مستحقة").length, demos: clients.filter((c) => ["طلب عرض", "تجربة/ديمو"].includes(c.outcome)).length, subscribed: clients.filter((c) => c.outcome === "مشترك").length, funnel, cities, followUps };
    },
  },
  auth: {
    async login(email: string, _password: string): Promise<AppUser> {
      const normalized = email.trim().toLowerCase();
      const found = fakeUsers.find((user) => user.email === normalized);
      const user = found ?? { id: "local-user", email: normalized || "user@ojlinker.sa", name: normalized.split("@")[0] || "عضو الفريق" };
      if (typeof window !== "undefined") window.localStorage.setItem("ojlinker_session", JSON.stringify(user));
      return user;
    },
    async logout(): Promise<void> { if (typeof window !== "undefined") window.localStorage.removeItem("ojlinker_session"); },
    async currentUser(): Promise<AppUser | null> {
      if (typeof window === "undefined") return null;
      const stored = window.localStorage.getItem("ojlinker_session");
      if (!stored) return null;
      try { return JSON.parse(stored) as AppUser; } catch { return null; }
    },
  },
  users: { async list(): Promise<AppUser[]> { return fakeUsers; } },
};
export type Api = typeof api;
