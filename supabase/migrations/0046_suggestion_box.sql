-- Suggestion box (GRIZZ, 2026-10-10): every client and trainer can suggest
-- how to improve the app. All suggestions go to the app owner (GRIZZ), who
-- marks each one a good idea or not for now. People see their own.

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Filled in by the trigger below from the author's own row, so nobody can
  -- post under someone else's name.
  author_role text not null default 'client' check (author_role in ('client', 'trainer')),
  author_name text not null default '',
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  status text not null default 'new' check (status in ('new', 'good_idea', 'not_now')),
  created_at timestamptz not null default now()
);

create index suggestions_created_at_idx on public.suggestions (created_at desc);
create index suggestions_author_idx on public.suggestions (author_id);

create or replace function public.fill_suggestion_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trainer_name text;
  v_client_name text;
begin
  new.author_id := auth.uid();
  new.status := 'new';
  new.created_at := now();
  select t.name into v_trainer_name from public.trainers t where t.id = new.author_id;
  if found then
    new.author_role := 'trainer';
    new.author_name := coalesce(v_trainer_name, '');
    return new;
  end if;
  select c.name into v_client_name from public.clients c where c.id = new.author_id;
  if found then
    new.author_role := 'client';
    new.author_name := coalesce(v_client_name, '');
    return new;
  end if;
  raise exception 'Only clients and trainers can make suggestions';
end;
$$;

revoke execute on function public.fill_suggestion_author() from public, anon, authenticated;

create trigger suggestions_fill_author
  before insert on public.suggestions
  for each row execute function public.fill_suggestion_author();

alter table public.suggestions enable row level security;

create policy "suggestions insert own"
  on public.suggestions for insert to authenticated
  with check (author_id = (select auth.uid()));

create policy "suggestions read own or owner"
  on public.suggestions for select to authenticated
  using (author_id = (select auth.uid()) or (select public.is_app_owner()));

create policy "suggestions owner sets status"
  on public.suggestions for update to authenticated
  using ((select public.is_app_owner()))
  with check ((select public.is_app_owner()));

-- Clients and trainers read and add; the owner can only change the status;
-- nobody removes one.
revoke all on public.suggestions from anon, authenticated;
grant select, insert on public.suggestions to authenticated;
grant update (status) on public.suggestions to authenticated;
