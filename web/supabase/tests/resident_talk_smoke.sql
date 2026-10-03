-- Resident talk (20261003161600_resident_talk, reachability deliverable 1). Throwaway local Postgres after every
-- migration, with the pre_* seeds. Never Supabase. Fails before the migration: npc_personas has no talk column.
\set ON_ERROR_STOP 1

-- ─── 1. Every resident has conversations (empty by default); the seeded two have theirs ───────────────────────────
DO $$ BEGIN
  ASSERT (SELECT jsonb_array_length(talk) FROM npc_personas WHERE slug = 'mayor') = 3, 'the mayor has three conversations';
  ASSERT (SELECT jsonb_array_length(talk) FROM npc_personas WHERE slug = 'shopkeeper') = 3, 'Toren has three conversations';
  ASSERT (SELECT talk -> 0 ->> 0 FROM npc_personas WHERE slug = 'mayor') LIKE '[happy] %', 'a line keeps its expression';
  ASSERT (SELECT talk -> 2 ->> 1 FROM npc_personas WHERE slug = 'mayor') LIKE '%Autumn''s%', 'apostrophes survive';
  INSERT INTO npc_personas (slug, display_name, spawn_zone) VALUES ('talk-smoke', 'Kit', 'courtyard');
  ASSERT (SELECT talk FROM npc_personas WHERE slug = 'talk-smoke') = '[]'::jsonb, 'a new resident starts with none';
  RAISE NOTICE 'talk 1 column and seed ok';
END $$;

-- ─── 2. Only what the game can say: the database refuses every other shape ────────────────────────────────────────
DO $$
DECLARE bad JSONB;
BEGIN
  UPDATE npc_personas SET talk = '[["[happy] Oh! Hi.", "Tide''s in."], ["[sleepy] Mornings are a rumour."]]' WHERE slug = 'talk-smoke';
  FOREACH bad IN ARRAY ARRAY[
    '{"a": 1}', '"hello"', '[[]]', '[["a", "b", "c", "d", "e"]]', '[[1]]', '[["   "]]', '[["[happy]   "]]', '[["[wizard] Hm."]]',
    jsonb_build_array(jsonb_build_array(repeat('x', 201))),
    (SELECT jsonb_agg('["Hi."]'::jsonb) FROM generate_series(1, 13))
  ]::jsonb[] LOOP
    BEGIN
      UPDATE npc_personas SET talk = bad WHERE slug = 'talk-smoke';
      RAISE EXCEPTION 'accepted %', bad;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  ASSERT (SELECT jsonb_array_length(talk) FROM npc_personas WHERE slug = 'talk-smoke') = 2, 'the good conversations stand';
  RAISE NOTICE 'talk 2 shape ok';
END $$;

-- ─── 3. Members read it with the row; only T1/T2 change it (row 215; the editor goes through the T1/T2 routes) ────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000001f1","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT jsonb_array_length(talk) FROM npc_personas WHERE slug = 'mayor') = 3, 'a member reads the conversations';
  UPDATE npc_personas SET talk = '[["Hacked."]]' WHERE slug = 'mayor';
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT talk -> 0 ->> 0 FROM npc_personas WHERE slug = 'mayor') <> 'Hacked.', 'a T3 cannot rewrite what residents say';
  RAISE NOTICE 'talk 3 read by members, written by T1/T2 ok';
END $$;
ROLLBACK;

DELETE FROM npc_personas WHERE slug = 'talk-smoke';
DO $$ BEGIN RAISE NOTICE 'resident talk smoke ok'; END $$;
