-- Local smoke test for 20261030010700_fishing_tasks_sushi (after every migration, same throwaway cluster). Never run against Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000f7', 'angler@x'), ('00000000-0000-4000-8000-0000000000f8', 'rival@x') ON CONFLICT DO NOTHING;

-- Fishing tasks: done from your own landed catches, claimed once, nothing taken.
DO $$
DECLARE F uuid := '00000000-0000-4000-8000-0000000000f7'; r record; v_day date := toronto_today(); v_week date := date_trunc('week', toronto_today())::date;
BEGIN
  BEGIN PERFORM fishing_task_claim(F, 'day', v_day, 'catch:fish_dace', 'fish_dace', 1, 16, 'task-0001'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_done', 'not caught yet: ' || SQLERRM; END;
  -- yesterday's landing doesn't count for today
  INSERT INTO catch_rolls (member_id, item_key, size_cm, landed_at) VALUES (F, 'fish_dace', 12, (v_day::timestamp AT TIME ZONE 'America/Toronto') - INTERVAL '1 hour');
  BEGIN PERFORM fishing_task_claim(F, 'day', v_day, 'catch:fish_dace', 'fish_dace', 1, 16, 'task-0002'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_done', 'yesterday: ' || SQLERRM; END;
  -- a cast not landed doesn't count; a landed one does
  INSERT INTO catch_rolls (member_id, item_key, size_cm) VALUES (F, 'fish_dace', 13);
  BEGIN PERFORM fishing_task_claim(F, 'day', v_day, 'catch:fish_dace', 'fish_dace', 1, 16, 'task-0003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_done', 'unlanded: ' || SQLERRM; END;
  INSERT INTO catch_rolls (member_id, item_key, size_cm, landed_at) VALUES (F, 'fish_dace', 14, NOW());
  SELECT * INTO r FROM fishing_task_claim(F, 'day', v_day, 'catch:fish_dace', 'fish_dace', 1, 16, 'task-0004');
  ASSERT r.paid = 16 AND NOT r.replayed, 'claim pays';
  ASSERT (SELECT source FROM wallet_ledger WHERE member_id = F AND idempotency_key = 'fish_task:task-0004') = 'quest', 'claim is a quest credit';
  SELECT * INTO r FROM fishing_task_claim(F, 'day', v_day, 'catch:fish_dace', 'fish_dace', 1, 16, 'task-0004');
  ASSERT r.replayed AND (SELECT coins FROM wallets WHERE member_id = F) = 16, 'claim replay pays nothing more';
  BEGIN PERFORM fishing_task_claim(F, 'day', v_day, 'catch:fish_dace', 'fish_dace', 1, 16, 'task-0005'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_claimed', 'claim twice: ' || SQLERRM; END;
  -- only this period: an old day or week is refused
  BEGIN PERFORM fishing_task_claim(F, 'day', v_day - 1, 'catch:fish_dace', 'fish_dace', 1, 16, 'task-0006'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_requested', 'old day: ' || SQLERRM; END;
  -- the week: a fish this week, and the variety of fish (not sea creatures) this week
  BEGIN PERFORM fishing_task_claim(F, 'week', v_week, 'catch:fish_pike', 'fish_pike', 1, 120, 'task-0007'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_done', 'week fish: ' || SQLERRM; END;
  PERFORM collections_record_catch(F, 'fish_pike', 70, true);
  SELECT * INTO r FROM fishing_task_claim(F, 'week', v_week, 'catch:fish_pike', 'fish_pike', 1, 120, 'task-0008');
  ASSERT r.paid = 120, 'week fish claimed';
  PERFORM collections_record_catch(F, 'fish_dace', 12, true);
  PERFORM collections_record_catch(F, 'sea_sea_star', 12, true);
  BEGIN PERFORM fishing_task_claim(F, 'week', v_week, 'variety:3', NULL, 3, 250, 'task-0009'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_done', 'variety 2 of 3: ' || SQLERRM; END;
  PERFORM collections_record_catch(F, 'fish_loach', 15, true);
  SELECT * INTO r FROM fishing_task_claim(F, 'week', v_week, 'variety:3', NULL, 3, 250, 'task-0010');
  ASSERT r.paid = 250, 'variety claimed';
  ASSERT (SELECT count FROM member_collections WHERE user_id = F AND item_key = 'fish_pike') = 1, 'claims take nothing';
  RAISE NOTICE 'fishing tasks ok';
END $$;

-- The chef takes the fish once a day, pays and feeds you.
DO $$
DECLARE F uuid := '00000000-0000-4000-8000-0000000000f7'; r record; v_coins int;
BEGIN
  SELECT coins INTO v_coins FROM wallets WHERE member_id = F;
  BEGIN PERFORM chef_order_fill(F, '2026-10-28', 'fish_koi', 180, 'chef-0001', 0.1, 0.2, '2026-10-28 20:00+00'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'chef none: ' || SQLERRM; END;
  UPDATE member_collections SET locked = TRUE WHERE user_id = F AND item_key = 'fish_pike';
  BEGIN PERFORM chef_order_fill(F, '2026-10-28', 'fish_pike', 180, 'chef-0002', 0.1, 0.2, '2026-10-28 20:00+00'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'locked', 'chef locked: ' || SQLERRM; END;
  UPDATE member_collections SET locked = FALSE WHERE user_id = F AND item_key = 'fish_pike';
  SELECT * INTO r FROM chef_order_fill(F, '2026-10-28', 'fish_pike', 180, 'chef-0003', 0.1, 0.2, '2026-10-28 20:00+00');
  ASSERT r.paid = 180 AND r.remaining = 0 AND NOT r.replayed, 'chef pays';
  ASSERT (SELECT coins FROM wallets WHERE member_id = F) = v_coins + 180, 'chef credited';
  ASSERT (SELECT source FROM member_buffs WHERE member_id = F) = 'staff_meal', 'staff meal buff';
  SELECT * INTO r FROM chef_order_fill(F, '2026-10-28', 'fish_pike', 180, 'chef-0003', 0.1, 0.2, '2026-10-28 20:00+00');
  ASSERT r.replayed, 'chef replay';
  PERFORM collections_record_catch(F, 'fish_pike', 60, false);
  BEGIN PERFORM chef_order_fill(F, '2026-10-28', 'fish_pike', 180, 'chef-0004', 0.1, 0.2, '2026-10-28 20:00+00'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_filled', 'chef twice: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = F AND item_key = 'fish_pike') = 1, 'second fill took nothing';
  RAISE NOTICE 'chef order ok';
END $$;

-- The monthly board: one of a fish you landed this month goes up at your biggest this month; a bigger one replaces it.
DO $$
DECLARE F uuid := '00000000-0000-4000-8000-0000000000f7'; G uuid := '00000000-0000-4000-8000-0000000000f8'; r record;
BEGIN
  BEGIN PERFORM monthly_fish_enter(F, 'fish_koi', 'month-0001'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_this_month', 'none this month: ' || SQLERRM; END;
  -- dace: 12 this week (count 1 after the claims above, plus the task's landing rows don't add stock)
  SELECT * INTO r FROM monthly_fish_enter(F, 'fish_dace', 'month-0002');
  ASSERT r.size_cm = 12 AND NOT r.replayed, 'entered at the month''s biggest';
  ASSERT (SELECT count FROM member_collections WHERE user_id = F AND item_key = 'fish_dace') = 0, 'entering takes the fish';
  SELECT * INTO r FROM monthly_fish_enter(F, 'fish_dace', 'month-0002');
  ASSERT r.replayed, 'entry replay';
  PERFORM collections_record_catch(F, 'fish_dace', 11, true);
  BEGIN PERFORM monthly_fish_enter(F, 'fish_dace', 'month-0003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_bigger', 'not bigger: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = F AND item_key = 'fish_dace') = 1, 'a refused entry takes nothing';
  PERFORM collections_record_catch(G, 'fish_dace', 16, true);
  PERFORM monthly_fish_enter(G, 'fish_dace', 'month-0004');
  ASSERT (SELECT count(*) FROM monthly_fish_entries WHERE item_key = 'fish_dace') = 2, 'two entries';
  RAISE NOTICE 'monthly board ok';
END $$;

-- Members can't call any of it or write their own rows.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f7","role":"authenticated"}';
DO $$ BEGIN
  PERFORM fishing_task_claim('00000000-0000-4000-8000-0000000000f7', 'day', toronto_today(), 'catch:fish_dace', 'fish_dace', 1, 5000, 'task-0099');
  RAISE EXCEPTION 'member called fishing_task_claim';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM chef_order_fill('00000000-0000-4000-8000-0000000000f7', '2026-10-29', 'fish_dace', 5000, 'chef-0099', 0, 0, NOW());
  RAISE EXCEPTION 'member called chef_order_fill';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM monthly_fish_enter('00000000-0000-4000-8000-0000000000f7', 'fish_dace', 'month-0099');
  RAISE EXCEPTION 'member called monthly_fish_enter';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO fishing_task_claims (member_id, period, period_start, task_id, reward) VALUES ('00000000-0000-4000-8000-0000000000f7', 'day', '2026-10-29', 'x', 1);
  RAISE EXCEPTION 'member wrote a claim';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO monthly_fish_entries (month, member_id, item_key, size_cm, idempotency_key) VALUES ('2026-10-01', '00000000-0000-4000-8000-0000000000f7', 'fish_koi', 999, 'month-0098');
  RAISE EXCEPTION 'member wrote an entry';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
ROLLBACK;

-- Sushi: a dish for coins sets the buff once per key; the feast takes one fish and no coins; not enough coins is refused.
DO $$
DECLARE F uuid := '00000000-0000-4000-8000-0000000000f7'; r record; v_coins int;
BEGIN
  SELECT coins INTO v_coins FROM wallets WHERE member_id = F;
  SELECT * INTO r FROM sushi_order(F, 'salmon_nigiri', 40, NULL, 0.1, 0, '2026-10-28 21:00+00', 'sushi-0001');
  ASSERT r.paid = 40 AND NOT r.replayed AND r.source = 'salmon_nigiri', 'order pays';
  ASSERT (SELECT coins FROM wallets WHERE member_id = F) = v_coins - 40, 'order debited';
  SELECT * INTO r FROM sushi_order(F, 'salmon_nigiri', 40, NULL, 0.1, 0, '2026-10-28 21:00+00', 'sushi-0001');
  ASSERT r.replayed AND (SELECT coins FROM wallets WHERE member_id = F) = v_coins - 40, 'order replay';
  ASSERT (SELECT source FROM member_buffs WHERE member_id = F) = 'salmon_nigiri', 'meal replaces the buff';
  BEGIN PERFORM sushi_order(F, 'omakase', 5000, NULL, 0.15, 0.3, '2026-10-28 21:00+00', 'sushi-0002'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient', 'order broke: ' || SQLERRM; END;
  BEGIN PERFORM sushi_order(F, 'feast', 0, 'fish_coelacanth', 0.35, 0.6, '2026-10-28 21:00+00', 'sushi-0003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'feast none: ' || SQLERRM; END;
  PERFORM collections_record_catch(F, 'fish_coelacanth', 120, false);
  SELECT * INTO r FROM sushi_order(F, 'feast', 0, 'fish_coelacanth', 0.35, 0.6, '2026-10-28 21:00+00', 'sushi-0004');
  ASSERT r.paid = 0 AND (SELECT count FROM member_collections WHERE user_id = F AND item_key = 'fish_coelacanth') = 0, 'feast takes the fish';
  ASSERT (SELECT coins FROM wallets WHERE member_id = F) = v_coins - 40, 'feast costs no coins';
  BEGIN PERFORM sushi_order(F, 'feast', 40, 'fish_coelacanth', 0.35, 0.6, '2026-10-28 21:00+00', 'sushi-0005'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'bad_qty', 'coins and a fish: ' || SQLERRM; END;
  RAISE NOTICE 'sushi orders ok';
END $$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f7","role":"authenticated"}';
DO $$ BEGIN
  PERFORM sushi_order('00000000-0000-4000-8000-0000000000f7', 'feast', 0, NULL, 1, 1, '2030-01-01', 'sushi-0006');
  RAISE EXCEPTION 'member called sushi_order';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO member_buffs (member_id, source, luck, size, until) VALUES ('00000000-0000-4000-8000-0000000000f7', 'x', 1, 1, '2030-01-01')
  ON CONFLICT (member_id) DO UPDATE SET luck = 1;
  RAISE EXCEPTION 'member wrote a buff';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
ROLLBACK;
