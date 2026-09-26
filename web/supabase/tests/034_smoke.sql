-- Local smoke test for draft 034_identity (after the 029-033 smokes; same throwaway
-- cluster). Never run against Supabase.
\set ON_ERROR_STOP 1
DO $$
DECLARE r record; A uuid := '00000000-0000-4000-8000-0000000000aa'; B uuid := '00000000-0000-4000-8000-0000000000bb';
  C uuid := '00000000-0000-4000-8000-0000000000cc'; att uuid; ord text[]; i int;
BEGIN
  -- names: unique by key, first set free, then cooldown; T1/T2 reset
  SELECT * INTO r FROM identity_set_name(B, 'Maya Chen', 'mayachen', B, 30);
  ASSERT r.world_name = 'Maya Chen' AND NOT r.replayed, '034 set name';
  SELECT * INTO r FROM identity_set_name(B, 'Maya Chen', 'mayachen', B, 30);
  ASSERT r.replayed, '034 re-save is a no-op';
  BEGIN PERFORM identity_set_name(C, 'maya_chen', 'mayachen', C, 30); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'name_taken', '034 taken: ' || SQLERRM; END;
  BEGIN PERFORM identity_set_name(B, 'Maya C', 'mayac', B, 30); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'too_soon', '034 too soon: ' || SQLERRM; END;
  BEGIN PERFORM identity_set_name(B, 'Islander 1', 'islanderi', C, 30); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'forbidden', '034 member cannot reset: ' || SQLERRM; END;
  SELECT * INTO r FROM identity_set_name(B, 'Islander 1', 'islanderi', A, 30);  -- A is T1 (set in 033 smoke)
  ASSERT r.name_changes = 1, '034 admin reset counts as a change';
  ASSERT (SELECT count(*) FROM identity_name_log WHERE member_id = B) = 2, '034 name log';

  -- member badge from membership (smoke profiles were inserted directly, so set them)
  UPDATE profiles SET membership = 'member' WHERE id IN (A, B);
  UPDATE profiles SET membership = 'public' WHERE id = C;
  ASSERT (SELECT badge FROM member_badges WHERE member_id = B) = 'member', '034 member badge';
  ASSERT (SELECT badge FROM member_badges WHERE member_id = C) IS NULL, '034 public no badge';

  -- oracle: free start, resume, incomplete, complete, cooldown, paid respec
  ord := ARRAY(SELECT format('%s%s', d, lpad(n::text, 2, '0')) FROM unnest(ARRAY['ei','sn','tf','jp']) d, generate_series(1, 16) n);
  SELECT * INTO r FROM oracle_start(C, 'start-0001', ord, 250, 7);
  att := r.attempt_id;
  ASSERT r.fee_paid = 0 AND NOT r.resumed, '034 first reading free';
  SELECT * INTO r FROM oracle_start(C, 'start-0002', ord, 250, 7);
  ASSERT r.attempt_id = att AND r.resumed, '034 resume open reading';
  INSERT INTO oracle_responses (attempt_id, item_id, value) SELECT att, x, 1 FROM unnest(ord[1:63]) x;
  BEGIN PERFORM oracle_complete(att, C, 'INTP', 'Arcane', '{}', '{}'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'incomplete', '034 incomplete: ' || SQLERRM; END;
  INSERT INTO oracle_responses (attempt_id, item_id, value) VALUES (att, ord[64], 2);
  SELECT * INTO r FROM oracle_complete(att, C, 'INTP', 'Arcane', '{}', '{}');
  ASSERT r.family = 'Arcane' AND r.aura_new AND r.previous_family IS NULL, '034 complete';
  SELECT * INTO r FROM oracle_complete(att, C, 'INTP', 'Arcane', '{}', '{}');
  ASSERT r.replayed, '034 complete replay';
  ASSERT (SELECT class FROM profiles WHERE id = C) = 'Arcane', '034 profiles.class for chapter 4';
  BEGIN PERFORM oracle_start(C, 'start-0003', ord, 250, 7); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'cooldown', '034 cooldown: ' || SQLERRM; END;
  UPDATE member_identity SET quiz_taken_at = NOW() - interval '8 days' WHERE member_id = C;
  i := (SELECT coins FROM wallets WHERE member_id = C);
  SELECT * INTO r FROM oracle_start(C, 'start-0004', ord, 250, 7);
  ASSERT r.fee_paid = 250, '034 respec fee';
  ASSERT (SELECT coins FROM wallets WHERE member_id = C) = i - 250, '034 fee through wallet';
  ASSERT (SELECT source FROM wallet_ledger WHERE member_id = C AND idempotency_key = 'respec:start-0004') = 'respec', '034 ledger source';
  att := r.attempt_id;
  INSERT INTO oracle_responses (attempt_id, item_id, value) SELECT att, x, -1 FROM unnest(ord) x;
  SELECT * INTO r FROM oracle_complete(att, C, 'ESFJ', 'Ranger', '{}', '{}');
  ASSERT r.previous_family = 'Arcane' AND r.aura_new, '034 respec result';
  ASSERT (SELECT count(*) FROM family_auras WHERE member_id = C) = 2, '034 auras kept';
  ASSERT (SELECT fee FROM respec_log WHERE attempt_id = att) = 250, '034 respec log';

  -- settings
  INSERT INTO member_settings (member_id, text_size, high_contrast, key_bindings) VALUES (C, 'large', TRUE, '{"openJournal":"b"}');
  BEGIN INSERT INTO member_settings (member_id, text_size) VALUES (B, 'huge'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- profile creation: whitelist / invite → member, otherwise public. 003 (which
  -- creates the trigger) isn't in this chain, so attach 034's function here.
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  INSERT INTO member_email_whitelist (email) VALUES ('member@uwo.ca');
  INSERT INTO invite_codes (code, term, is_active) VALUES ('WELCOME1', 'Fall 2026', TRUE);
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    ('00000000-0000-4000-8000-0000000000d1', 'member@uwo.ca', '{}'),
    ('00000000-0000-4000-8000-0000000000d2', 'friend@gmail.com', '{"invite_code":"welcome1"}'),
    ('00000000-0000-4000-8000-0000000000d3', 'stranger@gmail.com', '{}');
  ASSERT (SELECT membership FROM profiles WHERE id = '00000000-0000-4000-8000-0000000000d1') = 'member', '034 whitelisted member';
  ASSERT (SELECT membership FROM profiles WHERE id = '00000000-0000-4000-8000-0000000000d2') = 'member', '034 invite member';
  ASSERT (SELECT membership FROM profiles WHERE id = '00000000-0000-4000-8000-0000000000d3') = 'public', '034 public account';
  ASSERT (SELECT badge FROM member_badges WHERE member_id = '00000000-0000-4000-8000-0000000000d3') IS NULL, '034 public no badge';
  ASSERT NOT has_column_privilege('authenticated', 'profiles', 'membership', 'UPDATE'), '034 membership not self-editable';
  RAISE NOTICE '034 ok';
END $$;
