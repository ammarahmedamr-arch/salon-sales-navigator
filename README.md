# Salon Sales Navigator

Build "OJLinker CRM" — an internal sales-tracking web app for a small team that cold-contacts beauty salons in Saudi Arabia. Arabic-first, RTL, desktop-first but fully usable on mobile.

## HARD CONSTRAINTS
- Stack: React + Vite + TypeScript + Tailwind + shadcn/ui + React Router + TanStack Query + react-hook-form + zod + lucide-react + recharts.
- DO NOT use Supabase, Lovable Cloud, Firebase or any backend. This is FRONTEND ONLY. I will connect my own PocketBase backend on a VPS later.
- Put ALL data access behind ONE file: `src/lib/api.ts`, exporting async functions with typed signatures (below). Implement them now against an in-memory mock store seeded with ~25 realistic fake salons and ~60 contact log entries (Saudi cities, Arabic salon names, phones like 9665XXXXXXXX). Pages must NEVER touch the mock store directly — only call `api.ts` through TanStack Query hooks in `src/hooks/`. Add a comment at the top of api.ts: "Replace the mock implementation with PocketBase SDK calls."
- Add a simple fake login page (email + password, any credentials work) and a route guard, with `api.auth.login / logout / currentUser` so it can be swapped for PocketBase auth later.
- Whole UI: `dir="rtl"`, `lang="ar"`. Use logical Tailwind properties (ms-/me-/ps-/pe-/start/end) not left/right. Font: "IBM Plex Sans Arabic" (Google Fonts), fallback Tahoma. Western digits (0-9) everywhere. Dates shown as DD/MM/YYYY.
- All UI text in Arabic.

## DATA MODEL (TypeScript types + zod schemas in src/lib/types.ts)

Client:
- id (string), code (auto "SAL-0001", sequential)
- name (اسم الصالون, required)
- city: الرياض | جدة | مكة المكرمة | المدينة المنورة | الدمام | الخبر | الطائف | أبها | تبوك | بريدة | أخرى
- business_type: صالون نسائي | صالون رجالي | مركز تجميل | سبا | حلاقة | أخرى
- contact_person (اسم المسؤول)
- phone (واتساب/هاتف)
- website_url (رابط الموقع/إنستجرام)
- source: خرائط Google | إنستجرام | موقع إلكتروني | دليل أعمال | إحالة | بحث يدوي | مصدر آخر
- created_at
- priority: عالية | متوسطة | منخفضة
- contact_status: لم يتم التواصل | تم التواصل | في انتظار الرد | ردّ | متابعة مطلوبة | تم إيقاف التواصل
- outcome: غير محدد | مهتم | غير مهتم | طلب عرض | تجربة/ديمو | يحتاج متابعة لاحقًا | مشترك | لا يرغب بالتواصل
- last_contact_at, next_follow_up_date
- follow_up_state (COMPUTED, never stored): "متأخرة" if next_follow_up_date < today, "مستحقة" if == today, "لاحقًا" if > today, empty if none. Skip it entirely when outcome is مشترك, غير مهتم or لا يرغب بالتواصل.
- attempts_count (COMPUTED = number of log entries for this client)
- notes (ملاحظات / احتياج العميل)
- owner (المسؤول عن المتابعة — a team member name)
- chat_url

ContactLog:
- id, code ("ACT-00001"), client_id
- contacted_at (datetime)
- channel: واتساب | اتصال هاتفي | رسالة نصية | إنستجرام | بريد إلكتروني | أخرى
- attempt_type: رسالة أولى | متابعة أولى | متابعة ثانية | مكالمة | عرض توضيحي | متابعة بعد العرض | أخرى
- replied: نعم | لا | لم يتضح
- result: لم يرد | مهتم | غير مهتم | طلب تفاصيل | طلب عرض | طلب تجربة | مشترك | طلب عدم التواصل | رقم غير صحيح | إعادة التواصل لاحقًا
- next_follow_up_date
- reply_summary (ملخص الرد / الاعتراض)
- next_action: انتظار الرد | إرسال تفاصيل | تحديد موعد عرض | متابعة لاحقًا | إغلاق العميل | إيقاف التواصل | لا إجراء
- chat_url

Put every enum list in `src/lib/constants.ts` as const arrays, reused by forms, filters and badges.

## api.ts SIGNATURES
clients.list(filters) · clients.get(id) · clients.create · clients.update · clients.delete · contactLogs.listByClient(clientId) · contactLogs.listRecent(limit) · contactLogs.create(input) — creating a log must ALSO update the client's last_contact_at, next_follow_up_date, and (optionally, via a checkbox in the form) contact_status and outcome · dashboard.stats() · auth.login/logout/currentUser · users.list() for owner dropdown.

## PAGES
1. **/login** — centered card, logo text "OJLinker", subtle navy gradient background.

2. **/ (لوحة المتابعة — Dashboard)** — 8 KPI cards in a 4×2 grid (2×4 on mobile), exactly these:
   - إجمالي العملاء = count of all clients
   - تم التواصل معهم = contact_status in (تم التواصل, في انتظار الرد, ردّ)
   - ردّوا = contact_status = ردّ
   - مهتمون = outcome = مهتم
   - غير مهتمين = outcome = غير مهتم
   - متابعة مستحقة = follow_up_state = مستحقة
   - تحويل لعرض/تجربة = outcome in (طلب عرض, تجربة/ديمو)
   - مشتركين = outcome = مشترك
   Each card: big number, label, small lucide icon in a soft tinted circle, clickable → goes to /clients with the matching filter applied via URL query params.
   Below: a recharts funnel-style horizontal bar (لم يتم التواصل → تم التواصل → ردّ → مهتم → طلب عرض/تجربة → مشترك), a donut of clients by city, and a "آخر النشاطات" list of the last 8 contact logs. Add a compact "متابعات اليوم" widget showing the top 5 overdue/due clients with a "عرض الكل" link.

3. **/clients (العملاء)** — a dense, clean data table:
   - Top bar: search (name/phone/code), filter chips/dropdowns for city, business type, priority, contact status, outcome, follow-up state, owner, source; "مسح الفلاتر"; primary button "+ إضافة عميل".
   - Columns: code, salon name (bold, with city beneath in muted text), phone, priority badge, contact status badge, outcome badge, last contact, next follow-up + follow-up-state badge, attempts, owner, and a row actions cell: WhatsApp button (opens `https://wa.me/<phone>`), "تسجيل تواصل" button, edit, delete (confirm dialog).
   - Sortable columns, pagination (25/page), row click opens a right-side Sheet (slides from the start side) with full client details, notes, and that client's contact timeline.
   - On mobile, the table becomes a card list.
   - Add/edit client in a Dialog with a clean 2-column form (1 column on mobile), zod validation, and Saudi phone normalization (accept 05XXXXXXXX or +9665XXXXXXXX, store as 9665XXXXXXXX).

4. **/today (متابعات اليوم)** — the daily working screen. Two sections: "متأخرة" (red accent) and "مستحقة اليوم" (amber accent), sorted by priority then date. Each item is a card with salon name, contact person, last result/summary, days overdue, big WhatsApp + call buttons, and a primary "سجّل تواصل" button that opens the log dialog pre-filled for that client. Also a section "لاحقًا" collapsed by default. Empty state with a friendly illustration/message when nothing is due.

5. **/log (سجل التواصل)** — table of all contact log entries with filters (channel, result, replied, date range, owner) and search by salon name; "+ تسجيل تواصل" button.

6. **Log contact dialog (reused everywhere)** — fields: client (searchable combobox, locked when opened from a client), date-time (default now), channel (segmented buttons with icons), attempt type, replied (3-way toggle), result, next follow-up date (with quick chips: غدًا / بعد 3 أيام / بعد أسبوع / بعد أسبوعين), reply summary textarea, next action, chat URL, and a checkbox "حدّث حالة العميل تلقائيًا". If result is "طلب عدم التواصل", show a warning banner and auto-set the client to تم إيقاف التواصل / لا يرغب بالتواصل.

7. **/settings (الإعدادات)** — minimal: team members list (mock) and a "تصدير CSV" button for clients and log (client-side export, with UTF-8 BOM so Excel opens Arabic correctly).

## LAYOUT
- Right-side sidebar (RTL) with logo "OJLinker" + subtitle "متابعة مبيعات الصالونات", nav items with lucide icons: لوحة المتابعة, متابعات اليوم (with a red count badge of overdue+due), العملاء, سجل التواصل, الإعدادات. Collapsible to icons on desktop; becomes a bottom tab bar (4 items) on mobile.
- Top bar: global search, current user avatar menu with logout.
- Page header pattern: title + muted description + primary action on the opposite side.

## VISUAL STYLE (this is important — make it feel premium, not generic)
- Brand: deep navy primary #17365D (taken from our existing spreadsheet header), with a refined gold/amber accent #C9A227 used sparingly (active nav indicator, key highlights) to hint at the beauty/salon world. Neutral background #F6F7F9, white cards.
- Define everything as CSS variables in index.css (shadcn tokens) so I can retheme easily. Include a dark mode toggle with a properly designed dark palette (navy-tinted dark surfaces, not pure black).
- Cards: rounded-2xl, 1px soft border, very light shadow, generous padding; hover lift only on clickable cards.
- Semantic badge colors (soft tinted background + darker text, never saturated fills):
  - Outcome: مهتم = green, غير مهتم = red, طلب عرض/تجربة = blue, مشترك = emerald with a check icon, يحتاج متابعة لاحقًا = amber, غير محدد = gray, لا يرغب بالتواصل = dark gray/red outline.
  - Contact status: لم يتم التواصل = gray, تم التواصل = blue, في انتظار الرد = amber, ردّ = green, متابعة مطلوبة = orange, تم إيقاف التواصل = red outline.
  - Follow-up state: متأخرة = red, مستحقة = amber, لاحقًا = slate.
  - Priority: عالية = red dot, متوسطة = amber dot, منخفضة = gray dot.
- Tabular numbers for all stats, 14–15px base text, generous line-height for Arabic, subtle transitions (150ms), skeleton loaders, and proper empty states in Arabic.
- Toasts (sonner) in Arabic for every create/update/delete.
- Accessible: focus rings, aria labels in Arabic, keyboard navigable table and dialogs.

## CODE QUALITY
- Folder structure: src/pages, src/components (ui, layout, clients, log, dashboard), src/hooks, src/lib (api.ts, mock-data.ts, types.ts, constants.ts, utils.ts).
- A small `utils.ts` with `computeFollowUpState`, `formatDate`, `normalizePhone`, `waLink`.
- No inline hard-coded colors in components — use Tailwind tokens/variables only.

Start by building the design system, layout shell, login, dashboard and the clients table with the mock data. Then the other pages.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a0a4962d-8edf-4cc7-b620-3eb04a29a2f3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
