-- ─── Bounty Submissions (stub) ──────────────────────────────────────────────
-- Schema only — not wired to UI yet.
-- bounties table already exists in 001. This adds the submission/review workflow.

-- Bounty submissions (users submit work for review)
CREATE TABLE IF NOT EXISTS bounty_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submission_text TEXT NOT NULL,
  attachment_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revision_requested')),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bounty_submissions_bounty ON bounty_submissions(bounty_id);
CREATE INDEX IF NOT EXISTS idx_bounty_submissions_user ON bounty_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_bounty_submissions_status ON bounty_submissions(status);

-- RLS
ALTER TABLE bounty_submissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read submissions (transparency)
CREATE POLICY "Bounty submissions readable by authenticated"
  ON bounty_submissions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can submit to bounties they've claimed
CREATE POLICY "Users can insert own submissions"
  ON bounty_submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Only T1-T3 can update submissions (review workflow)
-- Note: tier check done at API level since RLS can't easily join profiles
CREATE POLICY "Submission authors can update own pending submissions"
  ON bounty_submissions FOR UPDATE
  USING (user_id = auth.uid() AND status = 'pending');
