-- 043_notifications_weekend.sql
--
-- Weekend hold (company commander, 06.11.2026): from Friday 17:00 to
-- Saturday 19:00 (Jerusalem) nothing reaches a phone. Notifications are
-- still written — reminders by the tick (042) and those from someone's
-- action (039) — and show in the bell at once; their push waits for
-- Saturday 19:00, when the tick releases them. This holds for every kind,
-- including the 1-hour and 5-minute reminders that skip the nightly quiet
-- hours. Run manually — SANDBOX first, then LIVE. Needs 039 and 042.
-- Idempotent.
--
-- The time is a parameter (default now()) so the sandbox can test any hour.
-- The one-argument version is dropped first: keeping both would make
-- notification_push_after(kind) ambiguous for notify_user().

drop function if exists public.notification_push_after(text);

create or replace function public.notification_push_after(p_kind text, p_at timestamptz default now())
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Jerusalem';
  v_dow int := extract(dow from v_local)::int;  -- 5 = Friday, 6 = Saturday
  v_hour int := extract(hour from v_local)::int;
begin
  -- Weekend: Friday 17:00 until Saturday 19:00, for every kind.
  if (v_dow = 5 and v_local::time >= time '17:00') or (v_dow = 6 and v_local::time < time '19:00') then
    return ((v_local::date + case when v_dow = 5 then 1 else 0 end) + time '19:00') at time zone 'Asia/Jerusalem';
  end if;
  -- Nightly quiet hours: 23:00–06:00, except the 1-hour and 5-minute reminders.
  if v_hour between 6 and 22 or p_kind in ('event_soon', 'task_soon') then
    return p_at;
  end if;
  return ((v_local::date + case when v_hour >= 23 then 1 else 0 end) + time '06:00') at time zone 'Asia/Jerusalem';
end;
$$;
