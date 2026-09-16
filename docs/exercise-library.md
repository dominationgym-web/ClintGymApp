# Exercise library: loading MoveKit videos

Source: **MoveKit Complete package** (one-time purchase, ~$299, all 412
clips, explicit commercial license for embedding in a client-facing app).
Chosen over continuing with Muscle & Motion because M&M's embedding rights
for a third-party app were never confirmed, while MoveKit's whole business
model is licensing clips for exactly this use.

## How a video actually reaches the app

1. Buy + download the Complete package from MoveKit.
2. In the [Supabase Dashboard](https://supabase.com/dashboard/project/vrasgqqubyurzoknsbgm)
   → **Storage → exercise-library**, upload the video files you want live
   right now (see the Phase 1 list below — you don't need all 412 loaded,
   just the ones currently assigned). This bucket is public, so each
   uploaded file gets a plain CDN URL immediately, no signed URLs needed.
3. Tell Claude the filenames (or just confirm you've uploaded the Phase 1
   batch) and it writes each file's public URL into the matching row of
   `public.exercises.external_url` via SQL — no manual table editing.
4. `ExerciseLibraryScreen` plays the video inline (`expo-video`, in a modal)
   the moment `external_url` is set — no app code changes needed per video.

## Phase 1 list (10 placeholder rows already seeded, `source = 'movekit'`)

Match MoveKit's clip names to these as closely as possible — exact wording
doesn't matter, just get a clip covering each movement:

1. Barbell Back Squat
2. Conventional Deadlift
3. Bench Press
4. Bent-Over Barbell Row
5. Overhead Press
6. Romanian Deadlift
7. Pull-Up
8. Walking Lunge
9. Plank
10. Dumbbell Shoulder Press

## Expanding later (Phase 2+)

The `exercises` table takes any number of rows — adding more later is just
more `insert` statements plus more uploaded files, no schema change. Per
the brief, let real client usage (which movements actually get assigned
most) drive what gets added next, rather than loading all 412 up front.
