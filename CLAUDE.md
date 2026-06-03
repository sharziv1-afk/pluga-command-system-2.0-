@AGENTS.md

Project-specific notes:

- Use Next.js 16 `src/proxy.ts`, not `middleware.ts`.
- Keep Hebrew RTL intact.
- Keep the Light Gloss Command System as the primary design language.
- Do not run `npm audit fix --force`.
- Do not delete `AppContext` / localStorage demo state without dependency mapping.
- Tasks, Requests, and Events are all Supabase-backed with real RLS. Do not bypass RLS or use service role in client code.
- Migrations 001–006 were all run manually in Supabase. Do not re-run automatically.
- Read README.md, PROJECT_HANDOFF_AI_CONTEXT.md, and PROJECT_SUMMARY.md at the start of any session involving Requests, Tasks, or Schedule changes.