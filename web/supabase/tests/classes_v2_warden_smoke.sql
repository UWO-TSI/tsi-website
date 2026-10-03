-- Local smoke test for draft 20261002214727_classes_v2_warden_seed (the game chain's throwaway cluster; never Supabase).
-- The Warden's signature weapons and shop cosmetics, the choice granting the tier-1 gloves, and the Summoner's tamings
-- (order, the flag, the subclass, replays) with members reading only their own. Leaves the classes_v2 flag off.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000003a1', 'wdn-a@x'), ('00000000-0000-4000-8000-0000000003a2', 'wdn-b@x')
  ON CONFLICT DO NOTHING;
DO $$
DECLARE r record; A uuid := '00000000-0000-4000-8000-0000000003a1'; B uuid := '00000000-0000-4000-8000-0000000003a2';
BEGIN
  -- Signature weapons: five tiers for each of the four, every type its own, tier bases from 1 to 5.
  ASSERT (SELECT count(*) FROM weapons WHERE subclass IN ('summoner', 'shaman', 'druid', 'priest')) = 20, 'wdn 20 signature rows';
  ASSERT (SELECT count(DISTINCT weapon_type) FROM weapons WHERE subclass IN ('summoner', 'shaman', 'druid', 'priest')) = 4, 'wdn four types';
  ASSERT (SELECT array_agg(tier ORDER BY tier) FROM weapons WHERE subclass = 'summoner') = ARRAY[1, 2, 3, 4, 5], 'wdn tiers 1-5';
  ASSERT (SELECT weapon_type FROM weapons WHERE key = 'sunstone-staff-1') = 'sunstone-staff' AND (SELECT scaling FROM weapons WHERE key = 'living-staff-3') = ARRAY['spirit', 'vitality'], 'wdn types and scaling';
  -- Shop cosmetics: skins fit one subclass's weapon, auras are three colours; two are priced in Gems.
  ASSERT (SELECT count(*) FROM shop_items WHERE slug LIKE 'skin-%' AND category = 'weapon_skin' AND cosmetic->>'subclass' IN ('summoner', 'shaman', 'druid', 'priest')) = 5, 'wdn five skins';
  ASSERT (SELECT count(*) FROM shop_items WHERE slug LIKE 'aura-warden-%' AND category = 'aura' AND jsonb_array_length(cosmetic->'ramp') = 3) = 4, 'wdn four auras';
  ASSERT (SELECT count(*) FROM shop_items WHERE (slug LIKE 'skin-%' OR slug LIKE 'aura-warden-%') AND tc_price IS NOT NULL) = 2, 'wdn two Gem items';
  ASSERT (SELECT count(*) FROM shop_items WHERE (slug LIKE 'skin-%' OR slug LIKE 'aura-warden-%') AND sprite_url IS NULL) = 0, 'wdn every row has its icon';

  INSERT INTO member_identity (member_id, family) VALUES (A, 'Warden'), (B, 'Warden') ON CONFLICT (member_id) DO UPDATE SET family = EXCLUDED.family;
  PERFORM combat_grant_xp(A, 11625, 'admin', 'x', 'wdn-xp-a');
  PERFORM combat_grant_xp(B, 11625, 'admin', 'x', 'wdn-xp-b');

  -- Flag off: no tamings.
  BEGIN PERFORM combat_tame_beast(A, 'owl', 'tame:owl:a0'); RAISE EXCEPTION 'wdn expected an error 1';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'unavailable', 'wdn flag off: ' || SQLERRM; END;

  UPDATE economy_settings SET value = 1 WHERE key = 'classes_v2';
  -- The choice grants the tier-1 seal gloves (and no gate starters).
  PERFORM combat_choose_subclass(A, 'summoner', 'Warden', 'wdn-sub-a1');
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = A AND weapon_key = 'seal-gloves-1'), 'wdn tier-1 gloves granted';
  PERFORM combat_choose_subclass(B, 'priest', 'Warden', 'wdn-sub-b1');
  ASSERT EXISTS (SELECT 1 FROM member_weapons WHERE member_id = B AND weapon_key = 'sunstone-staff-1'), 'wdn tier-1 sunstone staff granted';

  -- Only a Summoner tames; in turn; once per key; a beast tamed twice answers with the list.
  BEGIN PERFORM combat_tame_beast(B, 'owl', 'tame:owl:b1'); RAISE EXCEPTION 'wdn expected an error 2';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_beast', 'wdn a priest tames nothing: ' || SQLERRM; END;
  BEGIN PERFORM combat_tame_beast(A, 'toad', 'tame:toad:a1'); RAISE EXCEPTION 'wdn expected an error 3';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_beast', 'wdn the owl comes first: ' || SQLERRM; END;
  BEGIN PERFORM combat_tame_beast(A, 'wolves', 'tame:wolves:a1'); RAISE EXCEPTION 'wdn expected an error 4';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_beast', 'wdn wolves are known: ' || SQLERRM; END;
  SELECT * INTO r FROM combat_tame_beast(A, 'owl', 'tame:owl:a1');
  ASSERT r.tamed = ARRAY['owl'] AND NOT r.replayed, 'wdn owl tamed';
  SELECT * INTO r FROM combat_tame_beast(A, 'owl', 'tame:owl:a1');
  ASSERT r.tamed = ARRAY['owl'] AND r.replayed, 'wdn the key replays';
  SELECT * INTO r FROM combat_tame_beast(A, 'owl', 'tame:owl:a2');
  ASSERT r.tamed = ARRAY['owl'] AND r.replayed, 'wdn a second owl changes nothing';
  SELECT * INTO r FROM combat_tame_beast(A, 'toad', 'tame:toad:a2');
  ASSERT r.tamed = ARRAY['owl', 'toad'] AND NOT r.replayed, 'wdn toad next';
  PERFORM combat_tame_beast(A, 'serpent', 'tame:serpent:a3');
  SELECT * INTO r FROM combat_tame_beast(A, 'rabbits', 'tame:rabbits:a4');
  ASSERT r.tamed = ARRAY['owl', 'toad', 'serpent', 'rabbits'], 'wdn all four in order';
  ASSERT (SELECT count(*) FROM member_tamed_beasts WHERE member_id = A) = 4, 'wdn four rows';

  UPDATE economy_settings SET value = 0 WHERE key = 'classes_v2';
  RAISE NOTICE 'classes v2 warden ok';
END $$;

-- Members read their own tamings, nobody else's, and write nothing.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000003a2","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM member_tamed_beasts) = 0, 'wdn others'' tamings unreadable';
  BEGIN INSERT INTO member_tamed_beasts (member_id, beast, idempotency_key) VALUES ('00000000-0000-4000-8000-0000000003a2', 'owl', 'x'); RAISE EXCEPTION 'wdn expected an error 5';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM combat_tame_beast('00000000-0000-4000-8000-0000000003a2', 'owl', 'tame:owl:x'); RAISE EXCEPTION 'wdn expected an error 6';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000003a1","role":"authenticated"}';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM member_tamed_beasts) = 4, 'wdn own tamings readable';
  RAISE NOTICE 'classes v2 warden: members read their own tamings, write and call nothing ok';
END $$;
ROLLBACK;
