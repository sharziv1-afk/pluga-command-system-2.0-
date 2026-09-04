-- Closes an information leak from the invite-only auth model.
--
-- login/page.tsx uses `signInWithOtp({ shouldCreateUser: true })` because a
-- commander's invite creates the public.users row before the invited person
-- ever signs in — Supabase Auth doesn't know their email yet at invite time,
-- so shouldCreateUser must stay true or the invited user's own first login
-- would fail. That flag is not itself the bug; the real gate is
-- claim_own_profile, which only succeeds against a matching unlinked
-- public.users row.
--
-- The bug is downstream: `shouldCreateUser: true` also means ANYONE can
-- request an OTP for ANY email and receive a valid `authenticated` JWT for
-- an auth.users row with no matching public.users invite — an orphan
-- account, never approved, never able to claim a profile. Migration 017
-- (section E) already dropped anon access to units/roles, but left them
-- `for select to authenticated using (true)` — which that orphan JWT still
-- satisfies. Anyone could request a code for a throwaway email and read the
-- entire unit/role structure without ever being invited.
--
-- current_app_user_id() (015) returns null unless the caller is an
-- active + approved row in public.users, which an orphan account can never
-- be. Tightening to it costs nothing for real users: units/roles are only
-- read from /admin (commander-only, already active+approved to reach it)
-- and no page a pending or unapproved user can reach needs them anymore
-- (the self-registration dropdowns that used to need them were removed —
-- the invite-only model has the commander set role/unit directly).
drop policy if exists "units: authenticated read" on public.units;
create policy "units: active approved read"
  on public.units for select to authenticated
  using (public.current_app_user_id() is not null);

drop policy if exists "roles: authenticated read" on public.roles;
create policy "roles: active approved read"
  on public.roles for select to authenticated
  using (public.current_app_user_id() is not null);
