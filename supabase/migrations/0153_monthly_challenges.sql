-- Monthly challenges (GRIZZ, 2026-10-25): a trainer switches on one
-- challenge a month for all their clients (20 ready-made ones live in the app,
-- src/lib/challenges.ts). Clients tick off each day they did it and win by
-- reaching the target number of days. The app owner can add more challenges
-- and share them with every trainer to use if they wish.

-- The owner's own challenges. Trainers see them once shared.
create table public.challenge_library (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.trainers (id) on delete cascade,
  emoji text not null default '🏆' check (char_length(emoji) between 1 and 16),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  daily_task text not null check (char_length(btrim(daily_task)) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 500),
  target_days int not null default 20 check (target_days between 1 and 28),
  shared_at timestamptz,
  created_at timestamptz not null default now()
);

create index challenge_library_shared_idx on public.challenge_library (shared_at desc) where shared_at is not null;

alter table public.challenge_library enable row level security;

create policy "challenge library read owner or shared"
  on public.challenge_library for select to authenticated
  using ((select public.is_app_owner()) or (shared_at is not null and (select public.is_trainer(auth.uid()))));

create policy "challenge library owner insert"
  on public.challenge_library for insert to authenticated
  with check ((select public.is_app_owner()) and created_by = (select auth.uid()) and shared_at is null);

create policy "challenge library owner update"
  on public.challenge_library for update to authenticated
  using ((select public.is_app_owner()))
  with check ((select public.is_app_owner()));

create policy "challenge library owner remove"
  on public.challenge_library for delete to authenticated
  using ((select public.is_app_owner()));

revoke all on public.challenge_library from anon, authenticated;
grant select, insert, delete on public.challenge_library to authenticated;
-- Sharing goes through share_challenge() so every trainer is told.
grant update (emoji, title, daily_task, summary, target_days) on public.challenge_library to authenticated;

-- One challenge per trainer per month, copied in when the trainer picks it so
-- it never changes under the clients.
create table public.trainer_challenges (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null default auth.uid() references public.trainers (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  -- The built-in key or challenge_library id it came from.
  source text not null default '',
  emoji text not null default '🏆' check (char_length(emoji) between 1 and 16),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  daily_task text not null check (char_length(btrim(daily_task)) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 500),
  target_days int not null default 20 check (target_days between 1 and 28),
  -- When the clients were told (straight away for this month; on the 1st for a
  -- month picked ahead).
  announced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trainer_id, month)
);

alter table public.trainer_challenges enable row level security;

create policy "trainer challenges read own or my trainer's"
  on public.trainer_challenges for select to authenticated
  using (
    trainer_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = (select auth.uid()) and c.trainer_id = trainer_challenges.trainer_id)
  );

-- This month or later only; a finished month stays as it was.
create policy "trainer challenges insert own"
  on public.trainer_challenges for insert to authenticated
  with check (
    trainer_id = (select auth.uid())
    and (select public.is_trainer(auth.uid()))
    and month >= date_trunc('month', public.sa_today())::date
  );

create policy "trainer challenges remove own"
  on public.trainer_challenges for delete to authenticated
  using (trainer_id = (select auth.uid()) and month >= date_trunc('month', public.sa_today())::date);

revoke all on public.trainer_challenges from anon, authenticated;
grant select, insert, delete on public.trainer_challenges to authenticated;

-- The days a client did it.
create table public.challenge_days (
  challenge_id uuid not null references public.trainer_challenges (id) on delete cascade,
  client_id uuid not null default auth.uid() references public.clients (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (challenge_id, client_id, day)
);

create index challenge_days_client_idx on public.challenge_days (client_id, day desc);

alter table public.challenge_days enable row level security;

-- True when the caller is a client of the challenge's trainer and the day is
-- in the challenge's month, not in the future.
create or replace function public.can_tick_challenge_day(p_challenge uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trainer_challenges t
    join public.clients c on c.trainer_id = t.trainer_id
    where t.id = p_challenge
      and c.id = auth.uid()
      and c.archived_at is null
      and p_day >= t.month
      and p_day < (t.month + interval '1 month')::date
      and p_day <= public.sa_today()
  );
$$;

revoke execute on function public.can_tick_challenge_day(uuid, date) from public, anon;
grant execute on function public.can_tick_challenge_day(uuid, date) to authenticated;

create policy "challenge days read own or trainer"
  on public.challenge_days for select to authenticated
  using (
    client_id = (select auth.uid())
    or exists (select 1 from public.trainer_challenges t where t.id = challenge_days.challenge_id and t.trainer_id = (select auth.uid()))
  );

create policy "challenge days tick own"
  on public.challenge_days for insert to authenticated
  with check (client_id = (select auth.uid()) and public.can_tick_challenge_day(challenge_id, day));

create policy "challenge days untick own"
  on public.challenge_days for delete to authenticated
  using (client_id = (select auth.uid()) and public.can_tick_challenge_day(challenge_id, day));

revoke all on public.challenge_days from anon, authenticated;
grant select, insert, delete on public.challenge_days to authenticated;

-- Tells a trainer's clients about their challenge. Never the trainer's own
-- training row (0146), archived clients or ones whose plan has ended.
create or replace function public.announce_trainer_challenge(p_challenge uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.trainer_challenges;
  c record;
begin
  select * into v from public.trainer_challenges where id = p_challenge;
  if not found then
    return;
  end if;
  update public.trainer_challenges set announced_at = now() where id = p_challenge;
  for c in
    select cl.id from public.clients cl
    where cl.trainer_id = v.trainer_id and cl.id <> cl.trainer_id
      and cl.archived_at is null and cl.access_status <> 'expired'
  loop
    perform public.push_to_user(
      c.id,
      '🏆 New challenge: ' || v.title,
      v.daily_task || '. Do it on ' || v.target_days || ' days this month to win. Tick it off on the Habits tab.',
      jsonb_build_object('type', 'challenge_started', 'challengeId', v.id)
    );
  end loop;
exception when others then
  raise warning 'challenge announcement failed: %', sqlerrm;
end;
$$;

revoke execute on function public.announce_trainer_challenge(uuid) from public, anon, authenticated;

create or replace function public.trainer_challenge_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.month <= public.sa_today() then
    perform public.announce_trainer_challenge(new.id);
  end if;
  return new;
end;
$$;

revoke execute on function public.trainer_challenge_added() from public, anon, authenticated;

create trigger trainer_challenges_announce
  after insert on public.trainer_challenges
  for each row execute function public.trainer_challenge_added();

-- On the 1st, tell clients about challenges their trainer picked ahead.
create or replace function public.announce_monthly_challenges()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id from public.trainer_challenges
    where month = date_trunc('month', public.sa_today())::date and announced_at is null
  loop
    perform public.announce_trainer_challenge(r.id);
  end loop;
end;
$$;

revoke execute on function public.announce_monthly_challenges() from public, anon, authenticated;

select cron.unschedule('monthly-challenges')
where exists (select 1 from cron.job where jobname = 'monthly-challenges');
-- 05:00 UTC on the 1st is 07:00 in South Africa.
select cron.schedule('monthly-challenges', '0 5 1 * *', $$select public.announce_monthly_challenges();$$);

-- Tells the trainer when a client reaches the target, so they can congratulate
-- them personally.
create or replace function public.challenge_day_ticked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.trainer_challenges;
  v_done int;
  v_name text;
begin
  select * into v from public.trainer_challenges where id = new.challenge_id;
  select count(*) into v_done from public.challenge_days where challenge_id = new.challenge_id and client_id = new.client_id;
  if v_done = v.target_days then
    select name into v_name from public.clients where id = new.client_id;
    perform public.push_to_user(
      v.trainer_id,
      '🏆 ' || coalesce(split_part(v_name, ' ', 1), 'A client') || ' finished the challenge',
      v.title || ': ' || v_done || ' days done. Send them a well done!',
      jsonb_build_object('type', 'challenge_done', 'clientId', new.client_id, 'challengeId', v.id)
    );
  end if;
  return new;
exception when others then
  raise warning 'challenge win notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.challenge_day_ticked() from public, anon, authenticated;

create trigger challenge_days_ticked
  after insert on public.challenge_days
  for each row execute function public.challenge_day_ticked();

-- The owner shares one of their challenges with every trainer, who gets a
-- notification. Sharing again does nothing.
create or replace function public.share_challenge(p_id uuid)
returns public.challenge_library
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.challenge_library;
  t record;
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this';
  end if;
  select * into v from public.challenge_library where id = p_id;
  if not found then
    raise exception 'Challenge not found';
  end if;
  if v.shared_at is not null then
    return v;
  end if;
  update public.challenge_library set shared_at = now() where id = p_id returning * into v;
  for t in select tr.id from public.trainers tr where tr.approved and tr.id <> auth.uid() loop
    perform public.push_to_user(
      t.id,
      '🏆 New challenge to use: ' || v.title,
      'Use it for your clients any month you like. Menu > Monthly challenges.',
      jsonb_build_object('type', 'challenge_shared', 'challengeId', v.id)
    );
  end loop;
  return v;
end;
$$;

revoke execute on function public.share_challenge(uuid) from public, anon;
grant execute on function public.share_challenge(uuid) to authenticated;
