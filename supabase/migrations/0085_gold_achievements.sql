-- Gold achievement badges (GRIZZ, 2026-10-13): a badge pops up every time a
-- client lifts 10% more than their starting weight (or their last badge's
-- weight) on an exercise, for at least the same reps. Each badge is a row
-- here, which is also the starting point for the next one. The trainer gets
-- a push for each.

create table if not exists public.client_achievements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  from_weight numeric not null,
  from_reps int not null,
  weight numeric not null,
  reps int not null,
  achieved_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists client_achievements_client_idx on public.client_achievements (client_id, exercise_name);

alter table public.client_achievements enable row level security;

create policy "achievements read by client or trainer" on public.client_achievements
  for select using (
    client_id = (select auth.uid())
    or exists (select 1 from public.clients c where c.id = client_achievements.client_id and c.trainer_id = (select auth.uid()))
  );

-- Only the client records their own, and only a real 10% jump.
create policy "client records own achievement" on public.client_achievements
  for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and weight >= from_weight * 1.1
    and reps >= from_reps
  );

create or replace function public.notify_client_achievement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  select id, name, trainer_id into c from public.clients where id = new.client_id;
  if c.trainer_id is null then
    return new;
  end if;
  perform public.push_to_user(
    c.trainer_id,
    '🏅 Gold achievement',
    split_part(c.name, ' ', 1) || ' lifted ' || trim_scale(new.weight)::text || 'kg x ' || new.reps
      || ' on ' || new.exercise_name || ', up from ' || trim_scale(new.from_weight)::text || 'kg.',
    jsonb_build_object('type', 'achievement', 'client_id', new.client_id)
  );
  return new;
end;
$$;

revoke execute on function public.notify_client_achievement() from public, anon, authenticated;

create trigger client_achievements_notify
  after insert on public.client_achievements
  for each row execute function public.notify_client_achievement();
