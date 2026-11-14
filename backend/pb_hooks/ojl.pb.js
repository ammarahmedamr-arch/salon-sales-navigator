/// <reference path="../pb_data/types.d.ts" />

/**
 * OJLinker CRM PocketBase Server Hooks & Custom Endpoints
 *
 * Enforces business rules server-side:
 * 1. Authentication guards for clients and contact_logs listing/viewing
 * 2. Sequential SAL-XXXX and ACT-XXXXX codes
 * 3. Saudi mobile phone normalization to 9665XXXXXXXX
 * 4. Automatic attribution of created_by on contact_logs
 * 5. Atomic contact log creation + parent client status/outcome update (POST /api/ojl/contact-logs)
 * 6. Server-side aggregated dashboard stats (GET /api/ojl/dashboard)
 */

// -------------------------------------------------------------
// 0. Security Guards: Require authenticated user for listing & viewing
// -------------------------------------------------------------
onRecordsListRequest((e) => {
  if (!e.httpContext.get("authRecord") && !e.httpContext.get("admin")) {
    throw new ForbiddenError("المصادقة مطلوبة للوصول إلى السجلات");
  }
}, "clients", "contact_logs");

onRecordViewRequest((e) => {
  if (!e.httpContext.get("authRecord") && !e.httpContext.get("admin")) {
    throw new ForbiddenError("المصادقة مطلوبة للوصول إلى السجلات");
  }
}, "clients", "contact_logs");

// -------------------------------------------------------------
// 1. Clients hooks: sequential code + phone normalization
// -------------------------------------------------------------
onModelBeforeCreate((e) => {
  const { normalizeSaudiPhone } = require(__hooks + "/helpers.js");

  // Normalize phone when provided ("" is allowed after phone became optional)
  const rawPhone = e.model.get("phone");
  if (rawPhone) {
    e.model.set("phone", normalizeSaudiPhone(rawPhone));
  }

  // Auto-generate code SAL-XXXX if empty
  if (!e.model.get("code")) {
    const row = new DynamicModel({ max_num: 0 });
    $app.dao().db().newQuery(
      "SELECT COALESCE(MAX(CAST(SUBSTR(code, 5) AS INTEGER)), 0) as max_num FROM clients WHERE code LIKE 'SAL-%'"
    ).one(row);
    const nextNum = (row.max_num || 0) + 1;
    const padded = ("0000" + nextNum).slice(-4);
    e.model.set("code", `SAL-${padded}`);
  }
}, "clients");

onModelBeforeUpdate((e) => {
  const { normalizeSaudiPhone } = require(__hooks + "/helpers.js");

  // Normalize phone on update if provided
  const rawPhone = e.model.get("phone");
  if (rawPhone) {
    e.model.set("phone", normalizeSaudiPhone(rawPhone));
  }
}, "clients");

// -------------------------------------------------------------
// 2. Contact Logs hooks: sequential code + enforce created_by
// -------------------------------------------------------------
onModelBeforeCreate((e) => {
  // Auto-generate code ACT-XXXXX if empty
  if (!e.model.get("code")) {
    const row = new DynamicModel({ max_num: 0 });
    $app.dao().db().newQuery(
      "SELECT COALESCE(MAX(CAST(SUBSTR(code, 5) AS INTEGER)), 0) as max_num FROM contact_logs WHERE code LIKE 'ACT-%'"
    ).one(row);
    const nextNum = (row.max_num || 0) + 1;
    const padded = ("00000" + nextNum).slice(-5);
    e.model.set("code", `ACT-${padded}`);
  }
}, "contact_logs");

onRecordBeforeCreateRequest((e) => {
  // Enforce created_by from the authenticated user server-side
  if (e.httpContext && e.httpContext.get("authRecord")) {
    e.record.set("created_by", e.httpContext.get("authRecord").id);
  }
}, "contact_logs");

// -------------------------------------------------------------
// 3. Custom Route: POST /api/ojl/contact-logs
// Creates log and atomically updates parent client in a transaction
// -------------------------------------------------------------
routerAdd("POST", "/api/ojl/contact-logs", (c) => {
  const { deriveClientUpdate } = require(__hooks + "/helpers.js");

  const authRecord = c.get("authRecord");
  if (!authRecord) {
    throw new UnauthorizedError("يجب تسجيل الدخول أولًا");
  }

  const data = $apis.requestInfo(c).data;
  if (!data.client_id) {
    throw new BadRequestError("معرّف العميل مطلوب");
  }
  if (!data.contacted_at) {
    throw new BadRequestError("تاريخ ووقت التواصل مطلوب");
  }
  if (!data.result) {
    throw new BadRequestError("نتيجة التواصل مطلوبة");
  }

  const logsCollection = $app.dao().findCollectionByNameOrId("contact_logs");
  const clientsCollection = $app.dao().findCollectionByNameOrId("clients");

  let createdLog = null;
  let updatedClient = null;

  $app.dao().runInTransaction((txDao) => {
    // 1. Fetch parent client
    const client = txDao.findRecordById(clientsCollection.id, data.client_id);
    if (!client) {
      throw new NotFoundError("العميل غير موجود");
    }

    // 2. Create contact log record
    const log = new Record(logsCollection);
    log.set("client", client.id);
    log.set("contacted_at", data.contacted_at);
    log.set("channel", data.channel || "واتساب");
    log.set("attempt_type", data.attempt_type || "رسالة أولى");
    log.set("replied", data.replied || "لم يتضح");
    log.set("result", data.result);
    log.set("reply_summary", data.reply_summary || "");
    log.set("next_action", data.next_action || "");
    log.set("chat_url", data.chat_url || "");
    log.set("created_by", authRecord.id);

    txDao.saveRecord(log);
    createdLog = log;

    // 3. Update client if requested (default true) or forced by "طلب عدم التواصل"
    const forceUpdate = data.result === "طلب عدم التواصل";
    const autoUpdate = forceUpdate || (data.auto_update_client !== false && data.update_client !== false);
    if (autoUpdate) {
      const derived = deriveClientUpdate(data.result);

      if (derived.contact_status) {
        client.set("contact_status", derived.contact_status);
      }
      if (derived.outcome) {
        client.set("outcome", derived.outcome);
      }

      // Always update last_contact_at to the contact log's datetime
      client.set("last_contact_at", data.contacted_at);

      // Handle next_follow_up_date
      if (derived.next_follow_up_date === null) {
        client.set("next_follow_up_date", "");
      } else if (data.next_follow_up_date) {
        client.set("next_follow_up_date", data.next_follow_up_date);
      }

      // If chat_url provided and client has no chat_url, update it
      if (data.chat_url && !client.get("chat_url")) {
        client.set("chat_url", data.chat_url);
      }

      txDao.saveRecord(client);
    }

    updatedClient = client;
  });

  return c.json(200, {
    log: createdLog,
    client: updatedClient,
  });
});

// -------------------------------------------------------------
// 3b. Custom Route: POST /api/ojl/clients/import
// Admin-only bulk import. Imports ALL provided rows in one request,
// skipping duplicates (by phone, or name+city when phone is missing)
// instead of failing. Select fields are coerced to allowed values.
// -------------------------------------------------------------
routerAdd("POST", "/api/ojl/clients/import", (c) => {
  const { normalizeSaudiPhoneLoose, pickAllowed } = require(__hooks + "/helpers.js");

  const authRecord = c.get("authRecord");
  if (!authRecord) {
    throw new UnauthorizedError("يجب تسجيل الدخول أولًا");
  }
  if (authRecord.get("role") !== "admin") {
    throw new ForbiddenError("الاستيراد متاح للمدير فقط");
  }

  const data = $apis.requestInfo(c).data;
  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (rows.length === 0) {
    throw new BadRequestError("لا توجد صفوف للاستيراد");
  }
  if (rows.length > 500) {
    throw new BadRequestError("الحد الأقصى 500 صف لكل طلب");
  }

  const CITIES = [
    "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام",
    "الخبر", "الطائف", "أبها", "تبوك", "بريدة", "أخرى",
  ];
  const BUSINESS_TYPES = ["صالون نسائي", "صالون رجالي", "مركز تجميل", "سبا", "حلاقة", "أخرى"];
  const SOURCES = [
    "خرائط Google", "إنستجرام", "موقع إلكتروني", "دليل أعمال",
    "إحالة", "بحث يدوي", "مصدر آخر",
  ];
  const PRIORITIES = ["عالية", "متوسطة", "منخفضة"];

  const usersCollection = $app.dao().findCollectionByNameOrId("users");
  const clientsCollection = $app.dao().findCollectionByNameOrId("clients");

  // --- 1. Validate, normalize and coerce every row (never throws per row) ---
  const prepared = [];
  const invalid = [];
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] || {};
    const name = String(raw.name || "").trim();
    if (!name) {
      invalid.push({ index: i, name: "", reason: "اسم الصالون مفقود" });
      continue;
    }

    const phone = normalizeSaudiPhoneLoose(raw.phone);
    const city = pickAllowed(raw.city, CITIES, "الرياض", "أخرى");
    const businessType = pickAllowed(raw.business_type, BUSINESS_TYPES, "صالون نسائي", "أخرى");
    const source = pickAllowed(raw.source, SOURCES, "بحث يدوي", "مصدر آخر");
    const priority = pickAllowed(raw.priority, PRIORITIES, "متوسطة");

    prepared.push({
      index: i,
      name,
      phone,
      city,
      business_type: businessType,
      contact_person: String(raw.contact_person || "").trim(),
      website_url: String(raw.website_url || "").trim(),
      source,
      priority,
      notes: String(raw.notes || "").trim(),
      owner: String(raw.owner || "").trim(),
    });
  }

  // --- 2. Deduplicate inside the batch itself ---
  const batchPhones = {}; // phone -> true
  const batchNameCity = {}; // name|city -> true
  const uniqueRows = [];
  let batchDuplicates = 0;
  for (const row of prepared) {
    const key = row.phone ? row.phone : `${row.name}|${row.city}`;
    const seen = row.phone ? batchPhones[row.phone] : batchNameCity[key];
    if (seen) {
      batchDuplicates++;
      continue;
    }
    if (row.phone) {
      batchPhones[row.phone] = true;
    }
    batchNameCity[`${row.name}|${row.city}`] = true;
    uniqueRows.push(row);
  }

  // --- 3. Skip rows that already exist in the database ---
  const dbDuplicates = {}; // key -> true

  const withPhone = uniqueRows.filter((r) => r.phone);
  for (let i = 0; i < withPhone.length; i += 100) {
    const chunk = withPhone.slice(i, i + 100);
    const phones = chunk.map((r) => r.phone);
    const filter = phones.map((p) => `phone = '${p}'`).join(" || ");
    try {
      const found = $app.dao().findRecordsByFilter(
        clientsCollection.id,
        filter,
        "",
        1000,
        0
      );
      for (const rec of found) {
        dbDuplicates[rec.getString("phone")] = true;
      }
    } catch (err) {
      console.warn("import dedupe phone lookup failed:", err);
    }
  }

  const withoutPhone = uniqueRows.filter((r) => !r.phone);
  for (let i = 0; i < withoutPhone.length; i += 50) {
    const chunk = withoutPhone.slice(i, i + 50);
    const names = chunk
      .map((r) => r.name.replace(/'/g, "''"))
      .map((n) => `name = '${n}'`)
      .join(" || ");
    try {
      const found = $app.dao().findRecordsByFilter(
        clientsCollection.id,
        names,
        "",
        1000,
        0
      );
      for (const rec of found) {
        dbDuplicates[`${rec.getString("name")}|${rec.getString("city")}`] = true;
      }
    } catch (err) {
      console.warn("import dedupe name lookup failed:", err);
    }
  }

  // --- 4. Create the remaining rows (per-row error tolerance) ---
  const toCreate = [];
  let skippedDuplicates = 0;
  for (const row of uniqueRows) {
    const key = row.phone ? row.phone : `${row.name}|${row.city}`;
    if (dbDuplicates[key]) {
      skippedDuplicates++;
      continue;
    }
    toCreate.push(row);
  }

  let created = 0;
  const failed = [];
  for (const row of toCreate) {
    const record = new Record(clientsCollection);
    record.set("name", row.name);
    record.set("phone", row.phone);
    record.set("city", row.city);
    record.set("business_type", row.business_type);
    record.set("contact_person", row.contact_person);
    record.set("website_url", row.website_url);
    record.set("source", row.source);
    record.set("priority", row.priority);
    record.set("notes", row.notes);
    record.set("contact_status", "لم يتم التواصل");
    record.set("outcome", "غير محدد");

    if (row.owner) {
      try {
        const ownerRec = $app.dao().findRecordById(usersCollection.id, row.owner);
        if (ownerRec) {
          record.set("owner", ownerRec.id);
        }
      } catch {
        // Unknown owner id from a stale token — import unassigned instead of failing
      }
    }

    try {
      $app.dao().saveRecord(record);
      created++;
    } catch (err) {
      failed.push({
        index: row.index,
        name: row.name,
        reason: err && err.message ? String(err.message) : "خطأ غير معروف",
      });
    }
  }

  return c.json(200, {
    created,
    skippedDuplicates: batchDuplicates + skippedDuplicates,
    invalid: invalid.length,
    invalidReasons: invalid.slice(0, 20),
    failed: failed.length,
    failedReasons: failed.slice(0, 20),
  });
});

// -------------------------------------------------------------
// 4. Custom Route: GET /api/ojl/dashboard
// Returns 8 KPIs, funnel steps, city distribution, and top 5 follow-ups
// -------------------------------------------------------------
routerAdd("GET", "/api/ojl/dashboard", (c) => {
  const { getRiyadhTodayKey } = require(__hooks + "/helpers.js");

  const authRecord = c.get("authRecord");
  if (!authRecord) {
    throw new UnauthorizedError("يجب تسجيل الدخول أولًا");
  }

  const today = getRiyadhTodayKey();

  // 1. KPI Counts
  const kpiRow = new DynamicModel({
    total: 0,
    contacted: 0,
    replied: 0,
    interested: 0,
    not_interested: 0,
    due: 0,
    demos: 0,
    subscribed: 0,
    not_contacted: 0,
  });

  $app.dao().db().newQuery(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN contact_status IN ('تم التواصل', 'في انتظار الرد', 'ردّ') THEN 1 ELSE 0 END), 0) AS contacted,
      COALESCE(SUM(CASE WHEN contact_status = 'ردّ' THEN 1 ELSE 0 END), 0) AS replied,
      COALESCE(SUM(CASE WHEN outcome = 'مهتم' THEN 1 ELSE 0 END), 0) AS interested,
      COALESCE(SUM(CASE WHEN outcome = 'غير مهتم' THEN 1 ELSE 0 END), 0) AS not_interested,
      COALESCE(SUM(CASE
        WHEN outcome NOT IN ('مشترك', 'غير مهتم', 'لا يرغب بالتواصل')
         AND SUBSTR(next_follow_up_date, 1, 10) = {:today}
        THEN 1 ELSE 0 END
      ), 0) AS due,
      COALESCE(SUM(CASE WHEN outcome IN ('طلب عرض', 'تجربة/ديمو') THEN 1 ELSE 0 END), 0) AS demos,
      COALESCE(SUM(CASE WHEN outcome = 'مشترك' THEN 1 ELSE 0 END), 0) AS subscribed,
      COALESCE(SUM(CASE WHEN contact_status = 'لم يتم التواصل' THEN 1 ELSE 0 END), 0) AS not_contacted
    FROM clients
  `).bind({ today }).one(kpiRow);

  // 2. Funnel steps
  const funnel = [
    { label: "لم يتم التواصل", count: kpiRow.not_contacted || 0, fill: "var(--color-primary)" },
    { label: "تم التواصل", count: kpiRow.contacted || 0, fill: "var(--color-chart-1)" },
    { label: "ردّ", count: kpiRow.replied || 0, fill: "var(--color-chart-2)" },
    { label: "مهتم", count: kpiRow.interested || 0, fill: "var(--color-chart-3)" },
    { label: "طلب عرض/تجربة", count: kpiRow.demos || 0, fill: "var(--color-chart-4)" },
    { label: "مشترك", count: kpiRow.subscribed || 0, fill: "var(--color-chart-5)" },
  ];

  // 3. City distribution
  const cityRows = arrayOf(new DynamicModel({
    name: "",
    value: 0,
  }));
  $app.dao().db().newQuery(`
    SELECT city as name, COUNT(*) as value
    FROM clients
    WHERE city != '' AND city IS NOT NULL
    GROUP BY city
    ORDER BY value DESC
  `).all(cityRows);

  // 4. Top 5 Follow-ups (overdue or due today)
  const followUpRows = arrayOf(new DynamicModel({
    id: "",
    code: "",
    name: "",
    city: "",
    business_type: "",
    contact_person: "",
    phone: "",
    priority: "",
    contact_status: "",
    outcome: "",
    next_follow_up_date: "",
    owner: "",
  }));
  $app.dao().db().newQuery(`
    SELECT
      id, code, name, city, business_type, contact_person, phone,
      priority, contact_status, outcome, next_follow_up_date, owner
    FROM clients
    WHERE outcome NOT IN ('مشترك', 'غير مهتم', 'لا يرغب بالتواصل')
      AND next_follow_up_date != ''
      AND next_follow_up_date IS NOT NULL
      AND SUBSTR(next_follow_up_date, 1, 10) <= {:today}
    ORDER BY
      CASE priority WHEN 'عالية' THEN 0 WHEN 'متوسطة' THEN 1 ELSE 2 END ASC,
      next_follow_up_date ASC
    LIMIT 5
  `).bind({ today }).all(followUpRows);

  const followUps = followUpRows.map((client) => {
    const target = (client.next_follow_up_date || "").slice(0, 10);
    const state = target < today ? "متأخرة" : target === today ? "مستحقة" : "لاحقًا";
    return {
      ...client,
      follow_up_state: state,
    };
  });

  // 5. Recent 8 Logs
  const logRows = arrayOf(new DynamicModel({
    id: "",
    code: "",
    client_id: "",
    contacted_at: "",
    channel: "",
    attempt_type: "",
    replied: "",
    result: "",
    reply_summary: "",
    next_action: "",
    chat_url: "",
    created_by: "",
    client_name: "",
    client_code: "",
    client_phone: "",
  }));
  $app.dao().db().newQuery(`
    SELECT
      l.id, l.code, l.client as client_id, l.contacted_at, l.channel,
      l.attempt_type, l.replied, l.result, l.reply_summary, l.next_action,
      l.chat_url, l.created_by,
      c.name as client_name, c.code as client_code, c.phone as client_phone
    FROM contact_logs l
    LEFT JOIN clients c ON c.id = l.client
    ORDER BY l.contacted_at DESC
    LIMIT 8
  `).all(logRows);

  return c.json(200, {
    total: kpiRow.total || 0,
    contacted: kpiRow.contacted || 0,
    replied: kpiRow.replied || 0,
    interested: kpiRow.interested || 0,
    notInterested: kpiRow.not_interested || 0,
    due: kpiRow.due || 0,
    demos: kpiRow.demos || 0,
    subscribed: kpiRow.subscribed || 0,
    funnel,
    cities: cityRows,
    followUps,
    recentLogs: logRows,
  });
});
