-- Programs saved as drafts while a trainer builds them (GRIZZ, 2026-11-19:
-- "I was working on one yesterday then had to do something else and now it's
-- gone"). The builder saves what's on screen every moment, under the name the
-- trainer gave it, and the Programs tab lists the drafts at the top to carry
-- on with. A draft with program_id holds unsaved changes to a saved program.
-- Drafts live in their own table so no client ever sees a half-built program.

create table public.program_drafts (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  -- Set when the trainer is changing one of their saved programs.
  program_id uuid references public.programs (id) on delete cascade,
  name text not null default '',
  -- Everything on the builder screen: how-to, warm-up, days, exercises, gym or home.
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index program_drafts_trainer_idx on public.program_drafts (trainer_id, updated_at desc);
-- One set of unsaved changes per saved program.
create unique index program_drafts_program_idx on public.program_drafts (program_id) where program_id is not null;

alter table public.program_drafts enable row level security;

create policy "program drafts own" on public.program_drafts
  for all to authenticated
  using (trainer_id = (select auth.uid()))
  with check (
    trainer_id = (select auth.uid())
    and (program_id is null or exists (
      select 1 from public.programs p where p.id = program_id and p.trainer_id = (select auth.uid())
    ))
  );
