-- Habit wins (GRIZZ, 2026-10-12): when a client keeps a habit on 5 of the 7
-- days of a week (Monday to Sunday), their trainer gets a push naming the
-- habit, and the dashboard lists the client's wins so the trainer can send a
-- personally worded message (GRIZZ: no ready-made text). A habit set for
-- fewer than 5 days a week counts once every one of its days is done. One row
-- per client per week; each habit is announced once.

create table if not exists public.habit_wins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  trainer_id uuid,
  week_start date not null,
  -- [{habit_id, name, days}] in the order they were achieved.
  habits jsonb not null default '[]'::jsonb,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, week_start)
);

alter table public.habit_wins enable row level security;

create policy "habit wins read by client or trainer" on public.habit_wins
  for select using (
    client_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = habit_wins.client_id and c.trainer_id = auth.uid())
  );
-- Writes go through record_habit_win (trigger) and acknowledge_habit_win.

/** Days this week the habit was done (reps reached), and the days it needs. */
create or replace function public.habit_week_progress(p_habit uuid, p_week_start date)
returns table (done int, needed int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.habit_logs l
      where l.habit_id = h.id
        and l.log_date between p_week_start and p_week_start + 6
        and l.reps_completed >= greatest(h.reps_target, 1)),
    least(5, greatest(1, coalesce(array_length(h.active_days, 1), 7)))
  from public.habits h
  where h.id = p_habit;
$$;

create or replace function public.record_habit_win()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  wk date;
  prog record;
  win public.habit_wins;
  first_name text;
begin
  if new.reps_completed <= 0 then
    return new;
  end if;
  select hb.id, hb.name, hb.client_id, c.trainer_id, c.name as client_name
    into h
    from public.habits hb
    join public.clients c on c.id = hb.client_id
    where hb.id = new.habit_id;
  if h.id is null or h.trainer_id is null then
    return new;
  end if;
  wk := date_trunc('week', new.log_date)::date;
  select * into prog from public.habit_week_progress(h.id, wk);
  if prog.done < prog.needed then
    return new;
  end if;

  insert into public.habit_wins (client_id, trainer_id, week_start)
  values (h.client_id, h.trainer_id, wk)
  on conflict (client_id, week_start) do nothing;
  select * into win from public.habit_wins where client_id = h.client_id and week_start = wk for update;
  if win.habits @> jsonb_build_array(jsonb_build_object('habit_id', h.id)) then
    return new;
  end if;

  update public.habit_wins
    set habits = habits || jsonb_build_array(jsonb_build_object('habit_id', h.id, 'name', h.name, 'days', prog.done)),
        trainer_id = h.trainer_id,
        acknowledged_at = null,
        updated_at = now()
    where id = win.id;

  first_name := split_part(coalesce(h.client_name, 'Your client'), ' ', 1);
  begin
    perform public.push_to_user(
      h.trainer_id,
      '🏆 ' || first_name || ' hit ' || prog.done || '/7',
      first_name || ' kept "' || h.name || '" ' || prog.done || ' days this week. Send them a personal message to keep them going.',
      jsonb_build_object('type', 'habit_win', 'client_id', h.client_id)
    );
  exception when others then
    -- A failed push must never stop the client ticking a habit.
    null;
  end;
  return new;
end;
$$;

create or replace trigger habit_logs_record_win
  after insert or update of reps_completed on public.habit_logs
  for each row execute function public.record_habit_win();

/** The trainer's own message to the client about their wins; marks the win acknowledged. */
create or replace function public.acknowledge_habit_win(p_win uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  win public.habit_wins;
begin
  select w.* into win from public.habit_wins w
    join public.clients c on c.id = w.client_id
    where w.id = p_win and c.trainer_id = auth.uid();
  if win.id is null then
    raise exception 'Not your client';
  end if;
  if length(coalesce(trim(p_message), '')) < 2 then
    raise exception 'Write a message to your client';
  end if;
  insert into public.coach_messages (client_id, trainer_id, body)
  values (win.client_id, auth.uid(), left(trim(p_message), 1000));
  update public.habit_wins set acknowledged_at = now() where id = win.id;
end;
$$;

grant execute on function public.acknowledge_habit_win(uuid, text) to authenticated;
revoke execute on function public.record_habit_win() from public, anon, authenticated;
revoke execute on function public.habit_week_progress(uuid, date) from public, anon;
