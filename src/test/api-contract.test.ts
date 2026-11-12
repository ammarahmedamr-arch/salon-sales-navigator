import { describe, expect, it } from "vitest";
import { api } from "@/lib/api";

describe("API Contract & Pagination", () => {
  it("api.clients.list returns paginated results { items, totalItems, page, perPage, totalPages }", async () => {
    const res = await api.clients.list({ page: 1, perPage: 10 });
    expect(res).toBeDefined();
    expect(Array.isArray(res.items)).toBe(true);
    expect(res.items.length).toBeLessThanOrEqual(10);
    expect(res.totalItems).toBeGreaterThan(0);
    expect(res.page).toBe(1);
    expect(res.perPage).toBe(10);
    expect(res.totalPages).toBe(Math.ceil(res.totalItems / 10));

    // Client items must have attempts_count and follow_up_state enriched
    const first = res.items[0]!;
    expect(first.attempts_count).toBeDefined();
    expect(typeof first.attempts_count).toBe("number");
    expect(first.follow_up_state).toBeDefined();
  });

  it("api.clients.list filters by city and search query", async () => {
    const res = await api.clients.list({
      filters: { city: "الرياض" },
      perPage: 50,
    });
    for (const item of res.items) {
      expect(item.city).toBe("الرياض");
    }
  });

  it("api.contactLogs.list returns paginated results with expanded client info", async () => {
    const res = await api.contactLogs.list({ page: 1, perPage: 15 });
    expect(res).toBeDefined();
    expect(Array.isArray(res.items)).toBe(true);
    expect(res.items.length).toBeLessThanOrEqual(15);
    expect(res.totalItems).toBeGreaterThan(0);
    expect(res.page).toBe(1);
    expect(res.perPage).toBe(15);

    // Logs must include created_by and expanded client
    const first = res.items[0]!;
    expect(first.created_by).toBeDefined();
    if (first.client) {
      expect(first.client.id).toBe(first.client_id);
    }
  });

  it("api.contactLogs.create applies deriveClientUpdate atomically to parent client", async () => {
    // 1. Create a client
    const newClient = await api.clients.create({
      name: "صالون اختبار التحديث الآلي",
      city: "الرياض",
      business_type: "صالون نسائي",
      contact_person: "منيرة",
      phone: "0511112222",
      website_url: "",
      source: "خرائط Google",
      priority: "عالية",
      contact_status: "لم يتم التواصل",
      outcome: "غير محدد",
      last_contact_at: null,
      next_follow_up_date: null,
      notes: "اختبار",
      owner: "نورة العتيبي",
      chat_url: "",
    });

    expect(newClient.contact_status).toBe("لم يتم التواصل");
    expect(newClient.outcome).toBe("غير محدد");

    // 2. Add log with result 'مهتم' and update_client = true
    await api.contactLogs.create({
      client_id: newClient.id,
      contacted_at: "2026-11-12T10:00:00Z",
      channel: "واتساب",
      attempt_type: "رسالة أولى",
      replied: "نعم",
      result: "مهتم",
      next_follow_up_date: "2026-11-15",
      reply_summary: "مهتم بالاشتراك",
      next_action: "إرسال تفاصيل",
      chat_url: "",
      update_client: true,
    });

    // 3. Parent client must have updated status 'ردّ' and outcome 'مهتم'
    const updated = await api.clients.get(newClient.id);
    expect(updated).not.toBeNull();
    expect(updated?.contact_status).toBe("ردّ");
    expect(updated?.outcome).toBe("مهتم");
    expect(updated?.last_contact_at).toBe("2026-11-12T10:00:00Z");
    expect(updated?.next_follow_up_date).toBe("2026-11-15");
    expect(updated?.attempts_count).toBe(1);
  });

  it("api.contactLogs.create with 'طلب عدم التواصل' stops contact regardless of update_client", async () => {
    const testClient = await api.clients.create({
      name: "صالون تجربة إيقاف التواصل",
      city: "جدة",
      business_type: "سبا",
      contact_person: "سارة",
      phone: "0533334444",
      website_url: "",
      source: "إنستجرام",
      priority: "متوسطة",
      contact_status: "تم التواصل",
      outcome: "مهتم",
      last_contact_at: null,
      next_follow_up_date: "2026-11-20",
      notes: "",
      owner: "سارة القحطاني",
      chat_url: "",
    });

    await api.contactLogs.create({
      client_id: testClient.id,
      contacted_at: "2026-11-12T11:00:00Z",
      channel: "اتصال هاتفي",
      attempt_type: "مكالمة",
      replied: "نعم",
      result: "طلب عدم التواصل",
      next_follow_up_date: "2026-11-25", // Form might pass a date, but it must be cleared
      reply_summary: "طلب عدم الاتصال مجددًا",
      next_action: "إيقاف التواصل",
      chat_url: "",
      update_client: false, // Even if false!
    });

    const stopped = await api.clients.get(testClient.id);
    expect(stopped?.contact_status).toBe("تم إيقاف التواصل");
    expect(stopped?.outcome).toBe("لا يرغب بالتواصل");
    expect(stopped?.next_follow_up_date).toBeNull();
  });
});
