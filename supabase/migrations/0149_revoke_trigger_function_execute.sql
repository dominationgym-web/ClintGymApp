-- Stress test 2026-10-24: trigger helpers don't need to be callable by anyone.
-- Applied live.
revoke execute on function public.client_problems_from_checkin() from public, anon, authenticated;
revoke execute on function public.client_problems_from_flag() from public, anon, authenticated;
revoke execute on function public.notify_exercise_pain() from public, anon, authenticated;
revoke execute on function public.workout_logs_next_set_number() from public, anon, authenticated;
revoke execute on function public.workout_sessions_plan_check() from public, anon, authenticated;
