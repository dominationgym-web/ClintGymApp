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
- **Flexible habits** (`HabitsScreen`) on top of the fixed daily check-in.
  The trainer sets up what's needed and how often per client (e.g.
  "Supplements" 3x/day, or "Gym" 1x/day) from `ClientDetailScreen`; the
  client then picks whichever specific days and reminder time actually fit
  their own schedule, and logs reps each day. The reminder toggle/time is
  saved but not yet delivered - `expo-notifications` was removed after Expo
  Go dropped support for it in SDK 53 (importing it crashed the app for
  every client on Expo Go, not just a dev-build edge case). Needs a real
  push setup (Expo push tokens from a dev/production build + a server-side
  send path) before reminders actually fire - see the gaps list below.
- **Training-proof video upload** (`VideoUploadScreen`) to Supabase Storage
  as an interim provider (`videos.storage_provider` also supports `mux` /
  `cloudflare_stream` for when that's wired up), with a 30-day
  `expires_at` on every row for the auto-delete job to key off.
- **Simple set-by-set training log** built into the exercise library -
  tapping an exercise opens its video plus a "Log a set" form (weight, reps,
  and how it felt: comfortable / close to failure / failure). Logged sets
  show up under the exercise (`workout_logs` table) and in a recent-log
  section on the trainer's client detail screen.
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

- No push notifications yet (daily trainer summary, renewal reminders, habit
  reminders) — needs Expo push tokens from a dev/production build (Expo Go
  no longer supports `expo-notifications` as of SDK 53) plus a server-side
  send path. Habit `reminder_enabled`/`reminder_time` are captured and saved
  already, just not delivered yet.
- Video auto-delete is now live — a daily `pg_cron` job
  (`delete_expired_videos`, `supabase/migrations/0009_video_auto_delete_job.sql`)
  removes the Storage file and soft-deletes the row past `expires_at`.
- **Plan auto-expiry is now live** — when the trainer activates a client,
  `plan_expires_at` is automatically calculated based on `plan_type` (30 days
  for 1-month, 180 for 6-month, 365 for 12-month). A daily `pg_cron` job
  (`auto_expire_plans`, `supabase/migrations/0021_plan_expiry_job.sql`)
  auto-transitions clients to `expiring_soon` (7 days before expiry) and then
  to `expired` on the actual expiry date. The trainer sees the expiry date on
  the client detail screen.
- Privacy policy is now real (`docs/privacy-policy.md`, rendered in-app via
  `PrivacyPolicyContent`/a modal on `SignupScreen`, linked before the
  consent checkbox so consent is actually informed) — drafted around
  POPIA's Section 18 notice requirements and this app's real data
  practices. Worth a lawyer's review given health-adjacent data counts as
  "special personal information" under POPIA, but it's no longer a
  placeholder.
- **Intake form** is fully wired up: `IntakeFormScreen` (mostly tap-to-select
  pills and short time fields, minimal typing by design) is shown once, the
  first time an activated client logs in with an empty
  `clients.intake_responses` (`RootNavigator` gates on this the same way it
  gates on `access_status`). Submitting it writes straight into that jsonb
  column, which `ClientDetailScreen` already renders as question/answer
  pairs on the trainer side - no changes needed there.
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
