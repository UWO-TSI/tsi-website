#!/bin/zsh
# The forage evidence pass, queued behind the shared browser lock: waits for the lock (never while coordinator-pause
# holds it), runs a dev server from this tree on 3143 with the Supabase env blanked (never production), shoots the
# scenes (shoot.mjs), stops the server, releases the lock, then tiles the sheets (sheets.py).
#   specs/evidence/polish-forage/run.sh <before_dir> <after_dir> [scene ...]      (HEADLESS=1 for no window)
# The before frames come from the same scenes served from a checkout of a84643f9 (this pass's base):
#   SERVE_TREE=<that checkout> NO_SHEETS=1 run.sh - <before_dir> [scene ...]
HERE=${0:A:h}; TREE=${SERVE_TREE:-${HERE:h:h:h}}
BEFORE=$1; AFTER=$2; shift 2
LOCK=/private/tmp/claude-501/uwotsi-devserver.lock
ME=game/polish-forage
until mkdir $LOCK 2>/dev/null; do sleep 4; done
echo "$ME $(date '+%Y-%m-%d %H:%M:%S') evidence" > $LOCK/owner
( while [ "$(cut -d' ' -f1 $LOCK/owner 2>/dev/null)" = "$ME" ]; do echo "$ME $(date '+%Y-%m-%d %H:%M:%S') evidence" > $LOCK/owner; sleep 60; done ) &
REFRESH=$!
cd $TREE/web
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= SUPABASE_SERVICE_ROLE_KEY= node node_modules/next/dist/bin/next dev -p 3143 > /tmp/forage-dev-evidence.log 2>&1 &
DEV=$!
for i in {1..120}; do curl -s -o /dev/null -m 60 http://localhost:3143/student/opening-soon && break; sleep 5; done
curl -s -o /dev/null -m 300 "http://localhost:3143/lab/island"
mkdir -p $AFTER
node $HERE/shoot.mjs $AFTER 3143 "$@"
for p in $(pgrep -P $DEV); do for c in $(pgrep -P $p); do kill $c 2>/dev/null; done; kill $p 2>/dev/null; done
kill $DEV 2>/dev/null; sleep 3; kill -9 $DEV 2>/dev/null
kill $REFRESH 2>/dev/null
[ "$(cut -d' ' -f1 $LOCK/owner 2>/dev/null)" = "$ME" ] && rm -rf $LOCK
[ -n "$NO_SHEETS" ] || python3 $HERE/sheets.py $BEFORE $AFTER
