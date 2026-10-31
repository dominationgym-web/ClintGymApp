-- More back and chest variations (GRIZZ, 2026-10-31: "we need more
-- variation in the back dept. More cable back variations. And chest
-- variations"). YouTube demos like 0171, each video checked to work.
-- Only added when no exercise of that name exists.

insert into public.exercises (name, category, source, external_url, home_friendly, aka, sort_order)
select v.name, v.category, 'youtube', 'https://www.youtube.com/watch?v=' || v.video, v.home, v.aka,
       coalesce((select max(e.sort_order) from public.exercises e where e.category = v.category), 0) + v.n
from (values
  -- Back (Pull), mostly cable
  ('Reverse-Grip Lat Pulldown', 'Pull', 'SNiwpA13ZLU', false, array['underhand lat pulldown', 'supinated pulldown', 'chin-up grip pulldown'], 1),
  ('Half-Kneeling Single-Arm Cable Pulldown', 'Pull', '56blbOF9JoE', false, array['kneeling one-arm lat pulldown', 'single arm cable pulldown'], 2),
  ('Rope Straight-Arm Pulldown', 'Pull', 'EurcOa-r9r4', false, array['rope pullover', 'rope lat prayer', 'straight arm rope pulldown'], 3),
  ('Rope Lat Pulldown', 'Pull', 'ntzvFVxaXkE', false, array['seated rope pulldown', 'cable rope pulldown'], 4),
  ('Dual-Cable Lat Pulldown', 'Pull', 'IXaS-3Z1FAA', false, array['cable crossover lat pulldown', 'cross cable pulldown', 'dual pulley pulldown'], 5),
  ('Cable High Row', 'Pull', 'N7TpIlPVtAs', false, array['high cable row', 'dual cable high row'], 6),
  ('Seated Rope Cable Row', 'Pull', 'K5wctZXV35s', false, array['rope row', 'seated rope row'], 7),
  ('Single-Arm Lat-Focused Cable Row', 'Pull', 'wHQwkJ4MtlY', false, array['single arm lat row', 'high to low cable row', 'lat biased row'], 8),
  ('Standing Single-Arm Cable Row', 'Pull', 'raO8Q08Wems', false, array['split stance cable row', 'one arm standing cable row'], 9),
  ('Bent-Over Cable Row', 'Pull', 'nGRHCKIklXM', false, array['low pulley bent over row', 'cable bent over row'], 10),
  ('Cable Kayak Row', 'Pull', '-QzTAIvx5Dk', false, array['kayak row', 'cable paddle row'], 11),
  -- Chest (Push)
  ('Incline Bench Cable Fly', 'Push', 'EvaCILpbO3o', false, array['incline cable flyes', 'lying incline cable fly', 'upper chest cable fly'], 1),
  ('Seated Cable Fly', 'Push', 'VuzxvBnYVoA', false, array['seated cable pec fly', 'seated cable crossover'], 2),
  ('Dumbbell Hex Press', 'Push', 'rHfxaP0iF1E', true, array['squeeze press', 'dumbbell squeeze press', 'crush press'], 3),
  ('Hammer Strength Chest Press', 'Push', 'KVjtJS8eAAE', false, array['iso-lateral chest press', 'plate loaded chest press'], 4),
  ('Hammer Strength Incline Press', 'Push', 'Fpa5DI3lIqg', false, array['iso-lateral incline press', 'plate loaded incline press'], 5),
  ('Landmine Chest Press', 'Push', '-mYbyc48wAk', false, array['landmine press chest', 'standing landmine chest press'], 6),
  ('Deficit Push-Up', 'Push', 'Ua5IdZSRgi0', true, array['push-up on handles', 'deep push-up', 'push-up bars'], 7),
  ('Weighted Push-Up', 'Push', 'Q_FnrwhkdpU', true, array['plate push-up', 'plate on back push-up'], 8),
  ('Band Chest Press', 'Push', '8aQL3sguvV8', true, array['resistance band chest press', 'banded chest press'], 9),
  ('Band Chest Fly', 'Push', 'NzL2vHS6DbQ', true, array['resistance band fly', 'banded chest fly'], 10)
) as v(name, category, video, home, aka, n)
where not exists (select 1 from public.exercises e where lower(e.name) = lower(v.name));
