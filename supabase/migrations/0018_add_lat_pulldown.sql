-- Lat Pulldown alongside Pull-Up (not replacing it) - an alternative for
-- clients not yet strong enough for a full bodyweight pull-up.
update public.exercises set sort_order = sort_order + 1 where sort_order >= 8;

insert into public.exercises (name, category, source, external_url, sort_order) values
  ('Lat Pulldown', 'Pull', 'movekit', null, 8);
