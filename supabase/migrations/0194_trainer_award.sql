-- Trainer of the Half-Year (GRIZZ spec, 2026-11-08).
--
-- A cash award for the trainer who grows and keeps the most real clients and
-- gets them the best results. Merit only, never a draw (CPA s36). Everything
-- sits behind award_settings.enabled, which starts OFF: while it is off no
-- trainer or client sees anything, nothing is tracked and the daily job does
-- nothing. Every number (weights, caps, red-flag limits, period dates, prize)
-- and every message is a setting the owner changes in the app, not code.
--
-- Pieces:
--   award_settings          one row: the switch, numbers and wording
--   clients.*               face photo + consent, goal direction, suspicious flag
--   client_body_stats.entered_by   who typed each weigh-in (workout_logs.logged_by already exists, 0134)
--   app_opens               one row per person, day and phone (only while on)
--   award_periods           each half-year, its winner and the live reveal
--   award_scores            daily scores, monthly and final snapshots (owner only)
--   award_proofs            red flags and the client's proof video
--   award_trainer_flags     trainers whose clients keep failing proofs
--   award_trainer_messages  the monthly top-25% yes/no message and tip
--   award_daily()           the daily job (cron 02:30 SA)
--
-- Faces are compared by a person, never by automatic face recognition (POPIA
-- biometric rules). Only the client, their trainer and the owner can open a face photo.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table if not exists public.award_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default false,
  enabled_at timestamptz,
  -- Prizes grow with the number of trainers on the app (GRIZZ, 2026-11-08):
  -- each tier is {"trainers": N, "places": [1st, 2nd, ...]}, in prize_currency.
  -- The tier for a period is the highest one reached when the period ends.
  prize_currency text not null default 'USD',
  prize_tiers jsonb not null default '[
    {"trainers": 250, "places": [500]},
    {"trainers": 500, "places": [1000]},
    {"trainers": 1000, "places": [1500, 500]},
    {"trainers": 2000, "places": [2000, 1000, 500]},
    {"trainers": 3000, "places": [2500, 1000, 800, 500, 300]}
  ]'::jsonb,
  prize_text text,
  -- With no start date, the first period starts on the 1st of the month after
  -- the app reaches this many trainers (GRIZZ: 250).
  start_at_trainers integer not null default 250 check (start_at_trainers >= 0),
  -- The owner's trainer counter goals.
  trainer_goals integer[] not null default array[1000, 5000],
  first_period_start date,
  period_months integer not null default 6 check (period_months between 1 and 24),
  cooldown_months integer not null default 12 check (cooldown_months between 0 and 60),
  min_verified_clients integer not null default 10 check (min_verified_clients >= 0),
  -- Score out of 100: growth half (sign-ups that stay + retention) and progress half.
  signup_weight numeric not null default 30 check (signup_weight >= 0),
  retention_weight numeric not null default 20 check (retention_weight >= 0),
  progress_weight numeric not null default 50 check (progress_weight >= 0),
  signup_stay_days integer not null default 90 check (signup_stay_days between 1 and 365),
  -- A client's progress score.
  strength_weight numeric not null default 40 check (strength_weight >= 0),
  bodyweight_weight numeric not null default 30 check (bodyweight_weight >= 0),
  measurement_weight numeric not null default 30 check (measurement_weight >= 0),
  -- Most a change can count for, per month (%). Reaching the cap = full marks.
  cap_strength_pct numeric not null default 10 check (cap_strength_pct > 0),
  cap_weight_pct numeric not null default 4 check (cap_weight_pct > 0),
  cap_measure_pct numeric not null default 5 check (cap_measure_pct > 0),
  -- Red flags.
  flag_lift_pct numeric not null default 20 check (flag_lift_pct > 0),
  flag_weight_kg_week numeric not null default 1.5 check (flag_weight_kg_week > 0),
  flag_waist_cm numeric not null default 10 check (flag_waist_cm > 0),
  flag_jump_pct numeric not null default 15 check (flag_jump_pct > 0),
  flag_jump_gap_days integer not null default 14 check (flag_jump_gap_days > 0),
  proof_days integer not null default 7 check (proof_days between 1 and 60),
  trainer_review_after integer not null default 3 check (trainer_review_after >= 1),
  -- Verified clients.
  min_interactions integer not null default 2 check (min_interactions >= 0),
  -- What trainers see.
  top_percent integer not null default 25 check (top_percent between 1 and 100),
  rules_published boolean not null default true,
  rules_text text not null default
    'Trainer of the Half-Year is a cash award for the trainer who grows and keeps the most real clients and gets them the best results. '
    || 'The winner is chosen by the scoring below, never by a draw.' || chr(10) || chr(10)
    || 'The award starts once 250 trainers are on the app. The prize grows as more trainers join, and from 1 000 trainers more places win a prize. Trainers in South Africa are paid the same prize in rand. '
    || 'Two award periods a year. To win you need at least 10 verified clients on the last day of the period, '
    || 'and you can''t win again for 12 months after winning any prize place (the award then goes to the highest-scoring trainer who can win).' || chr(10) || chr(10)
    || 'Your score out of 100: 30% new sign-ups who are still with you 90 days after joining, 20% client retention, '
    || '50% the average progress of your verified clients (strength 40%, body weight 30%, measurements 30%, in the direction of each client''s goal). '
    || 'Ties go to higher retention, then higher average progress.' || chr(10) || chr(10)
    || 'Only verified clients count: they have a face photo, use the app themselves, and you respond to them at least twice a month. '
    || 'Progress must be entered by the client. Changes are capped each month, and unusual progress needs a short proof video from the client.' || chr(10) || chr(10)
    || 'Scores are private. On the 1st of each month you''ll hear whether you''re in the top 25%, with one tip. There is no update in the last month, '
    || 'and the winner is revealed live in the app at the end of the period.',
  message_top text not null default 'You''re in the top 25% for Trainer of the Half-Year. Keep it up!',
  message_not_top text not null default 'You''re not in the top 25% for Trainer of the Half-Year yet.',
  tip_signups text not null default 'Your client progress and retention are strong. Focus on bringing in new clients who stay.',
  tip_retention text not null default 'Your client progress is strong. Focus on retention: check in personally with clients who have gone quiet.',
  tip_progress text not null default 'You''re growing and keeping clients well. Focus on client progress: make sure they log their own workouts, weigh-ins and measurements.',
  stream_url text,
  updated_at timestamptz not null default now()
);

insert into public.award_settings (id) values (1) on conflict (id) do nothing;

alter table public.award_settings enable row level security;

-- Everyone signed in can read it (the switch and the published rules).
create policy "award settings readable" on public.award_settings
  for select to authenticated using (true);
create policy "owner changes award settings" on public.award_settings
  for update to authenticated
  using ((select public.is_app_owner()))
  with check ((select public.is_app_owner()));

create or replace function public.award_settings_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.enabled and not old.enabled then
    new.enabled_at := now();
  end if;
  return new;
end;
$$;

create or replace trigger award_settings_touch
  before update on public.award_settings
  for each row execute function public.award_settings_touch();

create or replace function public.award_is_on()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.award_settings where id = 1), false);
$$;

-- The sign-up screen asks before anyone is logged in.
create or replace function public.award_signup_needs()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.award_is_on();
$$;
grant execute on function public.award_signup_needs() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Client columns
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists face_photo_path text,
  add column if not exists face_photo_consent_at timestamptz,
  add column if not exists goal_direction text check (goal_direction is null or goal_direction in ('lose_fat', 'build_muscle', 'maintain')),
  add column if not exists award_flag text check (award_flag is null or award_flag in ('suspicious', 'approved', 'rejected')),
  add column if not exists award_flag_reason text,
  add column if not exists award_flag_at timestamptz;

-- Only the client sets their own face photo and goal; only the owner (or the
-- daily job) sets the suspicious flag.
create or replace function public.guard_award_client_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if auth.uid() is distinct from new.id then
    new.face_photo_path := old.face_photo_path;
    new.face_photo_consent_at := old.face_photo_consent_at;
    new.goal_direction := old.goal_direction;
  end if;
  if not public.is_app_owner() then
    new.award_flag := old.award_flag;
    new.award_flag_reason := old.award_flag_reason;
    new.award_flag_at := old.award_flag_at;
  end if;
  return new;
end;
$$;

create or replace trigger guard_award_client_columns
  before update on public.clients
  for each row execute function public.guard_award_client_columns();

create or replace function public.set_award_profile(p_face_path text, p_goal text, p_consent boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_face_path is not null and split_part(p_face_path, '/', 1) <> auth.uid()::text then
    raise exception 'That photo is not yours.';
  end if;
  if p_face_path is not null and not coalesce(p_consent, false) then
    raise exception 'Tick the box to agree to how your photo is used.';
  end if;
  update public.clients
  set face_photo_path = coalesce(p_face_path, face_photo_path),
      face_photo_consent_at = case when p_face_path is not null then now() else face_photo_consent_at end,
      goal_direction = coalesce(p_goal, goal_direction)
  where id = auth.uid();
end;
$$;
grant execute on function public.set_award_profile(text, text, boolean) to authenticated;

-- Who typed each weigh-in and measurement (client or trainer).
alter table public.client_body_stats
  add column if not exists entered_by uuid default auth.uid();

-- ---------------------------------------------------------------------------
-- Logins and phones (only while the award is on)
-- ---------------------------------------------------------------------------
create table if not exists public.app_opens (
  user_id uuid not null,
  opened_on date not null default public.sa_today(),
  device_id text not null,
  platform text,
  primary key (user_id, opened_on, device_id)
);
alter table public.app_opens enable row level security;
-- No direct access: written by record_app_open, read by the owner's checks.

create or replace function public.record_app_open(p_device text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.award_is_on() or coalesce(p_device, '') = '' then
    return;
  end if;
  insert into public.app_opens (user_id, opened_on, device_id, platform)
  values (auth.uid(), public.sa_today(), left(p_device, 80), left(p_platform, 20))
  on conflict do nothing;
end;
$$;
grant execute on function public.record_app_open(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Periods, scores, proofs, flags, messages
-- ---------------------------------------------------------------------------
create table if not exists public.award_periods (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null unique,
  ends_on date not null,
  prize_text text,
  winner_id uuid,
  winner_score numeric,
  closed_at timestamptz,
  revealed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.award_periods enable row level security;
create policy "owner reads award periods" on public.award_periods
  for select to authenticated using ((select public.is_app_owner()));

-- Everyone who placed in a period (1st, 2nd, ...) and their prize.
create table if not exists public.award_winners (
  period_id uuid not null,
  place integer not null check (place >= 1),
  trainer_id uuid not null,
  score numeric,
  prize numeric,
  -- What they're paid: in rand for South African trainers.
  prize_paid text,
  primary key (period_id, place)
);
alter table public.award_winners enable row level security;
create policy "owner reads award winners" on public.award_winners
  for select to authenticated using ((select public.is_app_owner()));

create table if not exists public.award_scores (
  period_id uuid not null,
  trainer_id uuid not null,
  score_date date not null,
  kind text not null check (kind in ('daily', 'monthly', 'final')),
  total numeric not null default 0,
  signups integer not null default 0,
  signup_score numeric not null default 0,
  retention numeric not null default 0,
  progress numeric not null default 0,
  verified_clients integer not null default 0,
  eligible boolean not null default false,
  in_cooldown boolean not null default false,
  rank integer,
  created_at timestamptz not null default now(),
  primary key (period_id, trainer_id, kind, score_date)
);
alter table public.award_scores enable row level security;
create policy "owner reads award scores" on public.award_scores
  for select to authenticated using ((select public.is_app_owner()));

create table if not exists public.award_proofs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  trainer_id uuid not null,
  kind text not null check (kind in ('lift', 'jump', 'weight', 'measurements')),
  source_table text not null check (source_table in ('workout_logs', 'client_body_stats')),
  source_id uuid not null,
  detail text not null,
  flagged_on date not null default public.sa_today(),
  due_on date not null,
  status text not null default 'requested' check (status in ('requested', 'uploaded', 'approved', 'rejected', 'expired')),
  video_path text,
  uploaded_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_table, source_id, kind)
);
create index if not exists award_proofs_client on public.award_proofs (client_id, status);
alter table public.award_proofs enable row level security;
create policy "client reads own award proofs" on public.award_proofs
  for select to authenticated using (client_id = (select auth.uid()) or (select public.is_app_owner()));

create table if not exists public.award_trainer_flags (
  trainer_id uuid primary key,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'cleared')),
  flagged_at timestamptz not null default now(),
  cleared_at timestamptz
);
alter table public.award_trainer_flags enable row level security;
create policy "owner reads award trainer flags" on public.award_trainer_flags
  for select to authenticated using ((select public.is_app_owner()));

create table if not exists public.award_trainer_messages (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null,
  sent_on date not null,
  kind text not null check (kind in ('top', 'not_top', 'cooldown')),
  body text not null,
  tip text,
  created_at timestamptz not null default now(),
  unique (trainer_id, sent_on)
);
alter table public.award_trainer_messages enable row level security;
create policy "trainer reads own award messages" on public.award_trainer_messages
  for select to authenticated using (trainer_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: face photos and proof videos (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('award-faces', 'award-faces', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('award-proofs', 'award-proofs', false, 52428800, array['video/*'])
on conflict (id) do nothing;

create policy "client uploads own award files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('award-faces', 'award-proofs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "award files readable by client trainer owner" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('award-faces', 'award-proofs')
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_app_owner())
      or (
        bucket_id = 'award-faces'
        and exists (
          select 1 from public.clients c
          where c.id::text = (storage.foldername(name))[1]
            and c.trainer_id = (select auth.uid())
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Scoring helpers
-- ---------------------------------------------------------------------------

-- Estimated one-rep max, so heavier-for-fewer and lighter-for-more compare fairly.
create or replace function public.award_e1rm(p_weight numeric, p_reps integer)
returns numeric
language sql
immutable
as $$
  select case when coalesce(p_weight, 0) <= 0 or coalesce(p_reps, 0) <= 0 then null
              else p_weight * (1 + least(p_reps, 30) / 30.0) end;
$$;

-- An entry counts unless it has a red flag that isn't approved yet.
create or replace function public.award_entry_counts(p_table text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.award_proofs p
    where p.source_table = p_table and p.source_id = p_id and p.status <> 'approved'
  );
$$;

-- Days on which the client did something themselves.
create or replace function public.award_client_action_days(p_client uuid, p_from date, p_to date)
returns setof date
language sql
stable
security definer
set search_path = public
as $$
  select distinct d from (
    select w.log_date as d from public.workout_logs w
      where w.client_id = p_client and w.logged_by = p_client and w.import_id is null and w.log_date between p_from and p_to
    union all
    select b.measured_on from public.client_body_stats b
      where b.client_id = p_client and b.entered_by = p_client and b.import_id is null and b.measured_on between p_from and p_to
    union all
    select c.checkin_date from public.checkins c
      where c.client_id = p_client and c.checkin_date between p_from and p_to
    union all
    select (v.uploaded_at at time zone 'Africa/Johannesburg')::date from public.videos v
      where v.client_id = p_client and (v.uploaded_at at time zone 'Africa/Johannesburg')::date between p_from and p_to
    union all
    select t.ate_on from public.client_meal_ticks t
      where t.client_id = p_client and t.ate_on between p_from and p_to
    union all
    select l.log_date from public.habit_logs l join public.habits h on h.id = l.habit_id
      where h.client_id = p_client and l.log_date between p_from and p_to
  ) x;
$$;

-- Two-way interactions: a trainer response (message, watched form video,
-- programme given or changed, video call) within 7 days after a client action.
create or replace function public.award_interactions(p_client uuid, p_trainer uuid, p_from date, p_to date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with acts as (
    select d from public.award_client_action_days(p_client, p_from - 7, p_to) d
  ),
  responses as (
    select (m.created_at at time zone 'Africa/Johannesburg')::date as d from public.coach_messages m
      where m.client_id = p_client and m.trainer_id = p_trainer
        and (m.created_at at time zone 'Africa/Johannesburg')::date between p_from and p_to
    union all
    select (v.viewed_at at time zone 'Africa/Johannesburg')::date from public.videos v
      where v.client_id = p_client and v.viewed_at is not null
        and (v.viewed_at at time zone 'Africa/Johannesburg')::date between p_from and p_to
    union all
    select (cp.assigned_at at time zone 'Africa/Johannesburg')::date from public.client_programs cp
      where cp.client_id = p_client and cp.assigned_at is not null
        and (cp.assigned_at at time zone 'Africa/Johannesburg')::date between p_from and p_to
    union all
    select (vc.starts_at at time zone 'Africa/Johannesburg')::date from public.video_checkins vc
      where vc.client_id = p_client and vc.trainer_id = p_trainer and coalesce(vc.status, '') not in ('cancelled')
        and (vc.starts_at at time zone 'Africa/Johannesburg')::date between p_from and least(p_to, public.sa_today())
  )
  select count(*)::integer from responses r
  where exists (select 1 from acts a where a.d between r.d - 7 and r.d);
$$;

-- A verified client on a day: face photo, not flagged, and at least the
-- minimum two-way interactions in the 30 days up to that day.
create or replace function public.award_client_verified(p_client uuid, p_on date)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  need integer;
begin
  select id, trainer_id, face_photo_path, award_flag into c from public.clients where id = p_client;
  if c.id is null or c.face_photo_path is null or coalesce(c.award_flag, '') in ('suspicious', 'rejected') or c.id = c.trainer_id then
    return false;
  end if;
  select min_interactions into need from public.award_settings where id = 1;
  if not exists (select 1 from public.award_client_action_days(p_client, p_on - 29, p_on)) then
    return false;
  end if;
  return public.award_interactions(p_client, c.trainer_id, p_on - 29, p_on) >= coalesce(need, 2);
end;
$$;

-- How well one change did, 0-100. good_pct: the change in the right
-- direction; cap: the most it can count for over the time.
create or replace function public.award_part_score(p_good_pct numeric, p_cap numeric)
returns numeric
language sql
immutable
as $$
  select greatest(0, least(100, 100 * least(p_good_pct, p_cap) / nullif(p_cap, 0)));
$$;

-- Staying the same: full marks at no change, nothing at the cap or beyond.
create or replace function public.award_steady_score(p_pct numeric, p_cap numeric)
returns numeric
language sql
immutable
as $$
  select greatest(0, least(100, 100 - 100 * abs(p_pct) / nullif(p_cap, 0)));
$$;

-- One client's progress score (0-100) over a period, from their own entries.
create or replace function public.award_client_progress(p_client uuid, p_from date, p_to date)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.award_settings;
  goal text;
  months numeric;
  strength numeric;
  bodyweight numeric;
  measure numeric;
  first_b record;
  last_b record;
  parts numeric[];
  m record;
  pct numeric;
  w_sum numeric := 0;
  total numeric := 0;
begin
  select * into s from public.award_settings where id = 1;
  select goal_direction into goal from public.clients where id = p_client;
  months := greatest(1, (least(p_to, public.sa_today()) - p_from + 1) / 30.4);

  -- Strength: best estimated max in the first and last 4 weeks of the client's
  -- own logging in the period, on their 3 most-logged lifts.
  with sets as (
    select w.exercise_name as ex, w.log_date as d, public.award_e1rm(w.weight_kg, w.reps) as e
    from public.workout_logs w
    where w.client_id = p_client and w.logged_by = p_client and w.import_id is null
      and not coalesce(w.warm_up, false) and not coalesce(w.gauge, false)
      and w.log_date between p_from and p_to
      and public.award_entry_counts('workout_logs', w.id)
  ),
  per_ex as (
    select ex, min(d) as first_d, max(d) as last_d, count(*) as n from sets where e is not null group by ex
  ),
  key_lifts as (
    select * from per_ex where last_d - first_d >= 28 order by n desc limit 3
  ),
  changes as (
    select k.ex,
      (select max(e) from sets x where x.ex = k.ex and x.d <= k.first_d + 27) as start_e,
      (select max(e) from sets x where x.ex = k.ex and x.d >= k.last_d - 27) as end_e
    from key_lifts k
  )
  select avg(public.award_part_score((end_e - start_e) / nullif(start_e, 0) * 100, s.cap_strength_pct * months))
  into strength from changes where start_e > 0;

  if goal is not null then
    -- Body weight: first and last weigh-in at least 2 weeks apart.
    select b.measured_on, b.weight_kg into first_b from public.client_body_stats b
      where b.client_id = p_client and b.entered_by = p_client and b.import_id is null and b.weight_kg > 0
        and b.measured_on between p_from and p_to and public.award_entry_counts('client_body_stats', b.id)
      order by b.measured_on asc, b.created_at asc limit 1;
    select b.measured_on, b.weight_kg into last_b from public.client_body_stats b
      where b.client_id = p_client and b.entered_by = p_client and b.import_id is null and b.weight_kg > 0
        and b.measured_on between p_from and p_to and public.award_entry_counts('client_body_stats', b.id)
      order by b.measured_on desc, b.created_at desc limit 1;
    if first_b.measured_on is not null and last_b.measured_on - first_b.measured_on >= 14 then
      pct := (last_b.weight_kg - first_b.weight_kg) / first_b.weight_kg * 100;
      bodyweight := case goal
        when 'lose_fat' then public.award_part_score(-pct, s.cap_weight_pct * months)
        when 'build_muscle' then public.award_part_score(pct, s.cap_weight_pct * months)
        else public.award_steady_score(pct, s.cap_weight_pct * months)
      end;
    end if;

    -- Measurements: each one the client logged at the start and end. Losing
    -- fat: smaller is better. Building muscle: chest, arms and thighs bigger,
    -- waist and hips steady. Maintaining: everything steady.
    parts := array[]::numeric[];
    for m in
      select key, first_v, last_v from (
        select k.key,
          (select v from (
             select b.measured_on, case k.key when 'waist' then b.waist_cm when 'hips' then b.hips_cm when 'chest' then b.chest_cm when 'arm' then b.arm_cm else b.thigh_cm end as v
             from public.client_body_stats b
             where b.client_id = p_client and b.entered_by = p_client and b.import_id is null
               and b.measured_on between p_from and p_to and public.award_entry_counts('client_body_stats', b.id)
           ) q where v > 0 order by measured_on asc limit 1) as first_v,
          (select v from (
             select b.measured_on, case k.key when 'waist' then b.waist_cm when 'hips' then b.hips_cm when 'chest' then b.chest_cm when 'arm' then b.arm_cm else b.thigh_cm end as v
             from public.client_body_stats b
             where b.client_id = p_client and b.entered_by = p_client and b.import_id is null
               and b.measured_on between p_from and p_to and public.award_entry_counts('client_body_stats', b.id)
           ) q where v > 0 order by measured_on desc limit 1) as last_v,
          (select max(b.measured_on) - min(b.measured_on) from public.client_body_stats b
             where b.client_id = p_client and b.entered_by = p_client and b.import_id is null
               and b.measured_on between p_from and p_to) as span
        from unnest(array['waist', 'hips', 'chest', 'arm', 'thigh']) as k(key)
      ) z where first_v > 0 and last_v > 0 and span >= 14
    loop
      pct := (m.last_v - m.first_v) / m.first_v * 100;
      parts := parts || case
        when goal = 'lose_fat' then public.award_part_score(-pct, s.cap_measure_pct * months)
        when goal = 'build_muscle' and m.key in ('chest', 'arm', 'thigh') then public.award_part_score(pct, s.cap_measure_pct * months)
        else public.award_steady_score(pct, s.cap_measure_pct * months)
      end;
    end loop;
    if array_length(parts, 1) > 0 then
      select avg(x) into measure from unnest(parts) x;
    end if;
  end if;

  -- Weighted, using only the parts the client has data for.
  if strength is not null then w_sum := w_sum + s.strength_weight; total := total + s.strength_weight * strength; end if;
  if bodyweight is not null then w_sum := w_sum + s.bodyweight_weight; total := total + s.bodyweight_weight * bodyweight; end if;
  if measure is not null then w_sum := w_sum + s.measurement_weight; total := total + s.measurement_weight * measure; end if;
  if w_sum = 0 then
    return 0;
  end if;
  return round(total / w_sum, 1);
end;
$$;

-- When a client joined their trainer.
create or replace function public.award_joined_on(p_plan_started date, p_created timestamptz)
returns date
language sql
immutable
as $$
  select coalesce(p_plan_started, (p_created at time zone 'Africa/Johannesburg')::date);
$$;

-- Score every trainer for a period, as of a day, and save it.
create or replace function public.award_score_period(p_period uuid, p_as_of date, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.award_settings;
  p public.award_periods;
  t record;
  v_verified integer;
  v_signups integer;
  v_base integer;
  v_kept integer;
  v_progress numeric;
  v_cooldown boolean;
  max_signups integer;
  w_total numeric;
begin
  select * into s from public.award_settings where id = 1;
  select * into p from public.award_periods where id = p_period;
  if p.id is null then
    return;
  end if;
  w_total := nullif(s.signup_weight + s.retention_weight + s.progress_weight, 0);

  for t in
    select tr.id from public.trainers tr where tr.approved and not tr.is_owner
  loop
    -- Verified clients today.
    select count(*) into v_verified
    from public.clients c
    where c.trainer_id = t.id and c.id <> t.id and c.archived_at is null and c.access_status <> 'expired'
      and public.award_client_verified(c.id, p_as_of);

    -- New sign-ups whose 90-day mark falls in this period, still with the trainer then.
    select count(*) into v_signups
    from public.clients c
    where c.trainer_id = t.id and c.id <> t.id
      and public.award_joined_on(c.plan_started_at, c.created_at) + s.signup_stay_days between p.starts_on and p_as_of
      and (c.archived_at is null or (c.archived_at at time zone 'Africa/Johannesburg')::date > public.award_joined_on(c.plan_started_at, c.created_at) + s.signup_stay_days)
      and public.award_client_verified(c.id, public.award_joined_on(c.plan_started_at, c.created_at) + s.signup_stay_days);

    -- Retention: verified clients at the start still active now.
    select count(*), count(*) filter (
             where (c.archived_at is null or (c.archived_at at time zone 'Africa/Johannesburg')::date > p_as_of)
               and c.access_status <> 'expired')
    into v_base, v_kept
    from public.clients c
    where c.trainer_id = t.id and c.id <> t.id
      and public.award_joined_on(c.plan_started_at, c.created_at) < p.starts_on
      and (c.archived_at is null or (c.archived_at at time zone 'Africa/Johannesburg')::date >= p.starts_on)
      and public.award_client_verified(c.id, p.starts_on);

    -- Average progress of today's verified clients.
    select coalesce(avg(public.award_client_progress(c.id, p.starts_on, p_as_of)), 0) into v_progress
    from public.clients c
    where c.trainer_id = t.id and c.id <> t.id and c.archived_at is null and c.access_status <> 'expired'
      and public.award_client_verified(c.id, p_as_of);

    -- A winner sits out until 12 months after the end of the period they won.
    -- (every prize place counts as a win).
    select exists (
      select 1 from public.award_winners aw join public.award_periods w on w.id = aw.period_id
      where aw.trainer_id = t.id and w.id <> p.id and w.ends_on < p.ends_on
        and (w.ends_on + make_interval(months => s.cooldown_months))::date >= p.ends_on
    ) into v_cooldown;

    insert into public.award_scores (period_id, trainer_id, score_date, kind, signups, retention, progress, verified_clients, eligible, in_cooldown)
    values (p.id, t.id, p_as_of, p_kind, v_signups,
            case when v_base > 0 then round(100.0 * v_kept / v_base, 1) else 0 end,
            round(v_progress, 1), v_verified,
            v_verified >= s.min_verified_clients and not v_cooldown, v_cooldown)
    on conflict (period_id, trainer_id, kind, score_date) do update
      set signups = excluded.signups, retention = excluded.retention, progress = excluded.progress,
          verified_clients = excluded.verified_clients, eligible = excluded.eligible,
          in_cooldown = excluded.in_cooldown, created_at = now();
  end loop;

  -- Sign-ups are scaled 0-100 against the highest trainer, then the total and rank.
  select max(signups) into max_signups from public.award_scores
  where period_id = p.id and score_date = p_as_of and kind = p_kind;

  update public.award_scores sc
  set signup_score = case when coalesce(max_signups, 0) > 0 then round(100.0 * sc.signups / max_signups, 1) else 0 end
  where sc.period_id = p.id and sc.score_date = p_as_of and sc.kind = p_kind;

  update public.award_scores sc
  set total = coalesce(round((s.signup_weight * sc.signup_score + s.retention_weight * sc.retention + s.progress_weight * sc.progress) / w_total, 1), 0)
  where sc.period_id = p.id and sc.score_date = p_as_of and sc.kind = p_kind;

  update public.award_scores sc
  set rank = r.rn
  from (
    select trainer_id, row_number() over (order by total desc, retention desc, progress desc) as rn
    from public.award_scores
    where period_id = p.id and score_date = p_as_of and kind = p_kind
  ) r
  where sc.period_id = p.id and sc.score_date = p_as_of and sc.kind = p_kind and sc.trainer_id = r.trainer_id;
end;
$$;
