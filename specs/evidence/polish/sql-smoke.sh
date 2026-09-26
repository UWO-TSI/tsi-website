#!/bin/zsh
# Throwaway Postgres 16 smoke chain for the game drafts (never Supabase).
# Run from anywhere: zsh specs/evidence/polish/sql-smoke.sh (Homebrew postgresql@16).
set -u
PG=/opt/homebrew/opt/postgresql@16/bin
W=${0:A:h}/../../../web/supabase
D=${TMPDIR:-/tmp}/uwotsi-smoke-pg
PORT=55441
rm -rf $D && $PG/initdb -D $D -U postgres -A trust >/dev/null || exit 1
$PG/pg_ctl -D $D -o "-p $PORT -k /tmp" -l $D.log start >/dev/null || exit 1
sleep 2
P=($PG/psql -h localhost -p $PORT -U postgres -v ON_ERROR_STOP=0 -q)
PS=($PG/psql -h localhost -p $PORT -U postgres -v ON_ERROR_STOP=1 -q)
MAIN=$(ls $W/migrations | awk '$0 <= "20260926130000_zzz"')
GAME=(20260926150000_game_coins 20260926150100_seasonal_seed 20260926150200_progression 20260926150300_homes 20260926150400_collections 20260926150500_study pre033 20260926150600_economy pre034 20260926150700_identity 20260926150800_combat 20260926150900_collections_server_only 20260926151000_economy_sell_lock 20260926151100_wallet_gem_types 20260926151200_profiles_class_server_only 20260926160000_crafting 20260926170000_profiles_avatar_config 20260926180000_ownership)

chain() { # db, with_seeds
  $PG/createdb -h localhost -p $PORT -U postgres $1
  $P -d $1 -f $W/tests/supabase_stub.sql >/dev/null 2>&1
  for m in ${(f)MAIN}; do $P -d $1 -f $W/migrations/$m >/dev/null 2>&1; done
  for g in $GAME; do
    if [[ $g == pre03* ]]; then [[ $2 == 1 ]] && { $PS -d $1 -f $W/tests/${g}_seed.sql >/dev/null || { echo "FAIL seed $g"; return 1; } }; continue; fi
    $PS -d $1 -f $W/migrations/$g.sql >/dev/null 2>$D.$1.err || { echo "FAIL $g"; cat $D.$1.err; return 1; }
  done
  echo "chain ok ($1)"
}
smoke() { $PS -d $1 -f $W/tests/$2 2>&1 | grep -E "NOTICE|ERROR|FAIL|smoke ok" | sed 's/^psql:[^ ]* //'; }

chain game 1 && for s in 029-031_smoke.sql 032_smoke.sql 033_smoke.sql 034_smoke.sql 034_legacy_smoke.sql 035_smoke.sql game_security_smoke.sql crafting_smoke.sql ownership_smoke.sql; do smoke game $s; done
chain guard 0 && smoke guard profiles_guard_smoke.sql | tail -3
chain rls 0 && { $PS -d rls -f $W/tests/portal_rls_smoke.sql >/dev/null 2>$D.rls.err && echo "portal_rls_smoke exit 0" || { echo FAIL rls; tail -5 $D.rls.err; }; }
chain look 0 && smoke look avatar_config_smoke.sql
$PG/pg_ctl -D $D stop >/dev/null
rm -rf $D $D.*
