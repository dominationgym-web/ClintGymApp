-- Drop set programs (GRIZZ, 2026-10-16): for intermediate and advanced
-- lifters. 3 programs per body part, each ONE exercise done as 2 rounds
-- (intermediate) or 3 rounds (advanced) of a drop set. A round: a start weight
-- you can do 4-8 reps max, then 6-10 lighter sets (6-8 on barbell and
-- plate-loaded lifts, 8-10 on machines, cables and dumbbells), every set to
-- failure, resting only long enough to change the weight. Built-in quick
-- programs named "Drop Set Chest 1".."3" (clients see "Drop Set Chest").
-- program_exercises.sets is 3; the app shows 2 rounds for intermediate
-- (and beginner or unknown) clients and 3 for advanced (clients.training_level).
--
-- drop_set_rounds: one row per finished round, with how long it took (the
-- clock pauses while the client types the next weight), how many drops they
-- did after the start weight and their total reps. Clients write their own
-- rows while they have access; their trainer reads them. Safe to run again.

create table if not exists public.drop_set_rounds (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  program_id uuid,
  exercise_id uuid,
  exercise_name text not null default '',
  log_date date not null default current_date,
  round_number smallint not null check (round_number between 1 and 10),
  seconds integer not null check (seconds between 0 and 7200),
  drops smallint not null check (drops between 0 and 30),
  total_reps smallint not null check (total_reps between 0 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists drop_set_rounds_client_idx
  on public.drop_set_rounds (client_id, exercise_id, log_date desc);

alter table public.drop_set_rounds enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'drop_set_rounds' and policyname = 'drop set rounds select own or trainer') then
    create policy "drop set rounds select own or trainer" on public.drop_set_rounds
      for select using (
        client_id = (select auth.uid())
        or exists (select 1 from public.clients c where c.id = drop_set_rounds.client_id and c.trainer_id = (select auth.uid()))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'drop_set_rounds' and policyname = 'drop set rounds insert own') then
    create policy "drop set rounds insert own" on public.drop_set_rounds
      for insert with check (client_id = (select auth.uid()) and public.client_has_access(client_id));
  end if;
end $$;

create or replace function pg_temp.add_program(p_name text, p_exercise text, p_reps text, p_description text, p_nutrition text, p_warm_up text)
returns void language plpgsql as $f$
declare
  prog uuid;
  ex uuid;
begin
  if exists (select 1 from public.programs where trainer_id is null and name = p_name) then
    return;
  end if;
  select e.id into ex from public.exercises e where e.name = p_exercise order by e.sort_order limit 1;
  if ex is null then
    raise exception 'exercise % (for %) is not in the library', p_exercise, p_name;
  end if;
  insert into public.programs (trainer_id, name, kind, place, weeks, description, nutrition, warm_up, day_titles)
  values (null, p_name, 'quick', 'gym', 1, p_description, p_nutrition, p_warm_up, '{}'::text[])
  returning id into prog;
  insert into public.program_exercises (program_id, week_number, day_number, sort_order, exercise_id, exercise_name, sets, reps, rest_seconds, kind)
  values (prog, 1, 1, 1, ex, p_exercise, 3, p_reps, 360, 'exercise');
end $f$;

do $$
declare
  nutrition text := 'Drop sets burn a lot of energy in a short time, so fuel them. Eat a meal with carbs and 25-40 g of protein 1-2 hours before, such as chicken and rice or eggs on toast. Afterwards, have another 25-40 g of protein within a couple of hours. Aim for 1.6-2.2 g of protein per kg a day. Drink 500 ml of water in the 2 hours before and sip between rounds.';
  warm_up text := '5 minutes easy on the bike or rower, then 2 light sets of the exercise: 15 reps at about 40% of your start weight and 8 reps at about 60%. Rest a minute, then start your first round.';
  how text := ' Drop sets are for intermediate and advanced lifters: intermediate do 2 rounds, advanced do 3. Each round: pick a start weight you can only do 4-8 reps with and go to failure. Then drop the weight a little (about 10-20%%) and go straight back to failure. Keep going for %s drops. Rest only long enough to change the weight, and rest 5 to 6 minutes between rounds because drop sets are very tiring. To log: put in your start weight and record your reps, and the round clock starts. It pauses while you type your next weight and starts again when you tap Log. Your round time is part of your output, so try to beat it next time.';
  mach text := '8-10';
  bar text := '6-8';
  reps_m text := 'Start weight 4-8 reps, then 8-10 drops, all to failure';
  reps_b text := 'Start weight 4-8 reps, then 6-8 drops, all to failure';
begin
  -- Chest
  perform pg_temp.add_program('Drop Set Chest 1', 'Machine Chest Press', reps_m, 'Machine chest press drop set.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Chest 2', 'Machine Pec Fly', reps_m, 'Pec fly machine drop set.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Chest 3', 'Cable Fly', reps_m, 'Cable fly drop set.' || format(how, mach), nutrition, warm_up);
  -- Back
  perform pg_temp.add_program('Drop Set Back 1', 'Lat Pulldown', reps_m, 'Lat pulldown drop set.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Back 2', 'Seated Cable Row', reps_m, 'Seated cable row drop set.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Back 3', 'Machine Neutral Row', reps_m, 'Neutral-grip machine row drop set.' || format(how, mach), nutrition, warm_up);
  -- Quads
  perform pg_temp.add_program('Drop Set Quads 1', 'Leg Extension', reps_m, 'Leg extension drop set.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Quads 2', 'Leg Press', reps_b, 'Leg press drop set. It is plate-loaded, so have a partner strip plates if you can.' || format(how, bar), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Quads 3', 'Smith Machine Squat', reps_b, 'Smith machine squat drop set. Rack the bar safely before each weight change.' || format(how, bar), nutrition, warm_up);
  -- Hamstrings
  perform pg_temp.add_program('Drop Set Hamstrings 1', 'Lying Leg Curl', reps_m, 'Lying leg curl drop set.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Hamstrings 2', 'Seated Leg Curl', reps_m, 'Seated leg curl drop set.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Hamstrings 3', 'Cable Pull Through', reps_m, 'Cable pull through drop set. Hinge at the hips and keep your back flat.' || format(how, mach), nutrition, warm_up);
  -- Glutes
  perform pg_temp.add_program('Drop Set Glutes 1', 'Machine Hip Thrust', reps_b, 'Hip thrust machine drop set.' || format(how, bar), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Glutes 2', 'Glute Kickback Machine', reps_m, 'Glute kickback machine drop set. Do each round on one leg, then the other.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Glutes 3', 'Hip Abduction', reps_m, 'Hip abduction machine drop set.' || format(how, mach), nutrition, warm_up);
  -- Shoulders: side and rear delts only (no overhead pressing)
  perform pg_temp.add_program('Drop Set Shoulders 1', 'Machine Lateral Raise', reps_m, 'Lateral raise machine drop set for the side delts.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Shoulders 2', 'Dumbbell Lateral Raise', reps_m, 'Dumbbell lateral raise drop set for the side delts. Run down the dumbbell rack.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Shoulders 3', 'Reverse Pec Deck', reps_m, 'Reverse pec deck drop set for the rear delts.' || format(how, mach), nutrition, warm_up);
  -- Biceps
  perform pg_temp.add_program('Drop Set Biceps 1', 'Cable Curl', reps_m, 'Cable curl drop set.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Biceps 2', 'Dumbbell Curl', reps_m, 'Dumbbell curl drop set. Run down the dumbbell rack.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Biceps 3', 'Machine Preacher Curl', reps_m, 'Preacher curl machine drop set.' || format(how, mach), nutrition, warm_up);
  -- Triceps
  perform pg_temp.add_program('Drop Set Triceps 1', 'Cable Rope Pushdown', reps_m, 'Rope pushdown drop set.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Triceps 2', 'Machine Tricep Extension', reps_m, 'Tricep extension machine drop set.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Triceps 3', 'Cable Bar Pushdown', reps_m, 'Straight bar pushdown drop set.' || format(how, mach), nutrition, warm_up);
  -- Calves
  perform pg_temp.add_program('Drop Set Calves 1', 'Standing Calf Raise', reps_m, 'Standing calf raise drop set. Pause at the bottom of every rep.' || format(how, mach), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Calves 2', 'Seated Calf Raise', reps_b, 'Seated calf raise drop set. It is plate-loaded, so take a plate off each time.' || format(how, bar), nutrition, warm_up);
  perform pg_temp.add_program('Drop Set Calves 3', 'Smith Machine Calf Raise', reps_b, 'Smith machine calf raise drop set.' || format(how, bar), nutrition, warm_up);
end $$;
