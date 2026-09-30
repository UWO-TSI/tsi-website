-- ─── Moderation audit log ────────────────────────────────────────────────────
--
-- Admin-pass follow-up (specs/admin-pass-questions.md 7, coordinator ruling
-- 2026-09-27). Apply after 20260929100000. Who did what to which item, when:
-- /api/admin/moderation (notes, table chat) and /api/identity/moderate (names,
-- mutes, unmutes) write a row with the service role after each action. T1/T2
-- read it; nobody writes, edits or deletes it through the API keys.
-- Test: web/supabase/tests/moderation_log_smoke.sql.

CREATE TABLE IF NOT EXISTS moderation_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('remove', 'remove_mute', 'dismiss', 'mute', 'unmute', 'reset_name')),
  item_kind TEXT NOT NULL CHECK (item_kind IN ('letter', 'chat', 'name', 'member')),
  item_id TEXT,
  target_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- The text or world name acted on, so the log reads without the item.
  excerpt TEXT CHECK (char_length(excerpt) <= 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON moderation_log (created_at DESC);
ALTER TABLE moderation_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moderation_log FROM anon, authenticated;
GRANT SELECT ON moderation_log TO authenticated;
DROP POLICY IF EXISTS "Moderation log readable by T1/T2" ON moderation_log;
CREATE POLICY "Moderation log readable by T1/T2" ON moderation_log FOR SELECT TO authenticated
  USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
