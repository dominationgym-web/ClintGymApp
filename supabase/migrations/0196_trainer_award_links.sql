-- Trainer of the Half-Year (0194/0195): link the award rows to their client,
-- trainer and period so they go when an account is removed. Sent on its own
-- because the connector waits on statements with the cascade wording.
alter table public.award_proofs
  add constraint award_proofs_client_fk foreign key (client_id) references public.clients (id) on delete cascade,
  add constraint award_proofs_trainer_fk foreign key (trainer_id) references public.trainers (id) on delete cascade;
alter table public.award_scores
  add constraint award_scores_period_fk foreign key (period_id) references public.award_periods (id) on delete cascade,
  add constraint award_scores_trainer_fk foreign key (trainer_id) references public.trainers (id) on delete cascade;
alter table public.award_trainer_flags
  add constraint award_trainer_flags_trainer_fk foreign key (trainer_id) references public.trainers (id) on delete cascade;
alter table public.award_trainer_messages
  add constraint award_trainer_messages_trainer_fk foreign key (trainer_id) references public.trainers (id) on delete cascade;
alter table public.award_periods
  add constraint award_periods_winner_fk foreign key (winner_id) references public.trainers (id) on delete set null;
alter table public.app_opens
  add constraint app_opens_user_fk foreign key (user_id) references auth.users (id) on delete cascade;
