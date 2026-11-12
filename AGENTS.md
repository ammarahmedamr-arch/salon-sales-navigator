# OJLinker CRM — Project Conventions

## Architecture rules

- **Data boundary:** All data access goes through `src/lib/api.ts`. Pages and components import hooks from `src/hooks/` only; they never import the PocketBase SDK or mock store directly.
- **Constants are the enum source of truth:** Arabic enum values live in `src/lib/constants.ts`. Types in `src/lib/types.ts` are derived from them via `z.enum(CONSTANT)`. Never hard-code an Arabic string in a component.
- **Routing:** TanStack Router file-based routes in `src/routes/`. Route names follow the `_authenticated.page-name.tsx` convention. Run `npm run dev` to auto-regenerate `routeTree.gen.ts`; never edit it by hand.
- **Styling:** Use Tailwind utility classes with the CSS-variable tokens in `src/styles.css`. No inline hard-coded hex/rgb colors. Use logical properties (`ms-`, `me-`, `ps-`, `pe-`) — never `left`/`right`.
- **RTL first:** The document is `lang="ar" dir="rtl"`. All new components must be verified at 390 px RTL.

## Commit rules

- Branch: all work on `phase-N` branches; never commit directly to `main`.
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- One logical change per commit. Keep diffs small.

## Forbidden

- Supabase, Firebase, any cloud-BaaS other than PocketBase.
- Express/NestJS/any custom API server.
- Docker Compose stacks in production.
- `left`/`right` CSS properties.
- Hard-coded Arabic strings outside `constants.ts`.
- Committing `.env`, secrets, `pb_data/`, or the PocketBase binary.
