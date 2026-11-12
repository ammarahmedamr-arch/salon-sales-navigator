# OJLinker CRM — Phase 0 Audit

**Audited:** 2026-11-12  
**Repo:** `salon-sales-navigator` (cloned to `/var/www/ojlinker-crm`)  
**Stack declared:** React + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Router (Start) + TanStack Query + react-hook-form + zod + recharts + lucide-react + sonner

---

## (a) File Map

| File | Purpose |
|------|---------|
| `package.json` | Deps: TanStack Start 1.168, React 19, Tailwind 4, shadcn/ui (Radix), react-hook-form 7, zod 3, recharts 2, sonner 2, lucide-react. **Missing:** `pocketbase` SDK (expected, not yet wired). |
| `vite.config.ts` | Uses `@lovable.dev/vite-tanstack-config` — a Lovable-cloud-specific wrapper around Vite + nitro + Cloudflare Workers. **Critical: must be replaced for self-hosted VPS.** |
| `tsconfig.json` | Strict mode on. `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled. |
| `vitest.config.ts` | Standalone vitest config with `@vitejs/plugin-react` (separate from Lovable vite config). |
| `src/styles.css` | Tailwind 4, CSS variables for all tokens, IBM Plex Sans Arabic, RTL layout utilities (uses logical props correctly), dark mode, login/nav/table styles. |
| `src/router.tsx` | TanStack Router + QueryClient wiring. |
| `src/server.ts` | TanStack Start SSR server entry (Cloudflare Worker shape). **Must be removed/replaced for plain Vite SPA.** |
| `src/start.ts` | TanStack Start CSRF + error middleware (Cloudflare/Lovable specific). **Must be removed/replaced.** |
| `src/routes/__root.tsx` | Root route: QueryClientProvider, error boundary, `lang="en"` ← **BUG: must be `lang="ar"`**. |
| `src/routes/login.tsx` | Login page — Arabic UI, calls `api.auth.login`. Works with mock. |
| `src/routes/_authenticated.tsx` | Auth guard: `beforeLoad` → redirect to `/login` if no user. |
| `src/routes/_authenticated.index.tsx` | Mounts `DashboardPage` from `@/components/dashboard/dashboard-page`. **File does not exist → build crash.** |
| `src/routeTree.gen.ts` | Auto-generated. Only knows `/` and `/login`. Missing `/clients`, `/today`, `/log`, `/settings`. |
| `src/components/layout/app-shell.tsx` | RTL sidebar, top bar, mobile bottom tab bar. Navigates to `/today`, `/clients`, `/log`, `/settings` — **none of these routes exist.** |
| `src/components/layout/theme-provider.tsx` | Dark mode context. |
| `src/components/ui/*` | Full shadcn/ui component set (accordion→tooltip). |
| `src/lib/api.ts` | Mock in-memory store. All data access here. Full mock implementation. |
| `src/lib/constants.ts` | All Arabic enum arrays. |
| `src/lib/types.ts` | Zod schemas + TypeScript interfaces. |
| `src/lib/utils.ts` | `computeFollowUpState`, `formatDate`, `normalizePhone`, `waLink`, `makeFollowUpDate`, `exportCsv`. |
| `src/lib/mock-data.ts` | 25 salon clients + 60 contact logs seed data. |
| `src/lib/error-capture.ts` | Lovable-specific error capture/console wrapper. |
| `src/lib/lovable-error-reporting.ts` | Posts errors to `window.__lovableEvents`. Lovable-cloud leftover. |
| `src/lib/error-page.ts` | Renders an English-only 500 HTML page. |
| `src/hooks/use-crm.ts` | TanStack Query hooks wrapping `api.*`. |
| `src/hooks/use-mobile.tsx` | Breakpoint hook. |
| `src/test/domain-utils.test.ts` | Tests for utils. |
| `src/test/app-routing.test.tsx` | Routing smoke test. |
| `src/test/setup.ts` | (assumed) jest-dom setup. |
| `components.json` | shadcn/ui config. `"rtl": false` ← **should be true.** |

---

## (b) Feature / Page Checklist

### Pages & Routes

| Feature | Status | Notes |
|---------|--------|-------|
| `/login` — real auth guard + redirect | 🟡 | Guard exists; auth is mock-only (accepts any email/password, no password check). Page UI is Arabic ✅. |
| `/` Dashboard — 8 KPI cards | ❌ | `DashboardPage` component (`@/components/dashboard/dashboard-page`) **does not exist**. Only the route stub exists. |
| Dashboard — funnel bar chart | ❌ | Component missing. |
| Dashboard — city donut chart | ❌ | Component missing. |
| Dashboard — "آخر النشاطات" (last 8 logs) | ❌ | Component missing. |
| Dashboard — "متابعات اليوم" widget (top 5) | ❌ | Component missing. |
| Dashboard — clickable KPI cards (→ /clients with URL filter params) | ❌ | Component missing + no `/clients` route. |
| `/clients` — dense table with search + filters | ❌ | Route file missing (`_authenticated.clients.tsx` doesn't exist). |
| `/clients` — filters persisted in URL params | ❌ | Missing. |
| `/clients` — sortable columns, pagination (25) | ❌ | Missing. |
| `/clients` — row actions (WhatsApp, log, edit, delete w/confirm) | ❌ | Missing. |
| `/clients` — side Sheet (details + contact timeline) | ❌ | Missing. |
| `/clients` — add/edit dialog with zod + phone normalization | ❌ | Missing. |
| `/clients` — mobile card list (table hidden on mobile ✓ via CSS) | ❌ | Missing. |
| `/today` — overdue (red) + due today (amber) + later (collapsed) | ❌ | Route missing. |
| `/today` — cards with WhatsApp/call/log buttons | ❌ | Missing. |
| `/log` — all contact logs table with filters | ❌ | Route missing. |
| `/log` — search by salon name | ❌ | Missing. |
| Reusable Log-contact dialog (full spec) | ❌ | Missing. |
| `/settings` — team members management | ❌ | Route missing. |
| `/settings` — CSV export (clients + logs, UTF-8 BOM) | ❌ | `exportCsv` utility exists ✅; settings page missing ❌. |
| Layout — RTL collapsible sidebar | 🟡 | Sidebar shell exists; links to missing routes. |
| Layout — mobile bottom tab bar | 🟡 | Exists in app-shell; routes missing. |
| Layout — red count badge on "متابعات اليوم" | ✅ | Implemented in app-shell. |
| Dark mode | ✅ | theme-provider + CSS vars. |

### Business Rules

| Rule | Status | Notes |
|------|--------|-------|
| `code` auto-increment SAL-0001 / ACT-00001 | 🟡 | Mock `nextCode()` works; not server-side. |
| Phone stored as `9665XXXXXXXX` | ✅ | `normalizePhone` handles 05/+9665 formats. |
| `follow_up_state` computed (never stored) | ✅ | `computeFollowUpState` correct. |
| `follow_up_state` forced empty when outcome ∈ {مشترك, غير مهتم, لا يرغب بالتواصل} | ✅ | Implemented. |
| `attempts_count` = number of logs per client | ✅ | `enrich()` in api.ts. |
| Contact log create → update parent client atomically | 🟡 | Done in api.ts mock; no server-side hook yet. |
| Auto-update client status/outcome from result when checkbox on | 🟡 | Partial: only "طلب عدم التواصل" always fires; `update_client` checkbox fires for other cases but no derivation map (e.g. `result "مهتم" → outcome "مهتم", status "ردّ"` derivation is **not** implemented — the mock relies on `input.contact_status` and `input.outcome` being passed in by the form, which doesn't exist). |
| "طلب عدم التواصل" → `contact_status = "تم إيقاف التواصل"`, `outcome = "لا يرغب بالتواصل"`, `next_follow_up_date = null` | 🟡 | In api.ts ✅; no UI form yet. |
| Dashboard 8 KPIs computed correctly | 🟡 | `api.dashboard.stats()` logic is correct; no UI. |
| Pagination (server-side ready, `{ page, perPage, sort, filters }` → `{ items, totalItems }`) | ❌ | `api.clients.list()` returns a flat array — no `page`, `perPage`, or `totalItems`. Not pagination-ready. |

### Data Model Conformance

| Item | Status | Notes |
|------|--------|-------|
| All `clients` fields present | 🟡 | Missing `updated` field (PocketBase auto-field). |
| `ContactLog` has `created_by` relation | ❌ | `ContactLogInput` and `ContactLog` types have no `created_by` field. |
| `AppUser.role` field (admin \| agent) | ❌ | `AppUser` interface only has `{ id, name, email }` — no `role`. |
| `DashboardStats.followUps` limited to top 5 | ✅ | `.slice(0, 5)`. |

---

## (c) Enum Mismatches

> Comparing `src/lib/constants.ts` against the spec.

| Constant | Spec | Code | Match? |
|----------|------|------|--------|
| `CITIES` | الرياض \| جدة \| مكة المكرمة \| المدينة المنورة \| الدمام \| الخبر \| الطائف \| أبها \| تبوك \| بريدة \| أخرى | ✅ Identical | ✅ |
| `BUSINESS_TYPES` | صالون نسائي \| صالون رجالي \| مركز تجميل \| سبا \| حلاقة \| أخرى | ✅ Identical | ✅ |
| `SOURCES` | خرائط Google \| إنستجرام \| موقع إلكتروني \| دليل أعمال \| إحالة \| بحث يدوي \| مصدر آخر | ✅ Identical | ✅ |
| `PRIORITIES` | عالية \| متوسطة \| منخفضة | ✅ Identical | ✅ |
| `CONTACT_STATUSES` | لم يتم التواصل \| تم التواصل \| في انتظار الرد \| ردّ \| متابعة مطلوبة \| تم إيقاف التواصل | ✅ Identical | ✅ |
| `OUTCOMES` | غير محدد \| مهتم \| غير مهتم \| طلب عرض \| تجربة/ديمو \| يحتاج متابعة لاحقًا \| مشترك \| لا يرغب بالتواصل | ✅ Identical | ✅ |
| `CHANNELS` | واتساب \| اتصال هاتفي \| رسالة نصية \| إنستجرام \| بريد إلكتروني \| أخرى | ✅ Identical | ✅ |
| `ATTEMPT_TYPES` | رسالة أولى \| متابعة أولى \| متابعة ثانية \| مكالمة \| عرض توضيحي \| متابعة بعد العرض \| أخرى | ✅ Identical | ✅ |
| `REPLIED_OPTIONS` | نعم \| لا \| لم يتضح | ✅ Identical | ✅ |
| `CONTACT_RESULTS` | لم يرد \| مهتم \| غير مهتم \| طلب تفاصيل \| طلب عرض \| طلب تجربة \| مشترك \| طلب عدم التواصل \| رقم غير صحيح \| إعادة التواصل لاحقًا | ✅ Identical | ✅ |
| `NEXT_ACTIONS` | انتظار الرد \| إرسال تفاصيل \| تحديد موعد عرض \| متابعة لاحقًا \| إغلاق العميل \| إيقاف التواصل \| لا إجراء | ✅ Identical | ✅ |

**All enum values match the spec exactly.** ✅

---

## (d) Bugs, RTL/i18n, Colors, TypeScript, Build Errors

### 🔴 Critical Build Errors

1. **`DashboardPage` component missing** (`src/components/dashboard/dashboard-page.tsx` does not exist). `_authenticated.index.tsx` imports it → **build crash / blank page.**
2. **Routes `/clients`, `/today`, `/log`, `/settings` missing entirely.** App-shell has nav links that go nowhere; TanStack Router generates 404 for all of them.
3. **`@lovable.dev/vite-tanstack-config`** — this is Lovable Cloud's proprietary wrapper targeting Cloudflare Workers + nitro. It is **incompatible with a plain VPS deployment** (expects Cloudflare Workers runtime, sets `ssr.external` rules, injects Cloudflare-specific env). Must be replaced with a standard Vite SPA config for self-hosted use.
4. **`src/server.ts` and `src/start.ts`** — TanStack Start SSR server entry files tied to Cloudflare/Lovable. Must be removed for plain Vite SPA.

### 🟠 RTL / i18n Issues

5. **`lang="en"` in `__root.tsx`** (`RootShell` renders `<html lang="en">`). Must be `lang="ar"` and `dir="rtl"`.
6. **404 / Error page strings are English** (`__root.tsx`: "Page not found", "The page you're looking for...", "Go home", "This page didn't load"). Must be Arabic.
7. **`renderErrorPage()` in `error-page.ts`** — static HTML is English only.
8. **`components.json`** has `"rtl": false` — should be `true` to get RTL-aware shadcn/ui component generation.
9. **`dateKey()` in `utils.ts`** — uses `new Date()` without timezone consideration. On a server, `new Date()` uses UTC; in Riyadh (UTC+3) this can be off by up to 3 hours around midnight, causing follow-up state to flip on the wrong day. Fix: compare using `Intl.DateTimeFormat` in `Asia/Riyadh`.

### 🟡 Logic / Type Gaps

10. **`normalizePhone` rejects `+9665XXXXXXXX`** (the `+` prefix variant). The regex `/^9665\d{8}$/` only matches without the `+`. Input `+966512345678` → after `replace(/\D/g, '')` → `966512345678` ✅. Actually this works because `\D` strips the `+`. But the test file verifies it. **Actually this is correct** — stripping non-digits first handles `+` correctly.
11. **`ContactLogInput` missing `created_by`** — when wired to PocketBase, the `created_by` field on contact_logs won't be settable/typed.
12. **`AppUser` missing `role`** — no way to enforce admin vs agent in the UI.
13. **`api.clients.list()` signature** — returns `Promise<Client[]>` not `Promise<{ items: Client[]; totalItems: number }>`. All hooks will need a signature change. The spec says this must accept `{ page, perPage, sort, filters }`.
14. **`api.contactLogs.listAll()` has no filters** — `/log` page needs channel/result/replied/date range/owner filters.
15. **`useSaveContactLog` invalidates using `crmKeys.clientLogs(input.client_id)`** but `crmKeys.clientLogs` takes a `string` and returns `["logs", id]` — the key structure might conflict with `crmKeys.logs = ["logs"]`. This is a TanStack Query prefix-invalidation issue (invalidating `["logs"]` invalidates everything that starts with `["logs"]`, including `["logs", id]`). Low severity.
16. **Mock `api.contactLogs.create`** — when `update_client` is true, it checks `input.contact_status` and `input.outcome` — but these must be derived from `input.result` server-side. The form (not yet built) would need to pass them, or the derivation logic must live in `api.ts`. Spec says the derivation map (e.g. `"مهتم" → outcome "مهتم", status "ردّ"`) must be in the PocketBase hook, but the mock must replicate it.

### 🟡 Hard-coded values

17. **`owner` default `"عمر الحربي"`** in `clientSchema` (`types.ts`): `z.string().default("عمر الحربي")`. Should default to current user's name/id.
18. **`fakeUsers` emails** like `team1@ojlinker.sa` are hard-coded in `api.ts`.

### 🟡 Lovable Cloud leftovers

19. `src/lib/lovable-error-reporting.ts` — posts to `window.__lovableEvents`. Safe to keep for now (noop outside Lovable editor), but should be removed before production.
20. `src/server.ts` — Cloudflare Worker SSR entry.
21. `src/start.ts` — TanStack Start config for Lovable.
22. `vite.config.ts` — imports `@lovable.dev/vite-tanstack-config`.
23. `.lovable/project.json` — Lovable project metadata file.
24. `AGENTS.md` — Lovable rules file (the section about Supabase/generated integrations).
25. `bunfig.toml` — Bun package manager config (team uses npm/bun inconsistency; `bun.lock` committed but `package.json` has npm scripts).

### TypeScript errors (confirmed by `npx tsc --noEmit`)

1. **`cn` not exported from `@/lib/utils`** — All 30+ shadcn/ui components import `{ cn }` from `@/lib/utils`, but `utils.ts` does not export `cn`. shadcn/ui requires `cn = (clsx + twMerge)`. This is the **most widespread TS error** (30+ files broken).
2. **Missing routes break `app-shell.tsx`** — TanStack Router type-checks `to` props against known routes. `/clients`, `/today`, `/log`, `/settings` are unknown → 5 type errors.
3. **Unknown search param `q`** in `navigate({ to: "/clients", search: { q: ... } })` — route not registered.

### Vitest test results (confirmed)

- `app-routing.test.tsx` — ❌ **FAIL** (transform error: `DashboardPage` module not found).
- `domain-utils.test.ts` — ✅ **4/4 pass** (computeFollowUpState, normalizePhone, formatDate, relativeDays all correct).

---

## (e) Supabase / Lovable Cloud Leftovers

| File | Leftover |
|------|---------|
| `vite.config.ts` | `@lovable.dev/vite-tanstack-config` — Lovable's Cloudflare Workers build wrapper |
| `src/server.ts` | TanStack Start SSR server entry (Cloudflare Worker shape) |
| `src/start.ts` | TanStack Start CSRF middleware / Lovable cloud wiring |
| `src/lib/lovable-error-reporting.ts` | `window.__lovableEvents` Lovable telemetry |
| `src/lib/error-capture.ts` | console.error wrapper for Lovable error capture (not harmful but Lovable-specific) |
| `.lovable/project.json` | Lovable project ID |
| `AGENTS.md` | Lovable agent rules (Supabase references in managed section) |
| `bunfig.toml` | Bun config (Lovable uses bun internally) |
| `src/lib/error-page.ts` | English-only error page (Lovable default) |
| `__root.tsx` | Error strings in English, Lovable App meta title |

No Supabase SDK, no Supabase URLs, no `SUPABASE_*` env vars found. ✅

---

## (f) api.ts Function Signatures (current)

```typescript
// clients
api.clients.list(filters?: ClientFilters): Promise<Client[]>
//   ClientFilters: { search?, city?, business_type?, priority?, contact_status?,
//                    outcome?, follow_up_state?, owner?, source?, page?,
//                    sortBy?: keyof Client, sortDirection?: "asc" | "desc" }
//   ⚠️ No perPage, no totalItems in return — not pagination-ready

api.clients.get(id: string): Promise<Client | null>
api.clients.create(input: ClientInput): Promise<Client>
api.clients.update(id: string, input: Partial<ClientInput>): Promise<Client>
api.clients.delete(id: string): Promise<void>

// contactLogs
api.contactLogs.listByClient(clientId: string): Promise<ContactLog[]>
api.contactLogs.listRecent(limit: number): Promise<ContactLog[]>
api.contactLogs.listAll(): Promise<ContactLog[]>
//   ⚠️ No filters, no pagination

api.contactLogs.create(input: ContactLogInput): Promise<ContactLog>

// dashboard
api.dashboard.stats(): Promise<DashboardStats>

// auth
api.auth.login(email: string, password: string): Promise<AppUser>
api.auth.logout(): Promise<void>
api.auth.currentUser(): Promise<AppUser | null>

// users
api.users.list(): Promise<AppUser[]>
```

---

## Summary Table

| Category | Count |
|----------|-------|
| ✅ Done (fully working) | Enums, utils, types, hooks scaffold, login UI, auth guard, sidebar shell, dark mode, mock data, CSV util, `computeFollowUpState`, `normalizePhone`, `waLink`, `formatDate` |
| 🟡 Partial | Auth (mock, no password check), contact log create (no derivation map), sidebar (links to missing routes), dashboard stats logic (correct but no UI) |
| ❌ Missing | `DashboardPage`, `/clients`, `/today`, `/log`, `/settings`, log dialog, pagination in api.ts, `created_by` in log type, `role` in AppUser, correct `lang="ar"` + `dir="rtl"` on html root, pagination-ready api signatures |
| 🔴 Build-breaking | Missing `DashboardPage` import, Lovable vite config (incompatible with VPS), missing routes crash nav |

---

## Recommended Phase 1 Order

1. **Fix vite.config** → replace `@lovable.dev/vite-tanstack-config` with standard `@vitejs/plugin-react` SPA config. Remove `server.ts` and `start.ts`. This unblocks local dev and VPS build.
2. **Fix `lang="ar" dir="rtl"`** on `<html>` in `__root.tsx`. Translate 404/error strings to Arabic.
3. **Fix `api.ts` signatures** → add `perPage`, return `{ items, totalItems }`.
4. **Add `created_by` + `role` to types.**
5. **Build missing pages** in order: Dashboard → Clients → Today → Log → Settings.
6. **Add log dialog** (reusable, used by Clients + Today).
7. **Fix timezone safety** in `dateKey` for `Asia/Riyadh`.
8. **Write Vitest tests** for timezone edge cases.
