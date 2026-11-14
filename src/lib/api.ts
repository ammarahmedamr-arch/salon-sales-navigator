import { pb } from "./pb";
import {
  computeFollowUpState,
  getRiyadhDateKey,
  normalizePhone,
  safeNormalizePhone,
} from "./utils";
import type {
  AppUser,
  Client,
  ClientFilters,
  ClientImportResult,
  ClientImportRow,
  ClientInput,
  ClientListParams,
  ContactLog,
  ContactLogFilters,
  ContactLogInput,
  ContactLogListParams,
  DashboardStats,
  PaginatedResult,
} from "./types";

/** PocketBase server-side max per page. */
const MAX_PER_PAGE = 500;

/**
 * Maps a PocketBase record to the frontend typed Client interface.
 */
function mapClientRecord(rec: any, attemptsCount = 0): Client {
  const followUpState = computeFollowUpState(rec["next_follow_up_date"] || null, rec["outcome"]);
  const ownerName = rec["expand"]?.["owner"]?.["name"] || "";
  return {
    id: rec["id"],
    code: rec["code"] || "",
    name: rec["name"] || "",
    city: rec["city"] || "أخرى",
    business_type: rec["business_type"] || "صالون نسائي",
    contact_person: rec["contact_person"] || "",
    phone: rec["phone"] || "",
    website_url: rec["website_url"] || "",
    source: rec["source"] || "مصدر آخر",
    priority: rec["priority"] || "متوسطة",
    contact_status: rec["contact_status"] || "لم يتم التواصل",
    outcome: rec["outcome"] || "غير محدد",
    last_contact_at: rec["last_contact_at"] || null,
    next_follow_up_date: rec["next_follow_up_date"] || null,
    notes: rec["notes"] || "",
    owner: rec["owner"] || "",
    owner_name: ownerName,
    chat_url: rec["chat_url"] || "",
    created_at: rec["created"],
    updated: rec["updated"],
    follow_up_state: followUpState,
    attempts_count: attemptsCount,
  };
}

/**
 * Maps a PocketBase record to the frontend typed ContactLog interface.
 */
function mapLogRecord(rec: any): ContactLog {
  const clientData = rec["expand"]?.["client"]
    ? mapClientRecord(rec["expand"]["client"])
    : undefined;
  const createdByName =
    rec["expand"]?.["created_by"]?.["name"] ||
    rec["expand"]?.["created_by"]?.["email"] ||
    rec["created_by"] ||
    "";

  return {
    id: rec["id"],
    code: rec["code"] || "",
    client_id: rec["client"] || (clientData?.id ?? ""),
    contacted_at: rec["contacted_at"],
    channel: rec["channel"] || "واتساب",
    attempt_type: rec["attempt_type"] || "رسالة أولى",
    replied: rec["replied"] || "لم يتضح",
    result: rec["result"] || "مهتم",
    next_follow_up_date: rec["next_follow_up_date"] || null,
    reply_summary: rec["reply_summary"] || "",
    next_action: rec["next_action"] || "أخرى",
    chat_url: rec["chat_url"] || "",
    created_by: createdByName,
    created: rec["created"],
    client: clientData,
  };
}

// Setup global 401 handler
pb.afterSend = (response, data) => {
  if (response.status === 401) {
    pb.authStore.clear();
  }
  return data;
};

export const api = {
  clients: {
    async list(params: ClientListParams = {}): Promise<PaginatedResult<Client>> {
      const page = Math.max(1, params.page ?? 1);
      const perPage = Math.min(MAX_PER_PAGE, Math.max(1, params.perPage ?? 10));

      // Merge flat & nested filters
      const rawFilters: ClientFilters = {
        search: params.search ?? params.filters?.search,
        city: params.city ?? params.filters?.city,
        business_type: params.business_type ?? params.filters?.business_type,
        priority: params.priority ?? params.filters?.priority,
        contact_status: params.contact_status ?? params.filters?.contact_status,
        outcome: params.outcome ?? params.filters?.outcome,
        follow_up_state: params.follow_up_state ?? params.filters?.follow_up_state,
        owner: params.owner ?? params.filters?.owner,
        source: params.source ?? params.filters?.source,
      };

      const filterParts: string[] = [];
      const filterParams: Record<string, string> = {};

      if (rawFilters.search && rawFilters.search.trim() !== "") {
        const q = rawFilters.search.trim();
        filterParams["search"] = q;
        filterParts.push(
          "(name ~ {:search} || code ~ {:search} || phone ~ {:search} || contact_person ~ {:search})",
        );
      }

      if (rawFilters.city && rawFilters.city !== "الكل") {
        filterParams["city"] = rawFilters.city;
        filterParts.push("city = {:city}");
      }

      if (rawFilters.business_type && rawFilters.business_type !== "الكل") {
        filterParams["business_type"] = rawFilters.business_type;
        filterParts.push("business_type = {:business_type}");
      }

      if (rawFilters.priority && rawFilters.priority !== "الكل") {
        filterParams["priority"] = rawFilters.priority;
        filterParts.push("priority = {:priority}");
      }

      if (rawFilters.contact_status && rawFilters.contact_status !== "الكل") {
        filterParams["contact_status"] = rawFilters.contact_status;
        filterParts.push("contact_status = {:contact_status}");
      }

      if (rawFilters.outcome && rawFilters.outcome !== "الكل") {
        filterParams["outcome"] = rawFilters.outcome;
        filterParts.push("outcome = {:outcome}");
      }

      if (rawFilters.owner && rawFilters.owner !== "الكل") {
        if (rawFilters.owner === "none") {
          filterParts.push("(owner = '' || owner = null)");
        } else {
          filterParams["owner"] = rawFilters.owner;
          filterParts.push("owner = {:owner}");
        }
      }

      if (rawFilters.source && rawFilters.source !== "الكل") {
        filterParams["source"] = rawFilters.source;
        filterParts.push("source = {:source}");
      }

      if (rawFilters.follow_up_state && rawFilters.follow_up_state !== "الكل") {
        const today = getRiyadhDateKey();
        filterParams["today"] = today;

        if (rawFilters.follow_up_state === "متأخرة") {
          filterParts.push(
            "next_follow_up_date != '' && next_follow_up_date < {:today} && outcome != 'مشترك' && outcome != 'غير مهتم' && outcome != 'لا يرغب بالتواصل'",
          );
        } else if (rawFilters.follow_up_state === "مستحقة") {
          filterParts.push(
            "next_follow_up_date = {:today} && outcome != 'مشترك' && outcome != 'غير مهتم' && outcome != 'لا يرغب بالتواصل'",
          );
        } else if (rawFilters.follow_up_state === "لاحقًا") {
          filterParts.push(
            "next_follow_up_date > {:today} && outcome != 'مشترك' && outcome != 'غير مهتم' && outcome != 'لا يرغب بالتواصل'",
          );
        }
      }

      // Map sort
      let sort = "-created";
      if (params.sortBy) {
        const dir = params.sortDirection === "asc" ? "+" : "-";
        const key = params.sortBy === "created_at" ? "created" : String(params.sortBy);
        sort = `${dir}${key}`;
      }

      const options: Record<string, any> = { sort, expand: "owner" };
      if (filterParts.length > 0) {
        options["filter"] = pb.filter(filterParts.join(" && "), filterParams);
      }

      const res = await pb.collection("clients").getList(page, perPage, options);

      return {
        items: res.items.map((r) => mapClientRecord(r)),
        totalItems: res.totalItems,
        page: res.page,
        perPage: res.perPage,
        totalPages: res.totalPages,
      };
    },

    async get(id: string): Promise<Client> {
      const record = await pb.collection("clients").getOne(id, { expand: "owner" });
      let attemptsCount = 0;
      try {
        const countRes = await pb.collection("contact_logs").getList(1, 1, {
          filter: pb.filter("client = {:id}", { id }),
        });
        attemptsCount = countRes.totalItems;
      } catch {}
      return mapClientRecord(record, attemptsCount);
    },

    async getById(id: string): Promise<Client> {
      return this.get(id);
    },

    async create(input: ClientInput): Promise<Client> {
      const payload: Record<string, any> = { ...input };
      if (payload["phone"]) {
        payload["phone"] = normalizePhone(payload["phone"]);
      } else {
        payload["phone"] = "";
      }
      if (!payload["owner"] || payload["owner"] === "none") {
        payload["owner"] = null;
      }
      if (!payload["next_follow_up_date"]) {
        payload["next_follow_up_date"] = null;
      }
      if (!payload["last_contact_at"]) {
        payload["last_contact_at"] = null;
      }
      const record = await pb.collection("clients").create(payload);
      return mapClientRecord(record, 0);
    },

    async update(id: string, input: Partial<ClientInput>): Promise<Client> {
      const payload: Record<string, any> = { ...input };
      if (payload["phone"]) {
        payload["phone"] = normalizePhone(payload["phone"]);
      }
      if (payload["owner"] !== undefined) {
        payload["owner"] =
          payload["owner"] && payload["owner"] !== "none" ? payload["owner"] : null;
      }
      if (payload["next_follow_up_date"] !== undefined && !payload["next_follow_up_date"]) {
        payload["next_follow_up_date"] = null;
      }
      if (payload["last_contact_at"] !== undefined && !payload["last_contact_at"]) {
        payload["last_contact_at"] = null;
      }
      const record = await pb.collection("clients").update(id, payload);
      return mapClientRecord(record);
    },

    async delete(id: string): Promise<boolean> {
      return await pb.collection("clients").delete(id);
    },

    /**
     * Sends one chunk of parsed Excel rows to the server-side bulk import
     * endpoint. The server dedupes (by phone, or name+city without phone),
     * coerces select values and tolerates per-row failures.
     */
    async importBatch(rows: ClientImportRow[]): Promise<ClientImportResult> {
      return (await pb.send("/api/ojl/clients/import", {
        method: "POST",
        body: { rows },
      })) as ClientImportResult;
    },

    /**
     * Fetches every client (auto-paginated in chunks of MAX_PER_PAGE),
     * so callers are never silently capped at 500 records.
     */
    async listAll(): Promise<Client[]> {
      const records = await pb.collection("clients").getFullList({
        sort: "-created",
        expand: "owner",
      });
      return records.map((r) => mapClientRecord(r));
    },
  },

  contactLogs: {
    async list(params: ContactLogListParams = {}): Promise<PaginatedResult<ContactLog>> {
      const page = Math.max(1, params.page ?? 1);
      const perPage = Math.min(MAX_PER_PAGE, Math.max(1, params.perPage ?? 10));

      const rawFilters: ContactLogFilters = {
        channel: params.channel ?? params.filters?.channel,
        result: params.result ?? params.filters?.result,
        replied: params.replied ?? params.filters?.replied,
        dateFrom: params.dateFrom ?? params.filters?.dateFrom,
        dateTo: params.dateTo ?? params.filters?.dateTo,
        owner: params.owner ?? params.filters?.owner,
        search: params.search ?? params.filters?.search,
      };

      const filterParts: string[] = [];
      const filterParams: Record<string, string> = {};

      if (rawFilters.channel && rawFilters.channel !== "الكل") {
        filterParams["channel"] = rawFilters.channel;
        filterParts.push("channel = {:channel}");
      }

      if (rawFilters.result && rawFilters.result !== "الكل") {
        filterParams["result"] = rawFilters.result;
        filterParts.push("result = {:result}");
      }

      if (rawFilters.replied && rawFilters.replied !== "الكل") {
        filterParams["replied"] = rawFilters.replied;
        filterParts.push("replied = {:replied}");
      }

      if (rawFilters.owner && rawFilters.owner !== "الكل") {
        filterParams["owner"] = rawFilters.owner;
        filterParts.push("created_by = {:owner}");
      }

      if (rawFilters.dateFrom) {
        filterParams["dateFrom"] = `${rawFilters.dateFrom} 00:00:00.000Z`;
        filterParts.push("contacted_at >= {:dateFrom}");
      }

      if (rawFilters.dateTo) {
        filterParams["dateTo"] = `${rawFilters.dateTo} 23:59:59.999Z`;
        filterParts.push("contacted_at <= {:dateTo}");
      }

      if (rawFilters.search && rawFilters.search.trim() !== "") {
        filterParams["search"] = rawFilters.search.trim();
        filterParts.push(
          "(code ~ {:search} || reply_summary ~ {:search} || client.name ~ {:search} || client.phone ~ {:search})",
        );
      }

      let sort = "-contacted_at";
      if (params.sortBy) {
        const dir = params.sortDirection === "asc" ? "+" : "-";
        sort = `${dir}${String(params.sortBy)}`;
      }

      const options: Record<string, any> = {
        sort,
        expand: "client,created_by",
      };

      if (filterParts.length > 0) {
        options["filter"] = pb.filter(filterParts.join(" && "), filterParams);
      }

      const res = await pb.collection("contact_logs").getList(page, perPage, options);

      return {
        items: res.items.map((r) => mapLogRecord(r)),
        totalItems: res.totalItems,
        page: res.page,
        perPage: res.perPage,
        totalPages: res.totalPages,
      };
    },

    async listByClient(clientId: string): Promise<ContactLog[]> {
      const records = await pb.collection("contact_logs").getFullList({
        filter: pb.filter("client = {:clientId}", { clientId }),
        sort: "-contacted_at",
        expand: "created_by",
      });
      return records.map((r) => mapLogRecord(r));
    },

    async listRecent(limit = 8): Promise<ContactLog[]> {
      const res = await pb.collection("contact_logs").getList(1, limit, {
        sort: "-contacted_at",
        expand: "client,created_by",
      });
      return res.items.map((r) => mapLogRecord(r));
    },

    async listAll(): Promise<ContactLog[]> {
      const records = await pb.collection("contact_logs").getFullList({
        sort: "-contacted_at",
        expand: "client,created_by",
      });
      return records.map((r) => mapLogRecord(r));
    },

    async create(input: ContactLogInput): Promise<ContactLog> {
      const res = (await pb.send("/api/ojl/contact-logs", {
        method: "POST",
        body: {
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
          auto_update_client: input.update_client !== false,
          update_client: input.update_client !== false,
        },
      })) as any;

      return mapLogRecord(res.log);
    },
  },

  dashboard: {
    async stats(): Promise<DashboardStats> {
      const res = (await pb.send("/api/ojl/dashboard", {
        method: "GET",
      })) as any;

      return {
        total: res["total"] || 0,
        contacted: res["contacted"] || 0,
        replied: res["replied"] || 0,
        interested: res["interested"] || 0,
        notInterested: res["notInterested"] || 0,
        due: res["due"] || 0,
        demos: res["demos"] || 0,
        subscribed: res["subscribed"] || 0,
        funnel: res["funnel"] || [],
        cities: res["cities"] || [],
        followUps: (res["followUps"] || []).map((c: any) => mapClientRecord(c)),
        recentLogs: res["recentLogs"] || [],
      };
    },
  },

  auth: {
    async login(email: string, password: string): Promise<AppUser> {
      const authData = await pb.collection("users").authWithPassword(email.trim(), password);
      const user = authData.record as any;
      return {
        id: user["id"],
        name: user["name"] || user["email"],
        email: user["email"],
        role: user["role"] || "agent",
      };
    },

    async logout(): Promise<void> {
      pb.authStore.clear();
    },

    async currentUser(): Promise<AppUser | null> {
      if (!pb.authStore.isValid || !pb.authStore.model) {
        return null;
      }
      try {
        const authData = await pb.collection("users").authRefresh();
        const model = authData.record as any;
        return {
          id: model["id"],
          name: model["name"] || model["email"],
          email: model["email"],
          role: model["role"] || "agent",
        };
      } catch {
        pb.authStore.clear();
        return null;
      }
    },

    async listUsers(): Promise<AppUser[]> {
      const records = await pb.collection("users").getFullList({ sort: "name" });
      return records.map((r: any) => ({
        id: r["id"],
        name: r["name"] || r["email"],
        email: r["email"],
        role: r["role"] || "agent",
      }));
    },
  },

  users: {
    async list(): Promise<AppUser[]> {
      const records = await pb.collection("users").getFullList({ sort: "name" });
      return records.map((r: any) => ({
        id: r["id"],
        name: r["name"] || r["email"],
        email: r["email"],
        role: r["role"] || "agent",
      }));
    },

    async create(data: {
      name: string;
      email: string;
      password: string;
      role: "admin" | "agent";
    }): Promise<AppUser> {
      const record = (await pb.collection("users").create({
        name: data.name,
        email: data.email,
        password: data.password,
        passwordConfirm: data.password,
        role: data.role,
        emailVisibility: false,
      })) as any;

      return {
        id: record["id"],
        name: record["name"],
        email: record["email"],
        role: record["role"],
      };
    },

    async delete(id: string): Promise<boolean> {
      return await pb.collection("users").delete(id);
    },

    async update(
      id: string,
      data: {
        name?: string;
        email?: string;
        password?: string;
        role?: "admin" | "agent";
      },
    ): Promise<AppUser> {
      const payload: Record<string, any> = {};
      if (data.name !== undefined) payload["name"] = data.name;
      if (data.email !== undefined) payload["email"] = data.email;
      if (data.role !== undefined) payload["role"] = data.role;
      if (data.password && data.password.trim().length >= 8) {
        payload["password"] = data.password.trim();
        payload["passwordConfirm"] = data.password.trim();
      }
      const record = (await pb.collection("users").update(id, payload)) as any;
      return {
        id: record["id"],
        name: record["name"],
        email: record["email"],
        role: record["role"],
      };
    },
  },
};

export type Api = typeof api;
