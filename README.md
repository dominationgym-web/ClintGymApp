# ClintGymApp

Coaching app for a solo online personal trainer (South Africa-based), built
around daily client accountability first. See the full product brief for
context on all 8 phases, foundational decisions, and the testing plan — this
README covers what's actually built and how to run it.

## Status: Phase 1 (core accountability loop) scaffold

What exists right now:

- **Auth & signup gated behind payment.** `SignupScreen` creates the account
  and a `clients` row at `access_status = 'expired'`; the trainer manually
  flips it to `active` in the **Clients** tab once EFT/PayPal payment is
  confirmed. See `docs/access-gating.md` — this is the single highest-stakes
  piece of logic in the app, deliberately enforced at both the RLS-policy and
  trigger level, not just in the UI.
- **Morning check-in** (`CheckInScreen`) covering every field from the brief:
  alcohol, sleep (bed/asleep/wake time + 1-5 quality), water + electrolytes,
  meals + high-GI count/timing, screen time before bed, non-backlit reading,
  breathing/stretching, and a distress/pain flag with a required note.
- **Training-proof video upload** (`VideoUploadScreen`) to Supabase Storage
  as an interim provider (`videos.storage_provider` also supports `mux` /
  `cloudflare_stream` for when that's wired up), with a 30-day
  `expires_at` on every row for the auto-delete job to key off.
- **Exercise reference library** (`ExerciseLibraryScreen`) seeded with 10
  placeholder entries, sourced from the MoveKit Complete package (one-time
  purchase, explicit commercial license — see `docs/exercise-library.md`).
  Plays inline via `expo-video` in a modal rather than deep-linking out;
  files live in the public `exercise-library` Supabase Storage bucket.
- **Trainer compliance dashboard** (`TrainerDashboardScreen`), sorted
  urgent-flag-first, then today's distress-flag, then wants-feedback-flag,
  then missing-check-in, then done — matching "sorted by needs attention"
  from the brief. Distress/urgent flags are visual, deliberately not a push
  notification (per the brief: the dashboard is checked daily anyway).
- **Client status flag** (`clients.status_flag`) — a standalone 🚩red /
  🟠orange / green traffic light the client sets any time from their Profile
  screen (not tied to the daily check-in), for signalling "I need guidance
  now" vs "I'd like feedback" vs "all good." Drives the dashboard sort order
  above; the trainer can mark one resolved from `ClientDetailScreen`.
- **Admin client list** (`ClientsScreen`) sorted by plan expiry, with the
  manual access-status control.
- **Client detail view** (`ClientDetailScreen`) with recent check-in history,
  distress notes surfaced, and a trainer-private notes field.

What's deliberately **not** built yet (tracked as gaps, not bugs):

- No push notifications yet (daily trainer summary, renewal reminders) —
  `expo-notifications` is installed but no token registration or send path
  exists.
- Video auto-delete is now live — a daily `pg_cron` job
  (`delete_expired_videos`, `supabase/migrations/0009_video_auto_delete_job.sql`)
  removes the Storage file and soft-deletes the row past `expires_at`. Still
  missing: the active → expiring_soon → expired transition based on
  `plan_expires_at` (see `docs/access-gating.md`) isn't automated yet.
- Privacy policy is now real (`docs/privacy-policy.md`, rendered in-app via
  `PrivacyPolicyContent`/a modal on `SignupScreen`, linked before the
  consent checkbox so consent is actually informed) — drafted around
  POPIA's Section 18 notice requirements and this app's real data
  practices. Worth a lawyer's review given health-adjacent data counts as
  "special personal information" under POPIA, but it's no longer a
  placeholder.
- Intake form: `clients.intake_responses` (jsonb) renders as an always-visible
  section on `ClientDetailScreen` (trainer view), formatted generically as
  question/answer pairs - shows "No intake form completed yet" until it's
  populated. No client-facing *input* screen exists yet, since the actual
  questions aren't finalized; once they are, that screen just needs to write
  into the same column and this display needs no changes.
- Everything past Phase 1 (video annotation, nutrition, progress charts, AI
  insights, anxiety toolkit, wearables, own video library) is out of scope
  for this scaffold by design — see the brief's phased build order.
- No app icon/splash/favicon assets exist yet (`app.json` intentionally omits
  them rather than pointing at files that don't exist) — add real ones under
  `src/assets/` before an EAS build or app store submission.

## Stack

- **App:** React Native + Expo (SDK 57), TypeScript, React Navigation
  (bottom tabs + native stack, role-branching root navigator)
- **Backend:** Supabase (Postgres + Auth + Storage), schema and RLS policies
  in `supabase/migrations/`
- **Video (interim):** Supabase Storage, bucket-scoped RLS by client folder
  (`supabase/migrations/0003_video_storage.sql`); swap for Mux/Cloudflare
  Stream when ready

## Setup

```bash
npm install
cp .env.example .env   # fill in Supabase URL/anon key + the trainer's auth UID
```

Apply the database schema against a Supabase project:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Create the trainer's own account through Supabase Auth (email/password),
then insert their `trainers` row manually (there's no trainer signup screen —
there's only one trainer, created once):

```sql
insert into public.trainers (id, name, email)
values ('<trainer-auth-uid>', 'Trainer Name', 'trainer@example.com');
```

Put that same UID in `.env` as `EXPO_PUBLIC_DEFAULT_TRAINER_ID` so client
signups attach to it.

Run the app:

```bash
npm run start     # then press i / a / w, or scan the QR code with Expo Go
```

## Project layout

```
App.tsx                     # provider + navigation root
src/
  lib/supabase.ts           # Supabase client (env-configured)
  types/database.ts         # hand-written mirror of the SQL schema
  context/AuthContext.tsx   # session + role (trainer/client) resolution
  navigation/                # role-branching navigators
  screens/
    auth/                    # login, signup + payment-pending
    client/                  # check-in, video upload, exercises, profile
    trainer/                 # dashboard, client list, client detail
supabase/
  migrations/                # schema, seed data, storage policies
docs/
  access-gating.md           # how the payment/access field is protected
```

## Testing this phase before it touches real client data

At minimum, before onboarding a real client: sign up as a test client,
confirm they see `PendingAccessScreen` (not the app) until flipped to
`active`; confirm a second test client can never see the first client's
check-ins or videos (RLS); confirm a distress-flagged check-in shows up
red-bordered at the top of the trainer dashboard. See the brief's full
"Testing plan" section for the broader manual QA checklist and beta-cohort
guidance.
