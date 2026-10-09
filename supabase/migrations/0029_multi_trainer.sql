-- Other trainers, phase 1.
--
-- Until now the app had exactly one trainer, created by hand, and every client
-- signup was pinned to that trainer by an id baked into the build
-- (EXPO_PUBLIC_DEFAULT_TRAINER_ID). From here:
--
--   * Anyone can sign up as a trainer from the app, but starts unapproved. The
--     app owner (GRIZZ) approves them; until then they get a waiting screen
--     and no client can join them.
--   * Every trainer has a short join code. A client types it at signup, and
--     trainer_for_join_code() resolves it server side to an approved trainer.
--   * Each trainer keeps their own business name, logo, EFT details and
--     proof-of-payment WhatsApp number, shown to the clients who join them.
--
-- The client/trainer split in the rest of the schema already keyed everything
-- on clients.trainer_id, so no other table changes.

alter table public.trainers
  add column approved boolean not null default false,
  add column is_owner boolean not null default false,
  add column business_name text,
  add column logo_path text,
  add column phone text,
  add column pop_whatsapp text,
  add column eft_details jsonb not null default '{}'::jsonb,
  add column join_code text;

alter table public.trainers add constraint trainers_logo_path_own_folder
  check (logo_path is null or logo_path like id::text || '/%');

-- ---------------------------------------------------------------------------
-- Join codes: 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L)
-- so they survive being read out over WhatsApp.
-- ---------------------------------------------------------------------------
create or replace function public.generate_trainer_join_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.trainers where join_code = code);
  end loop;
  return code;
end;
$$;

-- The trainer who was here first is the app owner and is already approved.
-- Their EFT details move here from the signup screen, so nothing changes for
-- the clients who join them.
update public.trainers set approved = true;
update public.trainers
set is_owner = true,
    join_code = 'GRIZZ',
    pop_whatsapp = '076 423 2075',
    eft_details = jsonb_build_object(
      'account_holder', 'Viveshan Naidoo',
      'bank', 'Discovery Bank',
      'account_type', 'Current Account',
      'branch_code', '679000',
      'account_number', '14374977427'
    )
where id = (select id from public.trainers order by created_at limit 1);

update public.trainers set join_code = public.generate_trainer_join_code() where join_code is null;

alter table public.trainers
  alter column join_code set not null,
  add constraint trainers_join_code_key unique (join_code);

-- ---------------------------------------------------------------------------
-- Helpers. Security definer so policies on other tables can ask about trainers
-- without needing to read the trainers table themselves.
-- ---------------------------------------------------------------------------
create or replace function public.is_app_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trainers where id = auth.uid() and is_owner);
$$;

create or replace function public.trainer_is_approved(p_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trainers where id = p_trainer_id and approved);
$$;

create or replace function public.is_trainer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trainers where id = p_user_id);
$$;

-- What a client sees after typing a code at signup, before they have an
-- account. Only approved trainers resolve, and only the fields a client needs
-- to pay them.
create or replace function public.trainer_for_join_code(p_code text)
returns table (
  id uuid,
  display_name text,
  logo_path text,
  pop_whatsapp text,
  eft_details jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, coalesce(nullif(t.business_name, ''), t.name), t.logo_path, t.pop_whatsapp, t.eft_details
  from public.trainers t
  where t.join_code = upper(trim(p_code)) and t.approved;
$$;

revoke execute on function public.generate_trainer_join_code() from public, anon, authenticated;
grant execute on function public.trainer_for_join_code(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guard the columns a trainer must not set on themselves. RLS can't restrict
-- columns, so this mirrors prevent_client_self_privilege_escalation (0001).
-- Statements with no signed-in user (migrations, the dashboard, service role)
-- are left alone.
-- ---------------------------------------------------------------------------
create or replace function public.guard_trainer_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approved := false;
    new.is_owner := false;
    new.join_code := public.generate_trainer_join_code();
    return new;
  end if;

  if new.id is distinct from old.id
    or new.is_owner is distinct from old.is_owner
    or new.join_code is distinct from old.join_code
  then
    raise exception 'these trainer fields can''t be changed from the app';
  end if;

  if new.approved is distinct from old.approved
    and (not public.is_app_owner() or old.is_owner)
  then
    raise exception 'only the app owner can approve trainers';
  end if;

  -- The owner may approve or block another trainer, and nothing else about them.
  if auth.uid() <> old.id
    and (to_jsonb(new) - 'approved') is distinct from (to_jsonb(old) - 'approved')
  then
    raise exception 'only a trainer can edit their own profile';
  end if;

  return new;
end;
$$;

create trigger trainers_guard_columns
  before insert or update on public.trainers
  for each row execute function public.guard_trainer_columns();

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Trainer signup: a signed-in user creates their own trainer row, unless they
-- already have a client account (one login is one role).
create policy "trainer signs up self" on public.trainers
  for insert to authenticated
  with check (
    id = (select auth.uid())
    and not exists (select 1 from public.clients c where c.id = (select auth.uid()))
  );

-- The owner sees every trainer, to approve them.
create policy "owner sees all trainers" on public.trainers
  for select to authenticated
  using ((select public.is_app_owner()));

create policy "owner approves trainers" on public.trainers
  for update to authenticated
  using ((select public.is_app_owner()));

-- A client sees their own trainer, for the trainer's name, logo and payment
-- details on their Profile.
create policy "client sees own trainer" on public.trainers
  for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = (select auth.uid()) and c.trainer_id = trainers.id
    )
  );

-- Client signup now names its trainer from a join code, so the row it inserts
-- must point at an approved trainer, and a trainer can't also sign up as a
-- client. Keeps every condition 0023 added.
alter policy "client inserts own signup row" on public.clients
  with check (
    id = (select auth.uid())
    and access_status = 'expired'
    and status_flag = 'green'
    and status_flag_note is null
    and status_flag_updated_at is null
    and plan_started_at is null
    and plan_expires_at is null
    and lifestyle_reset_started_at is null
    and trainer_notes is null
    and public.trainer_is_approved(trainer_id)
    and not public.is_trainer((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Trainer logos. Public, because a logo is branding meant to be seen, and the
-- signup screen shows it before the client has an account. Each trainer
-- writes only to their own "<trainer_id>/" folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trainer-logos', 'trainer-logos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "trainer uploads own logo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trainer-logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_trainer((select auth.uid()))
  );

create policy "trainer deletes own logo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trainer-logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
