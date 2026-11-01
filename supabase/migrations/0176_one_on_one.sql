-- Two trainer sides (GRIZZ, 2026-11-01): "1 on 1" for in-person session
-- tracking and "Evolution" for online clients. Each client is 1 on 1,
-- Evolution or both:
--   live_only = true                  -> 1 on 1 only (0169)
--   one_on_one = true, live_only false -> both
--   neither                           -> Evolution only
-- one_on_one puts the client on the 1 on 1 side's Clients tab.

alter table public.clients add column if not exists one_on_one boolean not null default false;

-- Everyone already training in person.
update public.clients c set one_on_one = true
where not c.one_on_one
  and (c.live_only or exists (select 1 from public.session_plans p where p.client_id = c.id));

-- Setting up a client's sessions puts them on the 1 on 1 side.
create or replace function public.session_plan_marks_one_on_one()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients set one_on_one = true where id = new.client_id and not one_on_one;
  return new;
end;
$$;

create or replace trigger session_plan_marks_one_on_one
after insert on public.session_plans
for each row execute function public.session_plan_marks_one_on_one();

-- A 1 on 1 only client is always on the 1 on 1 side; clients can't change it.
create or replace function public.guard_one_on_one()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and auth.uid() <> old.trainer_id
     and new.one_on_one is distinct from old.one_on_one then
    raise exception 'clients cannot modify their own access_status/trainer/plan fields';
  end if;
  if new.live_only then
    new.one_on_one := true;
  end if;
  return new;
end;
$$;

create or replace trigger guard_one_on_one
before update on public.clients
for each row execute function public.guard_one_on_one();
