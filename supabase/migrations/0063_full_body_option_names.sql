-- GRIZZ found "Full body 3-day" confusing (2026-10-11): the five Mon/Wed/Fri
-- programs are now "Full Body 3 x week option 1" to 5. Clients see
-- "Full Body 3 x week" (displayProgramName drops " option N").
update public.programs
set name = replace(name, 'Full body 3-day ', 'Full Body 3 x week option '),
    description = replace(replace(description, 'Move on to the next variation', 'Move on to the next option'), 'Variation ', 'Option ')
where trainer_id is null and name like 'Full body 3-day %';
