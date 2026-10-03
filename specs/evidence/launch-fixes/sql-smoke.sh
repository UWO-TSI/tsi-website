#!/bin/zsh
# Throwaway Postgres 16 smoke chain, every migration through the launch fixes (never Supabase).
# Run: zsh specs/evidence/launch-fixes/sql-smoke.sh [cutoff]   (Homebrew postgresql@16)
# cutoff (e.g. 20260926200000) skips migrations from that version on: the fail-first run.
set -u
CUT=${1:-99999999999999}
PG=/opt/homebrew/opt/postgresql@16/bin
W=${0:A:h}/../../../web/supabase
D=${TMPDIR:-/tmp}/uwotsi-launch-smoke-pg
PORT=55451
rm -rf $D && $PG/initdb -D $D -U postgres -A trust >/dev/null || exit 1
$PG/pg_ctl -D $D -o "-p $PORT -k /tmp" -l $D.log start >/dev/null || exit 1
sleep 2
P=($PG/psql -h localhost -p $PORT -U postgres -v ON_ERROR_STOP=0 -q)
PS=($PG/psql -h localhost -p $PORT -U postgres -v ON_ERROR_STOP=1 -q)
MAIN=$(ls $W/migrations | awk '$0 <= "20260926130000_zzz"')
GAME=(20260926150000_game_coins 20260926150100_seasonal_seed 20260926150200_progression 20260926150300_homes 20260926150400_collections 20260926150500_study pre033 20260926150600_economy pre034 20260926150700_identity 20260926150800_combat 20260926150900_collections_server_only 20260926151000_economy_sell_lock 20260926151100_wallet_gem_types 20260926151200_profiles_class_server_only
  20260926155000_schema_drift_reconcile 20260926155100_letters_broadcast_unique 20260926155200_event_attendance_rsvp_only 20260926155300_invite_codes_private 20260926155400_member_badges_signed_in_only
  20260926160000_crafting 20260926170000_profiles_avatar_config 20260926180000_ownership 20260926190000_combat_content pre_launch 20260926200000_membership_launch 20260926200100_event_rsvp_cancel 20260926210000_combat_kits 20260927090000_admin_pass
  20260929100000_catch_rolls 20260929100100_moderation_log 20260929100200_chapter4_subclass_copy 20260929120000_seasonal_events 20260930100000_recipe_drops 20260930142943_catalogue_seed 20261001041452_leaf_glider_seed 20261001070514_guardian_balance_seed 20261001072421_cafe_tables_seed 20261002050000_collections_eat 20261002052225_catalogue_seed 20261002181044_classes_v2 20261002182708_zone1_mobs 20261002191742_classes_v2_vanguard_seed)

chain() { # db, with_seeds
  $PG/createdb -h localhost -p $PORT -U postgres $1
  $P -d $1 -f $W/tests/supabase_stub.sql >/dev/null 2>&1
  for m in ${(f)MAIN}; do $P -d $1 -f $W/migrations/$m >/dev/null 2>&1; done
  for g in $GAME; do
    if [[ $g == pre* ]]; then [[ $2 == 1 ]] && { $PS -d $1 -f $W/tests/${g}_seed.sql >/dev/null || { echo "FAIL seed $g"; return 1; } }; continue; fi
    [[ ${g%%_*} < $CUT ]] || { echo "skipped $g"; continue; }
    $PS -d $1 -f $W/migrations/$g.sql >/dev/null 2>$D.$1.err || { echo "FAIL $g"; cat $D.$1.err; return 1; }
  done
  echo "chain ok ($1)"
}
smoke() { $PS -d $1 -f $W/tests/$2 2>&1 | grep -E "NOTICE|ERROR|FAIL|smoke ok" | sed 's/^psql:[^ ]* //'; }

chain game 1 && for s in 029-031_smoke.sql 032_smoke.sql 033_smoke.sql 034_smoke.sql 034_legacy_smoke.sql 035_smoke.sql game_security_smoke.sql crafting_smoke.sql ownership_smoke.sql combat_content_smoke.sql combat_kits_smoke.sql admin_pass_smoke.sql phase1_regressions.sql launch_fixes_smoke.sql catch_rolls_smoke.sql moderation_log_smoke.sql chapter4_copy_smoke.sql seasonal_events_smoke.sql recipe_drops_smoke.sql catalogue_seed_smoke.sql leaf_glider_smoke.sql guardian_balance_smoke.sql cafe_tables_smoke.sql collections_eat_smoke.sql item_icons_smoke.sql classes_v2_smoke.sql zone1_mobs_smoke.sql classes_v2_vanguard_smoke.sql; do echo "── $s"; smoke game $s; done
chain guard 0 && smoke guard profiles_guard_smoke.sql | tail -3
chain rls 0 && { $PS -d rls -f $W/tests/portal_rls_smoke.sql >/dev/null 2>$D.rls.err && echo "portal_rls_smoke exit 0" || { echo FAIL rls; tail -5 $D.rls.err; }; }
chain look 0 && smoke look avatar_config_smoke.sql
$PG/pg_ctl -D $D stop >/dev/null
rm -rf $D $D.*
