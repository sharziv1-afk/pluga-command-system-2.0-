-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type role_approval_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type user_status as enum ('active', 'pending', 'blocked', 'inactive');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type approval_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type task_status as enum ('open', 'in_progress', 'blocked', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type request_status as enum ('open', 'in_progress', 'approved', 'rejected', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

-- Updated-at helper
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Units
create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  parent_unit_id uuid references units(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Roles
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  permission_level integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  name text not null,
  role text not null,
  unit_id uuid references units(id) on delete set null,
  permission_level integer not null default 0,
  has_completed_onboarding boolean not null default false,
  role_approval_status role_approval_status not null default 'pending',
  status user_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Onboarding progress
create table if not exists onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  current_step text not null default 'start',
  completed_steps jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit logs
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  user_name text,
  user_role text,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

-- Future: Tasks
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status task_status not null default 'open',
  priority text,
  assigned_to uuid references users(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  unit_id uuid references units(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Future: Requests
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status request_status not null default 'open',
  request_type text,
  requested_by uuid references users(id) on delete set null,
  assigned_to uuid references users(id) on delete set null,
  unit_id uuid references units(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Future: Comments
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  user_id uuid references users(id) on delete set null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Future: Approvals
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  requested_by uuid references users(id) on delete set null,
  approver_id uuid references users(id) on delete set null,
  status approval_status not null default 'pending',
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Future: Forum posts
create table if not exists forum_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author_id uuid references users(id) on delete set null,
  unit_id uuid references units(id) on delete set null,
  is_pinned boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Future: Feature flags
create table if not exists feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_enabled boolean not null default false,
  rollout_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated-at triggers
drop trigger if exists set_units_updated_at on units;
create trigger set_units_updated_at before update on units for each row execute function set_updated_at();

drop trigger if exists set_roles_updated_at on roles;
create trigger set_roles_updated_at before update on roles for each row execute function set_updated_at();

drop trigger if exists set_users_updated_at on users;
create trigger set_users_updated_at before update on users for each row execute function set_updated_at();

drop trigger if exists set_onboarding_progress_updated_at on onboarding_progress;
create trigger set_onboarding_progress_updated_at before update on onboarding_progress for each row execute function set_updated_at();

drop trigger if exists set_tasks_updated_at on tasks;
create trigger set_tasks_updated_at before update on tasks for each row execute function set_updated_at();

drop trigger if exists set_requests_updated_at on requests;
create trigger set_requests_updated_at before update on requests for each row execute function set_updated_at();

drop trigger if exists set_comments_updated_at on comments;
create trigger set_comments_updated_at before update on comments for each row execute function set_updated_at();

drop trigger if exists set_approvals_updated_at on approvals;
create trigger set_approvals_updated_at before update on approvals for each row execute function set_updated_at();

drop trigger if exists set_forum_posts_updated_at on forum_posts;
create trigger set_forum_posts_updated_at before update on forum_posts for each row execute function set_updated_at();

drop trigger if exists set_feature_flags_updated_at on feature_flags;
create trigger set_feature_flags_updated_at before update on feature_flags for each row execute function set_updated_at();

-- Useful indexes
create index if not exists idx_units_parent_unit_id on units(parent_unit_id);

create index if not exists idx_users_auth_user_id on users(auth_user_id);
create index if not exists idx_users_email on users(email);
create index if not exists idx_users_unit_id on users(unit_id);
create index if not exists idx_users_role on users(role);
create index if not exists idx_users_status on users(status);
create index if not exists idx_users_role_approval_status on users(role_approval_status);

create index if not exists idx_onboarding_progress_user_id on onboarding_progress(user_id);

create index if not exists idx_audit_logs_user_id on audit_logs(user_id);
create index if not exists idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);

create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_assigned_to on tasks(assigned_to);
create index if not exists idx_tasks_created_by on tasks(created_by);
create index if not exists idx_tasks_unit_id on tasks(unit_id);
create index if not exists idx_tasks_due_at on tasks(due_at);

create index if not exists idx_requests_status on requests(status);
create index if not exists idx_requests_requested_by on requests(requested_by);
create index if not exists idx_requests_assigned_to on requests(assigned_to);
create index if not exists idx_requests_unit_id on requests(unit_id);

create index if not exists idx_comments_entity on comments(entity_type, entity_id);
create index if not exists idx_comments_user_id on comments(user_id);

create index if not exists idx_approvals_entity on approvals(entity_type, entity_id);
create index if not exists idx_approvals_status on approvals(status);
create index if not exists idx_approvals_approver_id on approvals(approver_id);

create index if not exists idx_forum_posts_author_id on forum_posts(author_id);
create index if not exists idx_forum_posts_unit_id on forum_posts(unit_id);
create index if not exists idx_forum_posts_created_at on forum_posts(created_at desc);

create index if not exists idx_feature_flags_key on feature_flags(key);
create index if not exists idx_feature_flags_is_enabled on feature_flags(is_enabled);
