-- After 034: legacy classes mapped to families via subclass; ambiguous ones cleared.
\set ON_ERROR_STOP 1
DO $$ BEGIN
  ASSERT (SELECT class FROM profiles WHERE id = '00000000-0000-4000-8000-0000000000e1') = 'Arcane', '034 legacy Sage → INTP → Arcane';
  ASSERT (SELECT family FROM member_identity WHERE member_id = '00000000-0000-4000-8000-0000000000e2') = 'Ranger', '034 legacy Shield Warden → ESFJ → Ranger';
  ASSERT (SELECT quiz_taken_at FROM member_identity WHERE member_id = '00000000-0000-4000-8000-0000000000e2') IS NULL, '034 legacy keeps a free reading';
  ASSERT EXISTS (SELECT 1 FROM family_auras WHERE member_id = '00000000-0000-4000-8000-0000000000e1' AND family = 'Arcane'), '034 legacy aura';
  ASSERT (SELECT class FROM profiles WHERE id = '00000000-0000-4000-8000-0000000000e3') IS NULL, '034 ambiguous legacy class cleared';
  -- 034 grandfathered existing profiles as members; 20260926200000 (ruling 1) then made non-staff, non-hired ones public.
  ASSERT (SELECT membership FROM profiles WHERE id = '00000000-0000-4000-8000-0000000000e4') = 'public', '200000 existing non-staff profiles public';
  RAISE NOTICE '034 legacy ok';
END $$;
