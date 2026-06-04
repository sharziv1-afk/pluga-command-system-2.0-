-- ============================================================
-- 007_request_creator_update_rls.sql
-- Allow request creators to edit their own requests (Phase 1)
-- ============================================================

drop policy if exists "requests: creator update own" on public.requests;

create policy "requests: creator update own"
  on public.requests
  for update
  to authenticated
  using (
    requested_by = (
      select id
        from public.users
       where auth_user_id = auth.uid()
       limit 1
    )
  )
  with check (
    requested_by = (
      select id
        from public.users
       where auth_user_id = auth.uid()
       limit 1
    )
  );
