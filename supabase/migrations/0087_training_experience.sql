-- Training experience at signup (GRIZZ, 2026-10-13): the client picks Never
-- trained, Beginner, Intermediate or Advanced on the intake form. The trainer
-- is told their level, and for all but Advanced is offered a 6-week
-- foundation program (0086) to approve on the client's Training tab.
-- foundation_status: suggested (waiting on the trainer), approved, declined.

alter table public.clients
  add column if not exists training_level text check (training_level in ('never', 'beginner', 'intermediate', 'advanced')),
  add column if not exists foundation_status text check (foundation_status in ('suggested', 'approved', 'declined'));

create or replace function public.training_level_suggest()
returns trigger
language plpgsql
as $$
begin
  if new.training_level is not null
     and new.training_level is distinct from (case when tg_op = 'UPDATE' then old.training_level end)
     and new.foundation_status is null
     and new.training_level <> 'advanced' then
    new.foundation_status := 'suggested';
  end if;
  return new;
end;
$$;

create trigger clients_training_level_suggest
  before insert or update of training_level on public.clients
  for each row execute function public.training_level_suggest();

create or replace function public.notify_training_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  label text := case new.training_level
    when 'never' then 'has never trained'
    when 'beginner' then 'is a beginner'
    when 'intermediate' then 'is intermediate'
    else 'is advanced' end;
begin
  if new.trainer_id is null or new.training_level is null
     or new.training_level is not distinct from (case when tg_op = 'UPDATE' then old.training_level end) then
    return new;
  end if;
  perform public.push_to_user(
    new.trainer_id,
    'Training experience: ' || split_part(new.name, ' ', 1),
    split_part(new.name, ' ', 1) || ' ' || label || '.'
      || case when new.foundation_status = 'suggested'
           then ' Open their Training tab to approve a 6-week foundation program.'
           else '' end,
    jsonb_build_object('type', 'training_level', 'client_id', new.id)
  );
  return new;
end;
$$;

revoke execute on function public.notify_training_level() from public, anon, authenticated;

create trigger clients_training_level_notify
  after insert or update of training_level on public.clients
  for each row execute function public.notify_training_level();
