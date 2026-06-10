-- Allow commanders and report creators/owners to delete daily reports.

drop policy if exists "forum_daily_reports: delete own or commander" on public.forum_daily_reports;

create policy "forum_daily_reports: delete own or commander"
  on public.forum_daily_reports
  for delete
  to authenticated
  using (
    public.is_commander(auth.uid())
    or created_by = (
      select u.id
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    )
    or owner_user_id = (
      select u.id
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    )
  );

-- Run manually in Supabase SQL editor. Do not run automatically.
