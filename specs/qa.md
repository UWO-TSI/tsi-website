# QA Report

> Owner: QA agent. All agents check this for bugs in their area.
> Last updated: 2026-05-25 (Wave 13)

---

## Wave 13 — 2026-05-25 B1+B2 Verification

Verification of `1ce7281` (sprint B1: content pipeline migration 014) and `bdd301e` (sprint B2: content loader hooks + palette wiring), with reviewer follow-up at `dbc571f`. Diff against Wave 12 baseline (`507bcb1`).

### Environment

- Branch: `main`
- HEAD: `dbc571f` ([review] mark B2 done + flag palette-aware TOD as follow-up)
- Files touched vs Wave 12: `web/supabase/migrations/014_content_pipeline.sql` (new, 193 lines), `web/lib/game/contentLoader.ts` (new, 179), `web/lib/game/contentTypes.ts` (new, 63), `web/data/content-defaults.ts` (new, 136), `web/components/game/GameWorld.tsx` (palette wiring), `web/app/api/shop/route.ts` (shop_items union), `web/package.json` (+`swr ^2.4.1`), `web/package-lock.json`.

### Verdict: **PASS**

No regressions. Migration syntax + RLS structure conforms to spec. Code paths exist and are wired. Runtime smoke green with and without `.env.local`.

### Build

- `cd web && npm run build` → `✓ Compiled successfully in 23.7s`
- Static pages: `72/72`. Routes (counting `├`/`└` lines in route table): **84** — exact match with Wave 12.
- Warnings: same two as Wave 12 (workspace-root lockfile inference, `middleware` convention deprecation). No new build warnings.

### Types

- `npx tsc --noEmit` → exit 0, no output. Clean.

### Lint

- `npm run lint` → **130 problems (74 errors, 56 warnings)** — exact match to Wave 12 floor.
- Rule-frequency table unchanged from Wave 12 (44 `no-explicit-any`, 38 `no-unused-vars`, 11 `set-state-in-effect`, 10 `immutability`, 8 `no-img-element`, etc.).
- No new lint errors introduced by B1/B2.

### Migration verification (`014_content_pipeline.sql`)

- 4 tables created: ✅ `npc_personas`, ✅ `shop_items`, ✅ `seasonal_palettes`, ✅ `content_drafts`. Columns + types + CHECK constraints match spec.
- RLS enabled on all 4: ✅ (one `ENABLE ROW LEVEL SECURITY` per table).
- SELECT policy count: **8** — 4 active-row/author-scoped + 4 T1/T2-all (matches checklist requirement). `content_drafts` active-equivalent SELECT is author-scoped (per spec) instead of `active = TRUE`.
- All `auth.uid()` and `auth.role()` calls wrapped in `(select ...)`: ✅ verified line-by-line.
- Partial unique index `idx_seasonal_palettes_single_active ON (active) WHERE active = TRUE`: ✅ present (lines 51-53).
- Seeds: ✅ 2 NPCs (`mayor`, `shopkeeper`), ✅ 3 shop items (`tsi-hoodie`, `glitch-aura`, `founder-badge`), ✅ 2 palettes (`default` active, `halloween` inactive). All use `ON CONFLICT (slug) DO NOTHING`.
- Not applied to any DB (syntax-only inspection per directive).

### Code path verification

- `web/lib/game/contentLoader.ts` exports `useNPCPersonas`, `useShopItems`, `useActivePalette`: ✅
- `web/data/content-defaults.ts` defaults cross-check vs migration seeds:
  - NPC slugs `mayor` / `shopkeeper` ✅; display names `Mayor Eliza` / `Toren` ✅; persona prompts + canned dialogue match exactly.
  - Shop slugs `tsi-hoodie` / `glitch-aura` / `founder-badge` ✅; categories, prices (1500/800/5000), rarity, stock all match.
  - Palette hex codes match exactly across all 7 keys for both `default` and `halloween`.
- `web/lib/game/contentTypes.ts` types align with migration columns: `NPCPersona.canned_dialogue: string[]` ✅; `SeasonalPalette.palette: PaletteColors` (7-key object) ✅; CHECK-constrained enums (`SpawnZone`, `ShopCategory`, `Rarity`) match.
- `swr ^2.4.1` in `web/package.json` dependencies: ✅ line 39.
- `GameWorld.tsx` imports + uses `useActivePalette`: ✅ line 12 import, line 565 hook call, lines 573-574 reference `activePalette.palette.sky` and `activePalette.palette.fog` with fallbacks to existing `P.skyBottom` / `P.fog`. Note: only sky + fog are wired this sprint; reviewer (`dbc571f`) explicitly flagged palette-aware TOD blending as a follow-up — grass/water/buildings not yet driven by palette, which matches the sprint scope.

### Runtime smoke

Port 3000 was free (different from Wave 12 — PID 793 process is no longer running). Spawned dev server on `:3050` via `npm run dev -- -p 3050`.

| URL | Code | Notes |
|-----|------|-------|
| `GET /` | 200 | Marketing home OK |
| `GET /student/dashboard` | **307** | Redirects to login (middleware auth gate) — expected |
| `GET /student/dashboard/shop` | **307** | Redirects to login — expected |
| `GET /api/shop` | **401** | `{"error":"Unauthorized"}` — auth-gated, expected without session cookie |

Could not inspect authenticated `/api/shop` response body (no test session). The shop route source (`web/app/api/shop/route.ts` lines 27-43) confirms `shop_items` is queried in parallel with `marketplace_items` + `avatar_items`, mapped through `SHOP_ITEM_CATEGORY_MAP`, and concatenated into the products array (lines 72-100). Path exists.

**Not visually tested** (no browser tool invoked this wave).

### Fallback path (`.env.local` removed)

- Renamed `web/.env.local` → `web/.env.local.bak`, restarted dev server.
- `GET /student/dashboard` → **200** (middleware bypass when env missing — matches `CLAUDE.md` "Middleware gracefully handles missing Supabase env vars").
- `GET /student/dashboard/shop` → **200**
- `GET /api/shop` → **200** with body `{"products":[]}` (the route's `try/createClient/catch` returns empty array early when client can't be built).
- Restored `.env.local`. Re-smoked: 307/307/401 codes return.
- Content loader SWR fallback path (defaults from `content-defaults.ts`) is exercised indirectly here. Confirmed by code review: `hasSupabaseEnv()` returns false when env vars are missing, hooks short-circuit to bundled defaults before any network call.

### Regression check vs Wave 12

- Lint count identical (74/56). No new errors.
- Build route count identical (84).
- No new console.error or runtime warnings in dev server stdout during smoke tests. Pre-existing warnings only: middleware deprecation, workspace lockfile inference, `@next/font` legacy install, `baseline-browser-mapping` data freshness — all carried from Wave 12.
- No portal-scope files were touched outside the documented commits.

### Notes for downstream

- Palette wiring only reads `sky` and `fog` in `GameWorld.tsx`. `grass`, `water`, `accent`, `building_primary`, `building_accent` are loaded but unused. Tracked: B2 follow-up "palette-aware TOD" per `dbc571f` reviewer commit. Not a Wave 13 failure.
- `/api/shop` legacy unioning (3 tables in parallel) means duplicate items will surface if a shop_items row and a marketplace_items row carry overlapping concepts during the migration window. Not in scope; flagging for downstream.
- B3 (content draft + preview URL system) and A1 (terrain undulation) are unblocked from a QA perspective.

---

## Wave 12 — 2026-05-25 World-Building Sprint Baseline

"Before" snapshot on `main` at commit `6393d48` for the World-Building + Content Pipeline sprint. Read-only on portal code this round — measurements only, no fixes.

### Environment

- Branch: `main`
- Commit: `6393d48` ([review] reset env for student game portal: 3-agent setup + community-first sprint pivot)
- Node modules: existing, refreshed via `npm install --legacy-peer-deps` → `up to date, audited 748 packages`
- npm vulnerabilities: **19 (14 moderate, 5 high)** — up from Wave 11 (10 total: 7 mod, 3 high). Recruitment dep additions since Wave 11 likely account for the bump.

### Build

**Result: PASSES**

- `npm run build` → `✓ Compiled successfully in 11.4s`
- Static pages generated: `72/72` in 621.4ms (7 workers)
- Total routes in tree: **84** (Wave 11: 61; **+23** — recruitment system + admin pages have grown since)
- Build-time warnings: 2, both pre-existing and non-blocking
  - Workspace-root inference (two lockfiles: repo root + `web/`)
  - `middleware` file convention deprecated — migrate to `proxy` (carried from Wave 11, still not actioned)
- No new build warnings introduced.

### Lint

**Result: 74 errors, 56 warnings** (130 total problems, 5 auto-fixable)

| Metric | Wave 11 | Wave 12 | Delta |
|--------|---------|---------|-------|
| Errors | 39 | **74** | **+35** |
| Warnings | 53 | **56** | +3 |
| Files with issues | n/a | 52 | — |

Rule frequency (top patterns):

| Rule | Count | Notes |
|------|-------|-------|
| `@typescript-eslint/no-explicit-any` | 44 | Largest single bucket — heavily concentrated in recruitment/admin code (`app/api/sheets-sync/route.ts`, `app/admin/recruit/page.tsx`) |
| `@typescript-eslint/no-unused-vars` | 38 | Spread across recruitment, admin, dashboard pages |
| `react-hooks/set-state-in-effect` | 11 | **NEW pattern in Wave 12** — not flagged at Wave 11 |
| `react-hooks/immutability` | 10 | **NEW pattern in Wave 12** — not flagged at Wave 11 |
| `@next/next` rules | 10 | Mostly img-element + script-ordering nits |
| `react-hooks/exhaustive-deps` | 4 | Pre-existing |
| `react/jsx-no-comment-textnodes` | 3 | — |
| `@typescript-eslint/no-require-imports` | 3 | Likely in `scripts/*.js` |
| Other (purity, refs, unescaped-entities, etc.) | 7 | Long tail |

File distribution (top folders):

| Folder | Files w/ issues |
|--------|-----------------|
| `app/student/` | 11 |
| `components/ui/` | 10 |
| `app/npo/` | 4 |
| `components/cards/` | 3 |
| `components/recruit/`, `components/portal/`, `components/layout/`, `components/dashboard/`, `components/ascii/` | 2 each |
| `scripts/` | 5 |
| Misc | rest |

**Concerns:**
- The +35 error delta is mostly from the recruitment system (`app/admin/recruit/page.tsx`, `app/api/sheets-sync/route.ts`, `app/student/apply/**`) merging in since Wave 11, plus newer React hook rules (`set-state-in-effect`, `immutability`) firing on existing portal code. Not blocking for this sprint, but the portal-side hook violations are technical debt that should be batched into a dedicated lint-cleanup pass before Phase 2.
- Portal scope (`app/student/dashboard/**`, `components/portal/**`, `components/game/**`) is not the dominant offender; most new errors are recruitment-adjacent. Build agent's sprint work should not regress this further — re-baseline at sprint end.

### Dev Server Smoke (port 3000)

Note: port 3000 was already bound by a pre-existing `next dev` session (PID 793, running ~1d 17h — not spawned by QA). My background `npm run dev` failed lock-acquire, exited cleanly. Smoke-tested the existing :3000 server instead of restarting.

| URL | Status | Notes |
|-----|--------|-------|
| `GET /student/dashboard` | **307 → 200** | Redirects to `/student/login` (200) via middleware — expected behavior without session cookie |
| `GET /` | 200 | Marketing home OK |
| `GET /student/login` | 200 | Login page OK |

No 5xx, no hangs, middleware functioning. Baseline runtime: healthy.

### Deltas vs Wave 11 — Summary

| Check | Wave 11 | Wave 12 | Delta |
|-------|---------|---------|-------|
| Build | PASS (61 routes) | PASS (84 routes) | +23 routes, still passing |
| Lint errors | 39 | 74 | **+35** (recruitment + new hook rules) |
| Lint warnings | 53 | 56 | +3 |
| npm vulnerabilities | 10 (7 mod, 3 high) | 19 (14 mod, 5 high) | +9 |
| Dashboard HTTP | 200 (no auth) | 307→200 (login redirect) | Middleware now enforces auth — expected since recruitment auth changes |
| Build warnings | middleware deprecation | middleware deprecation + workspace-root | +1 (workspace-root is non-blocking lockfile nit) |

### Concerns for the sprint

1. **Lint debt is real but bounded.** +35 errors since Wave 11. Sprint scope (world-building, content pipeline migrations) shouldn't touch these files much — QA-sprint pass at sprint end should confirm error count doesn't climb further.
2. **`react-hooks/set-state-in-effect` and `react-hooks/immutability` are newly active.** Whatever ESLint/plugin update activated these will flag any new React work the build agent does. Build agent should be aware.
3. **npm vulnerability count nearly doubled.** Not blocking for dev, but flag for any production-deploy gate.
4. **Two lockfiles in tree** (root + `web/`). Cosmetic build warning, but worth confirming the right one is the source of truth before Phase 2 dependency churn.

### Verdict

**BASELINE LOCKED.** Build passes, dev server healthy, lint at 74/56. Build agent: proceed with sprint A/B deliverables. QA-sprint wave will re-measure on completion.

---

## Wave 11 — P1 Blocker Fixes + Visual Verification (2026-04-06)

Playwright MCP reconnected after previous session crash. Completed all TODO items from Wave 10 handoff: visual testing of Round 3 pages, P1 bug documentation, and P1 blocker fixes.

### Build

**Result: ✅ PASSES — 61 routes (up from 60 in Wave 10)**

New route: `/api/shop` (stub — P1 fix)

### HTTP Status — 18/18 Key Pages Return 200

| Category | Pages | Status |
|----------|-------|--------|
| Marketing (5) | `/`, `/npo`, `/company`, `/sponsor`, `/student` | ✅ All 200 |
| Auth (3) | `/student/login`, `/signup`, `/onboarding` | ✅ All 200 |
| Dashboard (9) | home, directory, bounty, shop, jobs, leaderboard, profile, settings, oracle | ✅ All 200 |
| API `/api/shop` | New stub route | ✅ 200 (was 404) |

### Visual Testing — Round 3 Pages (Playwright)

| Page | Result | Screenshot | Notes |
|------|--------|------------|-------|
| `/student/onboarding` | ✅ FIXED | `qa-wave11-onboarding-fixed.png` | Was crashing with Supabase runtime error (hard crash). Fixed: try/catch around `createClient()`. Now renders 3-step flow (welcome → profile → avatar). |
| `/student/dashboard/oracle` | ✅ PASS | `qa-wave11-oracle.png` | 12-question MBTI quiz renders. 4 answer cards per question. Progress bar "1 of 12". Uses v1 card layout (not v2 NPC encounter). |
| `/student/dashboard` (game world) | ✅ PASS | `qa-wave11-dashboard.png` | AC-style village renders: HQ, House, Shop, Bounty Board buildings. Green terrain, river, trees, props. Sidebar shows "Player Lv. 1" (fallback — no auth creds). |

### P1 Blockers — FIXED

**P1 #1: Missing `/api/shop` route (was 404)**
- **Before:** Shop page fetched from `/api/shop` which returned 404. Frontend handled gracefully (empty state), but API error logged in console.
- **Fix:** Created `web/app/api/shop/route.ts` — stub returning `{ products: [] }`. Shop page now shows "No items in this category yet." with no console errors.
- **Screenshot (before):** `qa-wave11-shop-p1.png`
- **Status:** ✅ RESOLVED

**P1 #2: Directory/Profile show raw "HTTP 500"**
- **Before:** Directory showed bare "HTTP 500" text. Profile showed "HTTP 500" with "Go back" link. No retry option on directory.
- **Fix:**
  - `MemberDirectory.tsx`: Error state now shows SearchX icon + "Unable to load directory" + "The server is not available right now." + cyan Retry link
  - `ProfileView.tsx`: Error state now shows User icon + "Unable to load profile" + friendly description + "Go back" link
- **Screenshots (before):** `qa-wave11-directory-p1.png`, `qa-wave11-profile-p1.png`
- **Screenshots (after):** `qa-wave11-directory-fixed.png`, `qa-wave11-profile-fixed.png`
- **Status:** ✅ RESOLVED

**Bonus fix: Onboarding hard crash**
- **Before:** `/student/onboarding` showed Next.js runtime error overlay — `createClient()` threw because Supabase env vars are missing.
- **Fix:** Wrapped `createClient()` in try/catch in `useEffect`. Page now renders with empty defaults when Supabase is unavailable.
- **Screenshot (before):** `qa-wave11-onboarding.png`
- **Screenshot (after):** `qa-wave11-onboarding-fixed.png`
- **Status:** ✅ RESOLVED

### Files Modified

| File | Change |
|------|--------|
| `web/app/api/shop/route.ts` | **NEW** — stub GET returning `{ products: [] }` |
| `web/components/portal/MemberDirectory.tsx` | Error state: icon + friendly message + Retry button |
| `web/components/portal/ProfileView.tsx` | Error state: icon + friendly message; added `User` import |
| `web/app/student/onboarding/page.tsx` | Wrapped `createClient()` in try/catch |

### Updated Verdict

**READY** — Both P1 blockers resolved. All pages return HTTP 200. No hard crashes without Supabase credentials. Portal can merge to main.

### Remaining Known Issues (non-blocking)

| Sev | Issue | Status |
|-----|-------|--------|
| **P2** | FBX building files unused (651KB) | Unchanged |
| **P2** | No WebGL context loss handler | Unchanged |
| **P2** | Mobile sidebar z-index bleed | Unchanged |
| **P3** | 39 lint errors | Unchanged |
| **P3** | Font 404 (`TestSohne-Kraftig`) | Unchanged |
| **P3** | Middleware deprecation warning | Unchanged |
| **P3** | Oracle uses v1 layout, not v2 NPC encounter | New observation — cosmetic, not blocking |

---

## Wave 10 — Round 4 Merge Readiness Assessment (2026-04-05)

Full integration of Rounds 1–3 work. All agent branches merged. Complete page sweep, API audit, lint audit, code review of new pages (onboarding, oracle, events, auth context). This wave delivers the **READY / NOT READY verdict** for merge to main.

### Build

**Result: ✅ PASSES — 60 routes (up from 58 in Wave 9)**

New routes: `/student/dashboard/oracle` (Round 3 Frontend)

### HTTP Status — 36/36 Pages Return 200

| Category | Pages | Status |
|----------|-------|--------|
| Marketing (5) | `/`, `/npo`, `/company`, `/sponsor`, `/student` | ✅ All 200 |
| Auth (4) | `/student/login`, `/signup`, `/onboarding`, `/election` | ✅ All 200 |
| Dashboard (17) | home, directory, bounty, leaderboard, shop, jobs, settings, profile, oracle, calendar, quests, kanban, marketplace, mentorship, portfolio, tools, tools/ascii, tools/rag | ✅ All 200 |
| Admin (8) | admin, analytics, announcements, bounties, election, marketplace, members, quests | ✅ All 200 |
| Dynamic (1) | `/student/dashboard/directory/[id]` | ✅ (build-verified) |
| Other (1) | `/under-construction` | ✅ 200 |

### Round 3 New Features — Code Review

| Feature | Status | Notes |
|---------|--------|-------|
| Onboarding flow (3-step) | ✅ | Welcome → profile (name/bio/year/skills/socials) → avatar. PATCH /api/profile on finish. Redirects if already completed. |
| Oracle quiz (12 MBTI questions) | ✅ | 4 axes × 3 questions. 5-stage reveal animation (4.5s). Maps 16 MBTI types to 4 classes + 16 subclasses. Auto-saves class/subclass. |
| Auth context (UserContext) | ✅ | `useUser()` hook fetches `/api/profile`. Silent error handling (no error UI — acceptable for MVP). |
| Sidebar dynamic name/level | ✅ | `profile?.display_name \|\| "Player"`, `profile?.level ?? 1`. Fully wired. |
| Events API (GET/POST + RSVP) | ✅ | Tier-gated event creation (T1-T3). Zod validation. RSVP toggle. Well-structured. |
| Calendar page | ⚠️ | Queries Supabase directly (not via `/api/events`). Works but inconsistent with API pattern. Round 4 task to rewire. |
| GameWorld auth wiring | ✅ | `useUser()` → playerName/playerLevel props threaded through Scene → PlayerAvatar. |

### API Endpoint Audit — 22 Routes

| Route | Method | Status | Notes |
|-------|--------|--------|-------|
| `/api/profile` | GET/PATCH | 500 | Needs Supabase |
| `/api/profile/[id]` | GET | 500 | Needs Supabase |
| `/api/directory` | GET | 500 | Needs Supabase |
| `/api/bounties` | GET/POST | 500 | Needs Supabase |
| `/api/bounties/[id]` | GET/PATCH | 500 | Nested routes: claim, submit, review |
| `/api/leaderboard` | GET | 500 | Needs Supabase |
| `/api/jobs` | GET/POST | 500 | Needs Supabase |
| `/api/oracle/quiz` | GET | 500 | Returns 12 questions |
| `/api/oracle/result` | POST | 405 | POST-only — correct |
| `/api/onboarding` | GET/POST | 500 | Step-based flow |
| `/api/events` | GET/POST | 500 | New Round 3 |
| `/api/events/[id]/rsvp` | POST | — | RSVP toggle |
| `/api/achievements` | GET | 500 | Achievement system |
| `/api/achievements/[id]/award` | POST | — | Award achievement |
| `/api/inventory` | GET | 500 | Player inventory |
| `/api/economy` | POST | 500 | Coin transactions |
| `/api/quests` | GET | 500 | Quest system |
| `/api/quests/[id]/accept` | POST | — | Accept quest |
| `/api/quests/[id]/complete` | POST | — | Complete quest |
| `/api/an-token` | GET | 500 | Analytics token |
| **`/api/shop`** | **—** | **404** | **MISSING — no route file exists** |

### Lint

**Result: ❌ 39 errors, 53 warnings (down from 47 errors in Wave 9)**

Backend cleaned up 8 errors from Round 3.

| Pattern | Count | Owner |
|---------|-------|-------|
| setState in effect | 7 | Backend/Marketing |
| `no-explicit-any` | ~20 | Marketing/global.d.ts |
| Hook return mutation | 4 | Marketing (Lanyard.tsx) |
| `require()` imports | 3 | Frontend (convert script) |
| JSX comment text nodes | 3 | Marketing |
| Variable before declaration | 1 | Backend |
| Ref access during render | 1 | Marketing |

### Student Journey End-to-End Status

| Step | Status | Blocker |
|------|--------|---------|
| 1. Visit landing page | ✅ | — |
| 2. Navigate to signup | ✅ | — |
| 3. Create account | ⛔ | No Supabase credentials |
| 4. Complete onboarding (3-step) | ⛔ | No Supabase — PATCH /api/profile fails |
| 5. Take Oracle quiz (12 questions) | ⛔ | No Supabase — POST /api/oracle/result fails |
| 6. Get RPG class reveal | ⛔ | No Supabase — class not saved |
| 7. Explore game world | ✅ | Works without auth |
| 8. Visit bounty board | ✅ | Empty state (no Supabase) |
| 9. Visit shop | ✅ | Empty state (no API route) |
| 10. Visit leaderboard | ✅ | Empty state |
| 11. Visit jobs | ✅ | Empty state |
| 12. Visit settings | ✅ | Form renders, save fails without Supabase |
| 13. View profile | ⚠️ | HTTP 500 (no graceful fallback) |
| 14. View directory | ⚠️ | HTTP 500 (no graceful fallback) |

**Steps 3–6 require Supabase credentials to verify end-to-end.** All UI renders correctly with proper empty/error states except directory and profile (raw HTTP 500).

### Known Bugs (cumulative, prioritized)

#### Blocking (must fix before merge to main)

| # | Sev | Issue | Details |
|---|-----|-------|---------|
| 1 | **P1** | No `/api/shop` route | Shop page fetches from `/api/shop` which returns 404. Need route or remove fetch. |
| 2 | **P1** | Directory/Profile show raw "HTTP 500" | No graceful offline/error state. Users see bare error text. |

#### Non-Blocking (fix post-merge or in Round 4)

| # | Sev | Issue | Details |
|---|-----|-------|---------|
| 3 | P2 | FBX building files unused (651KB) | `public/assets/buildings/*.fbx` not loaded. Bloat. |
| 4 | P2 | No WebGL context loss handler | Canvas goes black on context loss. |
| 5 | P2 | Mobile sidebar z-index | drei `<Html>` labels bleed through sidebar overlay |
| 6 | P2 | Calendar queries Supabase directly | Should use `/api/events`. Round 4 task. |
| 7 | P2 | UserContext has no error UI | Silent fetch failure. User sees loading forever on API error. |
| 8 | P3 | 39 lint errors | Down from 53. Outside QA jurisdiction. |
| 9 | P3 | Font 404 (`TestSohne-Kraftig`) | Font file missing from repo |
| 10 | P3 | Middleware deprecation | Next.js 16 warns to use "proxy" convention |
| 11 | P3 | Player sprite dashed box in headless | Needs real browser verification |

---

## MERGE VERDICT: CONDITIONAL READY

**The student portal is READY to merge to main IF the 2 P1 blockers are fixed:**

1. **Add `/api/shop` route** — even a stub returning `{ products: [] }` is sufficient. The shop page already handles empty gracefully.
2. **Add error fallback to Directory and Profile pages** — replace raw "HTTP 500" with a user-friendly message like "Unable to load data. Check your connection."

**With those 2 fixes, the portal can ship.** All 36 pages build and render. The core student journey UI is complete (signup → onboard → quiz → class → explore → all features). 22 API routes exist and are well-structured. Auth middleware is in place. The only hard dependency is Supabase credentials in production.

**What works well:**
- 60 routes build cleanly
- Game world renders beautifully (Animal Crossing style)
- All 5 Round 2 pages functional
- Onboarding + Oracle quiz flows are clean with proper validation
- Auth context properly wired (sidebar, game world, player name/level)
- Events API well-structured with tier gating and Zod validation
- Mobile responsive works (hamburger menu, sidebar)

**What ships as tech debt:**
- 39 lint errors (marketing + legacy code)
- FBX files unused (651KB bloat)
- No WebGL crash recovery
- Calendar uses direct Supabase instead of API route
- Font 404

---

## Wave 9 — Post-Round 2 Lint Fixes + Full Visual Regression (2026-04-05)

No new agent commits since Wave 8. This wave: fix QA-jurisdiction lint errors, run full visual regression via Playwright, update error inventory.

### Build

**Result: ✅ PASSES — 58 routes (up from 52 in Wave 8)**

### Lint Fixes (QA jurisdiction)

**GameWorld.tsx — 6 errors fixed (impure `Math.random()` during render):**
- `River` sparkle geometry: replaced `Math.random()` with seeded PRNG (`seededRandom(42)`) inside `useMemo`
- `Butterflies` initial positions: replaced `Math.random()` with seeded PRNG (`seededRandom(99)`) inside `useMemo`
- React Compiler `react-hooks/purity` rule now satisfied — deterministic output on re-renders

**Building.tsx — 2 warnings fixed (unused imports):**
- Removed unused `useState` and `useRef` from import

**Lint totals: 53 → 47 errors, 50 → 48 warnings**

### Remaining 47 Lint Errors (outside QA jurisdiction)

| Pattern | Count | Where | Owner |
|---------|-------|-------|-------|
| `setState synchronously within an effect` | 15 | Backend dashboard/admin pages (12), CardCarouselLayout, GlassNavbar | Backend/Marketing |
| `no-explicit-any` | ~20 | global.d.ts (4), Lanyard (7+), various pages | Backend/Marketing |
| `Cannot call impure function` | 0 | ✅ ALL FIXED (was 6) | QA — done |
| `This value cannot be modified` | 4 | Lanyard.tsx (hook return mutations) | Marketing |
| `require()` imports | 3 | scripts/convert-fbx-to-glb.js | Frontend |
| `jsx-no-comment-textnodes` | 3 | MemberCard, TextRevealSection | Marketing |
| `Cannot access variable before declaration` | 1 | Backend page | Backend |
| `Cannot access refs during render` | 1 | CustomCursor or InteractivePylon3D | Marketing |

### Visual Browser Regression Test (Playwright)

**All 13 pages tested. Zero regressions from Wave 8.**

| Page | Status | Notes |
|------|--------|-------|
| `/student/dashboard` (game world) | ✅ | Buildings, terrain, trees, river, labels all render. Sidebar 8 items. |
| `/student/dashboard/bounty` | ✅ | Tabs (All/Available/My Claims/Completed), empty state |
| `/student/dashboard/leaderboard` | ✅ | Time tabs (Weekly/Monthly/All-Time), table headers, empty state |
| `/student/dashboard/shop` | ✅ | Category tabs (All/Apparel/Accessories/Digital/Merch), TSI balance, empty state |
| `/student/dashboard/jobs` | ✅ | Search bar, type filters, "Submit a Job" button, empty state |
| `/student/dashboard/settings` | ✅ | Profile section (name/bio/skills), Social Links (5 platforms), Save button |
| `/student/dashboard/directory` | ⚠️ | HTTP 500 — expected (no Supabase credentials) |
| `/student/dashboard/profile` | ⚠️ | HTTP 500 + "Go back" link — expected (no Supabase) |
| `/student/login` | ✅ | Terminal aesthetic, email/passphrase, "Initialize Session" |
| `/student/signup` | ✅ | Name/email/passphrase/confirm/invite code, "Request Access" |
| Mobile 375px — game world | ✅ | Hamburger menu visible, game fills viewport |
| Mobile 375px — sidebar open | ✅ | All 8 nav items, close (X) button, Home highlighted |
| Mobile 375px — sidebar close | ✅ | Tap X closes sidebar |

### Console Errors

| Error | Severity | Known? |
|-------|----------|--------|
| Font 404: `TestSohne-Kraftig` | P3 | Yes (Wave 7) |

No new console errors.

### Known Bugs (cumulative)

| Sev | Issue | Status |
|-----|-------|--------|
| **P2** | Directory/Profile show raw "HTTP 500" without Supabase | Open — needs graceful offline fallback |
| **P2** | FBX building files unused (651KB) | Open — delete or wire up |
| **P2** | No WebGL context loss handler | Open |
| **P2** | Mobile sidebar z-index — drei `<Html>` prompts bleed through | Open |
| **P3** | 47 lint errors | Reduced from 53 — remaining outside QA jurisdiction |
| **P3** | Font 404 (`TestSohne-Kraftig`) | Open |
| **P3** | Middleware deprecation warning | Open |
| **P3** | Player sprite shows as dashed box in headless Playwright | Open — needs real browser |

### Summary

All branches fully merged. No new commits pending from any agent. Build stable at 58 routes. Lint reduced to 47 errors (6 fixed this wave). All 5 Round 2 pages render correctly. Zero visual regressions across 13 pages tested including mobile. Waiting on other agents for further work.

---

## Wave 8 — Round 2 Integration (5 New Pages + New APIs + Nature Kit)

Merged 7 new commits: Frontend (5 pages + GLB buildings + nature kit + terrain + time-of-day), Backend (Oracle quiz + Jobs + Leaderboard + Achievements + Inventory + lint fixes), UXUI (settings spec + asset map + mobile spec).

### Build

**Result: ✅ PASSES — 52 routes, 6.9s compile**

### New Pages — All 5 Verified

| Page | HTTP | Content | Notes |
|------|------|---------|-------|
| `/student/dashboard/bounty` | 200 | ✅ Real content | Card grid, API-wired (no longer Coming Soon) |
| `/student/dashboard/leaderboard` | 200 | ✅ Real content | Ranked table (no longer Coming Soon) |
| `/student/dashboard/shop` | 200 | ✅ Real content | Product cards, category tabs (no longer Coming Soon) |
| `/student/dashboard/jobs` | 200 | ✅ Real content | Job cards, search/filter (no longer Coming Soon) |
| `/student/dashboard/settings` | 200 | ✅ Real content | Profile edit, social links (no longer Coming Soon) |

### New API Endpoints — All Respond

| Route | Method | Status | Notes |
|-------|--------|--------|-------|
| `/api/oracle/quiz` | GET | 500 | Returns questions (needs Supabase) |
| `/api/oracle/result` | POST | 405 | POST-only — correct |
| `/api/jobs` | GET | 500 | Job listings (needs Supabase) |
| `/api/leaderboard` | GET | 500 | Top N by XP (needs Supabase) |
| `/api/achievements` | GET | 500 | Achievement system (needs Supabase) |
| `/api/inventory` | GET | 500 | Player inventory (needs Supabase) |

### Regression Test — 25/25 Pass

All existing pages (marketing, auth, dashboard, admin) return HTTP 200. Zero regressions.

### Game World Enhancements (Frontend)

New features merged (not visually tested yet — Playwright session expired):
- Rolling hills terrain with vertex displacement
- Time-of-day cycle (real-time sky/lighting changes)
- GLB building models loaded with Suspense fallback to procedural
- Kenney Nature Kit GLB assets (trees, bushes, flowers, fences, mushrooms, stumps)
- Animated water with shader
- Ambient life (butterflies, chimney smoke)
- Player follows terrain height

### Lint

**Result: ❌ 53 errors, 50 warnings**

Up from 40 errors — Frontend's new pages added ~13 new errors:
- `require()` imports in nature model loader (3)
- `any` types in new pages (8)
- `setState` in effects (2)

### Merge Conflicts Resolved

3 conflicts in game components (Building.tsx, GameWorld.tsx, PlayerAvatar.tsx). Took Frontend's versions — they added GLB loading, terrain height, and nature model imports.

---

## Wave 7 — Full Integration + Visual Browser Test (All Branches Merged)

Merged ALL branches (backend API-wiring, frontend API-wiring, UXUI reviews) into QA. Resolved 3 merge conflicts (types.ts, MemberDirectory.tsx, ProfileView.tsx — took Frontend versions per file ownership). Ran build + lint + **first real browser testing via Playwright**.

### Build

**Result: ✅ PASSES — 55 pages (up from 51), 7.1s compile**

New routes: `/student/dashboard/directory/[id]` (dynamic profile page from Backend wiring).

### Lint

**Result: ❌ FAILS — 48 errors, 49 warnings across ~39 files**

Same patterns as Wave 6. No regressions from merge.

### Visual Browser Testing (Playwright — FIRST TIME)

This is the first time the game world has been **visually tested in a real browser**. All previous waves were HTTP-status + code-review only.

#### Game World ✅ Renders Correctly

| Feature | Status | Notes |
|---------|--------|-------|
| 3D Canvas rendering | ✅ | WebGL context initializes, R3F renders |
| Gradient sky | ✅ | Blue gradient, correct colors |
| Circular island terrain | ✅ | Green grass, dirt paths, dark edge ring |
| River + bridge | ✅ | Visible water, wooden bridge |
| Trees (4 types) | ✅ | Mix of cone and sphere trees, sway animation |
| Bushes + flowers | ✅ | Scattered around terrain, colorful |
| Clouds | ✅ | Animated in sky |
| Props (benches, fences, well, lampposts) | ✅ | All visible |
| Building labels | ✅ | White pill labels with dark text (HQ, House, Shop, Bounty Board) |
| Building proximity detection | ✅ | "Press E to enter" prompt appears when near HQ |
| Camera angle + follow | ✅ | Correct elevated perspective, follows player |
| WASD movement | ✅ | Player moves, camera follows |
| Sidebar navigation | ✅ | 8 items render correctly, "Soon" badges on Phase 2 items |
| Active nav highlighting | ✅ | Blue left accent on active item |

#### Buildings — Colors

| Building | Walls | Roof | Status |
|----------|-------|------|--------|
| HQ | Cream (#FFF5E1) | Coral (#E87B5A) | ✅ FIXED in this wave — was gray before |
| Shop | Mint (#D4EAD4) | Green (#5BA086) | ✅ FIXED |
| Oracle Temple | Lavender (#E8DCF0) | Purple (#7B5EA7) | ✅ FIXED |
| House | Sage (#C8E6C9) | Blue (#7EB8C9) | ✅ FIXED |

**Bug fixed:** `roofColor` was defined in GameWorld.tsx BUILDINGS config but never passed to Building component. ACBuilding was deriving roof color via `color * 0.55` (always gray). Added `roofColor` prop threading through Building → ACBuilding.

#### Player Avatar

| Feature | Status | Notes |
|---------|--------|-------|
| Billboard sprite | ⚠️ | Renders as dashed outline box in headless Playwright. Sprite file exists and serves HTTP 200. Likely headless WebGL texture limitation — needs real browser verification. |
| Nameplate ("Player Lv. 1") | ✅ | Renders correctly |
| WASD movement | ✅ | Position updates, camera follows |
| Click-to-move | Not tested | Playwright click goes to DOM, not raycaster |
| Sprite sheet animation | Not testable | Headless browser limitation |

#### Sidebar Navigation

| Item | Desktop | Mobile (375px) |
|------|---------|----------------|
| Player status (Lv. 1) | ✅ | ✅ |
| Home (active) | ✅ blue accent | ✅ |
| Directory | ✅ | ✅ |
| Bounty Board (Soon) | ✅ | ✅ |
| Shop (Soon) | ✅ | ✅ |
| Job Board (Soon) | ✅ | ✅ |
| Leaderboard (Soon) | ✅ | ✅ |
| Profile | ✅ | ✅ |
| Settings (Soon) | ✅ | ✅ |
| Hamburger button | N/A | ✅ visible |
| Slide-over menu | N/A | ✅ opens with X close |

#### All Pages — HTTP Status (34 pages tested)

**Result: ✅ ALL 34 pages return HTTP 200**

| Page | HTTP | Visual | Notes |
|------|------|--------|-------|
| `/student/dashboard` | 200 | ✅ | Game world renders with AC-style buildings, terrain, sky |
| `/student/dashboard/directory` | 200 | ⚠️ | Shows "HTTP 500" error from API — raw, not user-friendly |
| `/student/dashboard/profile` | 200 | ⚠️ | Shows "HTTP 500" + "Go back" link — same raw error |
| `/student/dashboard/bounty` | 200 | ✅ | Coming Soon placeholder with ASCII art |
| `/student/dashboard/shop` | 200 | ✅ | Coming Soon placeholder |
| `/student/dashboard/jobs` | 200 | ✅ | Coming Soon placeholder |
| `/student/dashboard/leaderboard` | 200 | ✅ | Coming Soon placeholder |
| `/student/dashboard/settings` | 200 | ✅ | Coming Soon placeholder |
| `/student/dashboard/calendar` | 200 | ✅ | Month/Week/List tabs, event category legend, "April 2026", "Loading events..." |
| `/student/dashboard/kanban` | 200 | ✅ | Renders (Backend page) |
| `/student/dashboard/marketplace` | 200 | ✅ | "Loading marketplace..." (waiting on Supabase) |
| `/student/dashboard/mentorship` | 200 | ✅ | Renders (Backend page) |
| `/student/dashboard/portfolio` | 200 | ✅ | Renders (Backend page) |
| `/student/dashboard/quests` | 200 | ✅ | "Loading quests..." (waiting on Supabase) |
| `/student/dashboard/tools` | 200 | ✅ | 2 tool cards: ASCII Converter, TETHOS RAG — both with "Launch →" |
| `/student/dashboard/tools/ascii` | 200 | ✅ | Renders |
| `/student/dashboard/tools/rag` | 200 | ✅ | Renders |
| `/student/dashboard/admin` | 200 | ✅ | "Access Denied — T1/T2 clearance required" — correct client-side tier gate |
| `/student/dashboard/admin/analytics` | 200 | ✅ | Renders |
| `/student/dashboard/admin/announcements` | 200 | ✅ | Renders |
| `/student/dashboard/admin/bounties` | 200 | ✅ | Renders |
| `/student/dashboard/admin/election` | 200 | ✅ | Renders |
| `/student/dashboard/admin/marketplace` | 200 | ✅ | Renders |
| `/student/dashboard/admin/members` | 200 | ✅ | Renders |
| `/student/dashboard/admin/quests` | 200 | ✅ | Renders |
| `/student/login` | 200 | ✅ | Terminal aesthetic, email + password, "INITIALIZE SESSION" button |
| `/student/signup` | 200 | ✅ | 5 fields (name, email, password, confirm, invite code), "REQUEST ACCESS" button |
| `/student/onboarding` | 200 | ✅ | ASCII art, XP/coin reward display, "ACCEPT QUEST" button, progress bar |
| `/student/election` | 200 | ⚠️ | Shows "Initializing election protocol..." spinner — should redirect to dashboard when ENABLE_ELECTION is off |
| `/` | 200 | ✅ | Marketing homepage |
| `/npo` | 200 | ✅ | NPO landing page |
| `/company` | 200 | ✅ | Company landing page |
| `/sponsor` | 200 | ✅ | Sponsor landing page |
| `/student` | 200 | ✅ | Student landing page |

#### Responsive Testing

| Viewport | Sidebar | Game World | Notes |
|----------|---------|------------|-------|
| 1280×900 (desktop) | ✅ 240px fixed | ✅ Full render | All elements visible |
| 768×1024 (tablet/breakpoint) | ✅ 240px fixed | ✅ Full render | Correct — sidebar shows at exactly 768px |
| 375×812 (mobile) | ✅ Hidden, hamburger | ✅ Full render | Hamburger opens slide-over with X close |
| **Z-index bug** | — | — | drei `<Html>` "Press E" prompt renders ON TOP of open mobile sidebar overlay |

#### Cross-Browser Testing

| Browser | Method | Status | Notes |
|---------|--------|--------|-------|
| Chromium | Playwright (headless) | ✅ | Full visual test — all features working |
| Firefox | — | ❌ NOT TESTED | Playwright defaults to Chromium only |
| Safari | — | ❌ NOT TESTED | Cannot test via Playwright; potential WebGL shadow perf concern (code analysis) |

**Limitation:** Playwright MCP runs Chromium only. Safari and Firefox require manual testing or WebKit/Gecko Playwright configs.

### Bugs Found This Wave

| Sev | Issue | Status | Details |
|-----|-------|--------|---------|
| **P1** | Building roofs all gray | ✅ FIXED | `roofColor` prop not threaded from GameWorld config to Building/ACBuilding. Fixed by adding prop. |
| **P2** | Mobile sidebar z-index | 🔴 Open | Game world "Press E" HTML prompts render ON TOP of the open mobile sidebar overlay. Html elements from drei need higher z-index management. |
| **P2** | Directory/Profile show raw "HTTP 500" | 🔴 Open | Without Supabase, users see bare "HTTP 500" text. Should show a friendly offline/demo message. Frontend error states exist (Loader2, error message) but the API fetch fails before component renders. |
| **P3** | Font 404 | 🔴 Open | `TestSohne-Kraftig-BF663d89cd32e6a.otf` returns 404. Missing font file in `/font/sohne-font-family/`. |
| **P3** | Player sprite invisible in headless | ⚠️ Needs verification | Sprite shows as dashed outline in Playwright. Asset serves HTTP 200. May be headless-only issue. Needs real browser test. |
| **P3** | Election page doesn't redirect | 🔴 Open | `/student/election` shows "Initializing election protocol..." spinner instead of redirecting to dashboard when `ENABLE_ELECTION` is not set. Middleware should catch this. |

### Previous Bugs Status

| Bug | Wave Found | Status |
|-----|-----------|--------|
| PS1Pipeline dead code | Wave 5 | ✅ Fixed in Wave 6 |
| Math.random() hydration | Wave 5 | ✅ Fixed in Wave 6 |
| FBX files unused (651KB) | Wave 5 | 🔴 Still open |
| No WebGL context loss handler | Wave 5 | 🔴 Still open |
| 48 lint errors | Wave 4 | ⬇️ Reduced to 40 — 8 game component errors fixed (Building.tsx ref-during-render, PlayerAvatar.tsx hook immutability). Remaining 40 are Backend/marketing — outside QA jurisdiction. |
| Middleware deprecation warning | Wave 4 | 🔴 Still open |
| POSITION_TIER_MAP discrepancy | Wave 4 | 🔴 Still open — never clarified |

### Console Errors

| Error | Severity | Notes |
|-------|----------|-------|
| `TestSohne-Kraftig...otf 404` | P3 | Missing font file |
| `/api/profile 500` | Expected | No Supabase credentials |
| `/api/directory 500` | Expected | No Supabase credentials |

---

## Wave 6 — Full Integration Test (v2 AC Visual Overhaul + Backend Phase 2)

Merged all branches: Frontend v2 AC visual overhaul, Backend onboarding + quest APIs, UXUI Sprint 2 specs. Full build + dev server + page testing.

### Build

**Result: ✅ PASSES — 51 pages (up from 49), 6.9s compile**

New routes: `/api/onboarding`, `/api/quests`, `/api/quests/[id]/accept`, `/api/quests/[id]/complete`

### Runtime — All 34 Pages HTTP 200 ✅

Every page tested via dev server (localhost:3001) — all return HTTP 200.

### Game World v2 — AC Visual Overhaul (Code Review)

The game world has been completely rewritten to match `specs/ux-game-world-v2.md`. Major improvements:

| Feature | v1 (Wave 5) | v2 (Wave 6) | Status |
|---------|-------------|-------------|--------|
| Sky | Flat `#87ceeb` | Gradient shader (skyTop→skyBottom) | ✅ |
| Terrain | 80x80 square plane | Circular island (r=40) with dark edge ring | ✅ |
| Grass | Single color | 4 colors (primary/secondary/highlight/shadow) with patches | ✅ |
| Materials | `meshLambertMaterial` | `meshStandardMaterial` with roughness/metalness | ✅ |
| River | Small pond only | Full-width river with animated water + bridge with rope railings | ✅ |
| Trees | 3 types, `Math.random()` scale | 4 types (deciduous/cluster/sapling/cedar), seeded scale, **gentle sway animation** via `useFrame` | ✅ Fixed |
| Bushes | None | 20 bushes, some with flower colors | ✅ NEW |
| Flowers | 6 clusters | 12 clusters with 7 colors, slight emissive glow | ✅ Enhanced |
| Props | Benches + lampposts + banners | + fences, well, log stumps, mushrooms | ✅ Enhanced |
| Clouds | None | 3 animated `<Cloud>` components from drei | ✅ NEW |
| Lighting | Ambient + directional | HemisphereLight + ambient + directional + fill + shadow-bias fix | ✅ Enhanced |
| Tone mapping | None | ACES Filmic + SRGB color space | ✅ NEW |
| Camera | FOV 40, polar π/4.5, dist 22 | FOV 50, polar π/3–π/3.3, dist 15 (closer, better angle) | ✅ Changed |
| Oracle Temple | At ground level | Elevated on 3-unit hill (cylinderGeometry) | ✅ Enhanced |
| Z-fighting | Yes (paths overlapped) | Fixed with `polygonOffset` on all layered planes | ✅ Fixed |

**Previous bugs now fixed:**
- ✅ `PS1Pipeline.tsx` deleted (was P2 dead code)
- ✅ `Math.random()` in Trees replaced with seeded deterministic values (`seed % 5`)
- ✅ `onCreated` handler added to Canvas (tone mapping + color space)

### Building Rendering (v2)

| Building | Position | Color | Roof | Details |
|----------|----------|-------|------|---------|
| HQ | (0, 0, -4) | #FFF5E1 (cream) | #E87B5A (coral) | Chimney, oversized door, arched windows with glow |
| Shop | (-14, 0, 8) | #D4EAD4 (mint) | #5BA086 (green) | Same AC style |
| Oracle Temple | (0, 3, 22) | #E8DCF0 (lavender) | #7B5EA7 (purple) | On elevated hill |
| House | (14, 0, 10) | #C8E6C9 (sage) | #7EB8C9 (blue) | Cozy residential |
| Bounty Board | (10, 0, 8) | dirt path color | N/A | Board sign style |
| Job Board | (-10, 0, -10) | dirt path color | N/A | Board sign style |
| Leaderboard | (10, 0, -10) | well stone | N/A | Pillar style |

All buildings have: door frame (#6B4226), door (#8B5E3C), window frames (#FFFFFF), glass (#B8E4F0 with warm emissive).

### Player / Interaction

- ✅ PlayerAvatar: 2D Billboard sprite, WASD+click-to-move, 5 units/sec, ±38 boundary
- ✅ Building proximity: 4-unit range, "Press E to enter/view" bounce prompt
- ✅ Transition: fade-to-black for buildings, direct nav for boards
- ✅ Camera follow: `CameraControls.moveTo()` on player move

### Sidebar Navigation ✅

SSR verified all 8 nav items render with correct text: Player/Lv.1, Home (active), Directory, Bounty Board (Soon), Shop (Soon), Job Board (Soon), Leaderboard (Soon), Profile, Settings (Soon)

### API Routes

| Route | Method | Status |
|-------|--------|--------|
| `GET /api/directory` | GET | 500 (no Supabase) |
| `GET/PATCH /api/profile` | GET/PATCH | 500 |
| `GET /api/profile/[id]` | GET | 500 |
| `GET/POST /api/bounties` | GET/POST | 500 |
| `GET/PATCH/DELETE /api/bounties/[id]` | Various | 500 |
| `POST /api/bounties/[id]/claim` | POST | 500 |
| `POST /api/bounties/[id]/submit` | POST | 500 |
| `PATCH /api/bounties/[id]/review` | PATCH | 500 |
| `GET/POST /api/economy` | GET/POST | 500 |
| `GET/PATCH /api/onboarding` | GET/PATCH | 500 NEW |
| `GET/POST /api/quests` | GET/POST | 500 NEW |
| `POST /api/quests/[id]/accept` | POST | 500 NEW |
| `POST /api/quests/[id]/complete` | POST | 500 NEW |

All return 500 — expected without `.env.local` Supabase credentials. 16 API endpoints total.

### Lint

**Result: ❌ FAILS — 48 errors, 46 warnings**

Slight improvement from Wave 5 (was 51 errors, 48 warnings). PS1Pipeline errors gone.

Remaining top error patterns:
1. ~15 `fetchX` before declaration (Backend dashboard pages)
2. ~8 ref/value mutations (PlayerAvatar, Building, InteractivePylon3D, CustomCursor)
3. ~8 `no-explicit-any` (Lanyard, GlassNavbar)
4. ~3 setState in effect (CardCarouselLayout, GlassNavbar)
5. ~3 JSX comment text nodes

### Remaining Bugs

| Sev | Issue | File | Status |
|-----|-------|------|--------|
| ~~P2~~ | ~~PS1Pipeline.tsx dead code~~ | Deleted | ✅ FIXED |
| ~~P3~~ | ~~Math.random() hydration~~ | Trees now seeded | ✅ FIXED |
| **P2** | FBX building files unused | `public/assets/buildings/*.fbx` (651KB) | Still present, unused |
| **P2** | No WebGL context loss handler | `GameWorld.tsx` | `onCreated` added for tone mapping but no context loss recovery |
| **P3** | 48 lint errors | Various | Mostly Backend `fetchX` pattern + Frontend ref mutations |
| **P3** | Middleware deprecation | `web/middleware.ts` | Still using deprecated convention |
| **P3** | API routes all 500 | All `/api/*` | Need `.env.local` with Supabase credentials |

---

## Wave 5 — Full Runtime Test (test-merge, all branches combined)

Merged all branches (Backend + Frontend + MGMT fixes + Animal Crossing style overhaul). Ran build, started dev server, tested every page via HTTP, inspected rendered HTML, verified game assets, tested API routes.

### Build Report

**Result: ✅ BUILD PASSES — 49 pages, 6.0s compile**

No TypeScript errors. All pages generate successfully.

### Dev Server Runtime Test

**All 34 testable pages return HTTP 200:**

| Category | Pages | HTTP Status |
|----------|-------|-------------|
| Marketing (5) | `/`, `/npo`, `/company`, `/sponsor`, `/student` | ✅ 200 |
| Auth (4) | `/student/login`, `/signup`, `/election`, `/onboarding` | ✅ 200 |
| Dashboard (17) | `/student/dashboard`, `/directory`, `/bounty`, `/jobs`, `/leaderboard`, `/profile`, `/shop`, `/settings`, `/calendar`, `/kanban`, `/marketplace`, `/mentorship`, `/portfolio`, `/quests`, `/tools`, `/tools/ascii`, `/tools/rag` | ✅ 200 |
| Admin (8) | `/student/dashboard/admin`, `/analytics`, `/announcements`, `/bounties`, `/election`, `/marketplace`, `/members`, `/quests` | ✅ 200 |

### Game World Testing

**Verified via SSR HTML inspection + code review:**

#### Sidebar Navigation ✅
- **8 nav items rendered** in SSR: Home (active, blue left accent), Directory, Bounty Board (Soon), Shop (Soon), Job Board (Soon), Leaderboard (Soon), Profile, Settings (Soon)
- Each item has Lucide icon (House, Users, Scroll, ShoppingBag, Briefcase, Trophy, User, Settings)
- "Soon" badges on Phase 2 items
- Player status at top: "Player" / "Lv. 1"
- Links verified: all point to correct `/student/dashboard/*` paths
- **Mobile hamburger**: `<Menu>` icon at top-left, hidden on md+ breakpoint, slide-in overlay with backdrop

#### Game World Canvas ✅
- `<Canvas>` element renders via `next/dynamic` with `ssr: false` — correctly bails out to client-side rendering
- SSR fallback shows "LOADING WORLD..." ASCII art loading screen
- `data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"` — expected behavior for R3F

#### Game World Components (code review)
| Component | Status | Details |
|-----------|--------|---------|
| `GameWorld.tsx` | ✅ | Animal Crossing style — sky blue bg (#87ceeb), 80x80 grass plane, cobblestone paths, pond, flowers, benches, lampposts, banners, 16 trees (3 types) |
| `PlayerAvatar.tsx` | ✅ | 2D Billboard sprite, WASD+arrow movement (5 units/sec), click-to-move via raycasting, frame cycling at 6 FPS, nameplate via `<Html>` |
| `Building.tsx` | ✅ | 7 buildings — ACBuilding (box+cone roof+door+windows) or BoardSign (posts+board). Proximity detection (4 units). "Press E to enter/view" prompt with bounce animation |
| `TransitionOverlay.tsx` | ✅ | Fade-to-black (0.3s in, 0.2s hold, 0.3s out). State machine: idle→fading-in→black→fading-out→idle |
| `PS1Pipeline.tsx` | ⚠️ Exists but may be unused | Animal Crossing overhaul removed PS1 filter. File still in repo but GameWorld.tsx no longer imports it |

#### Character Movement (code review)
- WASD/Arrow keys: handled in `useFrame` loop, updates position at 5 units/sec
- Boundary clamping: ±38 units
- Click-to-move: raycast on ground plane, pathfind to click point
- Direction-based sprite selection: down (row 0-1), left (row 2-3), right (row 4-5), up (row 6-7)
- Camera follows player via `CameraControls.moveTo()`

#### Building Interaction (code review)
- Proximity: `distanceTo(playerPosition) < 4` triggers "Press E" prompt
- E key handler: boards → direct `router.push(href)`, buildings → fade-to-black then navigate
- 7 buildings placed: HQ (center), Shop (-14,0,10), Oracle (0,0,22), House (14,0,14), Bounty Board (10,0,-2), Job Board (-10,0,-10), Leaderboard (10,0,-10)
- Buildings with `href`: Shop→`/shop`, Bounty→`/bounty`, Jobs→`/jobs`, Leaderboard→`/leaderboard`
- Buildings without `href` (HQ, Oracle, House): E key does nothing — expected for Phase 2

### Auth Pages Testing

#### Login Page ✅
- ASCII art header (TETHOS banner)
- Terminal-style UI: "tethos://auth/login"
- Fields: "Agent Email" (email), "Passphrase" (password)
- "Initialize Session" submit button
- "New agent? Request Access" → link to signup
- "Back to Student Home" → link back

#### Signup Page ✅
- Fields: display name (text), email, password, confirm password
- **Invite code field** with placeholder "TETHOS-XXXX"
- Submit button present
- Invite code `TETHOS-W26` seeded in DB migrations

### API Routes Testing

**All 4 API endpoints return HTTP 500** — expected since no Supabase env vars configured.

| Route | Status | Expected |
|-------|--------|----------|
| `GET /api/directory` | 500 | Missing `NEXT_PUBLIC_SUPABASE_URL` |
| `GET /api/profile` | 500 | Missing `NEXT_PUBLIC_SUPABASE_URL` |
| `GET /api/bounties` | 500 | Missing `NEXT_PUBLIC_SUPABASE_URL` |
| `GET /api/economy` | 500 | Missing `NEXT_PUBLIC_SUPABASE_URL` |

**Note:** The middleware gracefully handles missing env vars — when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are not set, it passes through without auth checks. This means dashboard pages load without login in dev mode.

### Static Assets

| Asset | Path | HTTP | Size |
|-------|------|------|------|
| Character sprite | `/assets/characters/prototype_character.png` | ✅ 200 | 3.3KB |
| Character shadow | `/assets/characters/static_shadow.png` | ✅ 200 | 5.1KB |
| Blue variant | `/assets/characters/prototype_character_blue.png` | ✅ | 3.3KB |
| Green variant | `/assets/characters/prototype_character_green.png` | ✅ | 3.4KB |
| Red variant | `/assets/characters/prototype_character_red.png` | ✅ | 3.3KB |
| Yellow variant | `/assets/characters/prototype_character_yellow.png` | ✅ | 3.3KB |
| Shadow sprite | `/assets/characters/prototype_character_shadow.png` | ✅ | 514B |
| HQ building | `/assets/buildings/hq.fbx` | ✅ | 165KB |
| Shop building | `/assets/buildings/shop.fbx` | ✅ | 166KB |
| Oracle temple | `/assets/buildings/oracle_temple.fbx` | ✅ | 208KB |
| House | `/assets/buildings/house_1.fbx` | ✅ | 112KB |

**Note:** Building FBX files exist but `Building.tsx` uses placeholder geometry (ACBuilding/BoardSign), not FBX loading. The FBX files are unused currently.

### Cross-Browser Compatibility (Code Analysis)

Cannot launch actual browser instances (Chrome/Safari/Firefox), but analyzed code for compatibility:

| Feature | Chrome | Safari | Firefox | Notes |
|---------|--------|--------|---------|-------|
| WebGL2 (R3F/Three.js) | ✅ | ✅ | ✅ | All modern versions support WebGL2 |
| CSS `inset: 0` | ✅ | ✅ 14.1+ | ✅ | Used in layout — needs Safari 14.1+ |
| CSS `gap` in flex | ✅ | ✅ 14.1+ | ✅ | Used in sidebar |
| `KeyboardEvent.key` | ✅ | ✅ | ✅ | Used for WASD/E detection |
| `pointer-events` | ✅ | ✅ | ✅ | Used on HTML overlays |
| CSS custom properties | ✅ | ✅ | ✅ | Used extensively |
| `next/dynamic` CSR | ✅ | ✅ | ✅ | Standard Next.js pattern |
| `@react-three/fiber` | ✅ | ⚠️ | ✅ | Safari WebGL can be slower, especially with shadows |
| `style jsx` | ✅ | ✅ | ✅ | Compiled by Next.js |

**Safari concerns:**
- Shadow mapping (`shadow-mapSize` 2048x2048) may cause performance issues on older iOS/Safari
- `CameraControls` touch events should work but haven't been tested
- WebGL context loss more common on Safari — no recovery handler in GameWorld

**Firefox concerns:**
- None identified. All APIs used are well-supported.

### Lint Report

**Result: ❌ FAILS — 51 errors, 48 warnings**

Error breakdown unchanged from Wave 4.1 — see that section below for details.

### Directory Page ✅
- "Search members" input field present
- Tier filter pills rendered (7 instances of "Tier" text in SSR)
- Uses mock data (9 members) since no Supabase connection

### Profile Page ✅
- "Profile", "Edit Profile" button, Level, XP, Skills, Social Links sections all render in SSR

### Bugs & Issues Found

| Severity | Issue | File | Details |
|----------|-------|------|---------|
| **P1** | API routes return 500 without Supabase | All `/api/*` routes | Need `.env.local` with Supabase credentials. Expected in dev but blocks runtime auth testing. |
| **P2** | PS1Pipeline.tsx possibly dead code | `components/game/PS1Pipeline.tsx` | Animal Crossing overhaul removed PS1 filter. GameWorld no longer imports it. Consider deleting. |
| **P2** | FBX building assets unused | `public/assets/buildings/*.fbx` | 4 FBX files (651KB total) ship to client but Building.tsx uses placeholder geometry. Delete or wire up. |
| **P2** | No WebGL context loss handler | `GameWorld.tsx` | If WebGL context is lost (common on Safari/mobile), the canvas will go black with no recovery. Add `onCreated` handler. |
| **P3** | 51 lint errors | Various | ~15 `fetchX` before declaration, ~10 ref mutations, ~10 `any` types. See lint section. |
| **P3** | Middleware deprecation | `web/middleware.ts` | Next.js 16 warns: use "proxy" instead of "middleware" |
| **P3** | `Math.random()` in render | `GameWorld.tsx:177` | `Trees()` uses `Math.random()` for scale — causes hydration mismatch warnings. Use seeded random or stable values. |
| **P3** | Missing `aria-selected` | `MemberCard.tsx:33` | Element with `role="option"` needs `aria-selected` attribute |

---

## Wave 4.1 — Full Combined Retest (Backend + Frontend + Phase 2 APIs)

### Build Report

**Result: ✅ BUILD PASSES — 49 pages**

All Frontend game world + Backend dashboard + Phase 2 API routes compile cleanly.

| Category | Count | Status |
|----------|-------|--------|
| Marketing pages | 5 | ✅ Static |
| Auth pages (login/signup/onboarding/election) | 4 | ✅ Static |
| Dashboard pages (regular) | 18 | ✅ Static |
| Dashboard pages (admin) | 8 | ✅ Static |
| API routes | 10 | ✅ Dynamic |
| Dev/test pages | 4 | ✅ Static |

**New API routes (Phase 2):**
- `POST/GET /api/bounties` — list + create
- `GET/PATCH/DELETE /api/bounties/[id]` — detail + update + delete
- `POST /api/bounties/[id]/claim` — claim bounty
- `POST /api/bounties/[id]/submit` — submit deliverables
- `PATCH /api/bounties/[id]/review` — review submission
- `GET/POST /api/economy` — balance/transactions + purchase/award

### Lint Report

**Result: ❌ FAILS — 50 errors, 48 warnings across 39 files**

#### Errors by category

| Error Type | Count | Files Affected |
|-----------|-------|----------------|
| `fetchX` before declaration (`react-hooks/immutability`) | ~15 | Backend admin + dashboard pages |
| Ref access during render (`react-hooks/immutability`) | 3 | Building.tsx, AsciiGlobe, GlobeVisualizer |
| Value modification (`react-hooks/immutability`) | ~10 | PlayerAvatar.tsx, InteractivePylon3D, CustomCursor |
| setState in effect (`react-hooks/set-state-in-effect`) | 3 | CardCarouselLayout, GlassNavbar, marketplace |
| JSX comment text nodes (`react/jsx-no-comment-textnodes`) | 3 | MemberCard, TextRevealSection |
| `no-explicit-any` | ~10 | Lanyard, GlassNavbar, etc. |
| Misc | ~6 | Various |

#### NEW Frontend game world errors

| File | Line | Error |
|------|------|-------|
| `components/game/Building.tsx:112` | Ref access during render | `react-hooks/immutability` |
| `components/game/Building.tsx:98` | Unused `id` | `@typescript-eslint/no-unused-vars` |
| `components/game/PlayerAvatar.tsx:68-76` | Modifying values (position, velocity refs) | `react-hooks/immutability` |
| `components/portal/MemberCard.tsx:33` | Missing `aria-selected` on role="option" | `jsx-a11y/role-has-required-aria-props` |

### Merge Conflict Resolution

Resolved 7 conflicts between Backend and Frontend dashboard pages. **Took Frontend's versions** per file ownership (Frontend owns `web/app/student/dashboard/`). Backend's versions of bounty, directory, jobs, leaderboard, profile pages replaced by Frontend's spec-aligned implementations with game world integration.

Backend's admin pages and pages Frontend didn't build (calendar, kanban, marketplace, mentorship, portfolio, quests, tools) were preserved from Backend.

---

## Wave 4 — Post-Backend Merge Full Retest

### Build Report (`npm run build`)

**Result: ✅ BUILD PASSES**

- Next.js 16.1.6 (Turbopack)
- Compiled successfully in 9.0s
- TypeScript check: passed
- Pages generated: **45** (up from 14 in Wave 1)
- New warning: `"middleware" file convention is deprecated. Please use "proxy" instead.`

**All routes:**
| Route | Type | Status |
|-------|------|--------|
| `/` | Static | ✅ |
| `/_not-found` | Static | ✅ |
| `/api/an-token` | Dynamic | ✅ |
| `/api/directory` | Dynamic | ✅ NEW |
| `/api/profile` | Dynamic | ✅ NEW |
| `/api/profile/[id]` | Dynamic | ✅ NEW |
| `/company` | Static | ✅ |
| `/globe-demo` | Static | ✅ |
| `/globe-test` | Static | ✅ |
| `/navbar-test` | Static | ✅ |
| `/npo` | Static | ✅ |
| `/npo/test` | Static | ✅ NEW |
| `/pylon-demo` | Static | ✅ |
| `/sponsor` | Static | ✅ |
| `/student` | Static | ✅ |
| `/student/auth/callback` | Dynamic | ✅ NEW |
| `/student/dashboard` | Dynamic | ✅ NEW |
| `/student/dashboard/admin` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/analytics` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/announcements` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/bounties` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/election` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/marketplace` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/members` | Dynamic | ✅ NEW |
| `/student/dashboard/admin/quests` | Dynamic | ✅ NEW |
| `/student/dashboard/bounty` | Dynamic | ✅ NEW |
| `/student/dashboard/calendar` | Dynamic | ✅ NEW |
| `/student/dashboard/directory` | Dynamic | ✅ NEW |
| `/student/dashboard/jobs` | Dynamic | ✅ NEW |
| `/student/dashboard/kanban` | Dynamic | ✅ NEW |
| `/student/dashboard/leaderboard` | Dynamic | ✅ NEW |
| `/student/dashboard/marketplace` | Dynamic | ✅ NEW |
| `/student/dashboard/mentorship` | Dynamic | ✅ NEW |
| `/student/dashboard/portfolio` | Dynamic | ✅ NEW |
| `/student/dashboard/profile` | Dynamic | ✅ NEW |
| `/student/dashboard/quests` | Dynamic | ✅ NEW |
| `/student/dashboard/tools` | Dynamic | ✅ NEW |
| `/student/dashboard/tools/ascii` | Dynamic | ✅ NEW |
| `/student/dashboard/tools/rag` | Dynamic | ✅ NEW |
| `/student/election` | Static | ✅ NEW |
| `/student/login` | Static | ✅ NEW |
| `/student/onboarding` | Static | ✅ NEW |
| `/student/signup` | Static | ✅ NEW |
| `/under-construction` | Static | ✅ |

**Dashboard pages: 23 total** (15 regular + 8 admin)

---

### Lint Report (`npm run lint`)

**Result: ❌ LINT FAILS (exit code 1)**

#### NEW errors from Backend's dashboard pages

| File | Error | Rule |
|------|-------|------|
| `student/dashboard/admin/announcements/page.tsx:31` | `fetchAnnouncements` accessed before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/bounties/page.tsx:5` | Unused import `Check` | `@typescript-eslint/no-unused-vars` |
| `student/dashboard/bounty/page.tsx` | Multiple `fetchX` before declaration errors | `react-hooks/immutability` |
| `student/dashboard/calendar/page.tsx` | `fetchEvents` before declaration | `react-hooks/immutability` |
| `student/dashboard/directory/page.tsx` | `fetchMembers` before declaration | `react-hooks/immutability` |
| `student/dashboard/jobs/page.tsx` | `fetchJobs` before declaration | `react-hooks/immutability` |
| `student/dashboard/kanban/page.tsx` | `fetchBoard` before declaration | `react-hooks/immutability` |
| `student/dashboard/leaderboard/page.tsx` | `fetchLeaderboard` before declaration | `react-hooks/immutability` |
| `student/dashboard/marketplace/page.tsx` | `fetchItems` before declaration | `react-hooks/immutability` |
| `student/dashboard/mentorship/page.tsx` | `fetchMentors` before declaration | `react-hooks/immutability` |
| `student/dashboard/portfolio/page.tsx` | `fetchPortfolio` before declaration | `react-hooks/immutability` |
| `student/dashboard/profile/page.tsx` | `fetchProfile` before declaration | `react-hooks/immutability` |
| `student/dashboard/quests/page.tsx` | `fetchQuests` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/analytics/page.tsx:53` | Unused `tcSpent` | `@typescript-eslint/no-unused-vars` |
| `student/dashboard/admin/members/page.tsx` | `fetchMembers` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/quests/page.tsx` | `fetchQuests` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/marketplace/page.tsx` | `fetchItems` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/bounties/page.tsx` | `fetchBounties` before declaration | `react-hooks/immutability` |
| `student/dashboard/admin/announcements/page.tsx` | `fetchAnnouncements` before declaration | `react-hooks/immutability` |

**Pattern:** Nearly ALL dashboard pages use `useEffect(() => { fetchX(); }, [])` with `fetchX` declared AFTER the effect. The function hoisting works at runtime but the React hooks linter flags it as accessing a variable before declaration.

**Fix:** Move each `async function fetchX()` declaration ABOVE the `useEffect` that calls it, or wrap in `useCallback`.

#### Pre-existing errors (from Wave 1)

| File | Error | Rule |
|------|-------|------|
| `components/cards/CardCarouselLayout.tsx:30` | setState in effect | `react-hooks/set-state-in-effect` |
| `components/layout/GlassNavbar.tsx:213` | setState in effect | `react-hooks/set-state-in-effect` |
| `components/ui/InteractivePylon3D.tsx:85` | Modifying hook return value | `react-hooks/immutability` |
| `components/ui/Lanyard.tsx` | 7x `any` types | `@typescript-eslint/no-explicit-any` |

#### Warnings (~35 total)

Mostly `@typescript-eslint/no-unused-vars` across marketing pages and dashboard widgets. See lint output for full list. Key new ones:
- `components/dashboard/widgets/AnnouncementWidget.tsx:3` — unused `Link`
- `components/dashboard/widgets/CalendarWidget.tsx:25` — unused `formatDate`
- `app/npo/test/page.tsx:621` — missing dep `data` in useEffect
- `app/npo/sections/NPOAbout.tsx:120` — `<img>` should be `<Image />`

---

### Marketing Pages

**Result: ✅ ALL 5 PASS**

| Page | Route | Build Status |
|------|-------|-------------|
| Home | `/` | ✅ Static |
| NPO | `/npo` | ✅ Static |
| Company | `/company` | ✅ Static |
| Sponsor | `/sponsor` | ✅ Static |
| Student | `/student` | ✅ Static |

---

### Auth Flow Testing (Code Review)

**Result: ✅ Auth infrastructure NOW EXISTS (after Backend merge)**

Cannot do runtime testing without Supabase credentials, but code review confirms:

#### Files present
| File | Status |
|------|--------|
| `web/lib/supabase/client.ts` | ✅ Browser client helper |
| `web/lib/supabase/server.ts` | ✅ Server client helper |
| `web/lib/supabase/middleware.ts` | ✅ Route protection (162 lines) |
| `web/lib/supabase/types.ts` | ✅ Full type system (301 lines) |
| `web/middleware.ts` | ✅ Next.js middleware entry point |
| `web/app/student/signup/page.tsx` | ✅ Signup page (343 lines) |
| `web/app/student/login/page.tsx` | ✅ Login page (232 lines) |
| `web/app/student/auth/callback/route.ts` | ✅ Auth callback handler |
| `web/app/student/onboarding/page.tsx` | ✅ Onboarding flow (750 lines) |
| `web/app/student/election/page.tsx` | ✅ Election page (601 lines) |

#### Middleware routing logic (verified via code review)

| Route | Condition | Action |
|-------|-----------|--------|
| `/student/election` | `ENABLE_ELECTION !== 'true'` | Redirect to `/student/dashboard` |
| `/student/election` | `ENABLE_ELECTION === 'true'` + no auth | Redirect to `/student/login` |
| `/student/dashboard/admin/election` | `ENABLE_ELECTION !== 'true'` | Redirect to `/student/dashboard` |
| `/student/dashboard/admin/election` | Auth + T3+ | Redirect to `/student/dashboard` (T1/T2 only) |
| `/student/dashboard/admin/*` | No auth | Redirect to `/student/login` |
| `/student/dashboard/admin/*` | Auth + T4/T5 | Redirect to `/student/dashboard` |
| `/student/dashboard/*` | No auth | Redirect to `/student/login` |
| `/student/dashboard/*` | Auth + `!onboarding_completed` | Redirect to `/student/onboarding` |
| `/student/onboarding` | No auth | Redirect to `/student/login` |
| `/student/onboarding` | Auth + `onboarding_completed` | Redirect to `/student/dashboard` |
| `/student/login` or `/student/signup` | Logged in | Redirect to `/student/dashboard` |

**Middleware matcher covers:** `/student/dashboard/:path*`, `/student/login`, `/student/signup`, `/student/onboarding/:path*`, `/student/election`

#### Invite code
- `TETHOS-W26` seeded in migration `001_initial_schema.sql` line 658 as active invite code for term `W2026`

---

### Dashboard Pages Inventory (23 pages)

#### Regular dashboard (15 pages)
| Page | Route | File exists | Builds |
|------|-------|------------|--------|
| Home | `/student/dashboard` | ✅ | ✅ |
| Directory | `/student/dashboard/directory` | ✅ | ✅ |
| Bounty Board | `/student/dashboard/bounty` | ✅ | ✅ |
| Calendar | `/student/dashboard/calendar` | ✅ | ✅ |
| Jobs | `/student/dashboard/jobs` | ✅ | ✅ |
| Kanban | `/student/dashboard/kanban` | ✅ | ✅ |
| Leaderboard | `/student/dashboard/leaderboard` | ✅ | ✅ |
| Marketplace | `/student/dashboard/marketplace` | ✅ | ✅ |
| Mentorship | `/student/dashboard/mentorship` | ✅ | ✅ |
| Portfolio | `/student/dashboard/portfolio` | ✅ | ✅ |
| Profile | `/student/dashboard/profile` | ✅ | ✅ |
| Quests | `/student/dashboard/quests` | ✅ | ✅ |
| Tools | `/student/dashboard/tools` | ✅ | ✅ |
| Tools > ASCII | `/student/dashboard/tools/ascii` | ✅ | ✅ |
| Tools > RAG | `/student/dashboard/tools/rag` | ✅ | ✅ |

#### Admin dashboard (8 pages)
| Page | Route | File exists | Builds |
|------|-------|------------|--------|
| Admin Home | `/student/dashboard/admin` | ✅ | ✅ |
| Analytics | `/student/dashboard/admin/analytics` | ✅ | ✅ |
| Announcements | `/student/dashboard/admin/announcements` | ✅ | ✅ |
| Bounties | `/student/dashboard/admin/bounties` | ✅ | ✅ |
| Election | `/student/dashboard/admin/election` | ✅ | ✅ |
| Marketplace | `/student/dashboard/admin/marketplace` | ✅ | ✅ |
| Members | `/student/dashboard/admin/members` | ✅ | ✅ |
| Quests | `/student/dashboard/admin/quests` | ✅ | ✅ |

---

### Profiles Table Schema (FULL documentation)

#### From `001_initial_schema.sql` — profiles table

| Column | Type | Default | Nullable | Constraint |
|--------|------|---------|----------|------------|
| `id` | UUID | — | NOT NULL | PK, FK → auth.users(id) ON DELETE CASCADE |
| `email` | TEXT | — | NOT NULL | — |
| `display_name` | TEXT | — | NOT NULL | — |
| `tier` | INTEGER | 4 | NOT NULL | CHECK (1-4), upgraded to 1-5 in 004 |
| `position` | TEXT | NULL | YES | — |
| `class` | TEXT | NULL | YES | — |
| `subclass` | TEXT | NULL | YES | — |
| `team_id` | UUID | NULL | YES | FK → teams(id) |
| `portfolio` | TEXT | NULL | YES | — |
| `side` | TEXT | NULL | YES | — |
| `xp` | INTEGER | 0 | NOT NULL | — |
| `level` | INTEGER | 1 | NOT NULL | — |
| `rank` | TEXT | 'Initiate' | NOT NULL | — |
| `tethos_coins` | INTEGER | 0 | NOT NULL | — |
| `onboarding_completed` | BOOLEAN | FALSE | NOT NULL | — |
| `onboarding_step` | INTEGER | 0 | NOT NULL | — |
| `has_voted` | BOOLEAN | FALSE | YES | Added in 002 |
| `year` | TEXT | NULL | YES | — |
| `program` | TEXT | NULL | YES | — |
| `hometown` | TEXT | NULL | YES | — |
| `birthday` | DATE | NULL | YES | — |
| `phone` | TEXT | NULL | YES | — |
| `preferred_email` | TEXT | NULL | YES | — |
| `uwo_email` | TEXT | NULL | YES | — |
| `gdrive_email` | TEXT | NULL | YES | — |
| `github_username` | TEXT | NULL | YES | — |
| `instagram` | TEXT | NULL | YES | — |
| `linkedin` | TEXT | NULL | YES | — |
| `discord_tag` | TEXT | NULL | YES | — |
| `favourite_music` | TEXT | NULL | YES | — |
| `dream_retirement` | TEXT | NULL | YES | — |
| `spirit_animal` | TEXT | NULL | YES | — |
| `fun_fact` | TEXT | NULL | YES | — |
| `avatar_url` | TEXT | NULL | YES | — |
| `bio` | TEXT | NULL | YES | — |
| `active_theme` | TEXT | 'dark' | NOT NULL | — |
| `is_alumni` | BOOLEAN | FALSE | NOT NULL | — |
| `is_active` | BOOLEAN | TRUE | NOT NULL | — |
| `created_at` | TIMESTAMPTZ | NOW() | NOT NULL | — |
| `updated_at` | TIMESTAMPTZ | NOW() | NOT NULL | — |
| `last_login_at` | TIMESTAMPTZ | NULL | YES | — |
| `login_streak` | INTEGER | 0 | NOT NULL | — |
| `avatar_config` | JSONB | '{}' | NOT NULL | Added in 004 |
| `skills` | TEXT[] | '{}' | NOT NULL | Added in 004 |
| `social_links` | JSONB | '{}' | NOT NULL | Added in 004 |

**Total: 42 columns** (39 from 001, +1 from 002, +3 from 004)

#### Indexes (from 004)
- `idx_profiles_tier` — on `tier`
- `idx_profiles_is_active` — on `is_active`
- `idx_profiles_display_name` — on `display_name`
- `idx_profiles_level` — on `level`
- `idx_profiles_position` — on `position`
- `idx_profiles_class` — on `class`
- `idx_profiles_display_name_trgm` — GIN trigram on `display_name` (requires pg_trgm)

#### RLS Policies
- `SELECT`: authenticated users can read all profiles
- `UPDATE`: users can update own profile only (auth.uid() = id)
- `INSERT`: users can insert own profile (auth.uid() = id)

#### Auto-profile creation (003)
- Trigger `on_auth_user_created` fires after `INSERT ON auth.users`
- Creates profile with: `id`, `email`, `display_name` (from metadata or email prefix)

---

### All Migrations Summary

| Migration | Contents |
|-----------|----------|
| `001_initial_schema.sql` | 30 tables, RLS policies, seed data (themes, achievements, invite code TETHOS-W26) |
| `002_election_votes.sql` | `election_votes` table, `has_voted` column on profiles, `get_election_results()` function |
| `003_profile_trigger.sql` | `handle_new_user()` trigger for auto-profile creation on signup |
| `004_cleanup_and_extend.sql` | Tier constraint 1-5, `avatar_config`, `skills`, `social_links` columns, 7 indexes |
| `005_avatar_items.sql` | `avatar_items` table, `player_inventory` table, indexes, RLS |
| `006_bounty_system.sql` | `bounty_submissions` table with review workflow, indexes, RLS |

### All Tables (32 total)

profiles, teams, invite_codes, announcements, announcement_dismissals, bounties, bounty_claims, bounty_deliverables, bounty_submissions, events, event_attendance, kanban_boards, kanban_columns, kanban_cards, kanban_card_assignees, kanban_card_labels, kanban_card_comments, kanban_card_checklist, marketplace_items, marketplace_orders, job_listings, job_comments, quests, quest_progress, achievements, user_achievements, tc_transactions, xp_transactions, notifications, mentorship_profiles, mentorship_matches, portfolios, portfolio_items, time_capsules, themes, user_themes, election_votes, avatar_items, player_inventory

---

### API Routes Testing (Code Review)

| Route | Method | Auth Required | Status |
|-------|--------|--------------|--------|
| `GET /api/directory` | GET | Yes (Supabase session) | ✅ Exists, builds |
| `GET /api/profile` | GET | Yes | ✅ Exists, builds |
| `PATCH /api/profile` | PATCH | Yes | ✅ Exists, builds |
| `GET /api/profile/[id]` | GET | Yes | ✅ Exists, builds |
| `POST /api/an-token` | POST | No | ✅ Pre-existing |

Cannot runtime test without Supabase credentials configured.

---

### Middleware Deprecation Warning

**NEW:** Next.js 16.1.6 warns: `The "middleware" file convention is deprecated. Please use "proxy" instead.`

This affects `web/middleware.ts`. The current middleware still works but should be migrated to the `proxy` convention before the next Next.js major version. Not blocking.

---

### Dependency Issues

- **Peer dependency conflict:** `@ai-sdk/react` vs React 19 — requires `--legacy-peer-deps` (resolved via `.npmrc`)
- **npm vulnerabilities:** 10 total (7 moderate, 3 high)
- **New deps added:** `@supabase/supabase-js`, `@supabase/ssr` — installed successfully

---

### Summary

| Check | Wave 1 | Wave 4 | Change |
|-------|--------|--------|--------|
| Build | ✅ 14 pages | ✅ 45 pages | +31 pages, all compile |
| Lint errors | ~25 | ~40+ | +15 new (mostly `fetchX` before declaration) |
| Lint warnings | ~30 | ~35 | +5 new |
| Auth flow | ⚠️ N/A | ✅ Code complete | Full auth + middleware built |
| Marketing pages | ✅ 5/5 | ✅ 5/5 | No regression |
| Dashboard pages | N/A | ✅ 23/23 | All build as dynamic |
| Profiles schema | ⚠️ N/A | ✅ 42 columns documented | Full schema exists |
| Migrations | ⚠️ N/A | ✅ 6 migrations, 32+ tables | Complete |
| API routes | N/A | ✅ 4 routes | All build |
| Middleware | N/A | ✅ 5 route patterns | Deprecation warning |

### Critical Items for Other Agents

**Backend:**
- Fix the `fetchX` before declaration pattern across ALL dashboard pages — move function declarations above the `useEffect` calls
- Fix unused imports (`Check` in bounties, `Link` in AnnouncementWidget, `formatDate` in CalendarWidget)

**Frontend:**
- Game world (R3F) is the #1 priority — zero game code exists yet
- Pre-existing lint errors still need fixing (CardCarouselLayout setState, InteractivePylon3D pointer mutation)

**Management:**
- `middleware.ts` deprecation warning — plan migration to `proxy` convention
- 10 npm vulnerabilities should be audited before production deploy
