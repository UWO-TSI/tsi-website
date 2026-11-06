-- Made-up players in the game's own tables, for the analytics evidence (an1-backfill-*). Never real data: invented
-- world names, example.invalid emails. The throwaway smoke Postgres only (sql-smoke.sh), never Supabase.
-- 90 players join over ten weeks. Those who joined before the log (three weeks ago) leave only what the tables keep:
-- the arrival's pay, a first fish, a first sale, a chapter, the daily gift each day they came. The rest also have the
-- event log: sessions, the opening's and the walk's beats, the screens, the features.
SELECT setseed(0.42);
DO $$
DECLARE
  names text[] := ARRAY['Pebble','Moss','Juniper','Kelp','Linden','Clover','Pip','Sorrel','Bramble','Fern','Tansy','Quill','Nettle','Rook','Sable','Thistle','Briar','Cobble','Dune','Ember'];
  walk text[] := ARRAY['arrival_aboard','arrival_creator','creator','arrival_crossing','arrival_landing','tut_docknew','tut_dash','tut_hqfirst',
    'hq_report','hq_lore','hq_id','hq_coins','hq_gems','hq_events','hq_tour','hq_esc','hq_done','tut_sights','tut_wharf','tut_cast','tut_barrel','tut_keep','arrived'];
  screens text[] := ARRAY['village','village','village','hq','museum','shop','bag','sell','journal','cafe','home'];
  feats text[] := ARRAY['fishing','fishing','selling','daily_gift','museum','crafting','shop','residents','volleyball','study'];
  log_start timestamptz := NOW() - INTERVAL '21 days';
  fish text := (SELECT key FROM collection_species WHERE category = 'fish' ORDER BY key LIMIT 1);
  ch uuid := (SELECT id FROM quest_chapters ORDER BY position LIMIT 1);
  m uuid; joined timestamptz; t timestamptz; d timestamptz; s uuid; st text; last_screen text;
  i int; k int; v int; beats int; visits int; reached int; logged boolean; arrived boolean; bal int := 0;
BEGIN
  FOR i IN 1..90 LOOP
    m := ('00000000-0000-4000-8000-' || lpad(to_hex(40960 + i), 12, '0'))::uuid;
    joined := NOW() - (random() ^ 1.2) * 70 * INTERVAL '1 day';
    logged := joined >= log_start;
    INSERT INTO auth.users (id, email) VALUES (m, 'bf' || i || '@example.invalid');
    UPDATE profiles SET membership = 'member', created_at = joined WHERE id = m;
    t := joined + INTERVAL '20 seconds';
    s := gen_random_uuid();
    IF logged THEN
      INSERT INTO game_events (member_id, session_id, kind, screen, at) VALUES (m, s, 'session_start', 'opening', t);
    END IF;
    -- The walk: each beat a little less likely; the creator and the HQ's key tour lose the most.
    reached := 0;
    FOR k IN 1..array_length(walk, 1) LOOP
      st := walk[k];
      EXIT WHEN random() > CASE st WHEN 'creator' THEN 0.86 WHEN 'hq_tour' THEN 0.8 WHEN 'tut_cast' THEN 0.9 ELSE 0.975 END;
      t := t + (CASE WHEN st LIKE 'hq_%' THEN 25 ELSE 60 END) * (0.5 + random() * 1.5) * INTERVAL '1 second';
      reached := k;
      IF logged THEN
        INSERT INTO game_events (member_id, session_id, kind, step, screen, at)
        VALUES (m, s, 'step', st, CASE WHEN st LIKE 'hq_%' THEN 'hq' WHEN st LIKE 'arrival_%' OR st = 'creator' THEN 'opening' ELSE 'village' END, t);
      END IF;
      IF st = 'creator' THEN
        UPDATE profiles SET avatar_config = '{"look": {}}' WHERE id = m;
        INSERT INTO member_identity (member_id, world_name, world_name_key, name_set_at)
        VALUES (m, names[1 + (i - 1) % 20] || CASE WHEN i > 20 THEN ' ' || ((i - 1) / 20 + 1) ELSE '' END, 'bf-' || i, t);
      ELSIF st = 'tut_cast' THEN
        INSERT INTO member_collections (user_id, item_key, count, first_collected_at) VALUES (m, fish, 1, t + INTERVAL '1 minute');
      ELSIF st = 'tut_barrel' THEN
        INSERT INTO wallet_ledger (member_id, amount, balance_after, source, ref, idempotency_key, created_at)
        VALUES (m, 10, 10, 'sell', fish, 'sell:bf-' || i, t);
      ELSIF st = 'arrived' THEN
        INSERT INTO wallet_ledger (member_id, amount, balance_after, source, ref, idempotency_key, created_at)
        VALUES (m, 5, 15, 'quest', 'arrival', 'arrival:v2', t);
      END IF;
    END LOOP;
    arrived := reached = array_length(walk, 1);
    last_screen := CASE WHEN reached < 5 THEN 'opening' WHEN reached < 17 AND reached >= 9 THEN 'hq' ELSE 'village' END;
    IF logged THEN
      INSERT INTO game_events (member_id, session_id, kind, screen, at) VALUES (m, s, 'session_end', last_screen, t + INTERVAL '1 minute');
    END IF;
    INSERT INTO daily_login_claims (member_id, day, coins, claimed_at) VALUES (m, joined::date, 5, joined + INTERVAL '30 seconds');
    -- Coming back: more often the further they got.
    visits := CASE WHEN arrived THEN floor(random() * 12)::int ELSE floor(random() * 1.4)::int END;
    d := joined;
    FOR v IN 1..visits LOOP
      d := d + (0.6 + random() ^ 2 * 7) * INTERVAL '1 day';
      EXIT WHEN d > NOW();
      INSERT INTO daily_login_claims (member_id, day, coins, claimed_at) VALUES (m, d::date, 5, d) ON CONFLICT DO NOTHING;
      IF arrived AND v = 2 AND random() < 0.7 THEN
        INSERT INTO member_quest_progress (member_id, chapter_id, status, started_at, completed_at) VALUES (m, ch, 'completed', joined, d)
        ON CONFLICT DO NOTHING;
      END IF;
      IF arrived AND random() < 0.6 THEN
        INSERT INTO wallet_ledger (member_id, amount, balance_after, source, ref, idempotency_key, created_at)
        VALUES (m, 8, 20, 'sell', fish, 'sell:bf-' || i || '-' || v, d + INTERVAL '5 minutes');
      END IF;
      IF d >= log_start THEN
        s := gen_random_uuid();
        INSERT INTO game_events (member_id, session_id, kind, screen, at) VALUES (m, s, 'session_start', 'village', d);
        beats := floor(1 + random() * 8)::int;
        FOR k IN 1..beats LOOP
          INSERT INTO game_events (member_id, session_id, kind, screen, at) VALUES (m, s, 'heartbeat', screens[1 + floor(random() * 11)::int], d + k * INTERVAL '3 minutes');
        END LOOP;
        INSERT INTO game_events (member_id, session_id, kind, step, screen, at)
        SELECT m, s, 'feature', f, 'village', d + INTERVAL '2 minutes' FROM unnest(feats) f WHERE random() < 0.25 GROUP BY f;
        INSERT INTO game_events (member_id, session_id, kind, screen, at)
        VALUES (m, s, 'session_end', screens[1 + floor(random() * 11)::int], d + (beats + 1) * INTERVAL '3 minutes');
      END IF;
    END LOOP;
  END LOOP;
END $$;
