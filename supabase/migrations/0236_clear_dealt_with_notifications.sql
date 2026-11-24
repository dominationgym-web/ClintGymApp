-- Clear "Did your 06:30 with X happen?" once it's dealt with (GRIZZ 2026-11-24:
-- "once I've approved clients' sessions it's still giving me notifications
-- asking if they trained").
--
--   * The trainer's question (live_session_ask) now carries the session ids it
--     asks about. Once none of them is still booked (marked Done, Cancelled,
--     No-show, removed, or moved to a later time), its inbox row is marked read.
--   * The client's "Did you train with X?" (live_session_confirm) is marked read
--     once they confirm or say it didn't happen, or the trainer un-marks it.
--   * The app takes any notification whose inbox row is read off the phone
--     (clearHandledNotifications in src/lib/notifications.ts).
--   * Questions already sent are tidied up now the same way.

-- ---------------------------------------------------------------------------
-- The question now says which sessions it's about
-- ---------------------------------------------------------------------------
create or replace function public.live_session_asks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  -- One question per time slot, so a group session asks once.
  for v in
    select ls.trainer_id, ls.starts_at, array_agg(ls.id) as ids, count(*) as n,
           string_agg(split_part(coalesce(c.name, ls.guest_name, 'client'), ' ', 1), ', ' order by coalesce(c.name, ls.guest_name)) as names,
           (array_agg(ls.client_id))[1] as client_id
    from public.live_sessions ls
    left join public.clients c on c.id = ls.client_id
    where ls.status = 'booked' and not ls.asked_trainer
      and ls.starts_at + make_interval(mins => ls.minutes) + interval '15 minutes' <= now()
      and ls.starts_at > now() - interval '2 days'
    group by ls.trainer_id, ls.starts_at
  loop
    update public.live_sessions set asked_trainer = true where id = any (v.ids);
    perform public.push_to_user(
      v.trainer_id,
      case when v.n > 1
        then '👥 Who came to your ' || to_char(v.starts_at at time zone public.session_tz(v.trainer_id), 'HH24:MI') || ' group?'
        else '🤝 Did your ' || to_char(v.starts_at at time zone public.session_tz(v.trainer_id), 'HH24:MI') || ' with ' || v.names || ' happen?'
      end,
      case when v.n > 1 then v.names || '. Tick who came so it''s on their invoices.'
        else 'Tap Done, Cancelled or No-show so it''s on their invoice.' end,
      jsonb_build_object('type', 'live_session_ask', 'clientId', v.client_id, 'sessionIds', to_jsonb(v.ids))
    );
  end loop;
end;
$$;

revoke execute on function public.live_session_asks() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Is this trainer question still waiting on anything?
-- ---------------------------------------------------------------------------
-- Questions sent before this migration have no session ids, so they're matched
-- by time: the question goes out on the first 5-minute run 15 minutes after the
-- session ends, so the slot is the one that ended 15-25 minutes before it.
create or replace function public.live_session_ask_open(p_item public.inbox_items)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_item.data ? 'sessionIds' then exists (
      select 1 from public.live_sessions s
      where s.id::text in (select jsonb_array_elements_text(p_item.data -> 'sessionIds'))
        and s.status = 'booked'
        -- Moved to a later time: the question about the old slot is done with.
        and s.starts_at < p_item.created_at
    )
    else exists (
      select 1 from public.live_sessions s
      where s.trainer_id = p_item.user_id
        and s.status = 'booked'
        and s.starts_at + make_interval(mins => s.minutes) + interval '15 minutes' <= p_item.created_at
        and s.starts_at + make_interval(mins => s.minutes) + interval '25 minutes' > p_item.created_at
    )
  end;
$$;

revoke execute on function public.live_session_ask_open(public.inbox_items) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- When a session is dealt with, clear the questions about it
-- ---------------------------------------------------------------------------
create or replace function public.live_session_clear_inbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trainer's "Did it happen?": the session left 'booked', or was moved.
  if (old.status = 'booked' and new.status <> 'booked') or new.starts_at is distinct from old.starts_at then
    update public.inbox_items i set read_at = now()
    where i.user_id = new.trainer_id
      and i.read_at is null
      and i.data ->> 'type' = 'live_session_ask'
      and i.created_at >= least(old.starts_at, new.starts_at)
      and i.created_at < greatest(old.starts_at, new.starts_at) + interval '3 days'
      and not public.live_session_ask_open(i);
  end if;

  -- Client's "Did you train with X?": answered, or no longer marked done.
  if new.client_id is not null and (
       (old.client_confirmed_at is null and new.client_confirmed_at is not null)
    or (old.client_disputed_at is null and new.client_disputed_at is not null)
    or (old.status = 'done' and new.status <> 'done')
  ) then
    update public.inbox_items i set read_at = now()
    where i.user_id = new.client_id
      and i.read_at is null
      and i.data ->> 'type' = 'live_session_confirm'
      and i.data ->> 'sessionId' = new.id::text;
  end if;
  return new;
end;
$$;

create trigger live_session_clear_inbox
  after update of status, starts_at, client_confirmed_at, client_disputed_at on public.live_sessions
  for each row execute function public.live_session_clear_inbox();

-- ---------------------------------------------------------------------------
-- Tidy up what's already been sent
-- ---------------------------------------------------------------------------
update public.inbox_items i set read_at = now()
where i.read_at is null
  and i.data ->> 'type' = 'live_session_ask'
  and not public.live_session_ask_open(i);

update public.inbox_items i set read_at = now()
where i.read_at is null
  and i.data ->> 'type' = 'live_session_confirm'
  and exists (
    select 1 from public.live_sessions s
    where s.id::text = i.data ->> 'sessionId'
      and (s.client_confirmed_at is not null or s.client_disputed_at is not null or s.status <> 'done')
  );
