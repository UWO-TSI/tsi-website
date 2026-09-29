-- Local smoke test for draft 20260926180000_ownership (after the full game chain,
-- same throwaway cluster, port 5432-style trust auth for dblink). Never run
-- against Supabase.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'owner-a@x'),
  ('00000000-0000-4000-8000-0000000000d2', 'owner-b@x')
ON CONFLICT DO NOTHING;

-- ─── Catalogue ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM shop_items WHERE category = 'hair' AND active) = 6, 'ownership: six dyes on sale';
  ASSERT NOT EXISTS (SELECT 1 FROM shop_items WHERE slug IN ('outfit-club-tee', 'hair-sunset', 'acc-bandana') AND active), 'ownership: partless outfits off sale';
  ASSERT (SELECT NOT active FROM shop_items WHERE slug = 'wear-top-tee'), 'ownership: starter clothes never sold';
  ASSERT (SELECT active FROM shop_items WHERE slug = 'wear-top-cardigan'), 'ownership: other clothes sold';
  ASSERT (SELECT count(*) FROM shop_items WHERE starter_qty > 0) = 23, 'ownership: 9 clothes + 14 furniture starters, got ' || (SELECT count(*) FROM shop_items WHERE starter_qty > 0);
  ASSERT (SELECT starter_qty FROM shop_items WHERE slug = 'furn-floor-lamp') = 1, 'ownership: existing furniture row marked';
  ASSERT NOT has_function_privilege('authenticated', 'public.economy_grant_starters(uuid)', 'EXECUTE'), 'ownership: grant is service-role only';
  RAISE NOTICE 'ownership catalogue ok';
END $$;

-- ─── Starters: once per account, even for two overlapping first calls ───────
-- The first call holds its transaction open while the second starts and blocks
-- on the marker row; then the first commits and the second grants nothing.
CREATE EXTENSION IF NOT EXISTS dblink;
DO $$
DECLARE
  D uuid := '00000000-0000-4000-8000-0000000000d1';
  conn text := format('dbname=%s host=localhost port=%s user=postgres', current_database(), current_setting('port'));
  grant_sql text := format('SELECT granted FROM economy_grant_starters(%L)', D);
  retry_pid int; a boolean; b boolean;
BEGIN
  PERFORM dblink_connect('first', conn);
  PERFORM dblink_connect('retry', conn);
  SELECT pid INTO retry_pid FROM dblink('retry', 'SELECT pg_backend_pid()') AS t(pid int);
  PERFORM dblink_exec('first', 'BEGIN');
  SELECT g INTO a FROM dblink('first', grant_sql) AS t(g boolean);
  PERFORM dblink_send_query('retry', grant_sql);
  FOR i IN 1..100 LOOP
    PERFORM pg_stat_clear_snapshot();
    EXIT WHEN (SELECT wait_event_type FROM pg_stat_activity WHERE pid = retry_pid) = 'Lock';
    PERFORM pg_sleep(0.02);
  END LOOP;
  PERFORM dblink_exec('first', 'COMMIT');
  SELECT g INTO b FROM dblink_get_result('retry') AS t(g boolean);
  PERFORM dblink_disconnect('first');
  PERFORM dblink_disconnect('retry');
  ASSERT a AND NOT b, format('ownership race: first %s, retry %s', a, b);
  ASSERT (SELECT count(*) FROM member_inventory WHERE member_id = D) = 23, 'ownership race: 23 starter rows';
  ASSERT (SELECT bool_and(qty = 1) FROM member_inventory WHERE member_id = D), 'ownership race: each starter once';
  ASSERT NOT (SELECT granted FROM economy_grant_starters(D)), 'ownership: a later call grants nothing';
  RAISE NOTICE 'ownership starters once ok';
END $$;

-- A bought copy adds to the starter one; the grant never tops it up again.
DO $$
DECLARE D uuid := '00000000-0000-4000-8000-0000000000d1'; lamp uuid; r record;
BEGIN
  PERFORM wallet_apply(D, 'coins', 500, 'admin', 'smoke', 'ownership:fund');
  SELECT id INTO lamp FROM shop_items WHERE slug = 'furn-floor-lamp';
  SELECT * INTO r FROM economy_buy(D, lamp, 1, 110, 'own-lamp-1');
  ASSERT r.owned = 2, 'ownership: bought lamp stacks on the starter';
  PERFORM economy_grant_starters(D);
  ASSERT (SELECT qty FROM member_inventory WHERE member_id = D AND item_id = lamp) = 2, 'ownership: no top-up';
  BEGIN PERFORM economy_buy(D, (SELECT id FROM shop_items WHERE slug = 'wear-top-tee'), 1, 150, 'own-tee-1'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_for_sale', 'ownership: starter tee not buyable: ' || SQLERRM; END;
  RAISE NOTICE 'ownership buy after grant ok';
END $$;

-- ─── avatar_config is server-only ───────────────────────────────────────────
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}';
DO $$ BEGIN
  UPDATE profiles SET avatar_config = '{"look":{"top":"top_tsi_crew","hair":11}}' WHERE id = auth.uid();
  RAISE EXCEPTION 'FAIL: member wrote avatar_config directly';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: member cannot write avatar_config (%)', SQLERRM;
END $$;
DO $$ BEGIN
  UPDATE profiles SET display_name = 'Still editable' WHERE id = auth.uid();
  ASSERT FOUND, 'ownership: display_name still editable';
END $$;
COMMIT;
UPDATE profiles SET avatar_config = '{"look":{"top":"top_tee"}}' WHERE id = '00000000-0000-4000-8000-0000000000d2';
DO $$ BEGIN
  ASSERT (SELECT avatar_config -> 'look' ->> 'top' FROM profiles WHERE id = '00000000-0000-4000-8000-0000000000d2') = 'top_tee', 'ownership: server writes the look';
  RAISE NOTICE 'ownership avatar_config server-only ok';
END $$;
\echo 'ownership smoke ok'
