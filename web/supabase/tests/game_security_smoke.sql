-- Exploit tests for the game-side security migrations (20260926150900 onward).
-- Runs last, after the 029-035 smokes on the same throwaway cluster. Never Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000f2', 'f2@x');

-- ─── 1. Collections stock is server-granted only ─────────────────────────────
-- A member tries to mint 999 fish with the public key, then sell 200 (the per-call max).
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}';
DO $$ BEGIN
  INSERT INTO member_collections (user_id, item_key, count) VALUES ('00000000-0000-4000-8000-0000000000f2', 'fish_golden_koi', 999);
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM economy_sell('00000000-0000-4000-8000-0000000000f2', 'fish_golden_koi', 200, 'exploit-0001');
  RAISE EXCEPTION 'member-minted stock was sold';
EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'security insert-and-sell: ' || SQLERRM;
END $$;
ROLLBACK;

-- One real catch, then the member raises its count to 999 and tries to sell 200.
SELECT collections_record_catch('00000000-0000-4000-8000-0000000000f2', 'fish_dace', 12, false);
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}';
DO $$ BEGIN
  UPDATE member_collections SET count = 999 WHERE user_id = '00000000-0000-4000-8000-0000000000f2';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM economy_sell('00000000-0000-4000-8000-0000000000f2', 'fish_dace', 200, 'exploit-0002');
  RAISE EXCEPTION 'member-raised stock was sold';
EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'insufficient_items', 'security update-and-sell: ' || SQLERRM;
END $$;
ROLLBACK;

-- Catches are capped per species per hour (legendary: 3).
DO $$
DECLARE F uuid := '00000000-0000-4000-8000-0000000000f2';
BEGIN
  PERFORM collections_record_catch(F, 'fish_stringfish', NULL, false) FROM generate_series(1, 3);
  BEGIN PERFORM collections_record_catch(F, 'fish_stringfish', NULL, false); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'rate_limited', 'security catch cap: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = F AND item_key = 'fish_stringfish') = 3, 'security capped count';
  PERFORM collections_record_catch(F, 'fish_dace', NULL, false);  -- other species unaffected
  RAISE NOTICE 'security 1 collections ok';
END $$;
