-- GRIZZ 2026-11-19: the session contract is written out in full and trainers
-- only tap the numbers (notice, holiday weeks, deposit) or leave points out.
-- The choices are kept here so the editor can show them again;
-- agreement_text still holds the finished wording clients sign.
alter table public.session_settings add column if not exists agreement_choices jsonb;

-- GRIZZ 2026-11-19: most trainers are paid in advance, so new trainers start there.
alter table public.session_settings alter column billing set default 'advance';
