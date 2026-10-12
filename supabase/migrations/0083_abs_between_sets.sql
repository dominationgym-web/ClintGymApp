-- Abs between sets (GRIZZ, 2026-10-12): on the upper body, lower body, full
-- body, Chest & Bi and Back & Tri workouts the client does 20 reps of an ab
-- exercise between sets, and taps Complete before the rest timer starts.
-- programs.abs_between_sets marks the workouts that have it; the trainer can
-- switch it off for a client with clients.abs_between_sets.

alter table public.programs add column if not exists abs_between_sets boolean not null default false;
alter table public.clients add column if not exists abs_between_sets boolean not null default true;

update public.programs
  set abs_between_sets = true
  where trainer_id is null
    and (
      name ~* '^(home )?(upper body|lower body|chest & bi|back & tri)\y'
      or name ~* '^(home )?quick (upper|lower|full) body'
      or name ~* '^full body 3 x week'
      or name ~* '^home full body week'
    );

-- Trainers' own programs (GRIZZ, 2026-10-12): on saving a program the trainer
-- is asked about abs between sets and picks the reps and the exercise. A null
-- abs_exercise means a different ab exercise each set.
alter table public.programs add column if not exists abs_reps smallint not null default 20 check (abs_reps between 1 and 100);
alter table public.programs add column if not exists abs_exercise text;
