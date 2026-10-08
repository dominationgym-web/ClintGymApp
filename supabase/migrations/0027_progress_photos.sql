-- Private progress photos: a "before" picture and more as the client goes.
--
-- Privacy is the point of this feature, so the rules are:
--   * The photos belong to the client. Only they can add or delete them.
--   * The trainer sees NOTHING (not the rows, not the files) unless the client
--     has switched clients.progress_photos_shared on.
--   * Only the client can switch that on or off; the trainer's broad update
--     policy on public.clients is blocked from touching it by a trigger below.
--   * Switching it off takes effect at once for every new request. The app
--     only ever hands the trainer signed URLs that last a few minutes, so a
--     photo already on the trainer's screen stops loading shortly after.
--
-- Adding a photo needs access (same rule as check-ins and videos, 0022), but
-- viewing and deleting don't: a lapsed client can always see and remove their
-- own photos.

alter table public.clients
  add column progress_photos_shared boolean not null default false;

create or replace function public.prevent_others_changing_photo_sharing()
returns trigger as $$
begin
  -- auth.uid() is null for the service role and scheduled jobs.
  if new.progress_photos_shared is distinct from old.progress_photos_shared
    and auth.uid() is not null
    and auth.uid() <> old.id
  then
    raise exception 'only the client can change who sees their progress photos';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

revoke execute on function public.prevent_others_changing_photo_sharing() from public, anon, authenticated;

create trigger clients_prevent_others_changing_photo_sharing
  before update on public.clients
  for each row execute function public.prevent_others_changing_photo_sharing();

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  storage_path text not null,
  taken_on date not null,
  created_at timestamptz not null default now(),
  constraint progress_photos_path_own_folder check (storage_path like client_id::text || '/%')
);

create index progress_photos_client_taken_idx on public.progress_photos (client_id, taken_on desc);

alter table public.progress_photos enable row level security;

create policy "progress photos select own or shared with trainer" on public.progress_photos
  for select to authenticated
  using (
    client_id = (select auth.uid())
    or exists (
      select 1 from public.clients c
      where c.id = progress_photos.client_id
        and c.trainer_id = (select auth.uid())
        and c.progress_photos_shared
    )
  );

create policy "progress photos insert own" on public.progress_photos
  for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and public.client_has_access(client_id)
  );

create policy "progress photos delete own" on public.progress_photos
  for delete to authenticated
  using (client_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "client uploads own progress photo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.client_has_access((select auth.uid()))
  );

create policy "client reads own progress photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "client deletes own progress photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "trainer reads progress photos shared with them" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.trainer_id = (select auth.uid())
        and c.progress_photos_shared
    )
  );
