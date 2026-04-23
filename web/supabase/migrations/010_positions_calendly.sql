-- ============================================
-- Positions: Calendly URL
-- Per-position interview scheduling link, rendered as react-calendly
-- InlineWidget on the student dashboard when status = interview_invite.
-- ============================================

ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS calendly_url text;

COMMENT ON COLUMN positions.calendly_url IS
  'Calendly event URL (e.g. https://calendly.com/tethos/vp-internal-interview). Rendered inline on student dashboard for interview_invite status.';
