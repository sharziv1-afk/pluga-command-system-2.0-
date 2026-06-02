-- ============================================================
-- 003_events_schema.sql
-- Events / Schedule schema for pluga-command-system
-- ============================================================

do $$ begin
  create type event_status as enum (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type_enum as enum (
    'training',
    'logistics',
    'meeting',
    'inspection',
    'operation',
    'admin',
    'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  event_type          event_type_enum not null default 'other',
  starts_at           timestamptz not null,
  ends_at             timestamptz,
  location            text,
  unit_id             uuid references public.units(id) on delete set null,
  created_by          uuid references public.users(id) on delete set null,
  responsible_user_id uuid references public.users(id) on delete set null,
  status              event_status not null default 'scheduled',
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_events_starts_at
  on public.events(starts_at);

create index if not exists idx_events_unit_id
  on public.events(unit_id);

create index if not exists idx_events_created_by
  on public.events(created_by);

create index if not exists idx_events_responsible
  on public.events(responsible_user_id);

create index if not exists idx_events_status
  on public.events(status);

drop trigger if exists set_events_updated_at on public.events;

create trigger set_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
