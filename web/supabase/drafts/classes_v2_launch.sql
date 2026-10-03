-- ─── Classes v2, wave 5: the launch ─────────────────────────────────────────
--
-- DRAFT 2026-10-03. NOT A MIGRATION YET. It lives in web/supabase/drafts/ so nothing applies it by accident. At go
-- time the coordinator moves it into web/supabase/migrations/ with a fresh timestamp (after the latest applied one,
-- 20261003054110_backpack today) and applies it in one transaction.
-- Spec: specs/classes/design-sheet.md §4 "Wave 5 (launch)", §1.5 "At launch", §1.11 "Existing members at launch",
-- §1.10 (shop cosmetics). Open calls for David: specs/classes/launch-questions.md (the letter's copy, which cosmetics
-- go on sale, signature-weapon wear). Test: web/supabase/tests/classes_v2_launch_smoke.sql
-- (zsh specs/evidence/launch-fixes/sql-smoke.sh --drafts).
--
-- Once (the data_backfills marker 'classes_v2_launch' is written in the same transaction, so a second run changes
-- nothing; the 20260926200000_membership_launch pattern), for every member who has a subclass:
--   1. a mastery row at 0 XP (mastery 1: their kit at its starters). There is no loadout to reset in v2 (keys 1-5
--      are fixed per class, the sheet's build overrides); member_progression.loadout is left as it is, so turning the
--      flag back off restores today's loadouts exactly. A row that already exists keeps its XP.
--   2. their subclass's signature weapon at the highest tier of any weapon they own (an iron sword is 2, the rune
--      staff 3, a guardian drop 4), tier 1 at least, at full durability. It isn't equipped: what they hold stays
--      theirs to change on the tool wheel, which lists signature weapons first (and an equipped weapon other than the
--      driftwood sword trips the held/equipped loop in wave0-questions #19).
--   3. one free in-family repick (repick_source 'launch'); a member already holding an Oracle token keeps that one
--      (one token at a time, wave0-questions #10).
--   4. the launch letter (one system letter each, broadcast key 'classes_v2:launch').
-- Then, for everyone:
--   5. the class cosmetics on sale: every aura and the coin-priced weapon skins. Nameplate frames and the Gem-priced
--      (animated) skins stay off until they show in game (launch-questions 2, david-decisions #12 B). For all of them
--      instead: drop the two conditions marked "(B)".
--   6. economy_settings.classes_v2 = 1.
-- Members without a subclass get nothing now: at level 10 they choose through combat_choose_subclass, which runs the
-- v2 path once the flag is on (mastery row, tier-1 signature weapon).
-- After a rollback (the flag set back to 0 by hand), applying this again changes nothing: turn the flag on by hand
-- (UPDATE economy_settings SET value = 1 WHERE key = 'classes_v2'). No new functions, so nothing to revoke.

DO $$
DECLARE v_members INTEGER; v_weapons INTEGER; v_tokens INTEGER; v_letters INTEGER; v_items INTEGER;
BEGIN
  INSERT INTO public.data_backfills (key) VALUES ('classes_v2_launch') ON CONFLICT (key) DO NOTHING;
  IF NOT FOUND THEN
    RAISE NOTICE 'classes v2 launch already applied, skipped';
    RETURN;
  END IF;

  -- 1 ── Mastery rows: mastery 1, the starters ───────────────────────────────
  INSERT INTO public.member_subclass_mastery (member_id, subclass)
  SELECT p.member_id, p.subclass FROM public.member_progression p WHERE p.subclass IS NOT NULL
  ON CONFLICT (member_id, subclass) DO NOTHING;
  GET DIAGNOSTICS v_members = ROW_COUNT;

  -- 2 ── The signature weapon at the highest tier owned ──────────────────────
  INSERT INTO public.member_weapons (member_id, weapon_key, durability)
  SELECT t.member_id, sig.key, sig.max_durability
    FROM (SELECT p.member_id, p.subclass, GREATEST(1, COALESCE(MAX(w.tier), 1)) AS tier
            FROM public.member_progression p
            LEFT JOIN public.member_weapons mw ON mw.member_id = p.member_id
            LEFT JOIN public.weapons w ON w.key = mw.weapon_key
           WHERE p.subclass IS NOT NULL
           GROUP BY p.member_id, p.subclass) t
    CROSS JOIN LATERAL (SELECT w.key, w.max_durability FROM public.weapons w
                         WHERE w.subclass = t.subclass AND w.active AND w.tier <= t.tier
                         ORDER BY w.tier DESC LIMIT 1) sig
  ON CONFLICT (member_id, weapon_key) DO NOTHING;
  GET DIAGNOSTICS v_weapons = ROW_COUNT;

  -- 3 ── One free in-family repick ───────────────────────────────────────────
  UPDATE public.member_progression SET repick_source = 'launch', updated_at = NOW()
   WHERE subclass IS NOT NULL AND repick_source IS NULL;
  GET DIAGNOSTICS v_tokens = ROW_COUNT;

  -- 4 ── The letter (copy: specs/classes/launch-questions.md, for David's approval) ──
  INSERT INTO public.letters (kind, recipient_id, subject, body, broadcast_key)
  SELECT 'system', p.member_id,
         'Your path has grown',
         E'Every path has its own kit now: its own skills on your number keys, an ultimate on F that fills as you fight, and a signature weapon. Yours is waiting in your tool wheel, at the best tier you''ve earned so far. Your skills need it in hand.\n\n'
         || E'Mastery is new too. You start at mastery 1, and fighting in the ruins raises it to 20, opening new skills and looks along the way.\n\n'
         || E'Since the paths changed under you, you get one free change: press P and pick any path in your family. No reading, no coins, no wait, and it never expires.\n\n'
         || 'See you in the ruins.',
         'classes_v2:launch'
    FROM public.member_progression p
   WHERE p.subclass IS NOT NULL
  ON CONFLICT (broadcast_key, recipient_id) DO NOTHING;
  GET DIAGNOSTICS v_letters = ROW_COUNT;

  -- 5 ── The class cosmetics on sale ─────────────────────────────────────────
  UPDATE public.shop_items SET active = TRUE
   WHERE category IN ('weapon_skin', 'aura', 'frame') AND NOT active
     AND category <> 'frame'                                   -- (B) frames: drawn nowhere yet
     AND NOT (category = 'weapon_skin' AND tc_price IS NOT NULL); -- (B) Gem skins: animated in name only so far
  GET DIAGNOSTICS v_items = ROW_COUNT;

  -- 6 ── The flag ─────────────────────────────────────────────────────────────
  UPDATE public.economy_settings SET value = 1 WHERE key = 'classes_v2';
  IF NOT FOUND THEN RAISE EXCEPTION 'classes_v2 setting missing: apply 20261002181044_classes_v2 first'; END IF;

  RAISE NOTICE 'classes v2 launch: % mastery rows, % signature weapons, % repicks, % letters, % cosmetics on sale; the flag is on',
    v_members, v_weapons, v_tokens, v_letters, v_items;
END $$;
