-- ─── Content Versions: snapshot table for rollback after publish ────────────
-- Each row captures the state of a content table row at the moment immediately
-- before a draft was published over it. Pairs with content_drafts (014).

CREATE TABLE IF NOT EXISTS content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  snapshot_data JSONB NOT NULL,
  draft_id UUID REFERENCES content_drafts(id) ON DELETE SET NULL,
  published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_versions_row ON content_versions(table_name, row_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_published_at ON content_versions(published_at DESC);

ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Content versions readable by T1/T2"
  ON content_versions
  FOR SELECT
  USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));

CREATE POLICY "Content versions insertable by T1/T2"
  ON content_versions
  FOR INSERT
  WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
