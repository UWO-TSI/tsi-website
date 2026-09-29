-- Local smoke test for draft 20260926150500_study (run after 029-031_smoke.sql on the
-- same throwaway cluster, so profiles A/B exist). Never run against Supabase.
\set ON_ERROR_STOP 1
DO $$
DECLARE r record; A uuid := '00000000-0000-4000-8000-0000000000aa'; B uuid := '00000000-0000-4000-8000-0000000000bb';
  t uuid := '00000000-0000-4000-8000-000000005103'; sid uuid; before int;
BEGIN
  ASSERT (SELECT count(*) FROM study_tables) = 9, '032 tables seeded';
  INSERT INTO study_sessions (id, member_id, table_id, seat) VALUES ('00000000-0000-4000-8000-00000000f001', A, t, 1);
  BEGIN INSERT INTO study_sessions (member_id, table_id, seat) VALUES (B, t, 1); RAISE EXCEPTION 'x';
  EXCEPTION WHEN unique_violation THEN NULL; END;  -- seat taken
  BEGIN INSERT INTO study_sessions (member_id, table_id, seat) VALUES (A, t, 2); RAISE EXCEPTION 'x';
  EXCEPTION WHEN unique_violation THEN NULL; END;  -- one active session per member
  -- a finished 25/5x1 session: 25 minutes + 10 bonus
  sid := '00000000-0000-4000-8000-00000000f001';
  UPDATE study_sessions SET focus_len = 25, break_len = 5, cycles = 1, phase = 'ended', started_at = NOW() - interval '26 minutes',
    ended_at = NOW() - interval '1 minute', end_reason = 'finished', minutes_completed = 25, blocks_completed = 1, bonus_earned = 10, longest_block = 25
   WHERE id = sid;
  before := (SELECT coins FROM wallets WHERE member_id = A);
  SELECT * INTO r FROM study_settle(sid, A);
  ASSERT r.coins = 35 AND NOT r.replayed, '032 settle';
  SELECT * INTO r FROM study_settle(sid, A);
  ASSERT r.coins = 35 AND r.replayed, '032 settle replay';
  ASSERT (SELECT coins FROM wallets WHERE member_id = A) = before + 35, '032 paid once';
  ASSERT (SELECT count(*) FROM wallet_ledger WHERE member_id = A AND source = 'study') = 1, '032 one ledger row';
  -- seat is free again once the session ended
  INSERT INTO study_sessions (id, member_id, table_id, seat, started_at) VALUES ('00000000-0000-4000-8000-00000000f002', B, t, 1, NOW() - interval '5 minutes');
  UPDATE study_sessions SET focus_len = 25, break_len = 5, cycles = 1, phase = 'ended', ended_at = NOW(), end_reason = 'left', minutes_completed = 60
   WHERE id = '00000000-0000-4000-8000-00000000f002';
  BEGIN PERFORM study_settle('00000000-0000-4000-8000-00000000f002', B); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'implausible', '032 implausible: ' || SQLERRM; END;
  ASSERT (SELECT minutes FROM study_weekly_stats WHERE member_id = A) = 25, '032 weekly view';
  RAISE NOTICE '032 ok';
END $$;
