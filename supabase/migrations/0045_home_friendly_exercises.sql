-- Home training (GRIZZ, 2026-10-10): flag the exercises a client can do
-- without gym machines, using dumbbells, a barbell, kettlebells, bands, a
-- bench or bodyweight. The app shows them on a separate Home tab.
--
-- Worked out from the name: anything on a machine, cable, Smith machine,
-- leg press, sled, pool, rower, bike and so on is gym only, unless the name
-- starts with a free-weight or bodyweight tool. Trainers can fix any single
-- exercise later by updating home_friendly.

alter table public.exercises add column if not exists home_friendly boolean not null default false;

update public.exercises
set home_friendly = true
where home_friendly = false
  and (
  name !~* '(machine|cable|smith|hammer strength|pulldown|leg press|hack squat|pec deck|belt squat|pendulum|assault bike|rowing|skierg|sled|treadmill|elliptical|arc trainer|stair climber|versaclimber|captain|swim|cycling|ride|spin|battle ropes|leg extension|leg curl|hamstring curl|abduction|adduction|calf raise|calf press|back extension|hyperextension|seated .*row|face pull|dip|pullover|t-bar|preacher|pushdown|crunch|landmine)'
  or name ~* '^(band|bodyweight|dumbbell|kettlebell|barbell|plate) '
  or name in ('Stability Ball Leg Curl', 'Towel Slide Leg Curl', 'Nordic Hamstring Curl', 'Bench Dip',
              'Single-Leg Standing Calf Raise', 'Tibialis Raise', 'Diamond Push-Up')
);
