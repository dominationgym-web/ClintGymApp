-- Public storage bucket for exercise reference videos (distinct from the
-- private "training-videos" bucket, which holds client-submitted proof and
-- must stay locked down). This content is generic licensed/purchased demo
-- clips, not personal client data, so a public bucket is fine and gives us
-- a plain CDN URL to store directly on public.exercises.external_url -
-- no signed URLs or auth token needed for playback.

insert into storage.buckets (id, name, public)
values ('exercise-library', 'exercise-library', true)
on conflict (id) do nothing;
