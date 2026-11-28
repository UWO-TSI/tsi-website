#!/bin/zsh
# Throwaway Postgres 16 smoke for old-cleanup's migration (never Supabase, never prod): zsh specs/evidence/old-cleanup/sql-smoke.sh
# (the chain from specs/evidence/analytics/r2/sql-smoke.sh).
# Chain: supabase_stub.sql; every migration through 20260926130000 (the legacy ones' known errors tolerated); every
# later migration before ours with ON_ERROR_STOP and the pre_* seeds. Then 20261113120000_game_events.sql with
# tests/game_events_smoke.sql run BEFORE it (must fail) and after it (must pass), and game_security_smoke.sql still
# passing. With a path: backfill.sql's made-up players, and game_analytics_snapshot() written there as JSON (the
# /dev/analytics?source=backfill page's input, ANALYTICS_SNAPSHOT).
set -u
PG=/opt/homebrew/opt/postgresql@16/bin
W=${0:A:h}/../../../web/supabase
D=${TMPDIR:-/tmp}/uwotsi-oldcleanup-smoke-pg
PORT=55512
OURS=20261128200412_old_chapters_inactive.sql
rm -rf $D && $PG/initdb -D $D -U postgres -A trust >/dev/null || exit 1
$PG/pg_ctl -D $D -o "-p $PORT -k /tmp" -l $D.log start >/dev/null || exit 1
trap '$PG/pg_ctl -D $D stop >/dev/null 2>&1; rm -rf $D $D.*' EXIT
sleep 2
P=($PG/psql -h localhost -p $PORT -U postgres -v ON_ERROR_STOP=0 -q)
PS=($PG/psql -h localhost -p $PORT -U postgres -v ON_ERROR_STOP=1 -q)
$PG/createdb -h localhost -p $PORT -U postgres smoke
$PS -d smoke -f $W/tests/supabase_stub.sql >/dev/null 2>&1 || { echo "FAIL stub"; exit 1; }
for m in $(ls $W/migrations | awk '$0 <= "20260926130000_zzz"'); do $P -d smoke -f $W/migrations/$m >/dev/null 2>&1; done
n=0
for m in $(ls $W/migrations | awk -v ours=$OURS '$0 > "20260926130000_zzz" && $0 < ours'); do
  case $m in 20260926150600_economy.sql) $PS -d smoke -f $W/tests/pre033_seed.sql >/dev/null 2>&1;; esac
  case $m in 20260926150700_identity.sql) $PS -d smoke -f $W/tests/pre034_seed.sql >/dev/null 2>&1;; esac
  case $m in 20260926200000_membership_launch.sql) $PS -d smoke -f $W/tests/pre_launch_seed.sql >/dev/null 2>&1;; esac
  $PS -d smoke -f $W/migrations/$m >/dev/null 2>$D.err || { echo "FAIL $m"; head -5 $D.err; exit 1; }
  n=$((n + 1))
done
echo "chain ok: $n migrations after the legacy set, then ours"
echo "--- old_chapters_inactive_smoke before $OURS (must fail):"
$PS -d smoke -f $W/tests/old_chapters_inactive_smoke.sql 2>&1 | grep -E "NOTICE|ERROR" | head -1 | sed 's/^psql:[^ ]* //'
$PS -d smoke -f $W/migrations/$OURS >/dev/null || { echo "FAIL applying $OURS"; exit 1; }
echo "--- after $OURS:"
$PS -d smoke -f $W/tests/old_chapters_inactive_smoke.sql 2>&1 | grep -E "NOTICE|ERROR" | sed 's/^psql:[^ ]* //'
echo "--- applied twice (idempotent):"
$PS -d smoke -f $W/migrations/$OURS >/dev/null 2>&1 && $PS -d smoke -f $W/tests/old_chapters_inactive_smoke.sql 2>&1 | grep -E "NOTICE|ERROR" | sed 's/^psql:[^ ]* //'
echo "--- game_security_smoke over it:"
$PS -d smoke -f $W/tests/game_security_smoke.sql 2>&1 | grep -E "NOTICE|ERROR" | tail -2 | sed 's/^psql:[^ ]* //'
