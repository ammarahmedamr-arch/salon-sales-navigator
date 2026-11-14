/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);

  // 1. Extend built-in 'users' auth collection
  const users = dao.findCollectionByNameOrId("users");

  // Ensure role field exists
  const existingRole = users.schema.getFieldByName("role");
  if (!existingRole) {
    users.schema.addField(new SchemaField({
      name: "role",
      type: "select",
      required: true,
      options: {
        maxSelect: 1,
        values: ["admin", "agent"],
      },
    }));
  }

  // Ensure name field is required
  const nameField = users.schema.getFieldByName("name");
  if (nameField) {
    nameField.required = true;
  }

  // Disable public signup and restrict API rules on users
  users.listRule = "@request.auth.id != ''";
  users.viewRule = "@request.auth.id != ''";
  users.createRule = "@request.auth.role = 'admin'";
  users.updateRule = "@request.auth.role = 'admin' || @request.auth.id = id";
  users.deleteRule = "@request.auth.role = 'admin'";

  if (users.options) {
    users.options.allowEmailAuth = true;
    users.options.allowOAuth2Auth = false;
    users.options.allowUsernameAuth = false;
    users.options.minPasswordLength = 8;
  }

  dao.saveCollection(users);

  // 2. Create 'clients' collection if not exists
  let clients;
  try {
    clients = dao.findCollectionByNameOrId("clients");
  } catch {
    clients = new Collection({
      name: "clients",
      type: "base",
      schema: [
        { name: "code", type: "text", required: false },
        { name: "name", type: "text", required: true },
        {
          name: "city",
          type: "select",
          options: {
            maxSelect: 1,
            values: [
              "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام",
              "الخبر", "الطائف", "أبها", "تبوك", "بريدة", "أخرى"
            ],
          },
        },
        {
          name: "business_type",
          type: "select",
          options: {
            maxSelect: 1,
            values: ["صالون نسائي", "صالون رجالي", "مركز تجميل", "سبا", "حلاقة", "أخرى"],
          },
        },
        { name: "contact_person", type: "text" },
        { name: "phone", type: "text", required: true },
        { name: "website_url", type: "text" },
        {
          name: "source",
          type: "select",
          options: {
            maxSelect: 1,
            values: [
              "خرائط Google", "إنستجرام", "موقع إلكتروني", "دليل أعمال",
              "إحالة", "بحث يدوي", "مصدر آخر"
            ],
          },
        },
        {
          name: "priority",
          type: "select",
          options: {
            maxSelect: 1,
            values: ["عالية", "متوسطة", "منخفضة"],
          },
        },
        {
          name: "contact_status",
          type: "select",
          options: {
            maxSelect: 1,
            values: [
              "لم يتم التواصل", "تم التواصل", "في انتظار الرد", "ردّ",
              "متابعة مطلوبة", "تم إيقاف التواصل"
            ],
          },
        },
        {
          name: "outcome",
          type: "select",
          options: {
            maxSelect: 1,
            values: [
              "غير محدد", "مهتم", "غير مهتم", "طلب عرض", "تجربة/ديمو",
              "يحتاج متابعة لاحقًا", "مشترك", "لا يرغب بالتواصل"
            ],
          },
        },
        { name: "last_contact_at", type: "date" },
        { name: "next_follow_up_date", type: "date" },
        { name: "notes", type: "text" },
        {
          name: "owner",
          type: "relation",
          options: {
            collectionId: users.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        },
        { name: "chat_url", type: "text" },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_clients_code ON clients (code)",
        "CREATE INDEX idx_clients_owner ON clients (owner)",
        "CREATE INDEX idx_clients_contact_status ON clients (contact_status)",
        "CREATE INDEX idx_clients_outcome ON clients (outcome)",
        "CREATE INDEX idx_clients_city ON clients (city)",
        "CREATE INDEX idx_clients_phone ON clients (phone)",
        "CREATE INDEX idx_clients_next_follow_up ON clients (next_follow_up_date)",
      ],
    });
    clients.listRule = "@request.auth.id != ''";
    clients.viewRule = "@request.auth.id != ''";
    clients.createRule = "@request.auth.id != ''";
    clients.updateRule = "@request.auth.id != ''";
    clients.deleteRule = "@request.auth.role = 'admin'";
    dao.saveCollection(clients);
  }

  // 3. Create 'contact_logs' collection if not exists
  let contactLogs;
  try {
    contactLogs = dao.findCollectionByNameOrId("contact_logs");
  } catch {
    contactLogs = new Collection({
      name: "contact_logs",
      type: "base",
      schema: [
        { name: "code", type: "text", required: false },
        {
          name: "client",
          type: "relation",
          required: true,
          options: {
            collectionId: clients.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
        },
        { name: "contacted_at", type: "date", required: true },
        {
          name: "channel",
          type: "select",
          options: {
            maxSelect: 1,
            values: ["واتساب", "اتصال هاتفي", "رسالة نصية", "إنستجرام", "بريد إلكتروني", "أخرى"],
          },
        },
        {
          name: "attempt_type",
          type: "select",
          options: {
            maxSelect: 1,
            values: [
              "رسالة أولى", "متابعة أولى", "متابعة ثانية", "مكالمة",
              "عرض توضيحي", "متابعة بعد العرض", "أخرى"
            ],
          },
        },
        {
          name: "replied",
          type: "select",
          options: {
            maxSelect: 1,
            values: ["نعم", "لا", "لم يتضح"],
          },
        },
        {
          name: "result",
          type: "select",
          options: {
            maxSelect: 1,
            values: [
              "لم يرد", "مهتم", "غير مهتم", "طلب تفاصيل", "طلب عرض",
              "طلب تجربة", "مشترك", "طلب عدم التواصل", "رقم غير صحيح", "إعادة التواصل لاحقًا"
            ],
          },
        },
        { name: "next_follow_up_date", type: "date" },
        { name: "reply_summary", type: "text" },
        {
          name: "next_action",
          type: "select",
          options: {
            maxSelect: 1,
            values: [
              "انتظار الرد", "إرسال تفاصيل", "تحديد موعد عرض", "متابعة لاحقًا",
              "إغلاق العميل", "إيقاف التواصل", "لا إجراء"
            ],
          },
        },
        { name: "chat_url", type: "text" },
        {
          name: "created_by",
          type: "relation",
          options: {
            collectionId: users.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_contact_logs_code ON contact_logs (code)",
        "CREATE INDEX idx_contact_logs_client ON contact_logs (client)",
        "CREATE INDEX idx_contact_logs_contacted_at ON contact_logs (contacted_at)",
        "CREATE INDEX idx_contact_logs_created_by ON contact_logs (created_by)",
        "CREATE INDEX idx_contact_logs_result ON contact_logs (result)",
        "CREATE INDEX idx_contact_logs_channel ON contact_logs (channel)",
      ],
    });
    contactLogs.listRule = "@request.auth.id != ''";
    contactLogs.viewRule = "@request.auth.id != ''";
    contactLogs.createRule = "@request.auth.id != ''";
    contactLogs.updateRule = "@request.auth.id != ''";
    contactLogs.deleteRule = "@request.auth.role = 'admin'";
    dao.saveCollection(contactLogs);
  }
}, (db) => {
  const dao = new Dao(db);
  try {
    const contactLogs = dao.findCollectionByNameOrId("contact_logs");
    dao.deleteCollection(contactLogs);
  } catch {}
  try {
    const clients = dao.findCollectionByNameOrId("clients");
    dao.deleteCollection(clients);
  } catch {}
});
