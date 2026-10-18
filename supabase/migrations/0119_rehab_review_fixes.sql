-- Rehab and recovery review fixes (2026-10-18).
--
-- 1. The intake injuries box (clients.injuries) can be marked healed, so an
--    injury from years ago stops flagging exercises in the injury check.
-- 2. The injury check warns instead of blocking. When the trainer keeps a
--    flagged exercise anyway, the reason is stored here so the card shows it
--    as "kept" instead of flagging it again. A keep only counts for the areas
--    it was made for: a new injury elsewhere flags the exercise again.
-- 3. The Flexibility 4 lower back program description gets the emergency
--    red flags (saddle numbness, bladder or bowel change) and the referral
--    line naming biokineticists.

alter table public.clients add column if not exists injuries_healed_on date;

create table if not exists public.client_injury_keeps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- The exercise id, or the lowercased name for an exercise not in the library.
  exercise_key text not null check (length(exercise_key) between 1 and 200),
  areas text[] not null default '{}',
  reason text not null check (length(reason) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (client_id, exercise_key)
);

alter table public.client_injury_keeps enable row level security;

-- The client can see why an exercise was kept; only their trainer writes.
create policy "injury keeps client reads own" on public.client_injury_keeps
  for select to authenticated
  using (client_id = (select auth.uid()));

create policy "injury keeps trainer manages" on public.client_injury_keeps
  for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = (select auth.uid())));

update public.programs
set description = replace(
  description,
  'Stop and see a doctor or physio if the pain is sharp, goes down a leg, or comes with numbness or pins and needles.',
  'Stop and see a doctor, physio or biokineticist if the pain is sharp, goes down a leg, or comes with numbness or pins and needles, or if it comes with fever, feeling unwell, a history of cancer, or follows a fall. Numbness around the groin or bottom, or new trouble controlling your bladder or bowel: go to the emergency room.'
)
where trainer_id is null
  and name = 'Flexibility 4 – Lower Back Release'
  and description like '%Stop and see a doctor or physio if the pain is sharp, goes down a leg, or comes with numbness or pins and needles.%';
