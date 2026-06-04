-- Forum Phase 1 RLS policies.
-- Creates read and write policies for public.forum_posts without enabling delete.

alter table public.forum_posts enable row level security;

-- H1. Approved active authenticated users can read forum posts.
drop policy if exists "forum_posts: approved active select" on public.forum_posts;
create policy "forum_posts: approved active select"
  on public.forum_posts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.auth_user_id = auth.uid()
        and u.status = 'active'
        and u.role_approval_status = 'approved'
    )
  );

-- H2. Authenticated users can insert only posts authored by their own public.users row.
drop policy if exists "forum_posts: insert own" on public.forum_posts;
create policy "forum_posts: insert own"
  on public.forum_posts
  for insert
  to authenticated
  with check (
    author_id = (
      select u.id
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    )
  );

-- H3. Commanders can update every forum post.
drop policy if exists "forum_posts: commander update all" on public.forum_posts;
create policy "forum_posts: commander update all"
  on public.forum_posts
  for update
  to authenticated
  using (public.is_commander(auth.uid()))
  with check (public.is_commander(auth.uid()));

-- H4. Post creators can update their own forum posts.
drop policy if exists "forum_posts: creator update own" on public.forum_posts;
create policy "forum_posts: creator update own"
  on public.forum_posts
  for update
  to authenticated
  using (
    author_id = (
      select u.id
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    )
  )
  with check (
    author_id = (
      select u.id
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    )
  );

-- Run manually in Supabase SQL editor. Do not run automatically.
