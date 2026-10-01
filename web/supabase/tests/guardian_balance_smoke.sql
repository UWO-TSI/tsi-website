-- Combat polish 11: the guardian statue's balance (20261001070514_guardian_balance_seed). Throwaway local Postgres after
-- every migration, with the pre_* seeds. Never Supabase. Fails before the migration (1800 HP, armor 9).
\set ON_ERROR_STOP 1
DO $$
BEGIN
  ASSERT (SELECT hp = 1700 AND armor = 7 FROM enemy_types WHERE key = 'guardian-statue'), 'guardian at 1700 HP, armor 7';
  ASSERT (SELECT hp = 420 AND armor = 2 FROM enemy_types WHERE key = 'stone-golem'), 'the rest of the roster unchanged';
  RAISE NOTICE 'guardian balance ok';
END $$;
