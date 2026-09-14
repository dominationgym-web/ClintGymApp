# Supabase schema

Phase 1 schema lives in `migrations/`, plain SQL applied with the Supabase CLI:

```
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

## Tables (Phase 1)

- `trainers` / `clients` — every client carries `trainer_id` from day one (multi-trainer ready, even solo at launch). `clients.id` and `trainers.id` are the same UUID as the corresponding `auth.users` row.
- `clients.access_status` (`active` / `expiring_soon` / `expired`) — flipped manually by the trainer once EFT/PayPal payment is confirmed. This is the single field that gates what a client sees; see `docs/access-gating.md` for the intended flow and test coverage before wiring up any UI that reads it.
- `clients.intake_responses` — jsonb, since the trainer is still designing the actual intake questions. Structure it as `{ "question_key": "answer" }` once the question set is final.
- `checkins` — one row per client per day (`unique (client_id, checkin_date)`), covering every field in the morning check-in from the brief, including `distress_flag`/`distress_notes` for prominent (not push-notified) dashboard surfacing.
- `videos` — training-proof uploads, `expires_at` defaults to 30 days out; a scheduled Edge Function should soft-delete (`deleted_at`) and remove the underlying storage object once past `expires_at`, without deleting the row itself (the trainer's notes should survive the video).
- `exercises` — seeded with 10 placeholder entries (`0002_seed_exercises.sql`); fill in real Muscle & Motion links once licensing terms confirm in-app display is covered.
- `push_tokens` — Expo push tokens for the daily trainer "who needs attention" summary and client renewal reminders.

## Row Level Security

Every table has RLS enabled. The load-bearing rule: a client can only ever
read/write rows where `client_id = auth.uid()`; a trainer can only reach rows
belonging to clients where `clients.trainer_id = auth.uid()`. This is what
guarantees one client can never see another client's data — test it
explicitly (see the brief's security testing section) before going live with
real client data.

Nothing here handles column-level encryption. Supabase/Postgres encrypts data
at rest by default; if that's insufficient for POPIA compliance on specific
fields (e.g. `distress_notes`), that's an app-level decision to make with
whoever reviews the privacy policy, not something this schema assumes.
