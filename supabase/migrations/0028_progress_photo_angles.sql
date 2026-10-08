-- Each progress update is a set of three full-body photos: front, side and
-- back. A set is the photos sharing a taken_on date, so the same angle lines
-- up across dates for an honest comparison. One photo per angle per set;
-- retaking an angle replaces it (the app deletes the old one first).
--
-- Applied when no progress photos existed yet, so no backfill is needed.

create type public.progress_photo_angle as enum ('front', 'side', 'back');

alter table public.progress_photos
  add column angle public.progress_photo_angle not null;

alter table public.progress_photos
  add constraint progress_photos_one_per_angle unique (client_id, taken_on, angle);
