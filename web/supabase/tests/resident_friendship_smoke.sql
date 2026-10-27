-- Resident friendship (20261027190100_resident_friendship, d-friends). Throwaway local Postgres after every migration
-- through it (supabase_stub.sql first). Never Supabase. Fails before it: no resident_friend_talk. Self-contained,
-- rolled back: a new day is made by moving last_day back a day.
\set ON_ERROR_STOP 1
BEGIN;
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000077d01', 'friend-1@x') ON CONFLICT DO NOTHING;
DO $$
DECLARE r record; M uuid := '00000000-0000-4000-8000-000000077d01'; refused boolean := false;
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM wallets WHERE member_id = M AND coins <> 0), 'a fresh member (77d01 is used by no other smoke)';
  SELECT * INTO r FROM resident_friend_talk(M, 'curator');
  ASSERT r.level = 1 AND r.leveled AND r.coins = 0, 'first talk: level 1, a letter level';
  SELECT * INTO r FROM resident_friend_talk(M, 'curator');
  ASSERT r.level = 1 AND NOT r.leveled, 'once a day';
  UPDATE resident_friendships SET last_day = last_day - 1 WHERE member_id = M;
  SELECT * INTO r FROM resident_friend_talk(M, 'curator');
  ASSERT r.level = 2 AND r.leveled AND r.coins = 50, 'level 2: a gift';
  ASSERT (SELECT coins FROM wallets WHERE member_id = M) = 50, 'the gift is paid';
  ASSERT EXISTS (SELECT 1 FROM wallet_ledger WHERE member_id = M AND source = 'friend' AND idempotency_key = 'friend:curator:2'), 'its ledger row';
  FOR i IN 3..6 LOOP
    UPDATE resident_friendships SET last_day = last_day - 1 WHERE member_id = M;
    SELECT * INTO r FROM resident_friend_talk(M, 'curator');
  END LOOP;
  ASSERT r.level = 5 AND NOT r.leveled, 'it stops at 5';
  ASSERT (SELECT coins FROM wallets WHERE member_id = M) = 50 + 100, 'gifts at 2 and 4';
  SELECT * INTO r FROM resident_friend_talk(M, 'mayor');
  ASSERT r.level = 1, 'each resident on their own';
  BEGIN PERFORM resident_friend_talk(M, 'nobody-here'); EXCEPTION WHEN OTHERS THEN refused := SQLERRM = 'not_found'; END;
  ASSERT refused, 'only real residents';
  PERFORM wallet_apply(M, 'coins', 25, 'campfire', 'smoke-day', 'campfire:smoke-day');
  ASSERT EXISTS (SELECT 1 FROM wallet_ledger WHERE member_id = M AND source = 'campfire'), 'campfire hour is a ledger source';
  RAISE NOTICE 'resident friendship ok';
END $$;
ROLLBACK;
