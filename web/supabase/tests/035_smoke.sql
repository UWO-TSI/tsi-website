-- Local smoke test for draft 20260926150800_combat (after 029-034 smokes; same throwaway cluster).
\set ON_ERROR_STOP 1
DO $$
DECLARE r record; A uuid := '00000000-0000-4000-8000-0000000000aa'; B uuid := '00000000-0000-4000-8000-0000000000f1'; -- fresh member (earlier smokes gave bb event XP)
  C uuid := '00000000-0000-4000-8000-0000000000cc'; pid uuid; v int;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (B, 'f1@x');  -- 034's trigger creates the profile
  PERFORM wallet_apply(B, 'coins', 1000, 'admin', 'smoke seed', 'seed:f1');
  -- curve matches web/lib/combat/progression.ts
  ASSERT combat_level_for_xp(0) = 1 AND combat_level_for_xp(124) = 1 AND combat_level_for_xp(125) = 2, '035 curve start';
  ASSERT combat_level_for_xp(11624) = 9 AND combat_level_for_xp(11625) = 10 AND combat_level_for_xp(999999999) = 50, '035 curve 10/50';
  -- starter gear, XP idempotent
  SELECT * INTO r FROM combat_grant_xp(B, 200, 'admin', 'x', 'xp-0001');
  ASSERT r.xp = 200 AND r.level = 2 AND r.levelled_up AND NOT r.replayed, '035 grant';
  SELECT * INTO r FROM combat_grant_xp(B, 200, 'admin', 'x', 'xp-0001');
  ASSERT r.replayed AND r.xp = 200, '035 grant replay';
  -- (20260926180000_combat_content adds the bow, staff and tome: combat_content_smoke checks all five)
  ASSERT (SELECT count(*) FROM member_weapons WHERE member_id = B AND weapon_key IN ('sword-driftwood', 'wraps-cloth')) = 2 AND (SELECT weapon_key FROM member_weapons WHERE member_id = B AND equipped) = 'sword-driftwood', '035 starter weapons';
  -- kills: once per event, XP from the table, hourly cap
  SELECT * INTO r FROM combat_record_kill(B, 'shadow-fox', 'ev-0001');
  ASSERT r.xp = 230, '035 kill xp';
  SELECT * INTO r FROM combat_record_kill(B, 'shadow-fox', 'ev-0001');
  ASSERT r.replayed AND r.xp = 230, '035 kill replay';
  UPDATE economy_settings SET value = 50 WHERE key = 'kill_xp_per_hour_cap';  -- 30 already this hour + 60 > 50
  BEGIN PERFORM combat_record_kill(B, 'rune-wisp', 'ev-0002'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'kill_xp_cap', '035 cap: ' || SQLERRM; END;
  UPDATE economy_settings SET value = 6000 WHERE key = 'kill_xp_per_hour_cap';
  -- allocation: add-only, within points; reset costs coins through the wallet
  PERFORM combat_grant_xp(B, 11395, 'admin', 'x', 'xp-0002');  -- total 11625 → level 10, 27 points
  ASSERT (SELECT level FROM member_progression WHERE member_id = B) = 10, '035 level 10';
  PERFORM combat_allocate(B, '{"might":20,"vitality":7}');
  BEGIN PERFORM combat_allocate(B, '{"might":21,"vitality":7}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_enough_points', '035 overspend: ' || SQLERRM; END;
  BEGIN PERFORM combat_allocate(B, '{"might":10,"vitality":7,"arcana":10}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'needs_reset', '035 add-only: ' || SQLERRM; END;
  v := (SELECT coins FROM wallets WHERE member_id = B);
  SELECT * INTO r FROM combat_reset_stats(B, 'reset-0001');
  ASSERT r.fee = 200 AND (SELECT coins FROM wallets WHERE member_id = B) = v - 200, '035 reset fee';
  SELECT * INTO r FROM combat_reset_stats(B, 'reset-0001');
  ASSERT r.replayed AND (SELECT coins FROM wallets WHERE member_id = B) = v - 200, '035 reset replay';
  ASSERT (SELECT stats->>'might' FROM member_progression WHERE member_id = B) = '0' AND (SELECT xp FROM member_progression WHERE member_id = B) = 11625, '035 reset keeps xp';
  -- subclass: level 10, own family only, first free
  INSERT INTO member_identity (member_id, family) VALUES (B, 'Vanguard') ON CONFLICT (member_id) DO UPDATE SET family = 'Vanguard';
  BEGIN PERFORM combat_choose_subclass(B, 'priest', 'Warden', 'sub-0001'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'wrong_family', '035 family: ' || SQLERRM; END;
  SELECT * INTO r FROM combat_choose_subclass(B, 'monk', 'Vanguard', 'sub-0002');
  ASSERT r.fee = 0 AND r.subclass = 'monk', '035 subclass free';
  BEGIN PERFORM combat_choose_subclass(C, 'monk', 'Vanguard', 'sub-0003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'level_too_low', '035 level gate: ' || SQLERRM; END;
  -- missions: one open per mission, complete once, cooldown
  SELECT * INTO r FROM combat_mission_start(B, 'hunt-foxes', 'mis-0001');
  pid := r.progress_id;
  SELECT * INTO r FROM combat_mission_start(B, 'hunt-foxes', 'mis-0002');
  ASSERT r.resumed AND r.progress_id = pid, '035 one open mission';
  BEGIN PERFORM combat_mission_complete(pid, B); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_ready', '035 not ready: ' || SQLERRM; END;
  UPDATE mission_progress SET state = 'ready' WHERE id = pid;
  v := (SELECT coins FROM wallets WHERE member_id = B);
  SELECT * INTO r FROM combat_mission_complete(pid, B);
  ASSERT r.xp_awarded = 300 AND r.coins_awarded = 60 AND NOT r.replayed, '035 complete';
  SELECT * INTO r FROM combat_mission_complete(pid, B);
  ASSERT r.replayed AND (SELECT coins FROM wallets WHERE member_id = B) = v + 60, '035 rewards once';
  BEGIN PERFORM combat_mission_start(B, 'hunt-foxes', 'mis-0003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'cooldown', '035 cooldown: ' || SQLERRM; END;
  -- durability: hits + defeat (10% of max), once per key; repair via wallet
  SELECT * INTO r FROM combat_wear(B, 'sword-driftwood', 5, TRUE, 'wear-0001');
  ASSERT r.durability = 90 - 5 - 9, '035 wear';
  SELECT * INTO r FROM combat_wear(B, 'sword-driftwood', 5, TRUE, 'wear-0001');
  ASSERT r.replayed AND r.durability = 76, '035 wear replay';
  v := (SELECT coins FROM wallets WHERE member_id = B);
  SELECT * INTO r FROM combat_repair(B, 'sword-driftwood', 'rep-0001');
  ASSERT r.cost = 14 AND r.durability = 90 AND (SELECT coins FROM wallets WHERE member_id = B) = v - 14, '035 repair';
  -- club event XP hook
  v := (SELECT xp FROM member_progression WHERE member_id = A);
  INSERT INTO event_attendance (id, event_id, user_id, status) VALUES ('00000000-0000-4000-8000-00000000ea02', '00000000-0000-4000-8000-00000000e001', A, 'attended');
  ASSERT (SELECT xp FROM member_progression WHERE member_id = A) = COALESCE(v, 0) + 2000, '035 event xp';
  RAISE NOTICE '035 ok';
END $$;
