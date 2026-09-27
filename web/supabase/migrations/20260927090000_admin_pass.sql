-- ─── Admin pass: resident fields, text-keyed versioning, T1/T2-only drafts ───
--
-- Spec: specs/admin-pass.md (rows 122, 215, 217, 218). Apply after every
-- 20260926* game draft. Test: web/supabase/tests/admin_pass_smoke.sql.

-- Residents are npc_personas rows (rows 122, 218): the service post they staff,
-- an authored bio, a tone, and where they stand in each island phase
-- ({"day": "shop", "night": "hq"}; anchors in web/lib/content/residents.ts).
ALTER TABLE npc_personas
  ADD COLUMN IF NOT EXISTS post TEXT CHECK (post IS NULL OR post IN
    ('hq_lead', 'shopkeeper', 'cafe_owner', 'museum_curator', 'wharf_keeper', 'oracle_keeper', 'workshop_crafter', 'villager')),
  ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '' CHECK (char_length(bio) <= 1000),
  ADD COLUMN IF NOT EXISTS tone TEXT CHECK (tone IS NULL OR char_length(tone) <= 40),
  ADD COLUMN IF NOT EXISTS schedule JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(schedule) = 'object');

-- The two seeded residents keep their island spots (DefaultIslandWorld before this pass).
UPDATE npc_personas SET schedule = '{"day": "path"}'::jsonb WHERE slug = 'mayor' AND schedule = '{}'::jsonb;
UPDATE npc_personas SET schedule = '{"day": "shop"}'::jsonb, post = COALESCE(post, 'shopkeeper') WHERE slug = 'shopkeeper' AND schedule = '{}'::jsonb;

-- crafting_recipes is keyed by text: drafts and version snapshots key rows by text.
ALTER TABLE content_drafts ALTER COLUMN row_id TYPE TEXT USING row_id::text;
ALTER TABLE content_versions ALTER COLUMN row_id TYPE TEXT USING row_id::text;

-- Row 215: only T1/T2 draft game content (014 let any signed-in account insert a draft).
DROP POLICY IF EXISTS "Content drafts insertable by authenticated" ON content_drafts;
DROP POLICY IF EXISTS "Content drafts insertable by T1/T2" ON content_drafts;
CREATE POLICY "Content drafts insertable by T1/T2" ON content_drafts
  FOR INSERT WITH CHECK (
    author = (select auth.uid())
    AND (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2)
  );
