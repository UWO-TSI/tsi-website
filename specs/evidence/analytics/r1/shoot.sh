#!/bin/zsh
# The analytics lane's shots: dev server on :3498 (Supabase env blanked), the shots, the server stopped. Run under the
# browser lock: LANE=game/analytics withlock.sh devserver zsh specs/evidence/analytics/r1/shoot.sh <snapshot.json>
set -u
R=${0:A:h}
cd $R/../../../../web || exit 1
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= ANALYTICS_SNAPSHOT=${1:?snapshot json} npx next dev -p 3498 > ${TMPDIR:-/tmp}/an1-dev.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; pkill -P $SERVER 2>/dev/null' EXIT
for i in {1..120}; do curl -s -o /dev/null http://localhost:3498/dev && break; sleep 2; done
echo "api signed out: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3498/api/admin/game-analytics) (game-analytics), $(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://localhost:3498/api/analytics/events) (events)"
node $R/shoot.mjs $R
