-- Powers the "most consistent client wins a free month" reward: a single
-- score per client for a given month, combining check-in compliance (did
-- they show up daily), habit completion (did they do the tasks they set
-- up), and training video uploads (proof of actually training).
-- security invoker (the default) - RLS on checkins/habits/habit_logs/videos
-- already restricts a caller to their own clients or their own data, so this
-- function only ever sees what the caller could already see directly.
create or replace function public.client_monthly_consistency(p_client_id uuid, p_month date default current_date)
returns table (
  checkin_rate numeric,
  habit_rate numeric,
  video_count integer,
  overall_score numeric
)
language sql
stable
as $$
  with month_bounds as (
    select
      date_trunc('month', p_month)::date as month_start,
      least((date_trunc('month', p_month) + interval '1 month - 1 day')::date, current_date) as month_end
  ),
  days as (
    select generate_series(month_start, month_end, interval '1 day')::date as d
    from month_bounds
  ),
  checkin_stats as (
    select
      count(distinct c.checkin_date)::numeric as done,
      (select count(*) from days)::numeric as total
    from days
    left join public.checkins c on c.client_id = p_client_id and c.checkin_date = days.d
  ),
  habit_days as (
    select h.id as habit_id, h.reps_target, days.d
    from public.habits h
    cross join days
    where h.client_id = p_client_id
      and days.d >= h.start_date
      and (h.end_date is null or days.d <= h.end_date)
      and extract(dow from days.d)::int = any(h.active_days)
  ),
  habit_stats as (
    select
      coalesce(sum(least(coalesce(hl.reps_completed, 0), hd.reps_target)), 0)::numeric as done,
      coalesce(sum(hd.reps_target), 0)::numeric as total
    from habit_days hd
    left join public.habit_logs hl on hl.habit_id = hd.habit_id and hl.log_date = hd.d
  ),
  video_stats as (
    select count(*)::integer as cnt
    from public.videos v, month_bounds mb
    where v.client_id = p_client_id
      and v.uploaded_at >= mb.month_start
      and v.uploaded_at < mb.month_start + interval '1 month'
      and v.deleted_at is null
  ),
  rates as (
    select
      case when cs.total = 0 then 0 else round(cs.done / cs.total * 100, 1) end as checkin_rate,
      case when hs.total = 0 then null else round(hs.done / hs.total * 100, 1) end as habit_rate,
      vs.cnt as video_count
    from checkin_stats cs, habit_stats hs, video_stats vs
  )
  select
    checkin_rate,
    habit_rate,
    video_count,
    -- Average of check-in and habit compliance, plus a small capped bonus
    -- for uploaded videos (they don't have a natural target count).
    round((checkin_rate + coalesce(habit_rate, checkin_rate)) / 2 + least(video_count, 8) * 0.5, 1) as overall_score
  from rates;
$$;

grant execute on function public.client_monthly_consistency(uuid, date) to authenticated;
