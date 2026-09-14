-- Storage bucket for training-proof videos (interim: Supabase Storage).
-- Files are keyed as "<client_id>/<filename>", so folder-name checks below
-- double as the client/trainer access split, mirroring the RLS policies on
-- public.videos. Swap storage_provider to 'mux' or 'cloudflare_stream' later
-- without needing to change this bucket.

insert into storage.buckets (id, name, public)
values ('training-videos', 'training-videos', false)
on conflict (id) do nothing;

create policy "client uploads own video folder"
  on storage.objects for insert
  with check (
    bucket_id = 'training-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "client reads own video folder"
  on storage.objects for select
  using (
    bucket_id = 'training-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "trainer reads their clients' video folders"
  on storage.objects for select
  using (
    bucket_id = 'training-videos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.trainer_id = auth.uid()
    )
  );
