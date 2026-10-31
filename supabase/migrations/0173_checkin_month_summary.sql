-- Month-end check-in summary (GRIZZ, 2026-10-31: "end of each month remind
-- them of how often they drank alcohol. How often they got their water intake
-- in etc."). On the 1st, each client who checked in last month gets one push
-- with last month's alcohol days, water-target days and average sleep, each
-- against the month before. The full list is on Profile > My progress >
-- Check-in (src/lib/checkinMonthly.ts counts the same way).
--
-- Live clients get it too (their check-in is optional, 0169), so it has no
-- push category; other clients who switched off progress pushes don't.

create or replace function public.checkin_month_numbers(p_client uuid, p_month date, p_water numeric)
returns table (checkins integer, alcohol_days integer, water_days integer, sleep_hours numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::int,
    count(*) filter (where k.alcohol_units > 0)::int,
    count(*) filter (where k.water_litres >= p_water)::int,
    round(avg(s.h) filter (where s.h between 2 and 16), 1)
  from public.checkins k
  cross join lateral (
    select case when k.sleep_wake_time is null or coalesce(k.sleep_asleep_time, k.sleep_bed_time) is null then null
      else (extract(epoch from k.sleep_wake_time - coalesce(k.sleep_asleep_time, k.sleep_bed_time)) / 3600
            + case when k.sleep_wake_time <= coalesce(k.sleep_asleep_time, k.sleep_bed_time) then 24 else 0 end)
    end as h
  ) s
  where k.client_id = p_client
    and k.checkin_date >= p_month and k.checkin_date < (p_month + interval '1 month')::date
$$;

revoke execute on function public.checkin_month_numbers(uuid, date, numeric) from public, anon, authenticated;

create or replace function public.checkin_month_summaries()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  last_m date := (date_trunc('month', public.sa_today()) - interval '1 month')::date;
  prev_m date := (date_trunc('month', public.sa_today()) - interval '2 months')::date;
  m_name text := trim(to_char(last_m, 'Month'));
  water numeric;
  a record;
  b record;
  sent integer := 0;
  body text;
begin
  for v in
    select c.id, c.live_only,
      (select bs.weight_kg from public.client_body_stats bs
        where bs.client_id = c.id and bs.weight_kg is not null
        order by bs.measured_on desc limit 1) as weight
    from public.clients c
    left join public.client_notification_prefs n on n.client_id = c.id
    where c.access_status <> 'expired' and c.archived_at is null
      and (c.live_only or coalesce(n.progress, true))
      and exists (select 1 from public.checkins k where k.client_id = c.id
                  and k.checkin_date >= last_m and k.checkin_date < (last_m + interval '1 month')::date)
  loop
    -- Same water target as the app: 33 ml per kg, 2 L when the weight isn't known.
    water := case when v.weight between 25 and 400 then round(v.weight * 0.033, 1) else 2 end;
    select * into a from public.checkin_month_numbers(v.id, last_m, water);
    select * into b from public.checkin_month_numbers(v.id, prev_m, water);

    body := '🍷 Alcohol on ' || a.alcohol_days || ' day' || case when a.alcohol_days = 1 then '' else 's' end;
    if b.checkins > 0 and a.alcohol_days <> b.alcohol_days then
      body := body || ' (' || case when a.alcohol_days < b.alcohol_days then '▼ ' else '▲ ' end || abs(a.alcohol_days - b.alcohol_days) || ')';
    end if;
    body := body || ' · 💧 Water target on ' || a.water_days || ' day' || case when a.water_days = 1 then '' else 's' end;
    if b.checkins > 0 and a.water_days <> b.water_days then
      body := body || ' (' || case when a.water_days > b.water_days then '▲ ' else '▼ ' end || abs(a.water_days - b.water_days) || ')';
    end if;
    if a.sleep_hours is not null then
      body := body || ' · 😴 ' || trim(to_char(a.sleep_hours, 'FM90.0')) || ' h sleep';
    end if;
    body := body || '. See Profile › My progress.';

    perform public.push_to_user(
      v.id,
      '📋 Your ' || m_name || ' check-ins: ' || a.checkins || ' day' || case when a.checkins = 1 then '' else 's' end,
      body,
      jsonb_build_object('type', 'checkin_month')
    );
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.checkin_month_summaries() from public, anon, authenticated;

select cron.unschedule('checkin-month-summary') where exists (select 1 from cron.job where jobname = 'checkin-month-summary');
-- 06:00 UTC is 08:00 in South Africa, on the 1st of each month.
select cron.schedule('checkin-month-summary', '0 6 1 * *', $$select public.checkin_month_summaries();$$);
