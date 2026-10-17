#!/bin/zsh
# Throwaway Postgres 16 smoke for the HQ onboarding copy migration (row 312). Never Supabase, never prod.
#   zsh specs/evidence/hq-onboarding/sql-smoke.sh
# Chain: supabase_stub.sql; every migration through 20260926130000 (the legacy ones' known errors tolerated); every
# later migration before ours with ON_ERROR_STOP; the smoke run BEFORE ours (it must fail); ours; the smoke again (it
# must pass), and the v1 drop copy smoke still passing over it.
set -u
PG=/opt/homebrew/opt/postgresql@16/bin
W=${0:A:h}/../../../web/supabase
D=${TMPDIR:-/tmp}/uwotsi-hq-smoke-pg
PORT=55471
OURS=20261017010000_hq_onboarding_copy.sql
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
  $PS -d smoke -f $W/migrations/$m >/dev/null 2>$D.err || { echo "FAIL $m"; head -5 $D.err; exit 1; }
  n=$((n + 1))
done
echo "chain ok: $n migrations after the legacy set"
echo "--- before $OURS (must fail):"
$PS -d smoke -f $W/tests/hq_onboarding_copy_smoke.sql 2>&1 | grep -E "NOTICE|ERROR" | head -2 | sed 's/^psql:[^ ]* //'
$PS -d smoke -f $W/migrations/$OURS >/dev/null || { echo "FAIL applying $OURS"; exit 1; }
echo "--- after $OURS:"
$PS -d smoke -f $W/tests/hq_onboarding_copy_smoke.sql 2>&1 | grep -E "NOTICE|ERROR" | sed 's/^psql:[^ ]* //'
echo "--- the v1 drop copy smoke over it:"
$PS -d smoke -f $W/tests/v1_drop_copy_smoke.sql 2>&1 | grep -E "NOTICE|ERROR" | sed 's/^psql:[^ ]* //'
echo "--- settle-in now:"
$PS -d smoke -At -c "SELECT summary || ' | ' || (step_copy #>> '{report_hq,label}') FROM quest_chapters WHERE slug = 'settle-in'"
