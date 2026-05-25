-- ============================================
-- One-shot: apply migration 013 + reset all applications for testing.
-- Paste this whole block into Supabase Studio → SQL Editor → Run.
-- Safe to run multiple times (uses IF EXISTS / idempotent UPDATEs).
-- ============================================

-- STEP 1: apply migration 013 (drop old CHECK, migrate values, add new CHECK)
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_draft_status_check;

UPDATE applications SET status = 'screening'        WHERE status = 'submitted';
UPDATE applications SET status = 'interview_invite' WHERE status = 'interview';
UPDATE applications SET status = 'accepted'         WHERE status = 'offer';
UPDATE applications SET status = 'rejected'         WHERE status = 'declined';

UPDATE applications SET draft_status = 'screening'        WHERE draft_status = 'submitted';
UPDATE applications SET draft_status = 'interview_invite' WHERE draft_status = 'interview';
UPDATE applications SET draft_status = 'accepted'         WHERE draft_status = 'offer';
UPDATE applications SET draft_status = 'rejected'         WHERE draft_status = 'declined';

ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN (
    'screening', 'interview_invite', 'final_review',
    'accepted', 'waitlist', 'rejected'
  ));

ALTER TABLE applications
  ADD CONSTRAINT applications_draft_status_check
  CHECK (draft_status IS NULL OR draft_status IN (
    'screening', 'interview_invite', 'final_review',
    'accepted', 'waitlist', 'rejected'
  ));

ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'screening';

UPDATE status_releases SET old_status = 'screening'        WHERE old_status = 'submitted';
UPDATE status_releases SET old_status = 'interview_invite' WHERE old_status = 'interview';
UPDATE status_releases SET old_status = 'accepted'         WHERE old_status = 'offer';
UPDATE status_releases SET old_status = 'rejected'         WHERE old_status = 'declined';

UPDATE status_releases SET new_status = 'screening'        WHERE new_status = 'submitted';
UPDATE status_releases SET new_status = 'interview_invite' WHERE new_status = 'interview';
UPDATE status_releases SET new_status = 'accepted'         WHERE new_status = 'offer';
UPDATE status_releases SET new_status = 'rejected'         WHERE new_status = 'declined';

-- STEP 2: wipe testing state — everyone back to screening, no drafts, no audit log
UPDATE applications SET
  status       = 'screening',
  draft_status = NULL,
  released_at  = NULL;

TRUNCATE status_releases;
