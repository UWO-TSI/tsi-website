-- ─── Profile fields bio + year (Playwright audit 2026-06-01) ────
--
-- The onboarding form code in app/student/onboarding/page.tsx already
-- reads/writes profiles.bio and profiles.year, but the columns were
-- never added to the profiles table. Result: /api/profile returns 400
-- with "column not found" and onboarding silently fails to save.
--
-- Caught during the Playwright FPS audit when QA Bot couldn't complete
-- onboarding via the form. Fixed by adding the missing columns.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS year TEXT,
  ADD COLUMN IF NOT EXISTS program TEXT;

-- No indexes needed — bio + year are display-only, queried per-profile
-- (already covered by the existing profiles_pkey on id).
