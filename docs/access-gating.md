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

## How it's meant to work

1. Client signs up (`SignupScreen`) → auth user created, `clients` row
   inserted with `access_status = 'expired'` (enforced at the database level,
   not just in the app — see below).
2. Client pays via direct EFT (South Africa) or PayPal (international),
   outside the app, and tells the trainer.
3. Trainer opens the **Clients** tab, confirms payment happened, and taps the
   status pill to move the client to `active` (`ClientsScreen.cycleStatus`).
4. `RootNavigator` reads `client.access_status` on every app load / auth
   state change: `active` → full app (`ClientNavigator`); anything else →
   `PendingAccessScreen`, no access to check-ins, videos, or anything else.
5. Near `plan_expires_at`, a scheduled job (not yet built — see Phase 1 gaps
   below) should flip the client to `expiring_soon` and send a renewal
   reminder notification; past expiry, flip to `expired`.

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
in as a client and asserts the update/insert is rejected.

## What's NOT built yet (Phase 1 gap to close before real billing volume)

- No scheduled job yet to auto-transition `active` → `expiring_soon` →
  `expired` based on `plan_expires_at`, or to send the renewal reminder
  notification described in the brief. This needs a Supabase scheduled Edge
  Function.
- Intro-plan expiry prompting the client to choose 6 or 12 months isn't
  built — currently the trainer would just talk to the client and re-run the
  signup/payment flow manually for the next plan.
