<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project-Specific Guardrails

- Use Next.js 16 `src/proxy.ts`; do not create or rename to `middleware.ts`.
- Preserve Hebrew RTL across layouts, forms, navigation, and mobile views.
- Preserve the Light Gloss Command System: bright background, orange `#FF6B02` actions, glass cards, and dark `#020108` text.
- Do not run `npm audit fix --force`.
- Do not delete or rewrite `src/lib/context/AppContext.tsx` / localStorage demo state without dependency mapping.
- Do not touch Supabase schema, seed, auth callback, or proxy during design-only work unless a direct verified issue requires it.
- Never put a service role key in frontend code.
- Do not propose or run SQL automatically. Propose SQL, then wait for explicit manual execution.
- Do not re-run migration 001 or 002 in production. They are idempotent but unnecessary.
- Keep Hebrew gershayim normalization (`normalizeRole`) consistent across all modules — it is critical for commander role detection.
- Tasks and Requests both have `event_id` as a real FK column (not metadata). Do not move it to metadata.
- Metadata merge on task edit must preserve: `source_type`, `source_id`, `creator_name`, `creator_role`, `creator_unit`, `control_questions`, `stuck_reason`. Only `category`, `location`, `output_required` should be overwritten.
- Metadata merge on request edit must preserve: `creator_name`, `creator_role`, `creator_unit`. Only `category` and `priority` should be overwritten. Use spread: `{ ...existingMetadata, category, priority }`.
- Audit actions are best-effort (`void createAuditLog(...)`). Never make them blocking.
- Closed item deletion is Phase 1 only (creator + commander). Do not add unit/hierarchy logic without planning.
- Request editing (Phase 1) allows creator or commander to edit: title, description, category, priority, event_id. Do not add status, assigned_to, or unit_id editing without planning.
- Event editing (Phase 1) allows creator or commander to edit: title, description, event_type, starts_at, ends_at, location, responsible_user_id. Status is not an editable field in the form. Exception: `handleEditEvent` auto-reopens a `completed` event to `scheduled` when the new time is in the future (records `reopened_from_completed: true` in audit). `cancelled` events are never auto-reopened. Do not add status as an editable field without explicit planning.
- Forum Phase 1 posts are Supabase-backed through `forum_posts` and `008_forum_rls.sql`. Creators can edit their own posts; commanders can edit all posts. Keep `forum_post_created` and `forum_post_updated` audit best-effort.
- Forum daily reports use `forum_daily_reports` from migrations 010-012. Migration 009 (`forum_daily_summaries`) is legacy/prototype and should not be used as the main model.
- Forum daily report slots must stay separated by report/owner/date/unit/staff identity. Do not fall back to `report_level` alone for platoon/staff selection.
- If a forum slot has no reliable owner mapping, show a user-mapping requirement instead of creating a report under the wrong owner.
- Forum Daily Owner Mapping Diagnosis (2026-06-21): latest checkpoint is `650353f Polish small dashboard forum and task UI issues`. Structural commander slots such as `platoon_1-summary` are currently static placeholders without `ownerUserId`/`unitId`; existing reports become fallback nodes under "existing reports". Do not delete that fallback. The next preferred fix is a UI-only mapping layer that enriches structural slots from active/approved owner options and unit/role labels before any DB/RLS work.
- For the next forum daily fix, do not start with DB population, do not change RLS, and do not wire `commanded_unit_id` into security without a Supabase snapshot and explicit planning.
- WhatsApp preview currently renders from `dailyReports`, not all mapped structural slots; empty platoons can be omitted. Fix it only after slot mapping is reliable.
- Real MK -> MM -> MP hierarchy mapping and hierarchy RLS are future work. Do not fake hierarchy permissions in UI or RLS without an explicit data model and planning.
- `users.unit_id` and `users.commanded_unit_id` both reference `units`. Do not use embedded `units(...)` selects from `users`; load units separately and map client-side.
- `supabase/migrations/013_add_commanded_unit_id.sql` adds `users.commanded_unit_id` as hierarchy foundation only. It was reportedly run manually. Do not rerun without a direct reason.
- `supabase/migrations/014_reference_data_read_policies.sql` adds `units: public read` + `roles: public read` SELECT policies (`for select to anon, authenticated using (true)`). `units`/`roles` are non-sensitive reference data; without these policies the client unit/role selectors return zero rows. Applied manually in live Supabase on 2026-06-19 and recorded for sync. Idempotent; do not rerun blindly.
- Registration is OTP-code-only (no `emailRedirectTo` on the registration `signInWithOtp`); the auth callback is reserved for password reset. Registration sets `has_completed_onboarding=true`, maps role→unit, and requires a real `unit_id` when the role maps to a unit. Admin prefills role (gershayim-normalized) and suggests מסגרת/יחידה בפיקוד/רמת הרשאה by role; an Admin guardrail blocks approval without a valid role + `unit_id`. Do not regress these without planning.
- `commanded_unit_id` is not yet wired into forum visibility or real hierarchy RLS.
- Forgot Password is implemented through `supabase.auth.resetPasswordForEmail(...)`, `next=/reset-password` in the auth callback, and `/reset-password` with `supabase.auth.updateUser({ password })`.
- Do not add recurring events, drag/drop, cron jobs, Supabase Edge Functions, or Supabase Realtime without an explicit feature request and planning session.
- Commit messages must be descriptive and specific (e.g., `Add request and event editing`, `Update project handoff after editing milestone`). Do not use generic names like `update`, `fix`, `changes`, or a hash alone.
