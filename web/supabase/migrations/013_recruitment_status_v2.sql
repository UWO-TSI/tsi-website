-- ============================================
-- Recruitment status pipeline v2
-- Trim from 8 statuses to 6 to match the actual hiring rounds:
--   screening → interview_invite → final_review → accepted | waitlist | rejected
-- Drops: 'submitted' (folded into screening), 'interview' (folded into
-- interview_invite), 'offer' (renamed accepted), 'declined' (renamed rejected).
-- ============================================

-- Drop old CHECK constraints (anonymous, but follow PG naming convention)
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_draft_status_check;

-- Migrate existing data on applications
UPDATE applications SET status = 'screening'        WHERE status = 'submitted';
UPDATE applications SET status = 'interview_invite' WHERE status = 'interview';
UPDATE applications SET status = 'accepted'         WHERE status = 'offer';
UPDATE applications SET status = 'rejected'         WHERE status = 'declined';

UPDATE applications SET draft_status = 'screening'        WHERE draft_status = 'submitted';
UPDATE applications SET draft_status = 'interview_invite' WHERE draft_status = 'interview';
UPDATE applications SET draft_status = 'accepted'         WHERE draft_status = 'offer';
UPDATE applications SET draft_status = 'rejected'         WHERE draft_status = 'declined';

-- Reapply CHECK constraints with the trimmed set
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

-- New rows start at 'screening' (no separate 'submitted' state).
ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'screening';

-- Audit log: rewrite historical strings so STATUS_LABELS lookups don't
-- show blank for old entries. No CHECK constraint on this table so just
-- normalize values.
UPDATE status_releases SET old_status = 'screening'        WHERE old_status = 'submitted';
UPDATE status_releases SET old_status = 'interview_invite' WHERE old_status = 'interview';
UPDATE status_releases SET old_status = 'accepted'         WHERE old_status = 'offer';
UPDATE status_releases SET old_status = 'rejected'         WHERE old_status = 'declined';

UPDATE status_releases SET new_status = 'screening'        WHERE new_status = 'submitted';
UPDATE status_releases SET new_status = 'interview_invite' WHERE new_status = 'interview';
UPDATE status_releases SET new_status = 'accepted'         WHERE new_status = 'offer';
UPDATE status_releases SET new_status = 'rejected'         WHERE new_status = 'declined';
