<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand.

- Database and generated integrations are managed by Lovable; do not add
  `supabase/migrations/`, `drizzle/`, or generated integration files by hand.
- Keep AI gateway, connectors, and secrets within Lovable's managed workflows;
  never add private keys to source code.
<!-- LOVABLE:END -->

- Keep all salon, contact-log, and mock-auth data access behind `src/lib/api.ts`; screens consume only typed hooks from `src/hooks/` so a later PocketBase replacement stays isolated.
- Build user-facing routes with the existing TanStack Start file router rather than introducing another framework; file-based routes preserve the project's supported preview and publishing flow.
