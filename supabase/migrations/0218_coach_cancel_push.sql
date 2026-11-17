-- Trainer cancels a session (GRIZZ 2026-11-17, "🚫 Cancel this session"):
-- the client's notification says whether a catch-up is coming, and the
-- coach's reason reads as a sentence. Same function as 0168 otherwise.
create or replace function public.log_session_cancellation(
  p_id uuid,
  p_by text,
  p_cancelled_at timestamptz,
  p_proof_path text default null,
  p_note text default null,
  p_charge text default null
)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.live_sessions;
  pol text;
  v_at timestamptz := least(coalesce(p_cancelled_at, now()), now());
begin
  if p_by not in ('client', 'trainer') then
    raise exception 'Who cancelled?';
  end if;
  select coalesce(p.policy, s.policy, '24h') into pol
  from public.live_sessions ls
  left join public.session_plans p on p.client_id = ls.client_id
  left join public.session_settings s on s.trainer_id = ls.trainer_id
  where ls.id = p_id;
  update public.live_sessions
  set status = 'cancelled', cancelled_by = p_by, cancelled_at = v_at, logged_by = 'trainer',
      charge = coalesce(p_charge, public.session_auto_charge(pol, p_by, starts_at, v_at)),
      proof_path = coalesce(p_proof_path, proof_path),
      note = coalesce(nullif(left(btrim(coalesce(p_note, '')), 500), ''), note),
      trainer_confirmed_at = null, asked_trainer = true, updated_at = now()
  where id = p_id and trainer_id = auth.uid() and status in ('booked', 'done', 'no_show', 'cancelled')
  returning * into saved;
  if saved.id is null then
    raise exception 'That session can''t be changed';
  end if;
  if p_by = 'trainer' and saved.starts_at > now() and saved.client_id is not null then
    perform public.push_to_user(
      saved.client_id,
      'Your coach cancelled ' || public.video_checkin_when(saved.starts_at, public.session_tz(saved.trainer_id)),
      coalesce(nullif(btrim(coalesce(p_note, '')), '') || '. ', '') ||
        case when saved.charge = 'makeup'
          then 'You won''t be charged for it, and your coach will find you a catch-up time.'
          else 'You won''t be charged for it.'
        end,
      jsonb_build_object('type', 'live_session')
    );
  end if;
  return saved;
end;
$$;

revoke execute on function public.log_session_cancellation(uuid, text, timestamptz, text, text, text) from public, anon;
grant execute on function public.log_session_cancellation(uuid, text, timestamptz, text, text, text) to authenticated;
