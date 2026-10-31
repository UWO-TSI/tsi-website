-- ─── The main quest, chapters 1 to 6, in the new world (specs/launch/v1-gameplay.md m1 to m6; lane main-quest) ───────
--
-- The village plays exactly as before (the launch fallback, NEXT_PUBLIC_GAME_WORLD unset): its chapter 1 (settle-in:
-- claim, catch, donate, report to Alice) is untouched and marked world 'village'. The new world (NEXT_PUBLIC_GAME_WORLD
-- =new) gets its own chapter 1 and five errands, each with a person and a place, marked world 'new'
-- (web/lib/progression/chapters.ts STEP_RULES, mirrored by DEFAULT_CHAPTERS in web/lib/progression/defaults.ts):
--   5 first-find: first catch, donated to Juno, the museum's guide (no report to Alice): 100 coins and her letter.
--   6 Odile's net, 7 Pim's shovel, 8 Bram's challenge (the Cedar rod), 9 the club's museum, 10 Eliza's pickaxe.
-- The club-goal and Oracle chapters (both worlds, world NULL) keep their rows and positions 2 to 4, so the village's
-- journal reads as before; the server orders personal chapters before the club's (chapters.ts evaluateChapters).
-- A chapter's `world` defaults NULL (both), so every other row and lane's chapter keeps working, and the server lists a
-- chapter only in its world (web/lib/game/drops.ts releasedChapters).
--
-- Also: the requirement types, reward_item (a shop item slug, given once on completion), the pickaxe's shop slot, and the
-- museum guide's post. Idempotent. Apply BEFORE the catalogue seed that follows it (Juno's post, the pickaxe's slot).

-- The CHECKs the new values meet, widened. Each was declared inline, so Postgres named it; any CHECK on the column whose
-- list holds the old values is dropped by its catalog name, then the widened one is added under a fixed name.
CREATE OR REPLACE FUNCTION pg_temp.drop_list_check(tbl regclass, col text, member text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = tbl AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%' || col || '%' AND pg_get_constraintdef(oid) LIKE '%''' || member || '''%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', tbl, c.conname);
  END LOOP;
END $$;

SELECT pg_temp.drop_list_check('quest_chapters', 'requirement', 'oracle_trial');
ALTER TABLE quest_chapters ADD CONSTRAINT quest_chapters_requirement_check
  CHECK (requirement IN ('settle_in', 'first_find', 'bug_net', 'dig', 'rod_challenge', 'museum_collab', 'pickaxe', 'club_goal', 'oracle_trial'));
ALTER TABLE quest_chapters ADD COLUMN IF NOT EXISTS reward_item TEXT CHECK (reward_item IS NULL OR reward_item ~ '^[a-z0-9-]{1,64}$');
-- The world a chapter plays in (web/lib/game/world/active.ts NEXT_PUBLIC_GAME_WORLD); NULL, the default: both.
ALTER TABLE quest_chapters ADD COLUMN IF NOT EXISTS world TEXT DEFAULT NULL CHECK (world IS NULL OR world IN ('village', 'new'));

SELECT pg_temp.drop_list_check('shop_items', 'slot', 'shovel');
ALTER TABLE shop_items ADD CONSTRAINT shop_items_slot_check CHECK (slot IS NULL OR slot IN ('rod', 'net', 'shovel', 'pickaxe', 'outfit', 'hair', 'accessory', 'bait', 'bobber'));
-- Juno, the museum's guide (the catalogue seed after this one adds her).
SELECT pg_temp.drop_list_check('npc_personas', 'post', 'museum_curator');
ALTER TABLE npc_personas ADD CONSTRAINT npc_personas_post_check
  CHECK (post IS NULL OR post IN ('hq_lead', 'shopkeeper', 'cafe_owner', 'museum_curator', 'museum_guide', 'wharf_keeper', 'oracle_keeper', 'workshop_crafter', 'villager'));

-- The village's chapter 1, unchanged, marked as the village's.
UPDATE quest_chapters SET world = 'village' WHERE slug = 'settle-in' AND world IS NULL;

INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy, unlocks_regions, completion_letter, skippable_max_tier, reward_coins, reward_item, world)
SELECT 'first-find', 5, 'Settle in', 'Make your first catch and bring it to Juno at the museum.', 'first_find', NULL, '{"claim_plot":{"label":"Claim your plot at HQ"},"first_catch":{"label":"Make your first catch","hint":"Any fish counts. Try the end of the pier."},"donate_catch":{"label":"Bring your catch to Juno at the museum","hint":"She''s the museum''s guide. Talk to her by the door."}}'::jsonb, '{village_core}', 'Thank you for the museum''s first find from you! I''ve written its label myself. Every fish, bug and buried treasure you bring in helps the whole club fill the halls. Come and see me any time. Juno, the museum', 5, 100, NULL, 'new'
 WHERE NOT EXISTS (SELECT 1 FROM quest_chapters WHERE slug = 'first-find' OR position = 5);

INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy, unlocks_regions, completion_letter, skippable_max_tier, reward_coins, reward_item, world)
SELECT 'odiles-net', 6, 'Odile''s net', 'Odile at the museum has a spare net. Catch a few bugs with it and show her.', 'bug_net', NULL, '{"get_net":{"label":"Ask Odile at the museum for a net"},"catch_bugs":{"label":"Catch 3 bugs","hint":"Bugs sit on flowers and trees. Walk up slowly (hold C) and swing when the net says so."},"show_odile":{"label":"Show Odile your bugs at the museum"}}'::jsonb, '{}', '', 5, 150, NULL, 'new'
 WHERE NOT EXISTS (SELECT 1 FROM quest_chapters WHERE slug = 'odiles-net' OR position = 6);

INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy, unlocks_regions, completion_letter, skippable_max_tier, reward_coins, reward_item, world)
SELECT 'pims-shovel', 7, 'Pim''s shovel', 'Pim on the beach always has a shovel. Things are buried all over the island: find the marks and dig.', 'dig', NULL, '{"get_shovel":{"label":"Ask Pim on the beach for a shovel"},"dig_up":{"label":"Dig up 3 buried things","hint":"Look for little star-shaped cracks in the sand and on dirt. Rare things turn up too."},"show_pim":{"label":"Show Pim your finds on the beach"}}'::jsonb, '{}', '', 5, 150, NULL, 'new'
 WHERE NOT EXISTS (SELECT 1 FROM quest_chapters WHERE slug = 'pims-shovel' OR position = 7);

INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy, unlocks_regions, completion_letter, skippable_max_tier, reward_coins, reward_item, world)
SELECT 'brams-challenge', 8, 'Bram''s challenge', 'Bram bets you can''t catch five kinds of fish, one of them at dawn or dusk. Win and his Cedar rod is yours.', 'rod_challenge', NULL, '{"fish_kinds":{"label":"Catch 5 different fish","hint":"The pier, the river and the pond all have their own."},"twilight_catch":{"label":"Catch a fish at dawn or dusk","hint":"Island time follows the real sun: fish around sunrise or sunset."},"show_bram":{"label":"Show Bram at the wharf"}}'::jsonb, '{}', '', 5, 0, 'rod-cedar', 'new'
 WHERE NOT EXISTS (SELECT 1 FROM quest_chapters WHERE slug = 'brams-challenge' OR position = 8);

INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy, unlocks_regions, completion_letter, skippable_max_tier, reward_coins, reward_item, world)
SELECT 'the-museum', 9, 'The club''s museum', 'The museum opens when the club has filled it: 10 kinds of fish, 5 bugs and 3 buried finds. Do your part.', 'museum_collab', NULL, '{"donate_new":{"label":"Donate 3 new finds to the museum","hint":"Talk to Odile inside. Only finds nobody has donated yet go on show."},"tell_odile":{"label":"Tell Odile at the museum"}}'::jsonb, '{}', '', 5, 200, NULL, 'new'
 WHERE NOT EXISTS (SELECT 1 FROM quest_chapters WHERE slug = 'the-museum' OR position = 9);

INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy, unlocks_regions, completion_letter, skippable_max_tier, reward_coins, reward_item, world)
SELECT 'elizas-pickaxe', 10, 'Eliza''s pickaxe', 'Mayor Eliza still has the pickaxe that dug the HQ''s foundations. Break some rocks with it.', 'pickaxe', NULL, '{"get_pickaxe":{"label":"Ask Mayor Eliza at the plaza for her pickaxe"},"mine_stone":{"label":"Break rocks for 3 stone","hint":"Swing the pickaxe at the big rocks. Each one gives a stone or so an hour."},"mine_iron":{"label":"Find a lump of iron","hint":"Iron turns up in rocks now and then."},"show_eliza":{"label":"Bring your stone to Mayor Eliza"}}'::jsonb, '{}', '', 5, 200, NULL, 'new'
 WHERE NOT EXISTS (SELECT 1 FROM quest_chapters WHERE slug = 'elizas-pickaxe' OR position = 10);
