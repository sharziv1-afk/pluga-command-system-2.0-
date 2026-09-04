-- The mentoring_entries policy (023) omitted `to authenticated`, so it
-- defaults to PUBLIC — the anon role is evaluated against it too. It fails
-- closed regardless (is_company_commander(auth.uid()) is false when
-- auth.uid() is null for an unauthenticated request), so this was never an
-- actual leak. Restricting to `authenticated` matches every other policy in
-- this schema and removes the anon role from evaluation entirely, rather
-- than relying on it failing closed by coincidence.
drop policy if exists "mentoring_entries: commander only" on public.mentoring_entries;
create policy "mentoring_entries: commander only"
  on public.mentoring_entries
  for all
  to authenticated
  using ( public.is_company_commander((select auth.uid())) )
  with check ( public.is_company_commander((select auth.uid())) );
