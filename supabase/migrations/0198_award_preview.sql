-- Owner preview of the trainer's award page (GRIZZ, 2026-11-08): what a
-- trainer sees once the award is switched on, even while it is off. p_sa
-- shows a South African trainer's page (prizes in rand) or an overseas one.
create or replace function public.award_preview_status(p_sa boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.award_settings;
begin
  if not public.is_app_owner() then
    raise exception 'Only the owner can preview the award';
  end if;
  select * into s from public.award_settings where id = 1;
  return jsonb_build_object(
    'enabled', true,
    'prize_text', coalesce(public.award_prize_words(public.award_prize_places(public.award_trainer_count()), p_sa), '')
                  || coalesce(chr(10) || s.prize_text, ''),
    'prize_tiers', (
      select jsonb_agg(jsonb_build_object('trainers', (t ->> 'trainers')::integer, 'prize', public.award_prize_words(t -> 'places', p_sa))
                       order by (t ->> 'trainers')::integer)
      from jsonb_array_elements(s.prize_tiers) t
    ),
    'start_at', s.start_at_trainers,
    'rules_text', s.rules_text,
    'rules_published', s.rules_published,
    'first_start', s.first_period_start,
    'stream_url', s.stream_url,
    'sample_places', (
      select jsonb_agg(jsonb_build_object('place', o, 'prize', public.award_money(p::numeric, p_sa)) order by o)
      from jsonb_array_elements_text(
        (select t -> 'places' from jsonb_array_elements(s.prize_tiers) t order by jsonb_array_length(t -> 'places') desc, (t ->> 'trainers')::integer limit 1)
      ) with ordinality as x(p, o)
    )
  );
end;
$$;
grant execute on function public.award_preview_status(boolean) to authenticated;

-- The rules now say how the rand prize is worked out (0197: R10 for every $1,
-- the same ratio as the subscription fees). Only changes the untouched default.
update public.award_settings
  set rules_text = replace(rules_text, 'Trainers in South Africa are paid the same prize in rand. ',
                           'Trainers in South Africa are paid in rand at R10 for every $1, the same ratio as their subscription fees. ')
  where id = 1 and position('Trainers in South Africa are paid the same prize in rand. ' in rules_text) > 0;
