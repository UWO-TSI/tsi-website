-- ─── Presidential Election ───────────────────────────────────────────────────
-- Adds voting infrastructure for the Tethos club presidential election.

-- 1. Add has_voted flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_voted BOOLEAN DEFAULT FALSE;

-- 2. Create election_votes table
CREATE TABLE IF NOT EXISTS election_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  candidate  TEXT NOT NULL CHECK (candidate IN (
    'Marco Chen',
    'Eleanor Liu',
    'Anthony Lam',
    'Scott McLaughlin',
    'Alice Nguyen'
  )),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE election_votes ENABLE ROW LEVEL SECURITY;

-- INSERT: users can insert their own vote
CREATE POLICY "Users can insert own vote"
  ON election_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- SELECT: users can read only their own row (to check if already voted)
CREATE POLICY "Users can read own vote"
  ON election_votes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No UPDATE or DELETE policies — votes are immutable

-- 4. Aggregation function for admin results (bypasses RLS)
CREATE OR REPLACE FUNCTION get_election_results()
RETURNS TABLE (candidate TEXT, vote_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT candidate, COUNT(*) AS vote_count
  FROM election_votes
  GROUP BY candidate
  ORDER BY vote_count DESC;
$$;
