-- Phase 1 schema: core accountability loop.
-- Every client carries trainer_id from day one (multi-trainer ready, even though
-- there is only one trainer at launch) per the project brief's foundations.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Trainers
-- ---------------------------------------------------------------------------
create table public.trainers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create type public.access_status as enum ('active', 'expiring_soon', 'expired');
create type public.plan_type as enum ('intro_1mo', 'sub_6mo', 'sub_12mo');

create table public.clients (
  id uuid primary key references auth.users (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete restrict,
  name text not null,
  email text not null,
  phone text,
  goals text,
  injuries text,
  trainer_notes text,
  -- Free-form answers to the trainer's own intake questions. Kept as jsonb
  -- (rather than a rigid column-per-question schema) because the trainer is
  -- still designing the specific questions himself.
  intake_responses jsonb not null default '{}'::jsonb,
  access_status public.access_status not null default 'expired',
  plan_type public.plan_type,
  plan_started_at date,
  plan_expires_at date,
  consent_accepted_at timestamptz,
  privacy_policy_version text,
  created_at timestamptz not null default now()
);

create index clients_trainer_id_idx on public.clients (trainer_id);
create index clients_access_status_idx on public.clients (access_status);

-- ---------------------------------------------------------------------------
-- Daily morning check-ins
-- ---------------------------------------------------------------------------
create type public.high_gi_timing as enum ('before_training', 'before_bed', 'other');

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  checkin_date date not null default current_date,

  alcohol_units numeric(4, 1) not null default 0,

  sleep_bed_time time,
  sleep_asleep_time time,
  sleep_wake_time time,
  sleep_quality smallint check (sleep_quality between 1 and 5),

  water_litres numeric(4, 2) not null default 0,
  electrolytes boolean not null default false,

  meals_total smallint not null default 0,
  high_gi_count smallint not null default 0,
  high_gi_timing public.high_gi_timing[] not null default '{}',

  screen_time_before_bed_minutes smallint,
  read_non_backlit_device boolean not null default false,
  breathing_or_stretching_done boolean not null default false,

  -- Distress/pain flagging: surfaced prominently on the trainer dashboard,
  -- not pushed as an urgent notification (dashboard is checked daily).
  distress_flag boolean not null default false,
  distress_notes text,

  created_at timestamptz not null default now(),

  unique (client_id, checkin_date)
);

create index checkins_client_id_date_idx on public.checkins (client_id, checkin_date desc);
create index checkins_distress_flag_idx on public.checkins (distress_flag) where distress_flag = true;

-- ---------------------------------------------------------------------------
-- Training-proof videos (auto-delete ~30 days after upload)
-- ---------------------------------------------------------------------------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  checkin_id uuid references public.checkins (id) on delete set null,
  storage_provider text not null default 'supabase' check (storage_provider in ('supabase', 'mux', 'cloudflare_stream')),
  storage_path text not null,
  playback_url text,
  uploaded_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  deleted_at timestamptz
);

create index videos_client_id_idx on public.videos (client_id);
create index videos_expires_at_idx on public.videos (expires_at) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Exercise reference library (Phase 1: 8-10 licensed entries)
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  source text not null default 'muscle_and_motion' check (source in ('muscle_and_motion', 'own_library')),
  external_url text,
  sort_order smallint not null default 0
);

-- ---------------------------------------------------------------------------
-- Push notification tokens (daily trainer summary, client reminders)
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  created_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.trainers enable row level security;
alter table public.clients enable row level security;
alter table public.checkins enable row level security;
alter table public.videos enable row level security;
alter table public.exercises enable row level security;
alter table public.push_tokens enable row level security;

-- Trainers: a trainer can read/update only their own row.
create policy "trainers select own" on public.trainers
  for select using (id = auth.uid());
create policy "trainers update own" on public.trainers
  for update using (id = auth.uid());

-- Clients: the client can see/update their own record; their trainer can see
-- and update every client assigned to them (e.g. flipping access_status).
create policy "clients select own or trainer" on public.clients
  for select using (
    id = auth.uid()
    or trainer_id = auth.uid()
  );
create policy "clients update own profile fields" on public.clients
  for update using (id = auth.uid());
create policy "trainer manages own clients" on public.clients
  for update using (trainer_id = auth.uid());
create policy "trainer inserts own clients" on public.clients
  for insert with check (trainer_id = auth.uid());
-- Self-signup: a newly authenticated user creates their own client row,
-- always starting at access_status = 'expired' (default) until the trainer
-- confirms payment. Trusts the client-supplied trainer_id at signup time;
-- once there is more than one trainer this should move to an edge function
-- that resolves trainer_id server-side instead of accepting it from the client.
create policy "client inserts own signup row" on public.clients
  for insert with check (id = auth.uid() and access_status = 'expired');

-- Check-ins: client owns their check-ins; trainer can see check-ins for
-- their own clients only (never another trainer's clients).
create policy "checkins select own or trainer" on public.checkins
  for select using (
    client_id = auth.uid()
    or exists (
      select 1 from public.clients c
      where c.id = checkins.client_id and c.trainer_id = auth.uid()
    )
  );
create policy "checkins insert own" on public.checkins
  for insert with check (client_id = auth.uid());
create policy "checkins update own" on public.checkins
  for update using (client_id = auth.uid());

-- Videos: same client/trainer split as check-ins.
create policy "videos select own or trainer" on public.videos
  for select using (
    client_id = auth.uid()
    or exists (
      select 1 from public.clients c
      where c.id = videos.client_id and c.trainer_id = auth.uid()
    )
  );
create policy "videos insert own" on public.videos
  for insert with check (client_id = auth.uid());

-- Exercise library: readable by any signed-in user (trainer manages content
-- via service role / dashboard, not through the client app).
create policy "exercises readable by authenticated" on public.exercises
  for select using (auth.role() = 'authenticated');

-- Push tokens: a user manages only their own tokens.
create policy "push tokens owned by user" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Defense in depth: the "clients update own profile fields" policy above has
-- no per-column restriction, so RLS alone would let a client set their own
-- access_status/plan fields to 'active' via a direct update call. This is the
-- single highest-stakes bug this schema can have (per the brief's testing
-- plan), so it is enforced again here with a trigger, independent of the
-- policy wording above.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_client_self_privilege_escalation()
returns trigger as $$
begin
  if auth.uid() = old.id and auth.uid() <> old.trainer_id then
    if new.access_status is distinct from old.access_status
      or new.trainer_id is distinct from old.trainer_id
      or new.plan_type is distinct from old.plan_type
      or new.plan_started_at is distinct from old.plan_started_at
      or new.plan_expires_at is distinct from old.plan_expires_at
    then
      raise exception 'clients cannot modify their own access_status/trainer/plan fields';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger clients_prevent_self_privilege_escalation
  before update on public.clients
  for each row execute function public.prevent_client_self_privilege_escalation();
