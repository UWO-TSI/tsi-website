-- ─── Seasonal events: four yearly club goals and what they bring to the island ─
--
-- Spec: specs/seasonal-events.md (ledger rows 96, 99, 184, 204, 212).
-- Needs 20260926150200_progression (club_goals, club_goal_completions),
-- 20260926150400_collections (collection_species), 20260926150600_economy
-- (shop_items, member_inventory), 20260926160000_crafting (acc-flower-crown),
-- 20260926200000_membership_launch (profiles.membership) and
-- 20260929100000_catch_rolls (collections_land). Idempotent.
-- Test: web/supabase/tests/seasonal_events_smoke.sql.
--
--   * club_goals.event: a seasonal goal's event, edited on the Seasonal Events
--     page: decoration set, fishing tourney, limited-time catches, reward
--     items, GENESIS posters (lib/progression/goals.ts normalizeEvent).
--   * The limited-time catches join the species roster; the event furniture
--     joins the shop catalogue, off sale.
--   * The four goals: fall fishing tourney (September), winter lights
--     (December), GENESIS week (March), spring blossom picnic (April), on
--     Toronto dates that repeat yearly.
--   * tourney_entries: each member's biggest catch per category per tourney
--     cycle, readable only by its owner. /api/collections/tourney serves the
--     board: the top half by name, the bottom half only as the caller's own
--     rank and unnamed neighbours (design principle 6).
--   * seasonal_land: the server's land step (collections_land) plus the
--     seasonal checks, in one transaction (service role): a limited-time fish
--     outside its event lands nothing; a fish landed during the tourney
--     enters it. Nothing the client reports reaches an entry.
--   * Completing a goal gives every active member its reward items, once: a
--     trigger on club_goal_completions (one row per goal and cycle).

-- ─── 1. The event on the goal ────────────────────────────────────────────────
ALTER TABLE club_goals ADD COLUMN IF NOT EXISTS event JSONB NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN
  ALTER TABLE club_goals ADD CONSTRAINT club_goals_event_object CHECK (jsonb_typeof(event) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Limited-time catches (web/lib/collections/roster.ts EVENT_SPECIES) ───
-- BEGIN GENERATED ROSTER (web/scripts/gen-seeds.mjs)
INSERT INTO collection_species (key, category, sub, name, biome, tool, rarity, size_min_cm, size_max_cm, start_hour, end_hour,
  rain_any_hour, weather, months, one_liner, icon, model, asset_ready, donatable, wing, position) VALUES
  ('fish_yellow_perch', 'fish', NULL, 'Yellow Perch', 'river', 'rod', 'common', 20, 30, NULL, NULL, FALSE, '{}'::text[], ARRAY[9]::int[], 'Tourney season''s favourite. Striped like the leaves.', '/assets/acnh/icons/fish_yellow_perch.png', NULL, TRUE, TRUE, 'aquarium', 101),
  ('fish_sturgeon', 'fish', NULL, 'Sturgeon', 'river', 'rod', 'legendary', 100, 200, NULL, NULL, FALSE, '{}'::text[], ARRAY[9]::int[], 'Older than the lake. Only surfaces for the tourney.', '/assets/acnh/icons/fish_sturgeon.png', NULL, TRUE, TRUE, 'aquarium', 102),
  ('fish_giant_trevally', 'fish', NULL, 'Giant Trevally', 'sea', 'rod', 'rare', 80, 150, NULL, NULL, FALSE, '{}'::text[], ARRAY[9]::int[], 'Hits the line like it has a grudge.', '/assets/acnh/icons/fish_giant_trevally.png', NULL, TRUE, TRUE, 'aquarium', 103)
ON CONFLICT (key) DO NOTHING;
-- END GENERATED ROSTER

-- ─── 3. Event furniture, off sale (web/lib/wallet/catalogue.ts EVENT_ITEMS) ──
-- BEGIN GENERATED EVENT FURNITURE (web/scripts/gen-seeds.mjs)
INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, position, active) VALUES
  ('furn-silver-hha-trophy', 'Tourney cup', 'furniture', '', 100, NULL, NULL, NULL, FALSE, TRUE, NULL, 'silver-hha-trophy', 267, FALSE),
  ('furn-lounge-tea', 'Cocoa set', 'furniture', '', 100, NULL, NULL, NULL, FALSE, TRUE, NULL, 'lounge-tea', 268, FALSE),
  ('furn-tree-cedar-snow', 'Festive fir', 'furniture', '', 100, NULL, NULL, NULL, FALSE, TRUE, NULL, 'tree-cedar-snow', 269, FALSE),
  ('furn-monument-banner', 'Showcase banner', 'furniture', '', 100, NULL, NULL, NULL, FALSE, TRUE, NULL, 'monument-banner', 270, FALSE),
  ('furn-beach-towel', 'Picnic blanket', 'furniture', '', 90, NULL, NULL, NULL, FALSE, TRUE, NULL, 'beach-towel', 271, FALSE)
ON CONFLICT (slug) DO NOTHING;
-- END GENERATED EVENT FURNITURE

-- ─── 4. The four seasonal goals (web/lib/progression/defaults.ts SEASONAL_GOALS) ─
-- BEGIN GENERATED SEASONAL GOALS (web/scripts/gen-seeds.mjs)
INSERT INTO club_goals (slug, title, summary, goal_type, target_points, accepts, window_start, window_end, unlocks, monument_key,
  completion_letter_subject, completion_letter_body, position, event) VALUES
  ('fall-fishing-tourney', 'Fall fishing tourney', 'September is tourney month. Your biggest catch goes on the board by the plaza trophy, and a few fish only bite while it runs. Bring catches and coins to the monument, and come to club events: every check-in counts extra.', 'seasonal', 15000, ARRAY['coins','specimen']::text[], '2026-09-01T04:00:00.000Z', '2026-10-01T04:00:00.000Z', '{}'::text[], 'plaza', 'The fall tourney goal is done', 'The club filled the fall tourney goal. A tourney cup is waiting in your storage, and the winners stay on the plaza trophy until the month is out.', 101, '{"decor":"fall-tourney","tourney":true,"catches":["fish_yellow_perch","fish_sturgeon","fish_giant_trevally"],"rewards":["furn-silver-hha-trophy"],"posters":[]}'::jsonb),
  ('winter-lights', 'Winter lights festival', 'Lanterns go up over the plaza and the cafe starts pouring cocoa, through New Year''s week. Chip in coins and materials at the monument, and every club event you check into during the festival counts extra.', 'seasonal', 15000, ARRAY['coins','material']::text[], '2026-12-01T05:00:00.000Z', '2027-01-08T05:00:00.000Z', '{}'::text[], 'plaza', 'The lights stay on', 'The club filled the winter lights goal. A festive fir and a cocoa set are in your storage. Happy holidays from everyone at TSI.', 102, '{"decor":"winter-lights","tourney":false,"catches":[],"rewards":["furn-tree-cedar-snow","furn-lounge-tea"],"posters":[]}'::jsonb),
  ('genesis-week', 'GENESIS week', 'The showcase comes to the island: banners, a stage in the plaza and a poster for every project. Checking in at GENESIS counts the most, and deliveries at the monument help too.', 'seasonal', 7500, ARRAY['coins','material','specimen']::text[], '2026-03-20T04:00:00.000Z', '2026-03-27T04:00:00.000Z', '{}'::text[], 'plaza', 'GENESIS week, done', 'The club filled the GENESIS goal. A showcase banner is in your storage for your own island.', 103, '{"decor":"genesis","tourney":false,"catches":[],"rewards":["furn-monument-banner"],"posters":[]}'::jsonb),
  ('spring-picnic', 'Spring blossom picnic', 'The cherry trees are out and the picnic blankets are down by the plaza. Fill the goal together and everyone gets a flower crown and a blanket of their own.', 'seasonal', 15000, ARRAY['coins','material']::text[], '2026-04-01T04:00:00.000Z', '2026-05-01T04:00:00.000Z', '{}'::text[], 'plaza', 'Picnic season', 'The club filled the spring picnic goal. A flower crown is in your closet and a picnic blanket is in your storage.', 104, '{"decor":"spring-picnic","tourney":false,"catches":[],"rewards":["acc-flower-crown","furn-beach-towel"],"posters":[]}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
-- END GENERATED SEASONAL GOALS

-- ─── 5. Tourney entries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tourney_entries (
  goal_id UUID NOT NULL REFERENCES club_goals(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('fish', 'sea')),
  item_key TEXT NOT NULL REFERENCES collection_species(key) ON DELETE CASCADE,
  size_cm NUMERIC(7, 1) NOT NULL CHECK (size_cm > 0),
  caught_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (goal_id, cycle, member_id, category)
);
CREATE INDEX IF NOT EXISTS idx_tourney_entries_board ON tourney_entries (goal_id, cycle, category, size_cm DESC);
ALTER TABLE tourney_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tourney entries readable by owner" ON tourney_entries;
CREATE POLICY "Tourney entries readable by owner" ON tourney_entries
  FOR SELECT USING (member_id = (select auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON tourney_entries FROM anon, authenticated;

-- ─── 6. Landing a cast in season: the catch and its tourney entry together ───
-- Wraps collections_land (20260929100000: the server's own roll, landed once,
-- its timing and caps) in one transaction. The route passes, for its clock
-- (lib/progression/seasonal.ts landSeason): the limited-time species whose
-- event isn't running (a roll of one lands nothing, out_of_season), and the
-- open tourney goal and cycle (the landed roll's species and size enter it).
CREATE OR REPLACE FUNCTION public.seasonal_land(p_member_id UUID, p_roll_id UUID, p_closed TEXT[], p_goal_id UUID, p_cycle INTEGER)
RETURNS TABLE (item_key TEXT, size_cm NUMERIC, count INTEGER, total_collected INTEGER, best_size_cm NUMERIC, new_record BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  r RECORD;
  v_category TEXT;
BEGIN
  SELECT * INTO r FROM public.collections_land(p_member_id, p_roll_id);
  IF r.item_key = ANY(COALESCE(p_closed, '{}')) THEN RAISE EXCEPTION 'out_of_season'; END IF;
  SELECT s.category INTO v_category FROM collection_species s WHERE s.key = r.item_key AND s.category IN ('fish', 'sea');
  IF p_goal_id IS NOT NULL AND r.size_cm IS NOT NULL AND v_category IS NOT NULL
     AND EXISTS (SELECT 1 FROM club_goals g WHERE g.id = p_goal_id AND g.goal_type = 'seasonal' AND g.event -> 'tourney' = 'true'::jsonb) THEN
    INSERT INTO tourney_entries AS t (goal_id, cycle, member_id, category, item_key, size_cm)
    VALUES (p_goal_id, p_cycle, p_member_id, v_category, r.item_key, r.size_cm)
    ON CONFLICT (goal_id, cycle, member_id, category) DO UPDATE
      SET item_key = EXCLUDED.item_key, size_cm = EXCLUDED.size_cm, caught_at = NOW()
      WHERE EXCLUDED.size_cm > t.size_cm;
  END IF;
  RETURN QUERY SELECT r.item_key, r.size_cm, r.count, r.total_collected, r.best_size_cm, r.new_record;
END;
$$;
REVOKE ALL ON FUNCTION public.seasonal_land(UUID, UUID, TEXT[], UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seasonal_land(UUID, UUID, TEXT[], UUID, INTEGER) TO service_role;

-- ─── 7. Completion reward: every active member gets the goal's reward items ──
-- club_goal_completions has one row per goal and cycle (service role inserts
-- it once, progression service maybeComplete), so this runs once per cycle.
-- Items a member already owns stay as they are. Cosmetics only: tools, recipe
-- cards and campus merch (Gems) are never granted this way (principle 3).
CREATE OR REPLACE FUNCTION public.club_goal_grant_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO member_inventory (member_id, item_id, qty, slot)
  SELECT p.id, s.id, 1, s.slot
    FROM club_goals g
    CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(g.event -> 'rewards') = 'array' THEN g.event -> 'rewards' ELSE '[]'::jsonb END) AS r (slug)
    JOIN shop_items s ON s.slug = r.slug AND s.category IN ('outfit', 'hair', 'accessory', 'furniture', 'wallpaper', 'flooring')
    CROSS JOIN profiles p
   WHERE g.id = NEW.goal_id AND p.membership = 'member' AND p.is_active
  ON CONFLICT (member_id, item_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.club_goal_grant_rewards() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_club_goal_rewards ON club_goal_completions;
CREATE TRIGGER trg_club_goal_rewards AFTER INSERT ON club_goal_completions
  FOR EACH ROW EXECUTE FUNCTION public.club_goal_grant_rewards();
