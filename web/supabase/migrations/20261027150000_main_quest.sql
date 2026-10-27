-- ─── The main quest, chapters 1 to 6 (specs/launch/v1-gameplay.md m1 to m6; lane main-quest) ─────────────────
--
-- After chapter 1 there was no personal quest. Now each chapter is an errand with a person and a place
-- (web/lib/progression/chapters.ts STEP_RULES, mirrored by DEFAULT_CHAPTERS in web/lib/progression/defaults.ts):
--   1 Settle in: first catch, donated to Juno, the museum's guide (no report to Alice): 100 coins and her letter.
--   2 Odile's net, 3 Pim's shovel, 4 Bram's challenge (the Cedar rod), 5 the club's museum, 6 Eliza's pickaxe.
-- The club-goal and Oracle chapters move after them (7, 8, 9), so the personal chain runs first.
--
-- Also: the requirement types, a chapter's reward_item (a shop item slug, given once on completion), and the pickaxe
-- as a tool (collection_species.tool, shop_items.slot) for rocks, and the museum guide's post (npc_personas.post). Copy changes only touch rows still as seeded, so an
-- admin's own wording stays. Idempotent. Apply BEFORE the catalogue seed that follows it (the pickaxe item and the
-- rocks' tool need these constraints).

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
  CHECK (requirement IN ('settle_in', 'bug_net', 'dig', 'rod_challenge', 'museum_collab', 'pickaxe', 'club_goal', 'oracle_trial'));
ALTER TABLE quest_chapters ADD COLUMN IF NOT EXISTS reward_item TEXT CHECK (reward_item IS NULL OR reward_item ~ '^[a-z0-9-]{1,64}$');

SELECT pg_temp.drop_list_check('collection_species', 'tool', 'shovel');
ALTER TABLE collection_species ADD CONSTRAINT collection_species_tool_check CHECK (tool IN ('rod', 'net', 'hand', 'shovel', 'pickaxe'));
SELECT pg_temp.drop_list_check('shop_items', 'slot', 'shovel');
ALTER TABLE shop_items ADD CONSTRAINT shop_items_slot_check CHECK (slot IS NULL OR slot IN ('rod', 'net', 'shovel', 'pickaxe', 'outfit', 'hair', 'accessory'));
-- Juno, the museum's guide (the catalogue seed after this one adds her).
SELECT pg_temp.drop_list_check('npc_personas', 'post', 'museum_curator');
ALTER TABLE npc_personas ADD CONSTRAINT npc_personas_post_check
  CHECK (post IS NULL OR post IN ('hq_lead', 'shopkeeper', 'cafe_owner', 'museum_curator', 'museum_guide', 'wharf_keeper', 'oracle_keeper', 'workshop_crafter', 'villager'));

-- Chapter 1 (m1): the donation to Juno finishes it; the report to Alice is gone.
UPDATE quest_chapters
   SET summary = 'Make your first catch and bring it to Juno at the museum.'
 WHERE slug = 'settle-in'
   AND summary IN ('Make your first catch and donate it to the museum, then report back to Alice at HQ.',
                   'Make your first catch and donate it to the museum, then report back to Wren at HQ.');
UPDATE quest_chapters
   SET step_copy = '{"claim_plot":{"label":"Claim your plot at HQ"},"first_catch":{"label":"Make your first catch","hint":"Any fish counts. Try the end of the pier."},"donate_catch":{"label":"Bring your catch to Juno at the museum","hint":"She''s the museum''s guide. Talk to her by the door."}}'::jsonb
 WHERE slug = 'settle-in'
   AND step_copy #>> '{donate_catch,label}' = 'Donate your catch to the museum shell';
UPDATE quest_chapters
   SET completion_letter = 'Thank you for the museum''s first find from you! I''ve written its label myself. Every fish, bug and buried treasure you bring in helps the whole club fill the halls. Come and see me any time. Juno, the museum'
 WHERE slug = 'settle-in'
   AND completion_letter = 'Welcome to the island. The village is yours to explore.';

-- The club's chapters after the personal ones (highest first: positions are unique).
UPDATE quest_chapters SET position = 9 WHERE slug = 'ruins-gate' AND position = 4 AND NOT EXISTS (SELECT 1 FROM quest_chapters WHERE position = 9);
UPDATE quest_chapters SET position = 8 WHERE slug = 'fund-museum' AND position = 3 AND NOT EXISTS (SELECT 1 FROM quest_chapters WHERE position = 8);
UPDATE quest_chapters SET position = 7 WHERE slug = 'reopen-cafe' AND position = 2 AND NOT EXISTS (SELECT 1 FROM quest_chapters WHERE position = 7);

INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy, unlocks_regions, completion_letter, skippable_max_tier, reward_coins, reward_item)
SELECT 'odiles-net', 2, 'Odile''s net', 'Odile at the museum has a spare net. Catch a few bugs with it and show her.', 'bug_net', NULL, '{"get_net":{"label":"Ask Odile at the museum for a net"},"catch_bugs":{"label":"Catch 3 bugs","hint":"Bugs sit on flowers and trees. Walk up slowly (hold C) and swing when the net says so."},"show_odile":{"label":"Show Odile your bugs at the museum"}}'::jsonb, '{}', '', 5, 150, NULL
 WHERE NOT EXISTS (SELECT 1 FROM quest_chapters WHERE slug = 'odiles-net' OR position = 2);
INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy, unlocks_regions, completion_letter, skippable_max_tier, reward_coins, reward_item)
SELECT 'pims-shovel', 3, 'Pim''s shovel', 'Pim on the beach always has a shovel. Things are buried all over the island: find the marks and dig.', 'dig', NULL, '{"get_shovel":{"label":"Ask Pim on the beach for a shovel"},"dig_up":{"label":"Dig up 3 buried things","hint":"Look for little star-shaped cracks in the sand and on dirt. Rare things turn up too."},"show_pim":{"label":"Show Pim your finds on the beach"}}'::jsonb, '{}', '', 5, 150, NULL
 WHERE NOT EXISTS (SELECT 1 FROM quest_chapters WHERE slug = 'pims-shovel' OR position = 3);
INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy, unlocks_regions, completion_letter, skippable_max_tier, reward_coins, reward_item)
SELECT 'brams-challenge', 4, 'Bram''s challenge', 'Bram bets you can''t catch five kinds of fish, one of them at dawn or dusk. Win and his Cedar rod is yours.', 'rod_challenge', NULL, '{"fish_kinds":{"label":"Catch 5 different fish","hint":"The pier, the river and the pond all have their own."},"twilight_catch":{"label":"Catch a fish at dawn or dusk","hint":"Island time follows the real sun: fish around sunrise or sunset."},"show_bram":{"label":"Show Bram at the wharf"}}'::jsonb, '{}', '', 5, 0, 'rod-cedar'
 WHERE NOT EXISTS (SELECT 1 FROM quest_chapters WHERE slug = 'brams-challenge' OR position = 4);
INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy, unlocks_regions, completion_letter, skippable_max_tier, reward_coins, reward_item)
SELECT 'the-museum', 5, 'The club''s museum', 'The museum opens when the club has filled it: 10 kinds of fish, 5 bugs and 3 buried finds. Do your part.', 'museum_collab', NULL, '{"donate_new":{"label":"Donate 3 new finds to the museum","hint":"Talk to Odile inside. Only finds nobody has donated yet go on show."},"tell_odile":{"label":"Tell Odile at the museum"}}'::jsonb, '{}', '', 5, 200, NULL
 WHERE NOT EXISTS (SELECT 1 FROM quest_chapters WHERE slug = 'the-museum' OR position = 5);
INSERT INTO quest_chapters (slug, position, title, summary, requirement, goal_slug, step_copy, unlocks_regions, completion_letter, skippable_max_tier, reward_coins, reward_item)
SELECT 'elizas-pickaxe', 6, 'Eliza''s pickaxe', 'Mayor Eliza still has the pickaxe that dug the HQ''s foundations. Break some rocks with it.', 'pickaxe', NULL, '{"get_pickaxe":{"label":"Ask Mayor Eliza at the plaza for her pickaxe"},"mine_stone":{"label":"Break rocks for 3 stone","hint":"Swing the pickaxe at the big rocks. Each one gives a stone or so an hour."},"mine_iron":{"label":"Find a lump of iron","hint":"Iron turns up in rocks now and then."},"show_eliza":{"label":"Bring your stone to Mayor Eliza"}}'::jsonb, '{}', '', 5, 200, NULL
 WHERE NOT EXISTS (SELECT 1 FROM quest_chapters WHERE slug = 'elizas-pickaxe' OR position = 6);
