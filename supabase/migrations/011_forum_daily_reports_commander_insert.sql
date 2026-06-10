-- Allow commanders to create daily reports for another active approved owner.

drop policy if exists "forum_daily_reports: commander insert all" on public.forum_daily_reports;

create policy "forum_daily_reports: commander insert all"
  on public.forum_daily_reports
  for insert
  to authenticated
  with check (
    public.is_commander(auth.uid())
    and created_by = (
      select commander_user.id
      from public.users commander_user
      where commander_user.auth_user_id = auth.uid()
      limit 1
    )
    and owner_user_id is not null
    and exists (
      select 1
      from public.users owner_user
      where owner_user.id = owner_user_id
        and owner_user.status = 'active'
        and owner_user.role_approval_status = 'approved'
    )
  );

-- Run manually in Supabase SQL editor. Do not run automatically.
