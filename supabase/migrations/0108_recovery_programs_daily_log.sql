-- Recovery, blended with GRIZZ's ChatGPT structure (2026-10-17):
--   * the eight activities are now Sleep, Hydration & nutrition, Active
--     recovery, Breathing & relaxation, Mobility & stretching, Massage &
--     foam rolling, Cold shower / ice bath and Sauna / heat (cold and heat
--     split; Rest & recharge folded into Active recovery). No rows used the
--     old keys yet.
--   * the Daily Log keeps whether a planned activity was skipped and an
--     optional note on soreness, energy or how they feel.
--   * clients pick one of three ready-made recovery programs (Training,
--     Sports or Lifestyle), or their coach picks it for them.
alter table public.recovery_activities drop constraint if exists recovery_activities_activity_check;
alter table public.recovery_activities add constraint recovery_activities_activity_check check (activity in (
  'sleep', 'hydration', 'easy_movement', 'breathing', 'stretching', 'foam_rolling', 'cold', 'sauna'
));

alter table public.recovery_activities add column if not exists skipped boolean not null default false;
alter table public.recovery_activities add column if not exists notes text;

alter table public.clients add column if not exists recovery_program text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_recovery_program_check') then
    alter table public.clients add constraint clients_recovery_program_check
      check (recovery_program is null or recovery_program in ('training', 'sports', 'lifestyle'));
  end if;
end $$;
