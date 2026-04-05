-- ─── Achievement System RLS Policies ────────────────────────────────────────
-- Adds INSERT policies so API routes can create achievements and award them.

-- Allow authenticated users to insert achievements (tier check done in API route)
CREATE POLICY "Achievements insertable by authenticated"
  ON achievements FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update achievements (tier check done in API route)
CREATE POLICY "Achievements updatable by authenticated"
  ON achievements FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to award achievements (inserts into user_achievements)
CREATE POLICY "User achievements insertable by authenticated"
  ON user_achievements FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
