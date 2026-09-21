-- "The Women's Health Reset" - a fixed 12-week programme (content lives in
-- the app, same pattern as the privacy policy - not a CMS table, since the
-- trainer edits wording through Claude, not through SQL). This migration
-- just adds the enrollment flag and the daily accountability tracker for
-- the 8 core habits from the programme's "Weekly Check-in" table.

-- One program per client; only the trainer enrolls/un-enrolls someone -
-- same protection as access_status/plan_type/package_type.
alter table public.clients add column lifestyle_reset_started_at date;

create or replace function public.prevent_client_self_privilege_escalation()
returns trigger as $$
begin
  if auth.uid() = old.id and auth.uid() <> old.trainer_id then
    if new.access_status is distinct from old.access_status
      or new.trainer_id is distinct from old.trainer_id
      or new.plan_type is distinct from old.plan_type
      or new.plan_started_at is distinct from old.plan_started_at
      or new.plan_expires_at is distinct from old.plan_expires_at
      or new.package_type is distinct from old.package_type
      or new.lifestyle_reset_started_at is distinct from old.lifestyle_reset_started_at
    then
      raise exception 'clients cannot modify their own access_status/trainer/plan fields';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Daily accountability: the 8 habits from the programme's own weekly
-- check-in table, one boolean per habit per day.
create table public.lifestyle_reset_daily_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  log_date date not null default current_date,
  morning_daylight boolean not null default false,
  breathing boolean not null default false,
  daily_movement boolean not null default false,
  protein_meals boolean not null default false,
  strength_training boolean not null default false,
  aerobic_exercise boolean not null default false,
  consistent_sleep boolean not null default false,
  evening_winddown boolean not null default false,
  created_at timestamptz not null default now(),
  unique (client_id, log_date)
);

create index lifestyle_reset_logs_client_date_idx on public.lifestyle_reset_daily_logs (client_id, log_date desc);

alter table public.lifestyle_reset_daily_logs enable row level security;

create policy "reset logs select own or trainer" on public.lifestyle_reset_daily_logs
  for select using (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = lifestyle_reset_daily_logs.client_id and c.trainer_id = auth.uid())
  );
create policy "reset logs insert own" on public.lifestyle_reset_daily_logs
  for insert with check (client_id = auth.uid());
create policy "reset logs update own" on public.lifestyle_reset_daily_logs
  for update using (client_id = auth.uid());
