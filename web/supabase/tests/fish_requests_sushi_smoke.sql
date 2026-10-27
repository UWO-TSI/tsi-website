-- Local smoke test for 20261027181000_fish_requests_sushi (after every migration, same throwaway cluster). Never run against Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000f7', 'angler@x') ON CONFLICT DO NOTHING;
DO $$
DECLARE F uuid := '00000000-0000-4000-8000-0000000000f7'; r record;
BEGIN
  PERFORM collections_record_catch(F, 'fish_dace', 12, false) FROM generate_series(1, 2);
  -- once: takes one fish and pays the reward as a quest credit
  SELECT * INTO r FROM fish_request_fill(F, '2026-10-27', 'market', 'fish_dace', 24, 'req-0001');
  ASSERT r.paid = 24 AND r.remaining = 1 AND NOT r.replayed, 'fill pays';
  ASSERT (SELECT coins FROM wallets WHERE member_id = F) = 24, 'fill credited';
  ASSERT (SELECT source FROM wallet_ledger WHERE member_id = F AND idempotency_key = 'fish_request:req-0001') = 'quest', 'fill is a quest credit';
  -- the same key replays; another key for the same request that day is refused, and takes nothing
  SELECT * INTO r FROM fish_request_fill(F, '2026-10-27', 'market', 'fish_dace', 24, 'req-0001');
  ASSERT r.replayed AND r.remaining = 1, 'fill replay';
  BEGIN PERFORM fish_request_fill(F, '2026-10-27', 'market', 'fish_dace', 24, 'req-0002'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_filled', 'fill twice: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = F AND item_key = 'fish_dace') = 1, 'second fill took nothing';
  -- the next day is a new request; a locked fish and a missing fish are refused
  UPDATE member_collections SET locked = TRUE WHERE user_id = F AND item_key = 'fish_dace';
  BEGIN PERFORM fish_request_fill(F, '2026-10-28', 'market', 'fish_dace', 24, 'req-0003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'locked', 'fill locked: ' || SQLERRM; END;
  UPDATE member_collections SET locked = FALSE WHERE user_id = F AND item_key = 'fish_dace';
  PERFORM fish_request_fill(F, '2026-10-28', 'market', 'fish_dace', 24, 'req-0004');
  BEGIN PERFORM fish_request_fill(F, '2026-10-28', 'market', 'fish_koi', 60, 'req-0005'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'fill none: ' || SQLERRM; END;
  ASSERT (SELECT count(*) FROM fish_request_fills WHERE member_id = F) = 2, 'two fills recorded';
  -- the chef's order is its own board, and its staff meal sets the buff
  PERFORM collections_record_catch(F, 'fish_dace', 12, false);
  PERFORM fish_request_fill(F, '2026-10-28', 'chef', 'fish_dace', 180, 'req-0006', 0.1, 0.2, '2026-10-28 20:00+00');
  ASSERT (SELECT source FROM member_buffs WHERE member_id = F) = 'staff_meal', 'staff meal buff';
  RAISE NOTICE 'fish requests ok';
END $$;

-- Members can't call it or write their own fills.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f7","role":"authenticated"}';
DO $$ BEGIN
  PERFORM fish_request_fill('00000000-0000-4000-8000-0000000000f7', '2026-10-29', 'market', 'fish_dace', 5000, 'req-0006');
  RAISE EXCEPTION 'member called fish_request_fill';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO fish_request_fills (member_id, day, item_key, reward) VALUES ('00000000-0000-4000-8000-0000000000f7', '2026-10-29', 'fish_dace', 1);
  RAISE EXCEPTION 'member wrote a fill';
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
