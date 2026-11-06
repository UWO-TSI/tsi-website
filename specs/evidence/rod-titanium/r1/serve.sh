#!/bin/bash
# One locked shoot: a dev server on 3484 (Supabase env blanked), the command given, then the server stopped.
#   LANE=game/rod-titanium withlock.sh devserver specs/evidence/rod-titanium/r1/serve.sh node specs/evidence/rod-titanium/r1/shots.mjs
ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
cd $ROOT/web
set -m                                  # the server in its own process group, stopped whole
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= NEXT_PUBLIC_GAME_WORLD=new npx next dev -p 3484 > /private/tmp/claude-501/rti1-dev.log 2>&1 &
SERVER=$!
trap 'kill -- -$SERVER 2>/dev/null' EXIT
for i in $(seq 120); do curl -s -o /dev/null http://localhost:3484/ && break; sleep 1; done
cd $ROOT
export PW=/Users/DavidLiu/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
export SHELL_BIN=/Users/DavidLiu/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell
export BASE=http://localhost:3484
"$@"
