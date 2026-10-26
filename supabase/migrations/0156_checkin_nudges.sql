-- "Check in on Nancy" (GRIZZ, 2026-10-25: "I'd prefer the trainer to get a
-- reminder to chat to the clients that hes hasn't been chatting to to make
-- them feel special. Instead of random messages."). A reminder to the trainer
-- only: nothing is ever sent to the client for them.
--
-- Chat happens on WhatsApp, which the app can't see, so a trainer counts as
-- in touch with a client when they:
--   * tap a WhatsApp button for them, or "Spoke in person" (client_contacts),
--   * send them a check-in note (coach_messages), or
--   * had a confirmed video check-in with them (0155).
-- Reused from the parked in-app chat work, with the chat parts left out.

create table public.client_contacts (
  client_id uuid primary key references public.clients (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  last_at timestamptz not null default now()
);

-- Read and written only through the functions below.
alter table public.client_contacts enable row level security;

-- The trainer tapped WhatsApp for this client, or "Spoke in person".
create or replace function public.mark_client_contact(p_client uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.client_contacts (client_id, trainer_id, last_at)
  select c.id, c.trainer_id, now()
  from public.clients c
  where c.id = p_client and c.trainer_id = auth.uid()
  on conflict (client_id) do update set trainer_id = excluded.trainer_id, last_at = excluded.last_at;
$$;

revoke execute on function public.mark_client_contact(uuid) from public, anon;
grant execute on function public.mark_client_contact(uuid) to authenticated;

-- Active clients the trainer last spoke to p_days or more days ago. A client
-- never spoken to counts from when they started (or came back), so a new
-- client shows up too.
create or replace function public.quiet_clients_for(p_trainer uuid, p_days integer default 4)
returns table (client_id uuid, name text, phone text, last_spoke_at timestamptz, days_quiet integer)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.name, q.phone, q.spoke, public.sa_today() - (q.since at time zone 'Africa/Johannesburg')::date
  from (
    select c.id, c.name, c.phone,
      greatest(tapped.last_at, coach.last_at, video.last_at) as spoke,
      coalesce(
        greatest(tapped.last_at, coach.last_at, video.last_at),
        greatest(c.returned_at, c.plan_started_at::timestamptz, c.created_at)
      ) as since
    from public.clients c
    left join public.client_contacts tapped on tapped.client_id = c.id and tapped.trainer_id = c.trainer_id
    left join lateral (
      select max(cm.created_at) as last_at from public.coach_messages cm
      where cm.client_id = c.id and cm.trainer_id = c.trainer_id
    ) coach on true
    left join lateral (
      select max(v.starts_at) as last_at from public.video_checkins v
      where v.client_id = c.id and v.trainer_id = c.trainer_id and v.status = 'confirmed' and v.starts_at <= now()
    ) video on true
    where c.trainer_id = p_trainer
      and c.id <> c.trainer_id
      and c.archived_at is null
      and c.access_status <> 'expired'
  ) q
  where public.sa_today() - (q.since at time zone 'Africa/Johannesburg')::date >= p_days
  order by q.since, q.name;
$$;

revoke execute on function public.quiet_clients_for(uuid, integer) from public, anon, authenticated;

-- The signed-in trainer's own quiet clients, for the Dashboard.
create or replace function public.quiet_clients()
returns table (client_id uuid, name text, phone text, last_spoke_at timestamptz, days_quiet integer)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.quiet_clients_for(auth.uid());
$$;

revoke execute on function public.quiet_clients() from public, anon;
grant execute on function public.quiet_clients() to authenticated;

-- 09:00 each morning: one notification per trainer naming who to check in on.
create or replace function public.checkin_nudges()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  first_name text;
  n integer;
  days integer;
begin
  for t in select tr.id from public.trainers tr where tr.approved loop
    select count(*) into n from public.quiet_clients_for(t.id) q;
    if n = 0 then
      continue;
    end if;
    -- The quietest client by name; the others are counted.
    select split_part(trim(q.name), ' ', 1), q.days_quiet into first_name, days
    from public.quiet_clients_for(t.id) q
    order by q.days_quiet desc, q.name
    limit 1;
    perform public.push_to_user(
      t.id,
      '💬 Check in on ' || first_name || case when n > 1 then ' and ' || (n - 1) || ' more' else '' end,
      'You haven''t spoken to ' || first_name || ' in ' || days || ' days. A quick personal message makes them feel special.',
      jsonb_build_object('type', 'checkin_nudge')
    );
  end loop;
end;
$$;

revoke execute on function public.checkin_nudges() from public, anon, authenticated;

-- 07:00 UTC is 09:00 in South Africa.
select cron.schedule('checkin-nudges-daily', '0 7 * * *', $$select public.checkin_nudges();$$);
