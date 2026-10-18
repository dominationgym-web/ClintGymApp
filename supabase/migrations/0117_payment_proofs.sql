-- Proof of payment through the app (GRIZZ, 2026-10-18: "they can send me
-- Proof of payment through the app. So it come through already linked to
-- that trainer or client? That way approval is also easier.").
--
-- A client sends a photo or screenshot of their EFT to their own trainer; a
-- trainer sends theirs (app fees) to the app owner (to_owner). The trainer
-- sees it on the client's row in the Clients tab and can Activate straight
-- from it; the owner sees trainers' ones on the Billing page. The receiver is
-- pushed a notification.
create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  -- Who sent it: the client, or the trainer paying app fees.
  payer_id uuid not null default auth.uid(),
  -- The client paying their trainer; null when a trainer pays the owner.
  client_id uuid references public.clients (id) on delete cascade,
  -- The client's trainer, or the trainer paying the owner.
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  to_owner boolean not null default false,
  -- In the private payment-proofs bucket, under the payer's id.
  storage_path text not null check (char_length(storage_path) <= 300),
  amount text check (amount is null or char_length(amount) <= 40),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'new' check (status in ('new', 'confirmed', 'not_received')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((to_owner and client_id is null) or (not to_owner and client_id is not null))
);

create index if not exists payment_proofs_trainer_idx on public.payment_proofs (trainer_id, created_at desc);
create index if not exists payment_proofs_client_idx on public.payment_proofs (client_id, created_at desc);

alter table public.payment_proofs enable row level security;

create policy "proofs client sends to own trainer" on public.payment_proofs
  for insert to authenticated
  with check (
    not to_owner
    and payer_id = (select auth.uid())
    and client_id = (select auth.uid())
    and trainer_id = (select c.trainer_id from public.clients c where c.id = (select auth.uid()))
    and (storage.foldername(storage_path))[1] = (select auth.uid())::text
  );

create policy "proofs trainer sends to owner" on public.payment_proofs
  for insert to authenticated
  with check (
    to_owner
    and payer_id = (select auth.uid())
    and trainer_id = (select auth.uid())
    and client_id is null
    and exists (select 1 from public.trainers t where t.id = (select auth.uid()))
    and (storage.foldername(storage_path))[1] = (select auth.uid())::text
  );

create policy "proofs sender and receiver read" on public.payment_proofs
  for select to authenticated
  using (
    payer_id = (select auth.uid())
    or (not to_owner and trainer_id = (select auth.uid()))
    or (to_owner and public.is_app_owner())
  );

create policy "proofs receiver reviews" on public.payment_proofs
  for update to authenticated
  using ((not to_owner and trainer_id = (select auth.uid())) or (to_owner and public.is_app_owner()))
  with check ((not to_owner and trainer_id = (select auth.uid())) or (to_owner and public.is_app_owner()));

-- The receiver only marks it confirmed or not received.
revoke update on public.payment_proofs from authenticated;
grant update (status, reviewed_at) on public.payment_proofs to authenticated;

-- Files ----------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "payment proof uploads own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "payment proof sender and receiver read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.clients c
        where c.id::text = (storage.foldername(name))[1] and c.trainer_id = (select auth.uid())
      )
      or (
        public.is_app_owner()
        and exists (select 1 from public.trainers t where t.id::text = (storage.foldername(name))[1])
      )
    )
  );

-- Tell the receiver ----------------------------------------------------------
create or replace function public.notify_payment_proof()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
  receiver uuid;
begin
  if new.to_owner then
    select coalesce(nullif(trim(t.business_name), ''), nullif(trim(t.name), ''), t.email) into who from public.trainers t where t.id = new.trainer_id;
    select t.id into receiver from public.trainers t where t.is_owner limit 1;
  else
    select trim(c.name) into who from public.clients c where c.id = new.client_id;
    receiver := new.trainer_id;
  end if;
  if receiver is not null then
    perform public.push_to_user(
      receiver,
      '🧾 Proof of payment from ' || coalesce(who, 'someone'),
      case when new.to_owner then 'Open Billing on the Trainers tab to check it and record the payment.'
           else 'Open your Clients tab to check it and activate them.' end,
      jsonb_build_object('type', 'payment_proof', 'client_id', new.client_id, 'trainer_id', new.trainer_id)
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_payment_proof() from public, anon, authenticated;

create trigger payment_proofs_notify after insert on public.payment_proofs
  for each row execute function public.notify_payment_proof();
