#!/bin/zsh
# Throwaway Postgres 16 smoke for the hq-onboarding lane's migrations (row 312, row 217). Never Supabase, never prod.
#   zsh specs/evidence/hq-onboarding/sql-smoke.sh
# Chain: supabase_stub.sql; every migration through 20260926130000 (the legacy ones' known errors tolerated); every
# later migration before ours with ON_ERROR_STOP. Then ours in apply order, each smoke run BEFORE its migration (it
# must fail) and after it (it must pass):
#   20261017010000_hq_onboarding_copy.sql   chapter 1 names Wren          tests/hq_onboarding_copy_smoke.sql
#   20261017020000_resident_roster.sql      the roster in production      tests/resident_roster_smoke.sql
#   20261017163142_catalogue_seed.sql       tier-1 net + shovel off sale  tests/taught_tools_off_sale_smoke.sql
# and the copy smokes they pass over (v1 drop copy) still passing.
set -u
PG=/opt/homebrew/opt/postgresql@16/bin
W=${0:A:h}/../../../web/supabase
D=${TMPDIR:-/tmp}/uwotsi-hq-smoke-pg
PORT=55471
OURS=(20261017010000_hq_onboarding_copy.sql 20261017020000_resident_roster.sql 20261017163142_catalogue_seed.sql)
SMOKES=(hq_onboarding_copy_smoke.sql resident_roster_smoke.sql taught_tools_off_sale_smoke.sql)
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
for m in $(ls $W/migrations | awk -v ours=${OURS[1]} '$0 > "20260926130000_zzz" && $0 < ours'); do
  case $m in 20260926150600_economy.sql) $PS -d smoke -f $W/tests/pre033_seed.sql >/dev/null 2>&1;; esac
  case $m in 20260926150700_identity.sql) $PS -d smoke -f $W/tests/pre034_seed.sql >/dev/null 2>&1;; esac
  $PS -d smoke -f $W/migrations/$m >/dev/null 2>$D.err || { echo "FAIL $m"; head -5 $D.err; exit 1; }
  n=$((n + 1))
done
echo "chain ok: $n migrations after the legacy set, then ours"
for i in 1 2 3; do
  # Before the tools come off sale: a member who bought the bug net (they keep it).
  if [[ $i == 3 ]]; then
    $PS -d smoke -c "INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000e1', 'net-owner@x') ON CONFLICT DO NOTHING;
      INSERT INTO member_inventory (member_id, item_id, qty, slot) SELECT '00000000-0000-4000-8000-0000000000e1', id, 1, slot FROM shop_items WHERE slug = 'net-basic';" >/dev/null || { echo "FAIL owner"; exit 1; }
  fi
  echo "--- ${SMOKES[$i]} before ${OURS[$i]} (must fail):"
  $PS -d smoke -f $W/tests/${SMOKES[$i]} 2>&1 | grep -E "NOTICE|ERROR" | head -1 | sed 's/^psql:[^ ]* //'
  $PS -d smoke -f $W/migrations/${OURS[$i]} >/dev/null || { echo "FAIL applying ${OURS[$i]}"; exit 1; }
  echo "--- after ${OURS[$i]}:"
  $PS -d smoke -f $W/tests/${SMOKES[$i]} 2>&1 | grep -E "NOTICE|ERROR" | sed 's/^psql:[^ ]* //'
done
echo "--- the v1 drop copy smoke over them:"
$PS -d smoke -f $W/tests/v1_drop_copy_smoke.sql 2>&1 | grep -E "NOTICE|ERROR" | sed 's/^psql:[^ ]* //'
echo "--- now:"
$PS -d smoke -At -c "SELECT 'settle-in: ' || summary || ' | ' || (step_copy #>> '{report_hq,label}') FROM quest_chapters WHERE slug = 'settle-in'"
$PS -d smoke -At -c "SELECT 'residents: ' || string_agg(display_name, ', ' ORDER BY display_name) FROM npc_personas WHERE active"
$PS -d smoke -At -c "SELECT 'tools on sale: ' || string_agg(slug, ', ' ORDER BY position) FROM shop_items WHERE category = 'tool' AND active"
