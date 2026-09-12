-- 033_drop_unused_tables.sql
--
-- Drops three tables that were created early, never wired to anything, and
-- have sat empty ever since:
--
--   approvals            — a generic approval workflow. The app never grew
--                          one: user approval lives on users.role_approval_status
--                          and report approval is the forum's own draft →
--                          in_progress → submitted → closed lifecycle.
--   feature_flags        — no flag was ever read.
--   onboarding_progress  — the /onboarding route it belonged to was deleted
--                          outright (it collected a name and a role and wrote
--                          nothing), so this is the last piece of that branch.
--
-- Verified before writing this (2026-09-12):
--   * 0 rows in each, in BOTH the live and sandbox projects.
--   * Zero references anywhere under src/ — grep across every .ts/.tsx file.
--   * No other table has a foreign key into any of them, so nothing cascades.
--
-- Why bother: all three have RLS enabled with no policy at all. That fails
-- closed, so it is not a security hole — but it is a permanent WARN in the
-- Supabase security advisor, and a permanent WARN is noise that trains you to
-- ignore the advisor. Removing dead tables is the honest fix; adding a policy
-- to a table nobody reads would only make the warning go away.
--
-- If feature flags are ever wanted, the table is five lines to recreate.
--
-- Run manually in the Supabase SQL editor. SANDBOX FIRST, verify the app
-- still loads, then LIVE.

drop table if exists public.approvals cascade;
drop table if exists public.feature_flags cascade;
drop table if exists public.onboarding_progress cascade;
