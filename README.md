# OJLinker CRM

داخلية CRM لتتبع مبيعات صالونات التجميل في المملكة العربية السعودية — واتساب-first.

## Stack

- **Frontend:** React 19 + Vite + TypeScript + Tailwind 4 + shadcn/ui + TanStack Router + TanStack Query + react-hook-form + zod + recharts
- **Backend:** PocketBase (single binary, SQLite) — see `backend/`
- **Hosting:** VPS behind Caddy (HTTPS) — see `deploy/`

## Development

```bash
npm install
cp .env.example .env          # set VITE_PB_URL
npm run dev                   # http://localhost:5173
```

> PocketBase must be running on port 8090 for API calls to work.
> With `VITE_USE_MOCK=true` the app uses an in-memory mock (no PocketBase needed).

## Build

```bash
npm run build      # outputs static files to dist/
npm run preview    # preview the dist/ build locally
```

## Test

```bash
npm run test         # vitest run (all tests)
npm run typecheck    # tsc --noEmit
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_PB_URL` | Yes (prod) | PocketBase origin, e.g. `https://crm.ojlinker.sa` |
| `VITE_USE_MOCK` | No | Set to `true` to use in-memory mock data instead of PocketBase |

## Project structure

```
src/
  routes/         # TanStack Router file-based routes
  components/     # React components (ui/ = shadcn, layout/, dashboard/, etc.)
  hooks/          # TanStack Query hooks (consume api.ts only)
  lib/
    api.ts        # ALL data access — mock or PocketBase
    pb.ts         # PocketBase SDK client (Phase 3)
    constants.ts  # Arabic enum arrays (source of truth)
    types.ts      # Zod schemas + TypeScript interfaces
    utils.ts      # Pure utility functions
backend/          # PocketBase migrations, hooks, scripts
deploy/           # systemd, Caddy, backup scripts
docs/             # Audit, screenshots, handoff
```

## Import Excel data

See `backend/scripts/import-excel.ts` (available after Phase 2).

## Deployment

See `deploy/DEPLOY.md`.
