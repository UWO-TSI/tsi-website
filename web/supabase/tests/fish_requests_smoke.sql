-- Local smoke test for 20261027181000_fish_requests (after every migration, same throwaway cluster). Never run against Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000f7', 'angler@x') ON CONFLICT DO NOTHING;
DO $$
DECLARE F uuid := '00000000-0000-4000-8000-0000000000f7'; r record;
BEGIN
  PERFORM collections_record_catch(F, 'fish_dace', 12, false) FROM generate_series(1, 2);
  -- once: takes one fish and pays the reward as a quest credit
  SELECT * INTO r FROM fish_request_fill(F, '2026-10-27', 'fish_dace', 24, 'req-0001');
  ASSERT r.paid = 24 AND r.remaining = 1 AND NOT r.replayed, 'fill pays';
  ASSERT (SELECT coins FROM wallets WHERE member_id = F) = 24, 'fill credited';
  ASSERT (SELECT source FROM wallet_ledger WHERE member_id = F AND idempotency_key = 'fish_request:req-0001') = 'quest', 'fill is a quest credit';
  -- the same key replays; another key for the same request that day is refused, and takes nothing
  SELECT * INTO r FROM fish_request_fill(F, '2026-10-27', 'fish_dace', 24, 'req-0001');
  ASSERT r.replayed AND r.remaining = 1, 'fill replay';
  BEGIN PERFORM fish_request_fill(F, '2026-10-27', 'fish_dace', 24, 'req-0002'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'already_filled', 'fill twice: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = F AND item_key = 'fish_dace') = 1, 'second fill took nothing';
  -- the next day is a new request; a locked fish and a missing fish are refused
  UPDATE member_collections SET locked = TRUE WHERE user_id = F AND item_key = 'fish_dace';
  BEGIN PERFORM fish_request_fill(F, '2026-10-28', 'fish_dace', 24, 'req-0003'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'locked', 'fill locked: ' || SQLERRM; END;
  UPDATE member_collections SET locked = FALSE WHERE user_id = F AND item_key = 'fish_dace';
  PERFORM fish_request_fill(F, '2026-10-28', 'fish_dace', 24, 'req-0004');
  BEGIN PERFORM fish_request_fill(F, '2026-10-28', 'fish_koi', 60, 'req-0005'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'fill none: ' || SQLERRM; END;
  ASSERT (SELECT count(*) FROM fish_request_fills WHERE member_id = F) = 2, 'two fills recorded';
  RAISE NOTICE 'fish requests ok';
END $$;

-- Members can't call it or write their own fills.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f7","role":"authenticated"}';
DO $$ BEGIN
  PERFORM fish_request_fill('00000000-0000-4000-8000-0000000000f7', '2026-10-29', 'fish_dace', 5000, 'req-0006');
  RAISE EXCEPTION 'member called fish_request_fill';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO fish_request_fills (member_id, day, item_key, reward) VALUES ('00000000-0000-4000-8000-0000000000f7', '2026-10-29', 'fish_dace', 1);
  RAISE EXCEPTION 'member wrote a fill';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
ROLLBACK;
