-- Home-screen calendar widget (GRIZZ, 2026-11-16): the trainer's 1 on 1
-- sessions still to come today, on the phone's home screen, without opening
-- the app. A name only drops off once it's marked trained or cancelled (or
-- no-show / taken off) in the app; one that's over but not marked stays,
-- shown with a "?".
--
-- The widget runs outside the app (Android: a background task, iPhone: a
-- widget extension) so it can't share the app's login, whose refresh token
-- changes on every refresh. Instead the app makes a long random widget key
-- for the signed-in trainer, keeps it on the phone, and drops it again on
-- sign-out. Only a hash of the key is stored. The key can do one thing: read
-- the trainer's booked sessions (time, length and name) for the widget.

create table if not exists public.widget_keys (
  key_hash text primary key,
  -- No foreign key: a key whose trainer is gone simply finds no sessions.
  trainer_id uuid not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- Set on sign-out (or when a newer key replaces it): the key stops working.
  revoked_at timestamptz
);
alter table public.widget_keys add column if not exists revoked_at timestamptz;
create index if not exists widget_keys_trainer_idx on public.widget_keys (trainer_id, created_at);
alter table public.widget_keys enable row level security;
-- No policies: only the functions below touch it.

create or replace function public.widget_key_hash(p_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
$$;
revoke execute on function public.widget_key_hash(text) from public, anon;

-- The signed-in trainer gets a new widget key (and the phone's old one, if
-- it had one, stops working). A trainer keeps at most 5 (phone, tablet...).
create or replace function public.create_widget_key(p_old text default null)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if auth.uid() is null or not exists (select 1 from public.trainers t where t.id = auth.uid()) then
    raise exception 'Only a trainer can add the calendar widget';
  end if;
  if p_old is not null then
    update public.widget_keys set revoked_at = now() where key_hash = public.widget_key_hash(p_old) and revoked_at is null;
  end if;
  v_key := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.widget_keys (key_hash, trainer_id) values (public.widget_key_hash(v_key), auth.uid());
  update public.widget_keys set revoked_at = now()
  where trainer_id = auth.uid()
    and revoked_at is null
    and key_hash not in (
      select key_hash from public.widget_keys where trainer_id = auth.uid() and revoked_at is null order by created_at desc limit 5
    );
  return v_key;
end;
$$;
revoke execute on function public.create_widget_key(text) from public, anon;
grant execute on function public.create_widget_key(text) to authenticated;

-- Sign-out: the phone's key stops working. Works without a login, since the
-- session may already be gone.
create or replace function public.revoke_widget_key(p_key text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.widget_keys set revoked_at = now() where key_hash = public.widget_key_hash(p_key) and revoked_at is null;
$$;
revoke execute on function public.revoke_widget_key(text) from public;
grant execute on function public.revoke_widget_key(text) to anon, authenticated;

-- What the widget shows: booked sessions from the last 3 days (over but not
-- marked) up to 2 days ahead, oldest first. ok = false means the key is no
-- longer valid (signed out), so the widget asks to log in.
create or replace function public.widget_sessions(p_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_trainer uuid;
  v_rows jsonb;
begin
  update public.widget_keys set last_used_at = now()
  where key_hash = public.widget_key_hash(p_key) and revoked_at is null
  returning trainer_id into v_trainer;
  if v_trainer is null then
    return jsonb_build_object('ok', false);
  end if;
  select coalesce(jsonb_agg(r order by r.starts_at, r.name), '[]'::jsonb) into v_rows
  from (
    select ls.id, ls.starts_at, ls.minutes,
           coalesce(c.name, ls.guest_name, 'Client') as name
    from public.live_sessions ls
    left join public.clients c on c.id = ls.client_id
    where ls.trainer_id = v_trainer
      and ls.status = 'booked'
      and ls.starts_at >= now() - interval '3 days'
      and ls.starts_at < now() + interval '2 days'
    order by ls.starts_at
    limit 40
  ) r;
  return jsonb_build_object('ok', true, 'sessions', v_rows, 'at', now());
end;
$$;
revoke execute on function public.widget_sessions(text) from public;
grant execute on function public.widget_sessions(text) to anon, authenticated;
