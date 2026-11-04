-- Check-in nudge push: new wording (GRIZZ 2026-11-04). The body now says why
-- staying in touch matters, instead of "makes them feel special".
-- Same function as 0156, only the body text changed.
create or replace function public.checkin_nudges()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  first_name text;
  n integer;
  days integer;
begin
  for t in select tr.id from public.trainers tr where tr.approved loop
    select count(*) into n from public.quiet_clients_for(t.id) q;
    if n = 0 then
      continue;
    end if;
    -- The quietest client by name; the others are counted.
    select split_part(trim(q.name), ' ', 1), q.days_quiet into first_name, days
    from public.quiet_clients_for(t.id) q
    order by q.days_quiet desc, q.name
    limit 1;
    perform public.push_to_user(
      t.id,
      '💬 Check in on ' || first_name || case when n > 1 then ' and ' || (n - 1) || ' more' else '' end,
      'You haven''t spoken to ' || first_name || ' in ' || days || ' days. Regular client interaction improves client retention.',
      jsonb_build_object('type', 'checkin_nudge')
    );
  end loop;
end;
$$;

revoke execute on function public.checkin_nudges() from public, anon, authenticated;
