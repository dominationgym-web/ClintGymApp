# Access gating (highest-stakes area — test this before every release)

The whole business model runs on one field: `clients.access_status`. Get this
wrong and either a non-paying client gets full access, or a paying client
gets locked out.

Two other fields describe what a client is paying for, but don't gate access
on their own — the app doesn't hide/show features based on them yet, they're
just recorded so the trainer knows what to deliver and bill for:

- `plan_type` — billing duration (`intro_1mo` / `sub_6mo` / `sub_12mo`).
- `package_type` — what's included (`training_only` / `training_nutrition` /
  `training_nutrition_lifestyle`).

Both are chosen once at signup and then locked the same way `access_status`
is (see the trigger below) — a client can't upgrade their own package or
plan without the trainer confirming payment and changing it for them.

Note what "locked" does and doesn't mean: the trigger is `BEFORE UPDATE`, so it
only stops a client *changing* these after the fact. The initial values still
come from the client's own signup insert. Until `0023` that left every other
trainer-owned column open at insert time too — a client could sign themselves up
with a `plan_expires_at` the trainer never agreed to (which the auto-expiry job
reads), a non-green `status_flag`, or `trainer_notes`. The
`client inserts own signup row` policy now pins all of those; `plan_type` and
`package_type` stay client-supplied on purpose, since the signup form
legitimately collects what the client is signing up for.

## How it's meant to work

1. Client signs up (`SignupScreen`) → auth user created, `clients` row
   inserted with `access_status = 'expired'` (enforced at the database level,
   not just in the app — see below).
2. Client pays via direct EFT (South Africa) or PayPal (international),
   outside the app, and tells the trainer.
3. Trainer opens the **Clients** tab, confirms payment happened, and taps the
   status pill to move the client to `active` (`ClientsScreen.cycleStatus`).
4. `RootNavigator` reads `client.access_status`: anything other than `expired`
   → full app (`ClientNavigator`); `expired`, or a client row that failed to
   load, → `PendingAccessScreen`, no access to check-ins, videos, or anything
   else.
5. Near `plan_expires_at`, the scheduled `auto_expire_plans` job flips the
   client to `expiring_soon`, then to `expired` past the expiry date.

### `expiring_soon` grants access

This is worth stating plainly, because the code used to say the opposite.
`expiring_soon` means a client who is **still paid up**, inside the renewal
window the job opens 7 days before expiry. They keep full access; the amber pill
and the expiry date on their Profile screen are the nudge to renew.

`RootNavigator` originally gated on `access_status === 'active'`, so
`expiring_soon` denied access — which would have locked every paying client out
for the last week of every plan, and meant the trainer's first tap on the status
pill (`expired → expiring_soon`) looked like it had granted access without
actually doing so. The rule is now `!== 'expired'` in the app and
`<> 'expired'` in `public.client_has_access` (`0022`). If you change one, change
both.

## Where the gate is actually enforced

Two separate questions, and for a long time only the first one had an answer.

**Can a client set their own `access_status`?** No — see the two layers below.

**Does anything stop a client whose plan has lapsed from using the app anyway?**
Until `0022`, no. `RootNavigator` hiding the tabs was the *entire* enforcement,
and that runs in the app bundle, which is the one place the user controls. Every
RLS policy on the client's own data keyed on `client_id = auth.uid()` alone, so
an `expired` client still held a valid JWT and could read and write check-ins,
videos, habit logs, workout logs and lifestyle-reset logs straight against the
REST API, and push files into the video bucket.

`0022` closes that. `public.client_has_access(uuid)` is folded into the
INSERT/UPDATE/DELETE policies on `checkins`, `videos`, `habit_logs`,
`workout_logs`, `lifestyle_reset_daily_logs` and the `training-videos` storage
bucket. Rules:

- **Writes by a client require access** (`access_status <> 'expired'`).
- **SELECT stays open**, so a lapsed client can still see their own history and
  the trainer can still review it while chasing a renewal.
- **Trainer-side policies are untouched** — managing lapsed clients is the
  trainer's job.

So the app-side gate is now a UI convenience and the database is the real
boundary. Any new client-writable table needs the same treatment; a policy that
only checks `client_id = auth.uid()` is an ungated table.

## Why a client can't just grant themselves access

Two independent layers, deliberately redundant:

- **RLS policy** (`client inserts own signup row`) only allows a client to
  insert their own row when `access_status = 'expired'` — they cannot insert
  themselves as `active`.
- **Trigger** (`prevent_client_self_privilege_escalation`) blocks a client
  from changing their own `access_status`, `trainer_id`, or plan fields on
  `UPDATE`, even though the general "clients update own profile fields"
  policy would otherwise allow it (RLS `USING` without a matching
  `WITH CHECK` does not restrict which columns change). Only the trainer
  (`auth.uid() = trainer_id`) can move the field.

If you change either of these, re-verify with an integration test that signs
in as a client and asserts the update/insert is rejected. That test doesn't
exist yet - it needs a live Supabase project, so it isn't part of the unit
suite.

## What is covered by automated tests

`src/lib/access.ts` holds the app-side gating decision, and
`src/lib/access.test.ts` pins it down: `active` and `expiring_soon` both open
the app, only `expired` lands on the pending screen, a client row that failed
to load is treated as locked out rather than open, and an empty intake form
can't be used to skip the access check. The status cycle the trainer taps
through starts at `expired`, so an unrecognised status can never cycle
straight into `active`.

`expiring_soon` counting as access is deliberate and is the thing most likely
to get broken again: the scheduled `auto_expire_plans` job sets it seven days
before `plan_expires_at`, and those seven days are paid for. The app-side rule
has to stay in step with `public.client_has_access` in the database, which
gates client writes on `access_status <> 'expired'`. There is a test named for
that renewal window so the reason survives.

Run them with `npm test`. They do not cover the two database layers above -
those are still manual, per the paragraph before this one.

## What's NOT built yet (Phase 1 gap to close before real billing volume)

- The `active` → `expiring_soon` → `expired` transition is automated by the
  `auto_expire_plans` pg_cron job (`0021`), but the renewal reminder
  notification described in the brief still isn't sent — that needs push
  notifications, which need a dev/production build (see the README).
- Intro-plan expiry prompting the client to choose 6 or 12 months isn't
  built — currently the trainer would just talk to the client and re-run the
  signup/payment flow manually for the next plan.
- The status pill in `ClientsScreen` still cycles
  `expired → expiring_soon → active → expired` with no confirmation step, so a
  mis-tap on an active client silently revokes their access. It should be an
  explicit "Activate" / "Mark expired" action with a confirm dialog.
- `trainer_notes` is described as trainer-private, but
  `clients select own or trainer` has no column restriction, so a client can
  read it off their own row through the API. Fixing it properly means moving the
  column to a trainer-only table.
- No automated test coverage yet for any of this. The checks worth pinning down:
  a client cannot update their own `access_status`; a client cannot insert
  themselves as `active`; and (since `0022`) an `expired` client's check-in,
  video, habit-log and workout-log writes are all rejected.
