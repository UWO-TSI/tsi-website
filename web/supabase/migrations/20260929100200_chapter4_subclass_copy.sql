-- ─── Chapter 4 names its real step: the level-10 subclass choice ────────────
--
-- Hardening E2E (specs/evidence/hardening/flows.md, specs/hardening-questions.md 8).
-- Apply after 20260929100100. Row 207: there is no family trial; the level-10
-- moment is the subclass choice, which is what chapter 4 now checks
-- (web/lib/progression/supabaseStore.ts). The seeded copy still promised a
-- trial. Only the untouched seed text changes; an admin's edit is kept.

UPDATE quest_chapters SET
  summary = CASE WHEN summary = 'Take the Oracle quiz and finish your family trial to open the ruins gate.'
    THEN 'Take the Oracle quiz, reach level 10 and choose your subclass to open the ruins gate.' ELSE summary END,
  step_copy = CASE WHEN step_copy #>> '{family_trial,label}' = 'Finish the level-10 family trial'
    THEN jsonb_set(step_copy, '{family_trial}', '{"label": "Reach level 10 and choose your subclass", "hint": "At the Oracle temple."}'::jsonb) ELSE step_copy END
WHERE slug = 'ruins-gate';
