-- Trainer of the Half-Year (GRIZZ, 2026-11-09): "This app is all about
-- interaction". A verified client now needs their trainer to respond at
-- least once every week, not twice a month. min_interactions now means
-- two-way interactions per week; each of the last 4 weeks the client has
-- been on the app for counts (a client needs at least one full week).
alter table public.award_settings alter column min_interactions set default 1;
update public.award_settings set min_interactions = 1 where id = 1 and min_interactions = 2;

create or replace function public.award_client_verified(p_client uuid, p_on date)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  need integer;
  joined date;
  wk_end date;
  weeks integer := 0;
begin
  select id, trainer_id, face_photo_path, award_flag, plan_started_at, created_at into c from public.clients where id = p_client;
  if c.id is null or c.face_photo_path is null or coalesce(c.award_flag, '') in ('suspicious', 'rejected') or c.id = c.trainer_id then
    return false;
  end if;
  select min_interactions into need from public.award_settings where id = 1;
  if not exists (select 1 from public.award_client_action_days(p_client, p_on - 29, p_on)) then
    return false;
  end if;
  joined := public.award_joined_on(c.plan_started_at, c.created_at);
  for w in 0..3 loop
    wk_end := p_on - 7 * w;
    exit when wk_end - 6 < joined;
    weeks := weeks + 1;
    if public.award_interactions(p_client, c.trainer_id, wk_end - 6, wk_end) < coalesce(need, 1) then
      return false;
    end if;
  end loop;
  return weeks > 0;
end;
$$;

-- The rules say so (only changes the untouched default sentence).
update public.award_settings
  set rules_text = replace(rules_text, 'you respond to them at least twice a month',
                           'you respond to them at least once every week')
  where id = 1 and position('you respond to them at least twice a month' in rules_text) > 0;
