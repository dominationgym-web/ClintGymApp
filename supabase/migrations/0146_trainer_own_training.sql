-- Trainer's own training (GRIZZ, 2026-10-23: "a live session tracker for the
-- trainer so that the trainer can actually do workouts on his own app, track
-- his weights and everything in his profile").
--
-- Every workout record hangs off a clients row, so a trainer who trains gets
-- one of their own: same id as the trainer, trainer_id pointing at
-- themselves. The live workout screen then works for them unchanged
-- (acting_client() already returns the caller), and their sets, sessions and
-- progress graphs sit on that row.
--
-- That row is never a paying client: it logs no activation, sends no signup
-- push, and is left out of client counts, billing and the owner tracker. The
-- app leaves it off the Clients tab and pickers. No other client can ever
-- have id = trainer_id, so that test picks out exactly these rows.

create or replace function public.start_my_training()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.trainers;
begin
  select * into me from public.trainers where id = auth.uid();
  if me.id is null then
    raise exception 'only trainers can do this';
  end if;
  if not public.not_unapproved_trainer() then
    raise exception 'your trainer account is waiting for approval';
  end if;
  insert into public.clients (id, trainer_id, name, email, access_status, consent_accepted_at)
  values (me.id, me.id, me.name, me.email, 'active', now())
  on conflict (id) do nothing;
  update public.clients
  set library_access = true, access_status = 'active', archived_at = null
  where id = me.id and trainer_id = me.id
    and (library_access is distinct from true or access_status <> 'active' or archived_at is not null);
  return me.id;
end;
$$;
revoke all on function public.start_my_training() from public, anon;
grant execute on function public.start_my_training() to authenticated;

create or replace function public.log_client_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id = new.trainer_id then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.access_status <> 'expired')
    or (tg_op = 'UPDATE' and old.access_status = 'expired' and new.access_status <> 'expired')
  then
    insert into public.client_activations (client_id, client_name, trainer_id)
    values (new.id, new.name, new.trainer_id);
  end if;
  return new;
end;
$$;

create or replace function public.notify_client_signup_and_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ends text := coalesce(to_char(new.plan_expires_at, 'FMDD FMMonth'), 'soon');
begin
  if new.id = new.trainer_id then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform public.push_to_user(
      new.trainer_id,
      'New client signed up',
      coalesce(new.name, 'Someone') || ' just signed up. Activate them on the Clients tab once they''ve paid.',
      jsonb_build_object('type', 'client_signup', 'clientId', new.id)
    );
  elsif old.access_status = 'expired' and new.access_status in ('active', 'expiring_soon') then
    perform public.push_to_user(
      new.id,
      'You''re in! 🎉',
      'Your trainer has activated your account. Open the app to get started.',
      jsonb_build_object('type', 'client_activated')
    );
  elsif old.access_status = 'active' and new.access_status = 'expiring_soon' then
    perform public.push_to_user(
      new.id,
      'Your plan ends ' || ends,
      'Renew with your trainer before then to keep your access and your streaks going.',
      jsonb_build_object('type', 'plan_expiring')
    );
    perform public.push_to_user(
      new.trainer_id,
      coalesce(new.name, 'A client') || '''s plan ends ' || ends,
      'They''ve been reminded to renew.',
      jsonb_build_object('type', 'client_plan_expiring', 'clientId', new.id)
    );
  elsif old.access_status in ('active', 'expiring_soon') and new.access_status = 'expired' then
    perform public.push_to_user(
      new.id,
      'Your plan has ended',
      'Renew with your trainer to get your access back. Open the app for the payment details.',
      jsonb_build_object('type', 'plan_expired')
    );
    perform public.push_to_user(
      new.trainer_id,
      coalesce(new.name, 'A client') || '''s plan has ended',
      'Their access is paused until you activate them again.',
      jsonb_build_object('type', 'client_plan_expired', 'clientId', new.id)
    );
  end if;
  return new;
exception when others then
  raise warning 'client membership notification failed: %', sqlerrm;
  return new;
end;
$$;

create or replace function public.billing_month_rows(p_month date)
returns table(trainer_id uuid, active_clients integer, new_activations integer, currency text, free boolean, client_fee numeric)
language plpgsql
stable security definer
set search_path = public
as $$
declare
  month_start date := date_trunc('month', p_month)::date;
  month_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
begin
  if auth.uid() is not null and not public.is_app_owner() then
    raise exception 'only the app owner can see billing';
  end if;
  return query
  with counts as (
    select
      t.id,
      t.billing_currency,
      t.free_use_from is not null as free_use,
      public.client_fees_start(t.id) as fees_from,
      (
        select count(distinct x.cid)::integer from (
          select c.id as cid from public.clients c
          where c.trainer_id = t.id and c.id <> c.trainer_id
            and c.access_status <> 'expired' and c.created_at::date <= month_end
          union
          select a.client_id from public.client_activations a
          where a.trainer_id = t.id and a.activated_on between month_start and month_end and a.client_id is not null
        ) x
      ) as active,
      (
        select count(*)::integer from public.client_activations a
        where a.trainer_id = t.id and a.activated_on between month_start and month_end
      ) as activations
    from public.trainers t
    where not t.is_owner
      and (t.billing_started_on <= month_end or t.free_use_from <= month_end)
  )
  select
    counts.id,
    counts.active,
    counts.activations,
    counts.billing_currency,
    (counts.fees_from is null or counts.fees_from > month_start) as is_free,
    case
      when counts.fees_from is null or counts.fees_from > month_start then 0::numeric
      else public.client_fee_total(counts.active, case when counts.free_use then 0 else s.free_clients end, coalesce(counts.billing_currency, 'USD'))
    end
  from counts, public.billing_settings s;
end;
$$;

create or replace function public.owner_client_income()
returns table(trainer_id uuid, currency text, income numeric, priced integer, unpriced integer)
language plpgsql
stable security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_app_owner() then
    raise exception 'only the app owner can see the tracker';
  end if;
  return query
  select
    t.id,
    coalesce(t.client_prices ->> 'currency', 'ZAR'),
    coalesce(sum(public.client_monthly_price(t.client_prices, c.price_package)), 0),
    count(c.id) filter (where public.client_monthly_price(t.client_prices, c.price_package) is not null)::integer,
    count(c.id) filter (where public.client_monthly_price(t.client_prices, c.price_package) is null)::integer
  from public.trainers t
  left join public.clients c
    on c.trainer_id = t.id and c.id <> c.trainer_id and c.archived_at is null and c.access_status <> 'expired'
  where t.approved or t.is_owner
  group by t.id;
end;
$$;

create or replace function public.owner_tracker()
returns table(trainer_id uuid, name text, is_owner boolean, region text, currency text, billing_plan text, trial_ends_at date, paid_until date, free_use boolean, clients_total integer, clients_active integer, client_fee_now numeric, client_fee_full numeric, plan_price numeric, paid_subs_month numeric, paid_fees_month numeric)
language plpgsql
stable security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  today date := public.sa_today();
  month_start date := date_trunc('month', public.sa_today())::date;
begin
  if not public.is_app_owner() then
    raise exception 'only the app owner can see the tracker';
  end if;
  return query
  with base as (
    select
      t.*,
      case
        when t.billing_currency is not null then t.billing_currency
        when t.signup_country = 'ZA' then 'ZAR'
        when t.signup_country is not null then 'USD'
        when t.is_owner then 'ZAR'
      end as cur,
      (select count(*)::integer from public.clients c where c.trainer_id = t.id and c.id <> c.trainer_id) as total,
      (select count(*)::integer from public.clients c
        where c.trainer_id = t.id and c.id <> c.trainer_id and c.archived_at is null and c.access_status <> 'expired') as active
    from public.trainers t
    where t.approved or t.is_owner
  ),
  now_fees as (
    select r.trainer_id, r.client_fee from public.billing_month_rows(today) r
  )
  select
    b.id,
    coalesce(b.business_name, b.name),
    b.is_owner,
    case b.cur when 'ZAR' then 'SA' when 'USD' then 'International' end,
    b.cur,
    b.billing_plan::text,
    b.trial_ends_at,
    b.paid_until,
    b.free_use_from is not null,
    b.total,
    b.active,
    coalesce(nf.client_fee, 0),
    case when b.is_owner then 0::numeric
      else public.client_fee_total(b.active, case when b.free_use_from is not null then 0 else s.free_clients end, coalesce(b.cur, 'USD'))
    end,
    case when b.is_owner or b.billing_plan is null or b.free_use_from is not null then 0::numeric
      else coalesce((s.prices -> coalesce(b.cur, 'USD') ->> b.billing_plan::text)::numeric, 0)
    end,
    coalesce((select sum(p.amount) from public.trainer_payments p
      where p.trainer_id = b.id and p.kind = 'subscription' and p.paid_on >= month_start), 0),
    coalesce((select sum(p.amount) from public.trainer_payments p
      where p.trainer_id = b.id and p.kind = 'client_fees' and p.paid_on >= month_start), 0)
  from base b
  cross join public.billing_settings s
  left join now_fees nf on nf.trainer_id = b.id
  order by b.is_owner desc, b.active desc, coalesce(b.business_name, b.name);
end;
$$;
