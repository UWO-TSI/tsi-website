-- Row 279: eating a held fruit (20261002050000_collections_eat). Throwaway local Postgres after every migration,
-- with the pre_* seeds. Never Supabase. Fails before the migration (no collections_eat).
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000009e7', 'eat@x');

DO $$
DECLARE M uuid := '00000000-0000-4000-8000-0000000009e7';
BEGIN
  INSERT INTO member_collections (user_id, item_key, count) VALUES (M, 'apple', 2), (M, 'rock_stone', 1);
  ASSERT collections_eat(M, 'apple') = 1, 'one apple eaten, one left';
  ASSERT collections_eat(M, 'apple') = 0, 'the last apple';
  BEGIN PERFORM collections_eat(M, 'apple'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'none_left', 'none left: ' || SQLERRM; END;
  BEGIN PERFORM collections_eat(M, 'rock_stone'); RAISE EXCEPTION 'x';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'not_edible', 'a stone: ' || SQLERRM; END;
  ASSERT (SELECT count FROM member_collections WHERE user_id = M AND item_key = 'rock_stone') = 1, 'the stone kept';
  ASSERT NOT has_function_privilege('authenticated', 'public.collections_eat(uuid, text)', 'execute'), 'service role only';
  RAISE NOTICE 'collections eat ok';
END $$;
