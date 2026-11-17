-- Automatic "how to pay" emails for trainers (GRIZZ, 2026-11-17).
--
-- The phone apps can't point trainers to the website to pay (Apple and Google
-- don't allow it in South Africa), so the way there is an email, sent outside
-- the app. Emails are allowed: Apple 3.1.3 lets developers "send
-- communications outside of the app" about other ways to pay.
--
-- * billing_emails is a queue. billing_reminders (and the approval trigger
--   below) add a row; the billing-emails Edge Function sends each one through
--   Resend and stamps sent_at. Only the service role reads or writes it.
-- * billing_settings.billing_emails_enabled is the owner's switch (Billing on
--   the Trainers tab), off until the email service is set up. While it's off
--   nothing is queued and the push reminders don't mention email.
-- * The push reminders no longer say "Pay by EFT" or "Open the app for the
--   payment details" (the phone app shows none): they say what's due and,
--   with emails on, "We've emailed you the details."
-- * Trainers whose saved card pays automatically get a heads-up instead of
--   "please pay", and no reminder on the day (the card is charged that morning).

alter table public.billing_settings
  add column if not exists billing_emails_enabled boolean not null default false;

create table if not exists public.billing_emails (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  -- welcome | plan_due | plan_due_today | plan_overdue | client_fees | client_fees_overdue
  kind text not null,
  -- autopay, due_on, amount, month, paused: whatever the email needs.
  details jsonb not null default '{}'::jsonb,
  queued_on date not null default public.sa_today(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  -- One of each kind a day, however often the reminders run.
  unique (trainer_id, kind, queued_on)
);

-- No policies: only the service role (the Edge Function) reads or writes it.
alter table public.billing_emails enable row level security;

create index if not exists billing_emails_unsent on public.billing_emails (created_at) where sent_at is null;

create or replace function public.queue_billing_email(p_trainer uuid, p_kind text, p_details jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce((select billing_emails_enabled from public.billing_settings where id = 1), false) then
    return false;
  end if;
  insert into public.billing_emails (trainer_id, kind, details)
  values (p_trainer, p_kind, coalesce(p_details, '{}'::jsonb))
  on conflict (trainer_id, kind, queued_on) do nothing;
  return true;
end;
$$;

revoke all on function public.queue_billing_email(uuid, text, jsonb) from public, anon, authenticated;

-- A newly approved trainer gets one email on how paying works.
create or replace function public.billing_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approved and not coalesce(old.approved, false) and not new.is_owner then
    perform public.queue_billing_email(new.id, 'welcome', jsonb_build_object(
      'trial_ends_at', new.trial_ends_at,
      'free_use_from', new.free_use_from
    ));
  end if;
  return new;
end;
$$;

create or replace trigger trainers_billing_welcome_email
after update of approved on public.trainers
for each row execute function public.billing_welcome_email();

-- The same reminders as 0179, with store-safe push wording and the emails.
create or replace function public.billing_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.billing_settings;
  today date := public.sa_today();
  last_month date := (date_trunc('month', public.sa_today()) - interval '1 month')::date;
  r record;
  owner_id uuid;
  symbol text;
  summary text;
  total_lines integer;
  emailed boolean;
  autopay boolean;
  tail text;
begin
  select * into s from public.billing_settings where id = 1;
  emailed := coalesce(s.billing_emails_enabled, false);
  tail := case when emailed then ' We''ve emailed you the details.' else '' end;

  -- 1st of the month: log last month and tell each trainer their client fees.
  if extract(day from today) = 1 then
    perform public.snapshot_billing_month(last_month);
    summary := '';
    total_lines := 0;
    for r in
      select m.*, coalesce(t.business_name, t.name) as display, t.free_use_from
      from public.trainer_billing_months m join public.trainers t on t.id = m.trainer_id
      where m.month = last_month and m.client_fee > 0
    loop
      symbol := case when r.currency = 'ZAR' then 'R' else '$' end;
      autopay := exists (select 1 from public.trainer_cards c where c.trainer_id = r.trainer_id and c.autopay);
      perform public.push_to_user(
        r.trainer_id,
        'Client fees for ' || to_char(last_month, 'FMMonth'),
        r.active_clients || ' active client' || case when r.active_clients = 1 then '' else 's' end
          || ' last month. Due by ' || to_char(make_date(extract(year from today)::int, extract(month from today)::int, s.client_fees_due_day), 'FMDDth FMMonth') || '.' || tail,
        jsonb_build_object('type', 'client_fees')
      );
      perform public.queue_billing_email(r.trainer_id, 'client_fees', jsonb_build_object(
        'month', to_char(last_month, 'FMMonth YYYY'),
        'clients', r.active_clients,
        'amount', symbol || r.client_fee::text,
        'due_on', make_date(extract(year from today)::int, extract(month from today)::int, s.client_fees_due_day),
        'autopay', autopay
      ));
      summary := summary || case when total_lines > 0 then ', ' else '' end || r.display || ' ' || symbol || r.client_fee::text;
      total_lines := total_lines + 1;
    end loop;
    if total_lines > 0 then
      for owner_id in select t.id from public.trainers t where t.is_owner loop
        perform public.push_to_user(
          owner_id,
          to_char(last_month, 'FMMonth') || ' client fees',
          summary || '. See Billing on the Trainers tab.',
          jsonb_build_object('type', 'client_fees_summary')
        );
      end loop;
    end if;
  end if;

  -- Plans: 3 days before, on the day, and the day after (overdue).
  for r in
    select t.id, coalesce(t.business_name, t.name) as display,
      coalesce(t.paid_until, t.billing_started_on - 1) as paid_until
    from public.trainers t
    where t.approved and not t.is_owner and t.billing_started_on is not null and t.free_use_from is null
      and coalesce(t.paid_until, t.billing_started_on - 1) in (today + 3, today, today - 1)
  loop
    autopay := exists (select 1 from public.trainer_cards c where c.trainer_id = r.id and c.autopay);
    if r.paid_until = today - 1 then
      perform public.push_to_user(
        r.id,
        'Your Daily Evolution plan is overdue',
        case when s.lockout_enabled then 'Your coach access is paused until it''s paid.' else 'It was due yesterday.' end || tail,
        jsonb_build_object('type', 'plan_overdue')
      );
      perform public.queue_billing_email(r.id, 'plan_overdue', jsonb_build_object(
        'due_on', r.paid_until,
        'paused', coalesce(s.lockout_enabled, false),
        'autopay', autopay
      ));
      for owner_id in select t.id from public.trainers t where t.is_owner loop
        perform public.push_to_user(
          owner_id,
          r.display || '''s plan is overdue',
          'Record their payment on Billing (Trainers tab) once it comes in.',
          jsonb_build_object('type', 'trainer_plan_overdue', 'trainerId', r.id)
        );
      end loop;
    elsif r.paid_until = today and autopay then
      -- The saved card is charged this morning: nothing to remind.
      null;
    else
      perform public.push_to_user(
        r.id,
        case when r.paid_until = today then 'Your plan is due today' else 'Your plan is due in 3 days' end,
        case when autopay
          then 'Your plan renews on ' || to_char(r.paid_until, 'FMDD FMMonth') || '.'
          else 'Your Daily Evolution plan is due on ' || to_char(r.paid_until, 'FMDD FMMonth') || '.' end || tail,
        jsonb_build_object('type', 'plan_due')
      );
      perform public.queue_billing_email(r.id, case when r.paid_until = today then 'plan_due_today' else 'plan_due' end,
        jsonb_build_object('due_on', r.paid_until, 'autopay', autopay));
    end if;
  end loop;

  -- Client fees: the day after they were due, if still unpaid.
  if extract(day from today) = s.client_fees_due_day + 1 then
    for r in
      select t.id, coalesce(t.business_name, t.name) as display, t.billing_currency, b.client_fees_overdue
      from public.trainers t, public.billing_status_for(t.id) b
      where t.approved and not t.is_owner and b.client_fees_overdue > 0
    loop
      symbol := case when r.billing_currency = 'ZAR' then 'R' else '$' end;
      autopay := exists (select 1 from public.trainer_cards c where c.trainer_id = r.id and c.autopay);
      perform public.push_to_user(
        r.id,
        'Client fees overdue',
        'Your client fees were due on ' || to_char(make_date(extract(year from today)::int, extract(month from today)::int, s.client_fees_due_day), 'FMDDth FMMonth') || '.' || tail,
        jsonb_build_object('type', 'client_fees_overdue')
      );
      perform public.queue_billing_email(r.id, 'client_fees_overdue', jsonb_build_object(
        'amount', symbol || r.client_fees_overdue::text,
        'autopay', autopay
      ));
      for owner_id in select t.id from public.trainers t where t.is_owner loop
        perform public.push_to_user(
          owner_id,
          r.display || ' owes client fees',
          symbol || r.client_fees_overdue::text || ' is overdue.',
          jsonb_build_object('type', 'trainer_fees_overdue', 'trainerId', r.id)
        );
      end loop;
    end loop;
  end if;

  -- Mondays: the owner's summary of everything outstanding.
  if extract(isodow from today) = 1 then
    summary := '';
    total_lines := 0;
    for r in
      select coalesce(t.business_name, t.name) as display, t.billing_currency, b.plan_overdue, b.client_fees_owed
      from public.trainers t, public.billing_status_for(t.id) b
      where t.approved and not t.is_owner and (b.plan_overdue or b.client_fees_owed > 0)
    loop
      symbol := case when r.billing_currency = 'ZAR' then 'R' else '$' end;
      summary := summary || case when total_lines > 0 then '; ' else '' end || r.display || ': '
        || concat_ws(' + ',
             case when r.plan_overdue then 'plan overdue' end,
             case when r.client_fees_owed > 0 then symbol || r.client_fees_owed::text || ' client fees' end);
      total_lines := total_lines + 1;
    end loop;
    if total_lines > 0 then
      for owner_id in select t.id from public.trainers t where t.is_owner loop
        perform public.push_to_user(
          owner_id,
          total_lines || ' trainer' || case when total_lines = 1 then ' owes' else 's owe' end || ' you',
          summary,
          jsonb_build_object('type', 'billing_summary')
        );
      end loop;
    end if;
  end if;
end;
$$;

-- The sender runs every hour (welcome emails can be queued any time) and
-- straight after the daily reminders at 06:05 UTC. It reuses the card-billing
-- cron secret from Vault (0136) and does nothing while the switch is off.
select cron.unschedule('billing-emails-hourly')
where exists (select 1 from cron.job where jobname = 'billing-emails-hourly');
select cron.schedule(
  'billing-emails-hourly',
  '10 * * * *',
  $$
  select net.http_post(
    url := 'https://vrasgqqubyurzoknsbgm.supabase.co/functions/v1/billing-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'card_billing_cron_secret')
    ),
    body := '{"action": "send"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
