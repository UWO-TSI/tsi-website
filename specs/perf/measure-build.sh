#!/bin/sh
# A production build for the perf bench (specs/perf/perf-bench.mjs): next build's optimised React, three and our code,
# with the development gates lifted so the bench's scenes exist (/lab, ?bots=, ?combat=demo, the window.__* hooks and
# the perf probe). The gates are `process.env.NODE_ENV` checks in the game's own files: each is rewritten to
# "development" for the build only, and every file is restored from git straight after, so nothing of it is committed.
#   sh specs/perf/measure-build.sh   then   cd web && NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=perf-bench SUPABASE_SERVICE_ROLE_KEY= npx next start -p 3149
# Never deploy this build. Run it under the heavy lock (it is a full build).
set -e
cd "$(dirname "$0")/../../web"
FILES=$(grep -rl 'process\.env\.NODE_ENV' app/lab components/game lib/game lib/net | grep -v '\.test\.ts$')
DIRTY=$(git status --porcelain -- $FILES)
if [ -n "$DIRTY" ]; then echo "uncommitted changes in gated files; commit or stash them first:"; echo "$DIRTY"; exit 1; fi
trap 'git checkout -- $FILES' EXIT
for f in $FILES; do sed -i '' 's/process\.env\.NODE_ENV/("development" as string)/g' "$f"; done
# Not production: a dummy local project (prerendering needs a URL and key to make a client; nothing is reached).
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=perf-bench SUPABASE_SERVICE_ROLE_KEY= npx next build
