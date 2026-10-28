-- Resident friendship (20261027190100_resident_friendship, d-friends), in half hearts (level 0 to 10). Throwaway local
-- Postgres after every migration through it (supabase_stub.sql first). Never Supabase. Fails before it: no
-- resident_friend_gift. Self-contained, rolled back: a new day is made by moving last_day or last_gift_day back a day.
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000077d01', 'friend-1@x') ON CONFLICT DO NOTHING;
INSERT INTO member_collections (user_id, item_key, count) VALUES ('00000000-0000-4000-8000-000000077d01', 'smoke_peach', 10), ('00000000-0000-4000-8000-000000077d01', 'smoke_kept', 2);
UPDATE member_collections SET locked = TRUE WHERE item_key = 'smoke_kept';
DO $$
DECLARE r record; M uuid := '00000000-0000-4000-8000-000000077d01'; refused text;
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM wallets WHERE member_id = M AND coins <> 0), 'a fresh member (77d01 is used by no other smoke)';
  -- Talk: half a heart, once a day.
  SELECT * INTO r FROM resident_friend_talk(M, 'curator');
  ASSERT r.was = 0 AND r.level = 1 AND r.coins = 0, 'first talk: half a heart';
  SELECT * INTO r FROM resident_friend_talk(M, 'curator');
  ASSERT r.was = 1 AND r.level = 1, 'talk once a day';
  -- A loved gift: a whole heart, the item leaves the bag; then one gift a day.
  SELECT * INTO r FROM resident_friend_gift(M, 'curator', 'smoke_peach', 2);
  ASSERT r.was = 1 AND r.level = 3 AND r.coins = 0, 'loved: +1 heart (1 to 3 halves, heart 1 is a letter)';
  ASSERT (SELECT count FROM member_collections WHERE user_id = M AND item_key = 'smoke_peach') = 9, 'the gift leaves the bag';
  BEGIN PERFORM resident_friend_gift(M, 'curator', 'smoke_peach', 2); EXCEPTION WHEN OTHERS THEN refused := SQLERRM; END;
  ASSERT refused = 'gift_done', 'one gift a day per resident';
  ASSERT (SELECT count FROM member_collections WHERE user_id = M AND item_key = 'smoke_peach') = 9, 'a refused gift keeps the item';
  -- A liked gift the next day reaches heart 2: its coins (friend_gift_coins x 2 / 2).
  UPDATE resident_friendships SET last_gift_day = last_gift_day - 1 WHERE member_id = M;
  SELECT * INTO r FROM resident_friend_gift(M, 'curator', 'smoke_peach', 1);
  ASSERT r.level = 4 AND r.coins = 50, 'liked: +1/2, heart 2 pays';
  ASSERT EXISTS (SELECT 1 FROM wallet_ledger WHERE member_id = M AND source = 'friend' AND idempotency_key = 'friend:curator:2'), 'its ledger row';
  -- A hated gift: -1 heart; winning it back pays nothing twice.
  UPDATE resident_friendships SET last_gift_day = last_gift_day - 1 WHERE member_id = M;
  SELECT * INTO r FROM resident_friend_gift(M, 'curator', 'smoke_peach', -2);
  ASSERT r.was = 4 AND r.level = 2 AND r.coins = 0, 'hated: -1 heart';
  UPDATE resident_friendships SET last_gift_day = last_gift_day - 1 WHERE member_id = M;
  SELECT * INTO r FROM resident_friend_gift(M, 'curator', 'smoke_peach', 2);
  ASSERT r.level = 4 AND r.coins = 0 AND (SELECT coins FROM wallets WHERE member_id = M) = 50, 'heart 2 again pays nothing';
  -- Neither: 0. Never below none, never above five hearts.
  UPDATE resident_friendships SET last_gift_day = last_gift_day - 1 WHERE member_id = M;
  SELECT * INTO r FROM resident_friend_gift(M, 'curator', 'smoke_peach', 0);
  ASSERT r.level = 4, 'neither: no change';
  SELECT * INTO r FROM resident_friend_gift(M, 'mayor', 'smoke_peach', -2);
  ASSERT r.level = 0, 'never below none (each resident on their own)';
  UPDATE resident_friendships SET level = 9, last_gift_day = last_gift_day - 1 WHERE member_id = M AND resident = 'curator';
  SELECT * INTO r FROM resident_friend_gift(M, 'curator', 'smoke_peach', 2);
  ASSERT r.level = 10 AND r.coins = 0, 'capped at five hearts (heart 5 is a letter, no coins)';
  -- Refusals: a locked item, none left, a made-up delta, a resident who isn't one.
  refused := NULL;
  BEGIN PERFORM resident_friend_gift(M, 'wren', 'smoke_kept', 2); EXCEPTION WHEN OTHERS THEN refused := SQLERRM; END;
  ASSERT refused = 'none_left', 'a locked item stays';
  refused := NULL;
  BEGIN PERFORM resident_friend_gift(M, 'nell', 'smoke_nothing', 2); EXCEPTION WHEN OTHERS THEN refused := SQLERRM; END;
  ASSERT refused = 'none_left', 'nothing to give';
  refused := NULL;
  BEGIN PERFORM resident_friend_gift(M, 'marlo', 'smoke_peach', 6); EXCEPTION WHEN OTHERS THEN refused := SQLERRM; END;
  ASSERT refused = 'bad_delta', 'only the four tastes';
  refused := NULL;
  BEGIN PERFORM resident_friend_talk(M, 'nobody-here'); EXCEPTION WHEN OTHERS THEN refused := SQLERRM; END;
  ASSERT refused = 'not_found', 'only real residents';
  PERFORM wallet_apply(M, 'coins', 25, 'campfire', 'smoke-day', 'campfire:smoke-day');
  ASSERT EXISTS (SELECT 1 FROM wallet_ledger WHERE member_id = M AND source = 'campfire'), 'campfire hour is a ledger source';
  RAISE NOTICE 'resident friendship ok';
END $$;
ROLLBACK;
