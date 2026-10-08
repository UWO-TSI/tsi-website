#!/bin/sh
# Before and after, interleaved (specs/perf/2026-10-results.md): two measurement builds (measure-build.sh) kept as
# .perf-builds/.next-before and .next-after at the worktree's root (not in web/: Tailwind scans web/ for class names, and
# a build output there breaks the next build's CSS), served in turn on PORT and benched round by round, so a busy
# machine weighs on both alike.   sh specs/perf/ab.sh <rounds> <scenes> <outPrefix>   (env passes through to
# perf-bench.mjs: TIER, UNCAPPED, ...). Run under the devserver lock; web/.next must not exist (it is the build served).
set -e
ROUNDS=$1; SCENES=$2; OUT=$3; PORT=${PORT:-3149}
cd "$(dirname "$0")/../../web"
serve() {
  mv "../.perf-builds/.next-$1" .next
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=perf-bench SUPABASE_SERVICE_ROLE_KEY= npx next start -p "$PORT" > /dev/null 2>&1 &
  until curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/lab/island" | grep -q 200; do sleep 1; done
}
stop() {
  pkill -f "next start -p $PORT" || true
  while lsof -iTCP:"$PORT" -sTCP:LISTEN -P > /dev/null 2>&1; do sleep 0.5; done
  mv .next "../.perf-builds/.next-$1"
}
for r in $(seq 1 "$ROUNDS"); do
  for b in before after; do
    serve $b
    echo "== round $r: $b"
    PORT=$PORT node ../specs/perf/perf-bench.mjs "$SCENES" "../${OUT}-$b.jsonl" | grep -v '^   [0-9]' || true
    stop $b
  done
done
