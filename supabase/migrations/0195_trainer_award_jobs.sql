-- Trainer of the Half-Year, part 2 (see 0194): red flags, suspicious
-- clients, the daily job, monthly trainer messages, the live reveal and the
-- app's calls. Nothing runs or shows while award_settings.enabled is off.

-- ---------------------------------------------------------------------------
-- Trainer count and prize tiers (GRIZZ, 2026-11-08)
-- ---------------------------------------------------------------------------

-- Approved trainers on the app, not counting the owner.
create or replace function public.award_trainer_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.trainers where approved and not is_owner;
$$;
revoke execute on function public.award_trainer_count() from public, anon;

-- The prize places for a number of trainers: the highest tier reached.
create or replace function public.award_prize_places(p_trainers integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select t -> 'places' from public.award_settings s, jsonb_array_elements(s.prize_tiers) t
    where s.id = 1 and (t ->> 'trainers')::integer <= p_trainers
    order by (t ->> 'trainers')::integer desc limit 1
  ), '[]'::jsonb);
$$;

-- South African trainers get their prize in rand (GRIZZ, 2026-11-08): the
-- dollar amount at billing_settings.usd_zar_rate, rounded to the nearest R100.
create or replace function public.award_is_sa(p_trainer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select t.billing_currency = 'ZAR' or t.signup_country = 'ZA' from public.trainers t where t.id = p_trainer), false);
$$;

create or replace function public.award_local_prize(p_amount numeric, p_zar boolean)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_amount is null then null
    when p_zar and s.prize_currency = 'USD' then round(p_amount * coalesce((select b.usd_zar_rate from public.billing_settings b where b.id = 1), 18) / 100) * 100
    else p_amount
  end
  from public.award_settings s where s.id = 1;
$$;

create or replace function public.award_money(p_amount numeric, p_zar boolean)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when p_zar or s.prize_currency = 'ZAR' then 'R' when s.prize_currency = 'USD' then '$' else s.prize_currency || ' ' end
    || replace(trim(to_char(public.award_local_prize(p_amount, p_zar), 'FM999G999G990')), ',', ' ')
  from public.award_settings s where s.id = 1;
$$;

-- "1st $1 500, 2nd $500" (or in rand for South Africans).
create or replace function public.award_prize_words(p_places jsonb, p_zar boolean default false)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select string_agg(
    case o when 1 then '1st' when 2 then '2nd' when 3 then '3rd' else o || 'th' end || ' ' || public.award_money(v::numeric, p_zar),
    ', ' order by o)
  from jsonb_array_elements_text(p_places) with ordinality as x(v, o);
$$;

-- Owner: the trainer counter.
create or replace function public.award_trainer_counter()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.award_settings;
  n integer := public.award_trainer_count();
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this.';
  end if;
  select * into s from public.award_settings where id = 1;
  return jsonb_build_object(
    'count', n,
    'goals', to_jsonb(s.trainer_goals),
    'start_at', s.start_at_trainers,
    'first_start', s.first_period_start,
    'enabled', s.enabled,
    'prize_now', public.award_prize_words(public.award_prize_places(n)),
    'next_tier', (
      select jsonb_build_object('trainers', (t ->> 'trainers')::integer, 'prize', public.award_prize_words(t -> 'places'))
      from jsonb_array_elements(s.prize_tiers) t
      where (t ->> 'trainers')::integer > n
      order by (t ->> 'trainers')::integer limit 1
    )
  );
end;
$$;
grant execute on function public.award_trainer_counter() to authenticated;

-- ---------------------------------------------------------------------------
-- Red flags: unusual progress needs a proof video from the client
-- ---------------------------------------------------------------------------
create or replace function public.award_add_proof(
  p_client uuid, p_trainer uuid, p_kind text, p_table text, p_source uuid, p_detail text, p_days integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  -- One request per lift or measure kind every 30 days is enough.
  if exists (
    select 1 from public.award_proofs p
    where p.client_id = p_client and p.kind = p_kind and p.flagged_on > public.sa_today() - 30
      and (p_kind not in ('lift', 'jump') or p.detail = p_detail)
  ) then
    return;
  end if;
  insert into public.award_proofs (client_id, trainer_id, kind, source_table, source_id, detail, due_on)
  values (p_client, p_trainer, p_kind, p_table, p_source, p_detail, public.sa_today() + p_days)
  on conflict (source_table, source_id, kind) do nothing
  returning id into new_id;
  if new_id is not null then
    perform public.push_to_user(
      p_client,
      'Please send a quick proof video',
      'Great progress! To count it, record a short video of ' || p_detail
        || ' with your face clearly visible, within ' || p_days || ' days. Open the app to send it.',
      jsonb_build_object('type', 'award_proof', 'proofId', new_id)
    );
  end if;
end;
$$;
revoke execute on function public.award_add_proof(uuid, uuid, text, text, uuid, text, integer) from public, anon, authenticated;

create or replace function public.award_scan_flags(p_from date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.award_settings;
  r record;
  today date := public.sa_today();
  scan_from date;
begin
  select * into s from public.award_settings where id = 1;
  scan_from := greatest(p_from, today - 35);

  -- Lifts: a day's best set more than flag_lift_pct above the best of the month before.
  for r in
    with day_best as (
      select distinct on (w.client_id, w.exercise_name, w.log_date)
        w.id, w.client_id, c.trainer_id, w.exercise_name, w.log_date, w.weight_kg, w.reps,
        public.award_e1rm(w.weight_kg, w.reps) as e
      from public.workout_logs w
      join public.clients c on c.id = w.client_id
      where w.log_date between scan_from and today and w.logged_by = w.client_id and w.import_id is null
        and not coalesce(w.warm_up, false) and not coalesce(w.gauge, false)
        and c.id <> c.trainer_id and public.award_e1rm(w.weight_kg, w.reps) is not null
      order by w.client_id, w.exercise_name, w.log_date, public.award_e1rm(w.weight_kg, w.reps) desc
    )
    select d.*,
      (select max(public.award_e1rm(x.weight_kg, x.reps)) from public.workout_logs x
        where x.client_id = d.client_id and x.exercise_name = d.exercise_name
          and x.log_date between d.log_date - 31 and d.log_date - 1
          and not coalesce(x.warm_up, false) and not coalesce(x.gauge, false)) as month_best
    from day_best d
  loop
    if r.month_best > 0 and r.e > r.month_best * (1 + s.flag_lift_pct / 100) then
      perform public.award_add_proof(r.client_id, r.trainer_id, 'lift', 'workout_logs', r.id,
        r.exercise_name || ' (' || trim(to_char(r.weight_kg, 'FM9990.##')) || ' kg x ' || r.reps || ')', s.proof_days);
    end if;
  end loop;

  -- Sudden jumps: a big rise since the last time, with no training logged in between.
  for r in
    with day_best as (
      select distinct on (w.client_id, w.exercise_name, w.log_date)
        w.id, w.client_id, c.trainer_id, w.exercise_name, w.log_date, w.weight_kg, w.reps,
        public.award_e1rm(w.weight_kg, w.reps) as e
      from public.workout_logs w
      join public.clients c on c.id = w.client_id
      where w.log_date between scan_from and today and w.logged_by = w.client_id and w.import_id is null
        and not coalesce(w.warm_up, false) and not coalesce(w.gauge, false)
        and c.id <> c.trainer_id and public.award_e1rm(w.weight_kg, w.reps) is not null
      order by w.client_id, w.exercise_name, w.log_date, public.award_e1rm(w.weight_kg, w.reps) desc
    )
    select d.*, prev.log_date as prev_date, prev.e as prev_e
    from day_best d
    cross join lateral (
      select x.log_date, max(public.award_e1rm(x.weight_kg, x.reps)) as e from public.workout_logs x
      where x.client_id = d.client_id and x.exercise_name = d.exercise_name and x.log_date < d.log_date
        and not coalesce(x.warm_up, false) and not coalesce(x.gauge, false)
      group by x.log_date order by x.log_date desc limit 1
    ) prev
  loop
    if r.prev_e > 0 and r.log_date - r.prev_date >= s.flag_jump_gap_days
      and r.e > r.prev_e * (1 + s.flag_jump_pct / 100)
      and not exists (
        select 1 from public.workout_logs y
        where y.client_id = r.client_id and y.log_date > r.prev_date and y.log_date < r.log_date
      )
    then
      perform public.award_add_proof(r.client_id, r.trainer_id, 'jump', 'workout_logs', r.id,
        r.exercise_name || ' (' || trim(to_char(r.weight_kg, 'FM9990.##')) || ' kg x ' || r.reps || ')', s.proof_days);
    end if;
  end loop;

  -- Body weight and measurements, against a weigh-in 2-4 weeks before.
  for r in
    select b.id, b.client_id, c.trainer_id, b.measured_on, b.weight_kg, b.waist_cm,
      prev.measured_on as prev_on, prev.weight_kg as prev_kg, prev.waist_cm as prev_waist
    from public.client_body_stats b
    join public.clients c on c.id = b.client_id
    cross join lateral (
      select x.measured_on, x.weight_kg, x.waist_cm from public.client_body_stats x
      where x.client_id = b.client_id and x.measured_on between b.measured_on - 28 and b.measured_on - 14
      order by x.measured_on asc limit 1
    ) prev
    where b.measured_on between scan_from and today and b.entered_by = b.client_id and b.import_id is null
      and c.id <> c.trainer_id
  loop
    if r.weight_kg > 0 and r.prev_kg > 0
      and abs(r.weight_kg - r.prev_kg) / (r.measured_on - r.prev_on) * 7 > s.flag_weight_kg_week
    then
      perform public.award_add_proof(r.client_id, r.trainer_id, 'weight', 'client_body_stats', r.id,
        'your weigh-in on the scale (' || trim(to_char(r.weight_kg, 'FM9990.#')) || ' kg)', s.proof_days);
    end if;
    if r.waist_cm > 0 and r.prev_waist > 0 and abs(r.waist_cm - r.prev_waist) >= s.flag_waist_cm
      and (r.weight_kg is null or r.prev_kg is null or abs(r.weight_kg - r.prev_kg) < 1)
    then
      perform public.award_add_proof(r.client_id, r.trainer_id, 'measurements', 'client_body_stats', r.id,
        'your waist being measured with a tape (' || trim(to_char(r.waist_cm, 'FM9990.#')) || ' cm)', s.proof_days);
    end if;
  end loop;

  -- No video in time: the entry is taken out of the scoring.
  update public.award_proofs set status = 'expired'
  where status = 'requested' and due_on < today;
end;
$$;
revoke execute on function public.award_scan_flags(date) from public, anon, authenticated;

-- Suspicious client accounts and trainers whose clients keep failing proofs.
create or replace function public.award_scan_accounts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.award_settings;
  today date := public.sa_today();
  r record;
  new_flags integer := 0;
  owner_id uuid;
begin
  select * into s from public.award_settings where id = 1;

  -- Only clients who would otherwise count (they have a face photo) are checked.
  for r in
    select c.id, c.trainer_id,
      exists (
        select 1 from public.app_opens a join public.app_opens b on b.device_id = a.device_id
        where a.user_id = c.id and b.user_id = c.trainer_id
      ) as same_phone,
      (s.enabled_at is not null and s.enabled_at < now() - interval '14 days'
        and c.created_at < now() - interval '14 days'
        and not exists (select 1 from public.app_opens a where a.user_id = c.id)) as never_in,
      (
        (select count(*) from public.workout_logs w
          where w.client_id = c.id and w.logged_by = c.trainer_id and w.import_id is null and w.log_date > today - 60) >= 5
        and not exists (select 1 from public.award_client_action_days(c.id, today - 60, today))
      ) as trainer_only
    from public.clients c
    where c.id <> c.trainer_id and c.archived_at is null and c.award_flag is null and c.face_photo_path is not null
  loop
    if r.same_phone or r.never_in or r.trainer_only then
      update public.clients
      set award_flag = 'suspicious', award_flag_at = now(),
          award_flag_reason = concat_ws('; ',
            case when r.same_phone then 'uses the same phone as their trainer' end,
            case when r.never_in then 'has never opened the app' end,
            case when r.trainer_only then 'all activity is entered by the trainer' end)
      where id = r.id;
      new_flags := new_flags + 1;
    end if;
  end loop;

  -- Repeated removals for one trainer's clients: full review of that trainer.
  for r in
    select p.trainer_id, count(*) as n
    from public.award_proofs p
    left join public.award_trainer_flags f on f.trainer_id = p.trainer_id
    where p.status in ('rejected', 'expired')
      and p.flagged_on > today - 180
      and (f.trainer_id is null or (f.status = 'cleared' and p.flagged_on > (f.cleared_at at time zone 'Africa/Johannesburg')::date))
    group by p.trainer_id
    having count(*) >= s.trainer_review_after
  loop
    insert into public.award_trainer_flags (trainer_id, reason, status, flagged_at, cleared_at)
    values (r.trainer_id, r.n || ' proof videos missing or turned down in the last 6 months', 'open', now(), null)
    on conflict (trainer_id) do update
      set reason = excluded.reason, status = 'open', flagged_at = now(), cleared_at = null;
    new_flags := new_flags + 1;
  end loop;

  if new_flags > 0 then
    for owner_id in select t.id from public.trainers t where t.is_owner loop
      perform public.push_to_user(owner_id, 'Trainer award: new flags',
        new_flags || ' new account' || case when new_flags = 1 then '' else 's' end || ' to check. Menu > Trainer award > Flags.',
        jsonb_build_object('type', 'award_admin'));
    end loop;
  end if;
end;
$$;
revoke execute on function public.award_scan_accounts() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Monthly trainer message (1st of the month)
-- ---------------------------------------------------------------------------
create or replace function public.award_cooldown_until(p_trainer uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select max((w.ends_on + make_interval(months => s.cooldown_months))::date)
  from public.award_winners aw
  join public.award_periods w on w.id = aw.period_id
  cross join public.award_settings s
  where s.id = 1 and aw.trainer_id = p_trainer and w.revealed_at is not null
    and (w.ends_on + make_interval(months => s.cooldown_months))::date >= public.sa_today();
$$;

create or replace function public.award_send_monthly(p_period uuid, p_as_of date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.award_settings;
  n integer;
  cutoff integer;
  r record;
  until_d date;
  v_kind text;
  v_body text;
  v_tip text;
begin
  select * into s from public.award_settings where id = 1;
  select count(*) into n from public.award_scores where period_id = p_period and score_date = p_as_of and kind = 'monthly';
  if n = 0 then
    return;
  end if;
  cutoff := ceil(n * s.top_percent / 100.0);
  for r in
    select * from public.award_scores where period_id = p_period and score_date = p_as_of and kind = 'monthly'
  loop
    until_d := public.award_cooldown_until(r.trainer_id);
    if until_d is not null then
      v_kind := 'cooldown';
      v_body := 'You placed in Trainer of the Half-Year. Sitting out until ' || to_char(until_d, 'FMDD FMMonth YYYY') || '.';
      v_tip := null;
    else
      v_kind := case when r.rank <= cutoff then 'top' else 'not_top' end;
      v_body := case when v_kind = 'top' then s.message_top else s.message_not_top end;
      -- One tip for the weakest part. No numbers are shown.
      v_tip := case
        when r.progress <= r.retention and r.progress <= r.signup_score then s.tip_progress
        when r.retention <= r.signup_score then s.tip_retention
        else s.tip_signups
      end;
    end if;
    insert into public.award_trainer_messages (trainer_id, sent_on, kind, body, tip)
    values (r.trainer_id, p_as_of, v_kind, v_body, v_tip)
    on conflict (trainer_id, sent_on) do nothing;
    if found then
      perform public.push_to_user(r.trainer_id, 'Trainer of the Half-Year', v_body || coalesce(' ' || v_tip, ''),
        jsonb_build_object('type', 'award_monthly'));
    end if;
  end loop;
end;
$$;
revoke execute on function public.award_send_monthly(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Close a period: final scores and the winner (revealed later by the owner)
-- ---------------------------------------------------------------------------
create or replace function public.award_close_period(p_period uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.award_periods;
  places jsonb;
  win record;
  v_place integer := 0;
  owner_id uuid;
begin
  select * into p from public.award_periods where id = p_period;
  if p.id is null or p.closed_at is not null then
    return;
  end if;
  perform public.award_score_period(p.id, p.ends_on, 'final');
  -- The prize tier the app has reached now, then the highest-scoring
  -- trainers who can win, one per place (ties: retention, then progress).
  places := public.award_prize_places(public.award_trainer_count());
  if jsonb_array_length(places) = 0 then
    places := '[0]'::jsonb;
  end if;
  for win in
    select trainer_id, total from public.award_scores
    where period_id = p.id and score_date = p.ends_on and kind = 'final' and eligible
    order by total desc, retention desc, progress desc
    limit jsonb_array_length(places)
  loop
    v_place := v_place + 1;
    insert into public.award_winners (period_id, place, trainer_id, score, prize, prize_paid)
    values (p.id, v_place, win.trainer_id, win.total, (places ->> (v_place - 1))::numeric,
            public.award_money((places ->> (v_place - 1))::numeric, public.award_is_sa(win.trainer_id)))
    on conflict (period_id, place) do nothing;
  end loop;
  update public.award_periods
  set closed_at = now(),
      winner_id = (select trainer_id from public.award_winners where period_id = p.id and place = 1),
      winner_score = (select score from public.award_winners where period_id = p.id and place = 1),
      prize_text = public.award_prize_words(places)
  where id = p.id;
  for owner_id in select t.id from public.trainers t where t.is_owner loop
    perform public.push_to_user(owner_id, 'Trainer of the Half-Year: period ended',
      case when v_place = 0 then 'No trainer qualified this time. See Menu > Trainer award.'
           else 'The winners are ready. Open Menu > Trainer award > Winners to reveal them live.' end,
      jsonb_build_object('type', 'award_admin'));
  end loop;
end;
$$;
revoke execute on function public.award_close_period(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The daily job
-- ---------------------------------------------------------------------------
create or replace function public.award_daily(p_force boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.award_settings;
  today date := public.sa_today();
  n integer;
  v_start date;
  v_end date;
  cur public.award_periods;
  old_p record;
begin
  select * into s from public.award_settings where id = 1;
  if not s.enabled and not p_force then
    return 'The award is switched off.';
  end if;
  -- No start date: start on the 1st of the month after the app reaches
  -- start_at_trainers trainers (GRIZZ: 250).
  if s.first_period_start is null then
    if s.enabled and public.award_trainer_count() >= s.start_at_trainers then
      update public.award_settings
      set first_period_start = (date_trunc('month', today) + interval '1 month')::date
      where id = 1
      returning * into s;
      for old_p in select t.id from public.trainers t where t.is_owner loop
        perform public.push_to_user(old_p.id, s.start_at_trainers || ' trainers reached! 🎉',
          'Trainer of the Half-Year starts on ' || to_char(s.first_period_start, 'FMDD FMMonth YYYY') || '.',
          jsonb_build_object('type', 'award_admin'));
      end loop;
      return 'The first period starts on ' || to_char(s.first_period_start, 'FMDD FMMonth YYYY') || '.';
    end if;
    return 'Waiting for ' || s.start_at_trainers || ' trainers (' || public.award_trainer_count() || ' now).';
  end if;

  -- Every period from the first start up to today exists (catches up on missed days).
  if today >= s.first_period_start then
    for n in 0 .. floor(((extract(year from age(today, s.first_period_start)) * 12) + extract(month from age(today, s.first_period_start))) / s.period_months)::integer loop
      v_start := (s.first_period_start + make_interval(months => n * s.period_months))::date;
      insert into public.award_periods (starts_on, ends_on)
      values (v_start, (v_start + make_interval(months => s.period_months))::date - 1)
      on conflict (starts_on) do nothing;
    end loop;
  end if;

  -- Close any period that has ended.
  for old_p in select id from public.award_periods where ends_on < today and closed_at is null order by starts_on loop
    perform public.award_close_period(old_p.id);
  end loop;

  if today < s.first_period_start then
    return 'The first period starts on ' || to_char(s.first_period_start, 'FMDD FMMonth YYYY') || '.';
  end if;

  -- The period today falls in.
  n := floor(((extract(year from age(today, s.first_period_start)) * 12) + extract(month from age(today, s.first_period_start))) / s.period_months);
  v_start := (s.first_period_start + make_interval(months => n * s.period_months))::date;
  v_end := (v_start + make_interval(months => s.period_months))::date - 1;
  insert into public.award_periods (starts_on, ends_on)
  values (v_start, v_end)
  on conflict (starts_on) do nothing;
  select * into cur from public.award_periods where starts_on = v_start;

  if s.enabled then
    perform public.award_scan_flags(cur.starts_on);
    perform public.award_scan_accounts();
  end if;

  perform public.award_score_period(cur.id, today, 'daily');

  -- 1st of the month: a snapshot, and the trainers' message, except in the
  -- period's first day and its last month (the blackout keeps the winner a surprise).
  if extract(day from today) = 1 then
    perform public.award_score_period(cur.id, today, 'monthly');
    if s.enabled and today > cur.starts_on and today < (cur.ends_on + 1 - interval '1 month')::date then
      perform public.award_send_monthly(cur.id, today);
    end if;
  end if;
  return 'Scores worked out for ' || to_char(today, 'FMDD FMMonth YYYY') || '.';
end;
$$;
revoke execute on function public.award_daily(boolean) from public, anon, authenticated;

select cron.schedule('trainer-award-daily', '30 0 * * *', $$select public.award_daily(false);$$);

-- ---------------------------------------------------------------------------
-- Calls from the app
-- ---------------------------------------------------------------------------

-- Owner: work the scores out now (also while switched off, to test).
create or replace function public.award_run_now()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this.';
  end if;
  return public.award_daily(true);
end;
$$;
grant execute on function public.award_run_now() to authenticated;

-- Owner: the leaderboard, newest scores of a period.
create or replace function public.award_leaderboard(p_period uuid default null)
returns table (
  trainer_id uuid, trainer_name text, score_date date, kind text, total numeric, signups integer,
  signup_score numeric, retention numeric, progress numeric, verified_clients integer,
  eligible boolean, in_cooldown boolean, rank integer, flagged boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_period uuid := p_period;
  v_date date;
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this.';
  end if;
  if v_period is null then
    select id into v_period from public.award_periods order by starts_on desc limit 1;
  end if;
  select max(sc.score_date) into v_date from public.award_scores sc where sc.period_id = v_period;
  return query
    select sc.trainer_id, coalesce(t.business_name, t.name), sc.score_date, sc.kind, sc.total, sc.signups,
           sc.signup_score, sc.retention, sc.progress, sc.verified_clients, sc.eligible, sc.in_cooldown, sc.rank,
           exists (select 1 from public.award_trainer_flags f where f.trainer_id = sc.trainer_id and f.status = 'open')
    from public.award_scores sc
    join public.trainers t on t.id = sc.trainer_id
    where sc.period_id = v_period and sc.score_date = v_date
      and sc.kind = (select x.kind from public.award_scores x where x.period_id = v_period and x.score_date = v_date
                     order by case x.kind when 'final' then 0 when 'monthly' then 1 else 2 end limit 1)
    order by sc.rank;
end;
$$;
grant execute on function public.award_leaderboard(uuid) to authenticated;

-- Owner: flagged clients and trainers.
create or replace function public.award_flag_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this.';
  end if;
  return jsonb_build_object(
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'trainer', coalesce(t.business_name, t.name),
        'reason', c.award_flag_reason, 'flagged_at', c.award_flag_at, 'face_photo_path', c.face_photo_path
      ) order by c.award_flag_at desc)
      from public.clients c join public.trainers t on t.id = c.trainer_id
      where c.award_flag = 'suspicious'
    ), '[]'::jsonb),
    'trainers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.trainer_id, 'name', coalesce(t.business_name, t.name), 'reason', f.reason, 'flagged_at', f.flagged_at
      ) order by f.flagged_at desc)
      from public.award_trainer_flags f join public.trainers t on t.id = f.trainer_id
      where f.status = 'open'
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.award_flag_list() to authenticated;

-- Owner: approve or turn down a flagged client.
create or replace function public.award_review_client(p_client uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this.';
  end if;
  update public.clients
  set award_flag = case when p_approve then 'approved' else 'rejected' end, award_flag_at = now()
  where id = p_client;
end;
$$;
grant execute on function public.award_review_client(uuid, boolean) to authenticated;

-- Owner: the trainer's client list was checked.
create or replace function public.award_clear_trainer(p_trainer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this.';
  end if;
  update public.award_trainer_flags set status = 'cleared', cleared_at = now() where trainer_id = p_trainer;
end;
$$;
grant execute on function public.award_clear_trainer(uuid) to authenticated;

-- Owner: proof videos waiting (and recent ones).
create or replace function public.award_proof_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'client', c.name, 'trainer', coalesce(t.business_name, t.name), 'kind', p.kind,
      'detail', p.detail, 'status', p.status, 'flagged_on', p.flagged_on, 'due_on', p.due_on,
      'video_path', p.video_path, 'face_photo_path', c.face_photo_path
    ) order by case p.status when 'uploaded' then 0 when 'requested' then 1 else 2 end, p.flagged_on desc)
    from public.award_proofs p
    join public.clients c on c.id = p.client_id
    join public.trainers t on t.id = p.trainer_id
    where p.status in ('uploaded', 'requested') or p.flagged_on > public.sa_today() - 60
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.award_proof_queue() to authenticated;

-- Owner: approve or turn down a proof video.
create or replace function public.award_review_proof(p_proof uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this.';
  end if;
  update public.award_proofs
  set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = now()
  where id = p_proof and status in ('uploaded', 'requested', 'expired')
  returning client_id into v_client;
  if v_client is not null then
    perform public.push_to_user(v_client,
      case when p_approve then 'Proof video approved ✅' else 'Proof video not accepted' end,
      case when p_approve then 'Thanks! Your progress counts.' else 'The video didn''t show the lift or weigh-in clearly, so that entry isn''t counted.' end,
      jsonb_build_object('type', 'award_proof'));
  end if;
end;
$$;
grant execute on function public.award_review_proof(uuid, boolean) to authenticated;

-- Owner: winners and the live reveal.
create or replace function public.award_periods_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'starts_on', p.starts_on, 'ends_on', p.ends_on, 'prize_text', p.prize_text,
      'winner_id', p.winner_id, 'winner', coalesce(t.business_name, t.name), 'winner_score', p.winner_score,
      'closed_at', p.closed_at, 'revealed_at', p.revealed_at,
      'winners', coalesce((
        select jsonb_agg(jsonb_build_object('place', aw.place, 'name', coalesce(x.business_name, x.name), 'score', aw.score, 'prize', aw.prize, 'prize_paid', aw.prize_paid) order by aw.place)
        from public.award_winners aw join public.trainers x on x.id = aw.trainer_id
        where aw.period_id = p.id
      ), '[]'::jsonb)
    ) order by p.starts_on desc)
    from public.award_periods p left join public.trainers t on t.id = p.winner_id
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.award_periods_list() to authenticated;

create or replace function public.award_reveal(p_period uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.award_periods;
  r record;
begin
  if not public.is_app_owner() then
    raise exception 'Only the app owner can do this.';
  end if;
  select * into p from public.award_periods where id = p_period;
  if p.closed_at is null or p.winner_id is null then
    raise exception 'This period has no winners yet.';
  end if;
  if p.revealed_at is not null then
    return;
  end if;
  update public.award_periods set revealed_at = now() where id = p.id;
  for r in select t.id from public.trainers t where t.approved loop
    perform public.push_to_user(r.id, 'Trainer of the Half-Year 🏆',
      'The winners are being revealed live now. Open the app to watch.',
      jsonb_build_object('type', 'award_reveal'));
  end loop;
end;
$$;
grant execute on function public.award_reveal(uuid) to authenticated;

-- Trainer: what to show (nothing while the award is off). Never a score or rank.
create or replace function public.my_award_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.award_settings;
  me uuid := auth.uid();
  cur public.award_periods;
  last_rev record;
  msg record;
begin
  select * into s from public.award_settings where id = 1;
  if not s.enabled or not exists (select 1 from public.trainers where id = me) then
    return jsonb_build_object('enabled', false);
  end if;
  select * into cur from public.award_periods
    where starts_on <= public.sa_today() and ends_on >= public.sa_today() order by starts_on desc limit 1;
  select p.id, p.ends_on, p.revealed_at, p.prize_text, p.winner_id, coalesce(t.business_name, t.name) as winner, t.logo_path
    into last_rev
    from public.award_periods p join public.trainers t on t.id = p.winner_id
    where p.revealed_at is not null and p.revealed_at > now() - interval '14 days'
    order by p.revealed_at desc limit 1;
  select m.sent_on, m.kind, m.body, m.tip into msg from public.award_trainer_messages m
    where m.trainer_id = me order by m.sent_on desc limit 1;
  return jsonb_build_object(
    'enabled', true,
    'prize_text', coalesce(public.award_prize_words(public.award_prize_places(public.award_trainer_count()), public.award_is_sa(me)), '')
                  || coalesce(chr(10) || s.prize_text, ''),
    'prize_tiers', (
      select jsonb_agg(jsonb_build_object('trainers', (t ->> 'trainers')::integer, 'prize', public.award_prize_words(t -> 'places', public.award_is_sa(me)))
                       order by (t ->> 'trainers')::integer)
      from jsonb_array_elements(s.prize_tiers) t
    ),
    'start_at', s.start_at_trainers,
    'rules_text', case when s.rules_published then s.rules_text end,
    'period_starts', cur.starts_on,
    'period_ends', coalesce(cur.ends_on, null),
    'first_start', s.first_period_start,
    'cooldown_until', public.award_cooldown_until(me),
    'message', case when msg.sent_on is not null then jsonb_build_object('sent_on', msg.sent_on, 'kind', msg.kind, 'body', msg.body, 'tip', msg.tip) end,
    'reveal', case when last_rev.revealed_at is not null then jsonb_build_object(
      'period_ends', last_rev.ends_on, 'revealed_at', last_rev.revealed_at, 'winner', last_rev.winner,
      'logo_path', last_rev.logo_path,
      'prize_text', (select string_agg(case aw.place when 1 then '1st' when 2 then '2nd' when 3 then '3rd' else aw.place || 'th' end
                                       || ' ' || public.award_money(aw.prize, public.award_is_sa(me)), ', ' order by aw.place)
                     from public.award_winners aw where aw.period_id = last_rev.id),
      'is_me', exists (select 1 from public.award_winners aw where aw.period_id = last_rev.id and aw.trainer_id = me),
      'my_place', (select aw.place from public.award_winners aw where aw.period_id = last_rev.id and aw.trainer_id = me),
      'places', (
        select jsonb_agg(jsonb_build_object('place', aw.place, 'name', coalesce(x.business_name, x.name), 'logo_path', x.logo_path, 'prize', aw.prize) order by aw.place)
        from public.award_winners aw join public.trainers x on x.id = aw.trainer_id
        where aw.period_id = last_rev.id
      ),
      'stream_url', s.stream_url) end
  );
end;
$$;
grant execute on function public.my_award_status() to authenticated;

-- Client: what the award needs from them (nothing while off).
create or replace function public.my_award_needs()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
begin
  if not public.award_is_on() then
    return jsonb_build_object('enabled', false);
  end if;
  select id, trainer_id, face_photo_path, goal_direction into c from public.clients where id = auth.uid();
  if c.id is null or c.id = c.trainer_id then
    return jsonb_build_object('enabled', false);
  end if;
  return jsonb_build_object(
    'enabled', true,
    'needs_photo', c.face_photo_path is null,
    'needs_goal', c.goal_direction is null,
    'proofs', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'detail', p.detail, 'due_on', p.due_on, 'status', p.status) order by p.due_on)
      from public.award_proofs p where p.client_id = c.id and p.status in ('requested', 'uploaded')
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.my_award_needs() to authenticated;

-- Client: their proof video is uploaded.
create or replace function public.submit_award_proof(p_proof uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  if split_part(p_path, '/', 1) <> auth.uid()::text then
    raise exception 'That video is not yours.';
  end if;
  update public.award_proofs
  set video_path = p_path, uploaded_at = now(), status = 'uploaded'
  where id = p_proof and client_id = auth.uid() and status = 'requested' and due_on >= public.sa_today();
  if not found then
    raise exception 'This request has closed.';
  end if;
  for owner_id in select t.id from public.trainers t where t.is_owner loop
    perform public.push_to_user(owner_id, 'Trainer award: proof video to check',
      'A client sent a proof video. Menu > Trainer award > Proof videos.',
      jsonb_build_object('type', 'award_admin'));
  end loop;
end;
$$;
grant execute on function public.submit_award_proof(uuid, text) to authenticated;
