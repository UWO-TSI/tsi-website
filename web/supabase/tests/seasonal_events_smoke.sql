-- Seasonal events (specs/seasonal-events.md). Throwaway local Postgres after every
-- migration through 20260929120000_seasonal_events, with the pre_* seeds. Never
-- Supabase. Each section fails before 20260929120000.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000005e1', 'se-maya@x'), ('00000000-0000-4000-8000-0000000005e2', 'se-jordan@x'),
  ('00000000-0000-4000-8000-0000000005e3', 'se-public@x');
UPDATE profiles SET membership = 'member', tier = 4, display_name = 'Maya' WHERE id = '00000000-0000-4000-8000-0000000005e1';
UPDATE profiles SET membership = 'member', tier = 4, display_name = 'Jordan' WHERE id = '00000000-0000-4000-8000-0000000005e2';

-- ─── 1. Seeds: four goals with their events, three catches, event furniture off sale ─
DO $$ BEGIN
  ASSERT (SELECT string_agg(slug || ':' || (event ->> 'decor'), ',' ORDER BY position) FROM club_goals WHERE goal_type = 'seasonal')
    = 'fall-fishing-tourney:fall-tourney,winter-lights:winter-lights,genesis-week:genesis,spring-picnic:spring-picnic', 'four seasonal goals';
  ASSERT (SELECT event -> 'tourney' FROM club_goals WHERE slug = 'fall-fishing-tourney') = 'true'::jsonb, 'fall is the tourney';
  ASSERT (SELECT window_start FROM club_goals WHERE slug = 'winter-lights') = '2026-12-01 00:00 America/Toronto'::timestamptz, 'winter opens at Toronto midnight';
  ASSERT (SELECT event FROM club_goals WHERE slug = 'reopen-cafe') = '{}'::jsonb, 'story goals carry no event';
  ASSERT (SELECT count(*) FROM collection_species WHERE key IN ('fish_yellow_perch', 'fish_sturgeon', 'fish_giant_trevally') AND donatable) = 3, 'limited-time catches in the roster';
  ASSERT (SELECT count(*) FROM shop_items WHERE slug IN ('furn-silver-hha-trophy', 'furn-lounge-tea', 'furn-tree-cedar-snow', 'furn-monument-banner', 'furn-beach-towel') AND NOT active) = 5, 'event furniture seeded off sale';
  BEGIN
    UPDATE club_goals SET event = '[]'::jsonb WHERE slug = 'genesis-week';
    RAISE EXCEPTION 'array event accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'seasonal 1 seeds ok';
END $$;

-- ─── 2. A catch during the tourney enters it; the biggest per category stays ──
DO $$
DECLARE
  M uuid := '00000000-0000-4000-8000-0000000005e1';
  J uuid := '00000000-0000-4000-8000-0000000005e2';
  T uuid := (SELECT id FROM club_goals WHERE slug = 'fall-fishing-tourney');
  W uuid := (SELECT id FROM club_goals WHERE slug = 'winter-lights');
BEGIN
  PERFORM tourney_record_catch(M, 'fish_carp', 60, true, T, 2026);
  PERFORM tourney_record_catch(M, 'fish_black_bass', 40, true, T, 2026);  -- smaller: entry keeps the carp
  PERFORM tourney_record_catch(M, 'sea_scallop', 12, true, T, 2026);      -- its own category
  PERFORM tourney_record_catch(M, 'bug_ladybug', NULL, false, T, 2026);   -- no size: caught, no entry
  PERFORM tourney_record_catch(J, 'fish_sturgeon', 150, true, W, 2026);   -- not a tourney goal: caught, no entry
  PERFORM tourney_record_catch(J, 'fish_pike', 70, true, T, 2026);
  ASSERT (SELECT string_agg(category || ':' || item_key || ':' || size_cm, ',' ORDER BY category) FROM tourney_entries WHERE member_id = M) = 'fish:fish_carp:60.0,sea:sea_scallop:12.0', 'Maya''s entries';
  ASSERT (SELECT count(*) FROM tourney_entries WHERE member_id = J) = 1, 'Jordan: one entry, from the tourney goal only';
  ASSERT (SELECT count FROM member_collections WHERE user_id = J AND item_key = 'fish_sturgeon') = 1, 'the non-tourney catch still landed';
  ASSERT (SELECT count FROM member_collections WHERE user_id = M AND item_key = 'bug_ladybug') = 1, 'the sizeless catch still landed';
  PERFORM tourney_record_catch(M, 'fish_carp', 65, true, T, 2026);
  ASSERT (SELECT size_cm FROM tourney_entries WHERE member_id = M AND category = 'fish') = 65, 'a bigger catch replaces the entry';
  RAISE NOTICE 'seasonal 2 tourney entries ok';
END $$;

-- ─── 3. Members read only their own entry and can't write or call the function ─
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000005e2","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM tourney_entries) = 1, 'a member sees only their own entry';
  ASSERT (SELECT count(*) FROM tourney_entries WHERE member_id = '00000000-0000-4000-8000-0000000005e1') = 0, 'nobody else''s';
  BEGIN
    INSERT INTO tourney_entries (goal_id, cycle, member_id, category, item_key, size_cm)
      VALUES ((SELECT id FROM club_goals WHERE slug = 'fall-fishing-tourney'), 2026, '00000000-0000-4000-8000-0000000005e2', 'fish', 'fish_sturgeon', 200);
    RAISE EXCEPTION 'a member wrote an entry';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE tourney_entries SET size_cm = 200;
    RAISE EXCEPTION 'a member raised an entry';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM tourney_record_catch('00000000-0000-4000-8000-0000000005e2', 'fish_sturgeon', 200, true, (SELECT id FROM club_goals WHERE slug = 'fall-fishing-tourney'), 2026);
    RAISE EXCEPTION 'a member called tourney_record_catch';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE club_goals SET event = '{"rewards":["merch-hoodie"]}'::jsonb WHERE slug = 'spring-picnic';
    ASSERT NOT FOUND, 'a T4 edited an event';
  END;
  RAISE NOTICE 'seasonal 3 member access ok';
END $$;
ROLLBACK;

-- ─── 4. Completing a goal gives every active member its rewards, once ────────
DO $$
DECLARE
  P uuid := (SELECT id FROM club_goals WHERE slug = 'spring-picnic');
  M uuid := '00000000-0000-4000-8000-0000000005e1';
  members INTEGER := (SELECT count(*) FROM profiles WHERE membership = 'member' AND is_active);
  crown uuid := (SELECT id FROM shop_items WHERE slug = 'acc-flower-crown');
  blanket uuid := (SELECT id FROM shop_items WHERE slug = 'furn-beach-towel');
  owned BIGINT;
BEGIN
  INSERT INTO member_inventory (member_id, item_id, qty, slot) VALUES (M, crown, 1, 'accessory');  -- crafted one already
  INSERT INTO club_goal_completions (goal_id, cycle, total_points) VALUES (P, 2026, 15000);
  ASSERT (SELECT count(*) FROM member_inventory WHERE item_id = blanket) = members, 'a blanket for every active member';
  ASSERT (SELECT count(*) FROM member_inventory WHERE item_id = crown) = members, 'a crown for every active member';
  ASSERT (SELECT qty FROM member_inventory WHERE member_id = M AND item_id = crown) = 1, 'an item already owned stays as it was';
  ASSERT NOT EXISTS (SELECT 1 FROM member_inventory WHERE member_id = '00000000-0000-4000-8000-0000000005e3'), 'public accounts get nothing';
  ASSERT (SELECT slot FROM member_inventory WHERE member_id = '00000000-0000-4000-8000-0000000005e2' AND item_id = crown) = 'accessory', 'wearable keeps its slot';
  INSERT INTO club_goal_completions (goal_id, cycle, total_points) VALUES (P, 2026, 16000) ON CONFLICT DO NOTHING;
  ASSERT (SELECT sum(qty) FROM member_inventory WHERE item_id = blanket) = members, 'a replayed completion grants nothing';
  owned := (SELECT count(*) FROM member_inventory);
  INSERT INTO club_goal_completions (goal_id, cycle, total_points) VALUES ((SELECT id FROM club_goals WHERE slug = 'reopen-cafe'), 0, 15000);
  ASSERT (SELECT count(*) FROM member_inventory) = owned AND members > 1, 'goals without rewards grant nothing';
  RAISE NOTICE 'seasonal 4 completion rewards ok';
END $$;

-- ─── 5. The migration applies twice ──────────────────────────────────────────
\ir ../migrations/20260929120000_seasonal_events.sql
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM club_goals WHERE goal_type = 'seasonal') = 4, 'no duplicate goals';
  ASSERT (SELECT count(*) FROM tourney_entries) = 3, 'entries kept';
  RAISE NOTICE 'seasonal 5 idempotent ok';
END $$;
\echo seasonal events smoke ok
