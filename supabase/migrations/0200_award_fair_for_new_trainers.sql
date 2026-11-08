-- New trainers (GRIZZ, 2026-11-08): a trainer who joins part-way through a
-- period can't win that one and competes from the next period, when every
-- trainer has had the same six months. They're still scored, so the owner
-- can see how they're doing. A trainer with no clients from before the
-- period (e.g. joined the day before) has no retention to measure, so
-- they're scored on sign-ups and progress instead of getting 0 for it.
alter table public.award_scores
  add column if not exists joined_late boolean not null default false,
  add column if not exists has_retention boolean not null default true;

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
  v_joined date;
  max_signups integer;
begin
  select * into s from public.award_settings where id = 1;
  select * into p from public.award_periods where id = p_period;
  if p.id is null then
    return;
  end if;

  for t in
    select tr.id, coalesce((tr.approved_at at time zone 'Africa/Johannesburg')::date, (tr.created_at at time zone 'Africa/Johannesburg')::date) as joined
    from public.trainers tr where tr.approved and not tr.is_owner
  loop
    -- Verified clients today.
    v_joined := t.joined;

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

    insert into public.award_scores (period_id, trainer_id, score_date, kind, signups, joined_late, has_retention, retention, progress, verified_clients, eligible, in_cooldown)
    values (p.id, t.id, p_as_of, p_kind, v_signups, coalesce(v_joined > p.starts_on, false), v_base > 0,
            case when v_base > 0 then round(100.0 * v_kept / v_base, 1) else 0 end,
            round(v_progress, 1), v_verified,
            v_verified >= s.min_verified_clients and not v_cooldown and not coalesce(v_joined > p.starts_on, false), v_cooldown)
    on conflict (period_id, trainer_id, kind, score_date) do update
      set signups = excluded.signups, joined_late = excluded.joined_late, has_retention = excluded.has_retention, retention = excluded.retention, progress = excluded.progress,
          verified_clients = excluded.verified_clients, eligible = excluded.eligible,
          in_cooldown = excluded.in_cooldown, created_at = now();
  end loop;

  -- Sign-ups are scaled 0-100 against the highest trainer, then the total and rank.
  select max(signups) into max_signups from public.award_scores
  where period_id = p.id and score_date = p_as_of and kind = p_kind and not joined_late;

  update public.award_scores sc
  set signup_score = case when coalesce(max_signups, 0) > 0 then least(100, round(100.0 * sc.signups / max_signups, 1)) else 0 end
  where sc.period_id = p.id and sc.score_date = p_as_of and sc.kind = p_kind;

  update public.award_scores sc
  -- A trainer with no clients from before the period has no retention to
  -- measure, so they're scored on the other parts (0200).
  set total = coalesce(round(
        (s.signup_weight * sc.signup_score + case when sc.has_retention then s.retention_weight * sc.retention else 0 end + s.progress_weight * sc.progress)
        / nullif(s.signup_weight + s.progress_weight + case when sc.has_retention then s.retention_weight else 0 end, 0), 1), 0)
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

-- The rules say so too (only changes the untouched default sentence).
update public.award_settings
  set rules_text = replace(rules_text, '20% client retention, ',
                           '20% client retention (a trainer with no clients from the start of the period is scored on the other parts), ')
  where id = 1 and position('20% client retention, ' in rules_text) > 0;
update public.award_settings
  set rules_text = replace(rules_text, 'Two award periods a year. ',
                           'Two award periods a year. A trainer who joins part-way through a period competes from the next one, so everyone has the same six months. ')
  where id = 1 and position('Two award periods a year. ' in rules_text) > 0;
