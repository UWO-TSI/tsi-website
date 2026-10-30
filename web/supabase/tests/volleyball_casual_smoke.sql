-- Beach volleyball casual wins (20261030010400_volleyball_casual). Throwaway local Postgres after every migration,
-- with the pre_* seeds. Never Supabase. Fails before the migration: no volleyball_casual_start.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000007b1', 'vb-1@x'), ('00000000-0000-4000-8000-0000000007b2', 'vb-2@x')
ON CONFLICT DO NOTHING;
DO $$
DECLARE
  M uuid := '00000000-0000-4000-8000-0000000007b1';
  O uuid := '00000000-0000-4000-8000-0000000007b2';
  T uuid; T2 uuid; r record; bal0 integer; i integer;
  -- A ticket opened `secs` ago.
BEGIN
  bal0 := COALESCE((SELECT coins FROM wallets WHERE member_id = M), 0);

  -- The happy path: a legal win after a plausible time pays once, through the wallet.
  SELECT ticket INTO T FROM volleyball_casual_start(M);
  UPDATE volleyball_casual_tickets SET started_at = NOW() - INTERVAL '10 minutes' WHERE id = T;
  SELECT * INTO r FROM volleyball_casual_finish(M, T, 21, 15);
  ASSERT r.status = 'won' AND r.paid = 15 AND NOT r.replayed, 'a win pays 15: ' || r.status;
  ASSERT (SELECT coins FROM wallets WHERE member_id = M) = bal0 + 15, 'the wallet has it';
  ASSERT (SELECT COUNT(*) FROM wallet_ledger WHERE member_id = M AND source = 'volleyball' AND idempotency_key = 'volleyball:casual:' || T) = 1, 'one ledger row';

  -- A replayed finish pays nothing new (and can't change the result).
  SELECT * INTO r FROM volleyball_casual_finish(M, T, 21, 3);
  ASSERT r.status = 'won' AND r.paid = 15 AND r.replayed, 'a replay returns the first outcome';
  ASSERT (SELECT coins FROM wallets WHERE member_id = M) = bal0 + 15, 'a replay pays nothing';

  -- Too fast: 36 points can't be played in 30 s; the ticket closes for good.
  SELECT ticket INTO T FROM volleyball_casual_start(M);
  UPDATE volleyball_casual_tickets SET started_at = NOW() - INTERVAL '30 seconds' WHERE id = T;
  ASSERT (SELECT status FROM volleyball_casual_finish(M, T, 21, 15)) = 'too_fast', 'too fast is refused';
  UPDATE volleyball_casual_tickets SET started_at = NOW() - INTERVAL '10 minutes' WHERE id = T;
  ASSERT (SELECT paid FROM volleyball_casual_finish(M, T, 21, 15)) = 0, 'a refused ticket stays refused';

  -- Illegal scores: not finished, not won by 2, over 21 by more than 2, negative.
  FOREACH i IN ARRAY ARRAY[1, 2, 3, 4] LOOP
    SELECT ticket INTO T FROM volleyball_casual_start(M);
    UPDATE volleyball_casual_tickets SET started_at = NOW() - INTERVAL '30 minutes' WHERE id = T;
    SELECT * INTO r FROM volleyball_casual_finish(M, T, (ARRAY[20, 21, 25, 21])[i], (ARRAY[5, 20, 10, -1])[i]);
    ASSERT r.status = 'bad_score' AND r.paid = 0, 'illegal score ' || i || ' refused: ' || r.status;
  END LOOP;

  -- A loss records, pays nothing; deuce wins (23-21) are legal.
  SELECT ticket INTO T FROM volleyball_casual_start(M);
  UPDATE volleyball_casual_tickets SET started_at = NOW() - INTERVAL '10 minutes' WHERE id = T;
  ASSERT (SELECT status FROM volleyball_casual_finish(M, T, 12, 21)) = 'lost', 'a loss';

  -- Another player's ticket: not found, nothing paid.
  SELECT ticket INTO T2 FROM volleyball_casual_start(O);
  UPDATE volleyball_casual_tickets SET started_at = NOW() - INTERVAL '10 minutes' WHERE id = T2;
  BEGIN PERFORM volleyball_casual_finish(M, T2, 21, 0); RAISE EXCEPTION 'took another player''s ticket';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_found', SQLERRM; END;
  ASSERT (SELECT status FROM volleyball_casual_tickets WHERE id = T2) = 'open', 'still theirs, still open';

  -- A new match abandons the open one.
  SELECT ticket INTO T FROM volleyball_casual_start(O);
  ASSERT (SELECT status FROM volleyball_casual_tickets WHERE id = T2) = 'abandoned', 'one open ticket at a time';

  -- The cap: 5 paid wins a day (one above), then capped wins pay nothing.
  FOR i IN 1..5 LOOP
    SELECT ticket INTO T FROM volleyball_casual_start(M);
    UPDATE volleyball_casual_tickets SET started_at = NOW() - INTERVAL '10 minutes' WHERE id = T;
    SELECT * INTO r FROM volleyball_casual_finish(M, T, 23, 21);
    ASSERT r.status = CASE WHEN i <= 4 THEN 'won' ELSE 'capped' END, 'win ' || i || ': ' || r.status;
  END LOOP;
  ASSERT (SELECT coins FROM wallets WHERE member_id = M) = bal0 + 15 * 5, 'five paid wins, no more';

  -- Expired: a ticket older than 2 hours.
  SELECT ticket INTO T FROM volleyball_casual_start(M);
  UPDATE volleyball_casual_tickets SET started_at = NOW() - INTERVAL '3 hours' WHERE id = T;
  ASSERT (SELECT status FROM volleyball_casual_finish(M, T, 21, 0)) = 'expired', 'expired';
  RAISE NOTICE 'volleyball casual smoke: payouts ok';
END $$;

-- Members can't call either function or write the table; they read only their own tickets.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000007b1","role":"authenticated"}', false);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM volleyball_casual_start('00000000-0000-4000-8000-0000000007b1'); RAISE EXCEPTION 'authenticated started a ticket';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM volleyball_casual_finish('00000000-0000-4000-8000-0000000007b1', gen_random_uuid(), 21, 0); RAISE EXCEPTION 'authenticated claimed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO volleyball_casual_tickets (member_id, seed, status) VALUES ('00000000-0000-4000-8000-0000000007b1', 1, 'open'); RAISE EXCEPTION 'authenticated wrote a ticket';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE volleyball_casual_tickets SET paid = 999; RAISE EXCEPTION 'authenticated edited a ticket';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ASSERT (SELECT COUNT(*) FROM volleyball_casual_tickets) > 0, 'reads its own tickets';
  ASSERT (SELECT COUNT(*) FROM volleyball_casual_tickets WHERE member_id <> '00000000-0000-4000-8000-0000000007b1') = 0, 'and only its own';
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM volleyball_casual_start('00000000-0000-4000-8000-0000000007b1'); RAISE EXCEPTION 'anon started a ticket';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM volleyball_casual_finish('00000000-0000-4000-8000-0000000007b1', gen_random_uuid(), 21, 0); RAISE EXCEPTION 'anon claimed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'volleyball casual smoke ok';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '', false);
