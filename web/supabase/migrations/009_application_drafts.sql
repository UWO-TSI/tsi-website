-- ============================================
-- Application Drafts
-- Cross-device save-and-exit for in-progress applications.
-- Deleted on successful submission via cleanup in /api/applications POST.
-- ============================================

CREATE TABLE IF NOT EXISTS application_drafts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  form_data   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  UNIQUE(user_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_application_drafts_user ON application_drafts(user_id);

CREATE TRIGGER trg_application_drafts_updated_at
  BEFORE UPDATE ON application_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE application_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own drafts"
  ON application_drafts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own drafts"
  ON application_drafts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own drafts"
  ON application_drafts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own drafts"
  ON application_drafts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
