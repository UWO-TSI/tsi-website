-- ─── The main quest, round 2 (David's review 2026-10-28; lane main-quest, specs/lanes/main-quest.md) ─────────────────
--
-- Apply AFTER 20261028144337_main_quest (it widens what that one made) and before the catalogue seed that follows it
-- (the broken sudo's species row). Idempotent.
--
-- 1. Chapter XP: quest_chapters.reward_xp, paid once on completion through combat_grant_xp with source 'chapter'.
--    The new world's chapter 1 pays a level's worth (125, lib/combat/progression.ts xpForLevel(2)): "chapter 1 done get
--    enough exp to level up to level 2".
-- 2. Dig loot (web/lib/collections/digLoot.ts): a dig spot gives a relic, ore, coins, very rarely a gem or very, very
--    rarely a broken sudo, rolled by the server with the held shovel's tier. collections_dig records it once per spot
--    and hour: a find like a harvest (caps, bag, recipe), or a purse paid into the wallet (coins: source 'dig'; gems:
--    type 'earn_dig'). member_digs keeps each member's dig tally (Pim's chapter counts digs, whatever came up).
-- 3. The museum's drive (m5): "this might get impossible if people donate all the stuff". Any fish, bug or buried find
--    handed in counts, even a kind already on display: museum_handins and museum_hand_in. The club's tally and each
--    member's part count donations and hand-ins (web/lib/progression/facts.ts).
-- 4. Copy: Pim's dig hint (the marks are now faint and small) and the museum chapter's wording, unless an admin edited them.
-- Mayor Eliza's pickaxe chapter keeps its row: the server doesn't list it until the cave update (web/lib/game/drops.ts).

CREATE OR REPLACE FUNCTION pg_temp.drop_list_check(tbl regclass, col text, member text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = tbl AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%' || col || '%' AND pg_get_constraintdef(oid) LIKE '%''' || member || '''%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', tbl, c.conname);
  END LOOP;
END $$;

-- ── 1. Chapter XP ──
ALTER TABLE quest_chapters ADD COLUMN IF NOT EXISTS reward_xp INTEGER NOT NULL DEFAULT 0 CHECK (reward_xp >= 0 AND reward_xp <= 20000);
UPDATE quest_chapters SET reward_xp = 125 WHERE slug = 'first-find' AND reward_xp = 0;

SELECT pg_temp.drop_list_check('combat_xp_ledger', 'source', 'kill');
ALTER TABLE combat_xp_ledger ADD CONSTRAINT combat_xp_ledger_source_check CHECK (source IN ('kill', 'mission', 'event', 'admin', 'chapter'));

-- ── 2. Dig loot ──
SELECT pg_temp.drop_list_check('wallet_ledger', 'source', 'study');
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_source_check CHECK (source IN (
  'study', 'sell', 'chapter', 'quest', 'daily_gift', 'event', 'admin', 'shop', 'room', 'goal', 'refund', 'migration', 'respec',
  'mission', 'repair', 'stat_reset', 'dig'));
SELECT pg_temp.drop_list_check('tc_transactions', 'type', 'earn_quest');
ALTER TABLE tc_transactions ADD CONSTRAINT tc_transactions_type_check CHECK (type IN (
  'earn_quest', 'earn_bounty', 'earn_event', 'earn_achievement', 'earn_birthday', 'earn_streak', 'earn_admin',
  'spend_marketplace', 'spend_theme', 'spend_shop', 'spend_merch', 'refund_merch', 'earn_dig'));

CREATE TABLE IF NOT EXISTS member_digs (
  member_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  digs INTEGER NOT NULL DEFAULT 0 CHECK (digs >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE member_digs ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
REVOKE ALL ON member_digs FROM anon, authenticated;

-- One dig: exactly one of a find (p_item_key) or a purse (p_currency, p_amount). The server rolled it.
CREATE OR REPLACE FUNCTION public.collections_dig(p_member_id UUID, p_node_id TEXT, p_hour_key TEXT, p_item_key TEXT, p_size NUMERIC, p_trophy BOOLEAN,
  p_currency TEXT, p_amount INTEGER)
RETURNS TABLE (count INTEGER, total_collected INTEGER, best_size_cm NUMERIC, new_record BOOLEAN, recipe_id TEXT, recipe_name TEXT, digs INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE v_digs INTEGER;
BEGIN
  IF p_node_id IS NULL OR p_node_id !~ '^dig-(sand|soil)-[0-9]+$' THEN RAISE EXCEPTION 'not_a_dig'; END IF;
  IF (p_item_key IS NULL) = (p_currency IS NULL) THEN RAISE EXCEPTION 'bad_loot'; END IF;
  INSERT INTO member_digs AS d (member_id, digs) VALUES (p_member_id, 1)
  ON CONFLICT (member_id) DO UPDATE SET digs = d.digs + 1, updated_at = NOW()
  RETURNING d.digs INTO v_digs;
  IF p_item_key IS NOT NULL THEN
    RETURN QUERY SELECT h.count, h.total_collected, h.best_size_cm, h.new_record, h.recipe_id, h.recipe_name, v_digs
      FROM public.collections_harvest_drop(p_member_id, p_node_id, p_hour_key, p_item_key, p_size, p_trophy) h;
    RETURN;
  END IF;
  -- A purse: the spot is spent like any harvest, and the coins or the gem are paid once (keyed by the spot and hour).
  IF p_currency NOT IN ('coins', 'gems') THEN RAISE EXCEPTION 'bad_currency'; END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > (CASE p_currency WHEN 'coins' THEN 200 ELSE 1 END) THEN RAISE EXCEPTION 'bad_amount'; END IF;
  DELETE FROM catch_rolls c WHERE c.member_id = p_member_id AND c.rolled_at < NOW() - INTERVAL '1 day';
  INSERT INTO catch_rolls (member_id, node_id, hour_key, item_key, landed_at)
  VALUES (p_member_id, p_node_id, p_hour_key, p_currency, NOW())
  ON CONFLICT (member_id, node_id, hour_key) WHERE node_id IS NOT NULL DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'already_harvested'; END IF;
  PERFORM public.wallet_apply(p_member_id, p_currency, p_amount, CASE p_currency WHEN 'coins' THEN 'dig' ELSE 'earn_dig' END,
    'dig:' || p_node_id, 'dig:' || p_node_id || ':' || p_hour_key);
  RETURN QUERY SELECT NULL::INTEGER, NULL::INTEGER, NULL::NUMERIC, FALSE, NULL::TEXT, NULL::TEXT, v_digs;
END;
$$;

-- ── 3. The museum's drive ──
CREATE TABLE IF NOT EXISTS museum_handins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  species_key TEXT NOT NULL REFERENCES collection_species(key) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 100),
  handed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_museum_handins_member ON museum_handins (member_id);
ALTER TABLE museum_handins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Museum drive readable by authenticated" ON museum_handins;
CREATE POLICY "Museum drive readable by authenticated" ON museum_handins FOR SELECT USING ((select auth.role()) = 'authenticated');
REVOKE INSERT, UPDATE, DELETE ON museum_handins FROM anon, authenticated;

-- Hand one in: any donatable kind the member has, whether or not it's on display. Consumes one; a replayed key is a no-op.
CREATE OR REPLACE FUNCTION public.museum_hand_in(p_member_id UUID, p_species_key TEXT, p_idempotency_key TEXT)
RETURNS TABLE (replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF EXISTS (SELECT 1 FROM museum_handins WHERE member_id = p_member_id AND idempotency_key = p_idempotency_key) THEN
    RETURN QUERY SELECT TRUE; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM collection_species WHERE key = p_species_key AND donatable AND active) THEN
    RAISE EXCEPTION 'not_donatable';
  END IF;
  UPDATE member_collections SET count = count - 1, updated_at = NOW()
   WHERE user_id = p_member_id AND item_key = p_species_key AND count >= 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_owned'; END IF;
  INSERT INTO museum_handins (member_id, species_key, idempotency_key) VALUES (p_member_id, p_species_key, p_idempotency_key);
  RETURN QUERY SELECT FALSE;
END;
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['collections_dig(uuid, text, text, text, numeric, boolean, text, integer)', 'museum_hand_in(uuid, text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

-- ── 4. Copy (an admin's edit is kept: each only replaces the text 20261028144337 wrote) ──
UPDATE quest_chapters
   SET step_copy = jsonb_set(step_copy, '{dig_up,hint}', '"Look closely: a scuffed patch of sand or dirt. Relics, coins, ore, and now and then something rare."')
 WHERE slug = 'pims-shovel' AND step_copy->'dig_up'->>'hint' = 'Look for little star-shaped cracks in the sand and on dirt. Rare things turn up too.';
UPDATE quest_chapters
   SET summary = 'The museum opens when the club has brought it 10 fish, 5 bugs and 3 buried finds. Do your part.',
       step_copy = jsonb_set(step_copy, '{donate_new}', '{"label":"Bring Odile 3 things for the museum","hint":"Any fish, bug or buried find counts, even a kind the museum already has. Odile waits by the museum."}')
 WHERE slug = 'the-museum' AND step_copy->'donate_new'->>'label' = 'Donate 3 new finds to the museum';
