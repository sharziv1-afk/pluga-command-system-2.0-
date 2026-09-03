-- 020_admin_invite_users.sql
-- Lets a commander invite a user directly from the app's /admin screen
-- instead of the Supabase Table Editor. A commander may insert a
-- public.users row for someone else, but only as an unlinked invitation
-- (auth_user_id must be null) — the only way to attach a real
-- auth_user_id to that row is still claim_own_profile, which requires the
-- invited person to prove their email via a verified Supabase Auth JWT.
-- This does not weaken the invite-only guarantee from 016; it just moves
-- the "add a row to public.users" step into the app's own UI.

drop policy if exists "users: commander insert" on public.users;
create policy "users: commander insert"
  on public.users for insert to authenticated
  with check (
    public.is_commander((select auth.uid()))
    and auth_user_id is null
  );
