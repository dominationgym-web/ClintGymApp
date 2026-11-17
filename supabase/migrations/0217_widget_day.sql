-- Home-screen calendar widget shows the same day as 1 on 1 Today (GRIZZ,
-- 2026-11-17: "show the exact same schedule and gaps and catch-ups in the
-- widget as in the calendar"). widget_sessions (0214) only gave booked
-- sessions, so the widget couldn't show joint sessions with someone out,
-- away / cancelled slots that are free to book, catch-ups, or the green
-- Available gaps. widget_day gives the same rows the app's Today list is made
-- from, plus the trainer's working day, and the app works the list out with
-- the same code (dayRows in src/lib/liveSessions.ts).
--
-- widget_sessions stays as it is for phones still on the older widget code.

create or replace function public.widget_day(p_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_trainer uuid;
  v_rows jsonb;
  v_settings jsonb;
begin
  update public.widget_keys set last_used_at = now()
  where key_hash = public.widget_key_hash(p_key) and revoked_at is null
  returning trainer_id into v_trainer;
  if v_trainer is null then
    return jsonb_build_object('ok', false);
  end if;
  select coalesce(jsonb_agg(r order by r.starts_at, r.name), '[]'::jsonb) into v_rows
  from (
    select ls.id, ls.starts_at, ls.minutes, ls.status, ls.charge, ls.cancelled_by,
           ls.away_id, ls.stop_id, ls.note, ls.makeup_for, ls.makeup_session_id,
           ls.client_id, ls.guest_name, ls.client_disputed_at, ls.repeat_id,
           coalesce(c.name, ls.guest_name, 'Client') as name
    from public.live_sessions ls
    left join public.clients c on c.id = ls.client_id
    where ls.trainer_id = v_trainer
      and (ls.status <> 'removed' or ls.stop_id is not null)
      and ls.starts_at >= now() - interval '3 days'
      and ls.starts_at < now() + interval '2 days'
    order by ls.starts_at
    limit 300
  ) r;
  select jsonb_build_object('day_start', to_char(s.day_start, 'HH24:MI'), 'day_end', to_char(s.day_end, 'HH24:MI'), 'minutes', s.minutes)
  into v_settings
  from public.session_settings s
  where s.trainer_id = v_trainer;
  return jsonb_build_object('ok', true, 'sessions', v_rows, 'settings', v_settings, 'at', now());
end;
$$;
revoke execute on function public.widget_day(text) from public;
grant execute on function public.widget_day(text) to anon, authenticated;
