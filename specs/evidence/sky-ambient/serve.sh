#!/bin/bash
# serve.sh <webdir> <mode: start|dev> <port> <cmd...>: serve, wait for /lab/island, run cmd, kill the server tree.
WEB="$1"; MODE="$2"; PORT="$3"; shift 3
cd "$WEB" || exit 1
if [ "$MODE" = start ]; then
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=perf-bench SUPABASE_SERVICE_ROLE_KEY= npx next start -p "$PORT" > /tmp/sky-serve-$PORT.log 2>&1 &
else
  NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= NEXT_PUBLIC_GAME_WORLD=new npx next dev -p "$PORT" > /tmp/sky-serve-$PORT.log 2>&1 &
fi
SP=$!
cleanup() { pkill -TERM -P $SP 2>/dev/null; kill $SP 2>/dev/null; sleep 1; for p in $(lsof -t -i tcp:$PORT -sTCP:LISTEN 2>/dev/null); do kill $p 2>/dev/null; done; }
trap cleanup EXIT
for i in $(seq 1 180); do curl -s -o /dev/null -m 120 "http://localhost:$PORT/lab/island" && break; sleep 2; done
"$@"
