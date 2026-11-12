// Mock data access layer (implements typed async methods matching PocketBase SDK contracts)
import { initialClients, initialLogs } from "./mock-data";
import { computeFollowUpState, normalizePhone } from "./utils";
import { deriveClientUpdate } from "./business-rules";
import type {
  AppUser,
  Client,
  ClientFilters,
  ClientInput,
  ClientListParams,
  ContactLog,
  ContactLogFilters,
  ContactLogInput,
  ContactLogListParams,
  DashboardStats,
  PaginatedResult,
} from "./types";

const clientsStore: Client[] = structuredClone(initialClients);
const logsStore: ContactLog[] = structuredClone(initialLogs);

const fakeUsers: AppUser[] = [
  { id: "team-1", name: "عمر الحربي", email: "admin@ojlinker.sa", role: "admin" },
  { id: "team-2", name: "نورة العتيبي", email: "noura@ojlinker.sa", role: "agent" },
  { id: "team-3", name: "سارة القحطاني", email: "sara@ojlinker.sa", role: "agent" },
  { id: "team-4", name: "فيصل الشهري", email: "faisal@ojlinker.sa", role: "agent" },
];

const dateOrder = (value: string | null | undefined) => (value ? new Date(value).getTime() : 0);

function enrich(client: Client): Client {
  const latest = logsStore.filter((entry) => entry.client_id === client.id).length;
  const state = computeFollowUpState(client.next_follow_up_date, client.outcome);
  return { ...client, attempts_count: latest, follow_up_state: state };
}

function nextCode(prefix: string, collection: Array<{ code: string }>, width: number) {
  const max = collection.reduce(
    (value, item) => Math.max(value, Number(item.code.replace(`${prefix}-`, "")) || 0),
    0,
  );
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

function resolveClientFilters(params: ClientListParams): ClientFilters {
  const nested = params.filters ?? {};
  return {
    search: params.search ?? nested.search,
    city: params.city ?? nested.city,
    business_type: params.business_type ?? nested.business_type,
    priority: params.priority ?? nested.priority,
    contact_status: params.contact_status ?? nested.contact_status,
    outcome: params.outcome ?? nested.outcome,
    follow_up_state: params.follow_up_state ?? nested.follow_up_state,
    owner: params.owner ?? nested.owner,
    source: params.source ?? nested.source,
  };
}

function clientMatches(client: Client, filter: ClientFilters) {
  const query = filter.search?.trim().toLowerCase();
  if (
    query &&
    !`${client.name} ${client.phone} ${client.code} ${client.contact_person ?? ""}`
      .toLowerCase()
      .includes(query)
  ) {
    return false;
  }

  const fields: Array<[keyof ClientFilters, keyof Client]> = [
    ["city", "city"],
    ["business_type", "business_type"],
    ["priority", "priority"],
    ["contact_status", "contact_status"],
    ["outcome", "outcome"],
    ["owner", "owner"],
    ["source", "source"],
  ];

  for (const [filterKey, clientKey] of fields) {
    const value = filter[filterKey];
    if (value && value !== "الكل" && client[clientKey] !== value) return false;
  }

  if (
    filter.follow_up_state &&
    filter.follow_up_state !== "الكل" &&
    enrich(client).follow_up_state !== filter.follow_up_state
  ) {
    return false;
  }

  return true;
}

function resolveLogFilters(params: ContactLogListParams): ContactLogFilters {
  const nested = params.filters ?? {};
  return {
    channel: params.channel ?? nested.channel,
    result: params.result ?? nested.result,
    replied: params.replied ?? nested.replied,
    dateFrom: params.dateFrom ?? nested.dateFrom,
    dateTo: params.dateTo ?? nested.dateTo,
    owner: params.owner ?? nested.owner,
    search: params.search ?? nested.search,
  };
}

function logMatches(log: ContactLog, filters: ContactLogFilters) {
  if (filters.channel && filters.channel !== "الكل" && log.channel !== filters.channel) {
    return false;
  }
  if (filters.result && filters.result !== "الكل" && log.result !== filters.result) {
    return false;
  }
  if (filters.replied && filters.replied !== "الكل" && log.replied !== filters.replied) {
    return false;
  }

  if (filters.owner && filters.owner !== "الكل") {
    const parentClient = clientsStore.find((c) => c.id === log.client_id);
    const ownerMatches =
      log.created_by === filters.owner ||
      parentClient?.owner === filters.owner ||
      fakeUsers.find((u) => u.id === log.created_by)?.name === filters.owner;
    if (!ownerMatches) return false;
  }

  if (filters.dateFrom) {
    const logDate = log.contacted_at.slice(0, 10);
    if (logDate < filters.dateFrom) return false;
  }

  if (filters.dateTo) {
    const logDate = log.contacted_at.slice(0, 10);
    if (logDate > filters.dateTo) return false;
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    const parentClient = clientsStore.find((c) => c.id === log.client_id);
    const textToSearch = `${log.code} ${log.reply_summary} ${parentClient?.name ?? ""} ${parentClient?.code ?? ""} ${parentClient?.phone ?? ""}`.toLowerCase();
    if (!textToSearch.includes(q)) return false;
  }

  return true;
}

export const api = {
  clients: {
    async list(params: ClientListParams = {}): Promise<PaginatedResult<Client>> {
      const filters = resolveClientFilters(params);
      const filtered = clientsStore.filter((client) => clientMatches(client, filters));

      const sortBy = params.sortBy ?? "created_at";
      const direction = params.sortDirection ?? "desc";

      filtered.sort((a, b) => {
        const first = a[sortBy];
        const second = b[sortBy];
        const cmp =
          typeof first === "number" && typeof second === "number"
            ? first - second
            : String(first ?? "").localeCompare(String(second ?? ""), "ar");
        return direction === "asc" ? cmp : -cmp;
      });

      const page = Math.max(1, params.page ?? 1);
      const perPage = params.perPage && params.perPage > 0 ? params.perPage : 25;
      const totalItems = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
      const start = (page - 1) * perPage;
      const items = filtered.slice(start, start + perPage).map(enrich);

      return {
        items,
        totalItems,
        page,
        perPage,
        totalPages,
      };
    },

    async get(id: string): Promise<Client | null> {
      const client = clientsStore.find((item) => item.id === id);
      return client ? enrich(client) : null;
    },

    async create(input: ClientInput): Promise<Client> {
      const now = new Date().toISOString();
      const client: Client = {
        ...input,
        phone: normalizePhone(input.phone),
        id: crypto.randomUUID(),
        code: nextCode("SAL", clientsStore, 4),
        created_at: now,
        updated: now,
        follow_up_state: "",
        attempts_count: 0,
      };
      clientsStore.unshift(client);
      return enrich(client);
    },

    async update(id: string, input: Partial<ClientInput>): Promise<Client> {
      const index = clientsStore.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("العميل غير موجود");
      const current = clientsStore[index]!;
      const updated: Client = {
        ...current,
        ...input,
        ...(input.phone ? { phone: normalizePhone(input.phone) } : {}),
        updated: new Date().toISOString(),
      };
      clientsStore[index] = updated;
      return enrich(updated);
    },

    async delete(id: string): Promise<void> {
      const index = clientsStore.findIndex((item) => item.id === id);
      if (index >= 0) clientsStore.splice(index, 1);
      for (let i = logsStore.length - 1; i >= 0; i--) {
        if (logsStore[i]?.client_id === id) logsStore.splice(i, 1);
      }
    },
  },

  contactLogs: {
    async list(params: ContactLogListParams = {}): Promise<PaginatedResult<ContactLog>> {
      const filters = resolveLogFilters(params);
      const filtered = logsStore.filter((log) => logMatches(log, filters));

      filtered.sort((a, b) => dateOrder(b.contacted_at) - dateOrder(a.contacted_at));

      const page = Math.max(1, params.page ?? 1);
      const perPage = params.perPage && params.perPage > 0 ? params.perPage : 25;
      const totalItems = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
      const start = (page - 1) * perPage;

      const items = filtered.slice(start, start + perPage).map((log) => {
        const client = clientsStore.find((c) => c.id === log.client_id);
        return {
          ...log,
          client: client ? enrich(client) : undefined,
        };
      });

      return {
        items,
        totalItems,
        page,
        perPage,
        totalPages,
      };
    },

    async listByClient(clientId: string): Promise<ContactLog[]> {
      return logsStore
        .filter((log) => log.client_id === clientId)
        .sort((a, b) => dateOrder(b.contacted_at) - dateOrder(a.contacted_at))
        .map((log) => {
          const client = clientsStore.find((c) => c.id === log.client_id);
          return {
            ...log,
            client: client ? enrich(client) : undefined,
          };
        });
    },

    async listRecent(limit = 8): Promise<ContactLog[]> {
      return [...logsStore]
        .sort((a, b) => dateOrder(b.contacted_at) - dateOrder(a.contacted_at))
        .slice(0, limit)
        .map((log) => {
          const client = clientsStore.find((c) => c.id === log.client_id);
          return {
            ...log,
            client: client ? enrich(client) : undefined,
          };
        });
    },

    async listAll(): Promise<ContactLog[]> {
      return [...logsStore]
        .sort((a, b) => dateOrder(b.contacted_at) - dateOrder(a.contacted_at))
        .map((log) => {
          const client = clientsStore.find((c) => c.id === log.client_id);
          return {
            ...log,
            client: client ? enrich(client) : undefined,
          };
        });
    },

    async create(input: ContactLogInput): Promise<ContactLog> {
      const client = clientsStore.find((item) => item.id === input.client_id);
      if (!client) throw new Error("العميل غير موجود");

      const log: ContactLog = {
        id: crypto.randomUUID(),
        code: nextCode("ACT", logsStore, 5),
        client_id: input.client_id,
        contacted_at: input.contacted_at,
        channel: input.channel,
        attempt_type: input.attempt_type,
        replied: input.replied,
        result: input.result,
        next_follow_up_date: input.next_follow_up_date,
        reply_summary: input.reply_summary,
        next_action: input.next_action,
        chat_url: input.chat_url,
        created_by: input.created_by ?? "team-1",
        created: new Date().toISOString(),
      };
      logsStore.unshift(log);

      // Business rule: Atomic update on parent client
      client.last_contact_at = input.contacted_at;
      client.updated = new Date().toISOString();

      if (input.result === "طلب عدم التواصل") {
        client.contact_status = "تم إيقاف التواصل";
        client.outcome = "لا يرغب بالتواصل";
        client.next_follow_up_date = null;
      } else {
        client.next_follow_up_date = input.next_follow_up_date;
        if (input.update_client) {
          const derived = deriveClientUpdate(input.result);
          if (input.contact_status) {
            client.contact_status = input.contact_status;
          } else if (derived.contact_status) {
            client.contact_status = derived.contact_status;
          }

          if (input.outcome) {
            client.outcome = input.outcome;
          } else if (derived.outcome) {
            client.outcome = derived.outcome;
          }

          if (derived.next_follow_up_date === null) {
            client.next_follow_up_date = null;
          }
        }
      }

      return {
        ...log,
        client: enrich(client),
      };
    },
  },

  dashboard: {
    async stats(): Promise<DashboardStats> {
      const clients = clientsStore.map(enrich);
      const contacted = clients.filter((client) =>
        ["تم التواصل", "في انتظار الرد", "ردّ"].includes(client.contact_status),
      ).length;

      const funnel = [
        {
          label: "لم يتم التواصل",
          count: clients.filter((c) => c.contact_status === "لم يتم التواصل").length,
          fill: "var(--color-primary)",
        },
        { label: "تم التواصل", count: contacted, fill: "var(--color-chart-1)" },
        {
          label: "ردّ",
          count: clients.filter((c) => c.contact_status === "ردّ").length,
          fill: "var(--color-chart-2)",
        },
        {
          label: "مهتم",
          count: clients.filter((c) => c.outcome === "مهتم").length,
          fill: "var(--color-chart-3)",
        },
        {
          label: "طلب عرض/تجربة",
          count: clients.filter((c) => ["طلب عرض", "تجربة/ديمو"].includes(c.outcome)).length,
          fill: "var(--color-chart-4)",
        },
        {
          label: "مشترك",
          count: clients.filter((c) => c.outcome === "مشترك").length,
          fill: "var(--color-chart-5)",
        },
      ];

      const cities = Array.from(new Set(clients.map((client) => client.city))).map((name) => ({
        name,
        value: clients.filter((client) => client.city === name).length,
      }));

      const priorityRank = { عالية: 0, متوسطة: 1, منخفضة: 2 };
      const followUps = clients
        .filter(
          (client) => client.follow_up_state === "متأخرة" || client.follow_up_state === "مستحقة",
        )
        .sort(
          (a, b) =>
            priorityRank[a.priority] - priorityRank[b.priority] ||
            (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? ""),
        )
        .slice(0, 5);

      return {
        total: clients.length,
        contacted,
        replied: clients.filter((c) => c.contact_status === "ردّ").length,
        interested: clients.filter((c) => c.outcome === "مهتم").length,
        notInterested: clients.filter((c) => c.outcome === "غير مهتم").length,
        due: clients.filter((c) => c.follow_up_state === "مستحقة").length,
        demos: clients.filter((c) => ["طلب عرض", "تجربة/ديمو"].includes(c.outcome)).length,
        subscribed: clients.filter((c) => c.outcome === "مشترك").length,
        funnel,
        cities,
        followUps,
      };
    },
  },

  auth: {
    async login(email: string, _password: string): Promise<AppUser> {
      const normalized = email.trim().toLowerCase();
      const found = fakeUsers.find((user) => user.email === normalized);
      const isAdmin = normalized.includes("admin") || normalized.startsWith("omar");
      const user: AppUser = found ?? {
        id: "local-user",
        email: normalized || "user@ojlinker.sa",
        name: normalized.split("@")[0] || "عضو الفريق",
        role: isAdmin ? "admin" : "agent",
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ojlinker_session", JSON.stringify(user));
      }
      return user;
    },

    async logout(): Promise<void> {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("ojlinker_session");
      }
    },

    async currentUser(): Promise<AppUser | null> {
      if (typeof window === "undefined") return null;
      const stored = window.localStorage.getItem("ojlinker_session");
      if (!stored) return null;
      try {
        return JSON.parse(stored) as AppUser;
      } catch {
        return null;
      }
    },
  },

  users: {
    async list(): Promise<AppUser[]> {
      return fakeUsers;
    },
  },
};

export type Api = typeof api;
