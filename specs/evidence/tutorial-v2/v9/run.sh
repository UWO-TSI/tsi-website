#!/bin/bash
# tutorial-v2 r9: a short-lived dev server on 3172 (new world, Supabase blanked), the v9 walk's scenes, then the server stops.
OUT=$1; shift
WT=/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/tutorial-v2
cd $WT/web
NEXT_PUBLIC_GAME_WORLD=new NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3172 > $OUT.dev.log 2>&1 &
PID=$!
trap "kill $PID 2>/dev/null; sleep 1; pkill -P $PID 2>/dev/null; lsof -ti tcp:3172 | xargs kill 2>/dev/null" EXIT
for i in $(seq 1 120); do curl -s -o /dev/null http://localhost:3172/lab/island && break; sleep 2; done
cd $WT
HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v9/walk.mjs $OUT "$@"; echo SHOOT_EXIT $?
