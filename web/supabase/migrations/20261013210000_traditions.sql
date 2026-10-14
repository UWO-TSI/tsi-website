-- ─── Traditions: the yearly calendar of island events, and trick-or-treat ────
--
-- specs/v1-drop.md §9 (the Halloween launch event) and design principle 8 (a
-- monthly content cadence admins run). Apply after 20261013200000_v1_drop_copy.
-- Needs 20260926150400_collections (collection_species, member_collections),
-- 20261003054110_backpack (collections_record_catch with the bag's check),
-- 014 (content_drafts, content_versions). Idempotent.
-- Test: web/supabase/tests/traditions_smoke.sql.
--
--   * traditions: one row a tradition. A Toronto window (starts_on to ends_on,
--     MM-DD, both inclusive, wrapping the new year when it ends before it
--     starts) that repeats every year, and the content it switches on (pumpkin
--     lanterns, the costume closet, trick-or-treat, fog nights:
--     web/lib/content/traditions.ts TRADITION_CONTENT). Everyone reads it (the
--     island dresses for it signed in or out); T1/T2 edit it on the Traditions
--     page through the content pipeline (draft, publish, history).
--   * Seeded: Halloween, Oct 25 to Nov 1, everything on.
--   * Treats: three candies in the species roster (fruit, sub 'treat': they stack
--     in the bag and can be eaten; never donated). Mirrors TREATS in
--     web/lib/collections/treats.ts.
--   * trick_or_treats: a member's treat from a resident on a night (the Toronto
--     date of its evening): one per member, resident and night. Readable by its
--     owner only. traditions_treat (service role) records it and puts the treat
--     in the bag in one transaction ('already_treated', 'bag_full'); the route
--     (/api/traditions/treat) checks the tradition is on and that it's night.

-- ─── 1. The calendar ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traditions (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,40}$'),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  starts_on TEXT NOT NULL CHECK (starts_on ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  ends_on TEXT NOT NULL CHECK (ends_on ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  content JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE traditions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Traditions readable by everyone" ON traditions;
CREATE POLICY "Traditions readable by everyone" ON traditions FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Traditions writable by T1/T2" ON traditions;
CREATE POLICY "Traditions writable by T1/T2" ON traditions
  FOR ALL USING ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2))
  WITH CHECK ((SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2));
GRANT SELECT ON traditions TO anon, authenticated;

INSERT INTO traditions (id, title, starts_on, ends_on, content, position) VALUES
  ('halloween', 'Halloween', '10-25', '11-01', '{"pumpkins":true,"costumes":true,"trick_or_treat":true,"fog_nights":true}'::jsonb, 1)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. The treats (web/lib/collections/treats.ts TREATS) ───────────────────
INSERT INTO collection_species (key, category, sub, name, biome, tool, rarity, size_min_cm, size_max_cm, start_hour, end_hour,
  rain_any_hour, weather, months, one_liner, icon, model, asset_ready, donatable, wing, position) VALUES
  ('treat_toffee', 'fruit', 'treat', 'Wrapped toffee', 'ground', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'Twisted in waxed paper. Sticks to your teeth in the friendliest way.', '/assets/icons/treat_toffee.webp', '/assets/game/items/treat_toffee.glb', TRUE, FALSE, NULL, 201),
  ('treat_lollipop', 'fruit', 'treat', 'Swirl lollipop', 'ground', 'hand', 'common', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'A spiral of every colour the shop had. Lasts a whole walk home.', '/assets/icons/treat_lollipop.webp', '/assets/game/items/treat_lollipop.glb', TRUE, FALSE, NULL, 202),
  ('treat_candy_corn', 'fruit', 'treat', 'Candy corn', 'ground', 'hand', 'uncommon', NULL, NULL, NULL, NULL, FALSE, '{}'::text[], '{}'::int[], 'Somebody on this island loves it. Nobody will say who.', '/assets/icons/treat_candy_corn.webp', '/assets/game/items/treat_candy_corn.glb', TRUE, FALSE, NULL, 203)
ON CONFLICT (key) DO NOTHING;

-- ─── 3. Trick-or-treat: once per member, resident and night ─────────────────
CREATE TABLE IF NOT EXISTS trick_or_treats (
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resident TEXT NOT NULL CHECK (resident ~ '^[a-z0-9-]{1,48}$'),
  night DATE NOT NULL,
  item_key TEXT NOT NULL REFERENCES collection_species(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, resident, night)
);
CREATE INDEX IF NOT EXISTS idx_trick_or_treats_night ON trick_or_treats (member_id, night);
ALTER TABLE trick_or_treats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Trick-or-treats readable by owner" ON trick_or_treats;
CREATE POLICY "Trick-or-treats readable by owner" ON trick_or_treats FOR SELECT USING (member_id = (select auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON trick_or_treats FROM anon, authenticated;

-- The resident answers once a night: the treat is recorded and goes in the bag together, or neither happens (a full bag
-- leaves the door to knock on again after making room). The treat goes through the catch record (the bag's check and
-- the hourly caps), as every pickup does.
CREATE OR REPLACE FUNCTION public.traditions_treat(p_member_id UUID, p_resident TEXT, p_night DATE, p_item_key TEXT)
RETURNS TABLE (item_key TEXT, count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM collection_species s WHERE s.key = p_item_key AND s.sub = 'treat' AND s.active) THEN
    RAISE EXCEPTION 'not_a_treat';
  END IF;
  INSERT INTO trick_or_treats (member_id, resident, night, item_key) VALUES (p_member_id, p_resident, p_night, p_item_key)
  ON CONFLICT (member_id, resident, night) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'already_treated'; END IF;
  SELECT * INTO r FROM public.collections_record_catch(p_member_id, p_item_key, NULL, FALSE);
  RETURN QUERY SELECT p_item_key, r.count;
END;
$$;
REVOKE ALL ON FUNCTION public.traditions_treat(UUID, TEXT, DATE, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.traditions_treat(UUID, TEXT, DATE, TEXT) TO service_role;
