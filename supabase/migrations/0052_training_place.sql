-- Home or gym training for each client (2026-10-10): picked at signup, and the
-- trainer can switch it on the client's Training tab. Home clients get a home
-- exercise of the same body part in place of each gym-only one in their
-- program (worked out in the app). Starts from the Women's Health Reset choice
-- where a client already made one.
alter table public.clients
  add column training_place text not null default 'gym' check (training_place in ('gym', 'home'));

update public.clients set training_place = reset_location where reset_location = 'home';
