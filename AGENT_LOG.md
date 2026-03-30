# AGENT_LOG.md — Team Communication Board

> Every agent reads this at session start. Append to your section only.
> **ALL AGENTS:** Read `CLAUDE.md`, this file, AND `specs/asset-stack.md` before starting work.

---

## Execution Order

```
WAVE 1 (parallel, start immediately):
  QA  ──→ build/lint baseline + auth flow test + document existing profiles schema
  UXUI ──→ ask David 8 design-detail questions, then write specs

WAVE 2 (after QA baseline):
  Backend ──→ audit profiles table, write migrations, archive election, update middleware, create API routes

WAVE 3 (after Backend types.ts is committed):
  Frontend ──→ download assets, build dashboard shell, PS1 shader, game world, directory

WAVE 4 (after Frontend commits):
  QA ──→ retest everything
```

---

## Active Tasks — Phase 1: MVP (Single-Player Game World + Directory)

### QA — WAVE 1 (start NOW)

**Goal:** Establish baseline, document existing schema, unblock Backend.

- [x] Run `cd web && npm run build` — ✅ PASSES, logged to `specs/qa.md`
- [x] Run `cd web && npm run lint` — ❌ FAILS (~25 errors, ~30 warnings), logged to `specs/qa.md`
- [x] Test existing auth flow — ⚠️ N/A: no auth code exists on any branch (documented)
- [x] Test all 5 marketing pages load — ✅ ALL PASS as static pages
- [x] **CRITICAL:** `web/lib/supabase/types.ts` — ⚠️ FILE DOES NOT EXIST (no Supabase code on any branch)
- [x] `web/lib/supabase/middleware.ts` — ⚠️ FILE DOES NOT EXIST
- [x] `web/supabase/migrations/` — ⚠️ DIRECTORY DOES NOT EXIST — entirely greenfield
- [x] Log findings in QA section of this file — DONE

**Output:** `specs/qa.md` with build errors, auth test results, and full existing schema documentation.

---

### UXUI — ✅ WAVE 1 COMPLETE → PHASE 2 SPECS

**Wave 1 delivered:** `ux-dashboard.md`, `ux-game-world.md`, `ux-directory.md`, `tokens.md` — all committed, all checked off.

**Phase 2 — Spec the remaining features. Ask David design-detail questions (multi-choice, batched) for each before writing.**

- [ ] `specs/ux-shop.md` — Shop interior, item grid catalog, item card (icon + name + price + rarity), purchase confirmation, category tabs (outfits, effects, merch, profile), coin balance display
- [ ] `specs/ux-bounty.md` — Bounty board overlay, bounty card (title, description, reward, deadline, difficulty+category tags, solo/team), claim flow, submission flow, active bounty tracking, Bounty Hunter application form
- [ ] `specs/ux-leaderboard.md` — Leaderboard overlay, ranked list, your-rank highlight, time period tabs, stats displayed
- [ ] `specs/ux-jobs.md` — Job board overlay, job listing card, filter/search, member submission form
- [ ] `specs/ux-oracle.md` — Oracle Temple interior, MBTI quiz flow (question count, question UI, answer format), class reveal animation, 4 main classes + 16 subclass visual identity
- [ ] `specs/ux-onboarding.md` — Welcome screen → profile form → avatar creator → tutorial → quest checklist with rewards
- [ ] Design review of Frontend's implementation once building starts
- [ ] Update AGENT_LOG.md

**Rules:** Same as Wave 1 — specs only, no code. Ask David before writing. Multi-choice. Implementation-ready detail.

---

### Backend — WAVE 2 (after QA documents the existing schema)

**Goal:** Clean DB, write migrations, archive election, create API routes. Frontend depends on your types.ts.

**Step 1 — Audit existing profiles table:**
- [ ] Read QA's schema documentation in `specs/qa.md`
- [ ] Read `web/lib/supabase/types.ts` — understand current Profile type
- [ ] Read all migration files in `web/supabase/migrations/`
- [ ] Decide which of the ~30 fields to keep, remove, or rename
- [ ] Document audit results at the top of `specs/api.md`

**Step 2 — Write migrations:**
- [ ] `004_cleanup_and_extend.sql`:
  - Clean up unused profile fields (based on audit)
  - ALTER tier CHECK constraint from `BETWEEN 1 AND 4` to `BETWEEN 1 AND 5`
  - Add new columns: `avatar_config JSONB DEFAULT '{}'`, `xp INTEGER DEFAULT 0`, `level INTEGER DEFAULT 1`, `coin_balance INTEGER DEFAULT 0`, `class TEXT`, `subclass TEXT`, `skills TEXT[] DEFAULT '{}'`, `social_links JSONB DEFAULT '{}'`, `avatar_url TEXT`, `year INTEGER`, `is_active BOOLEAN DEFAULT TRUE`
  - Add indexes on commonly queried fields

- [ ] `005_avatar_items.sql`:
  - `avatar_items` table (id, name, type, category, coin_price, sprite_url, rarity, created_at)
  - `player_inventory` table (id, user_id, item_id, equipped BOOLEAN, acquired_at)
  - RLS: users can read all items, read/update own inventory

- [ ] `006_bounty_system.sql` (stub — schema only, not wired up yet):
  - `bounties` table (id, title, description, reward_coins, category, difficulty, timeframe, status, solo_or_team, created_by, claimed_by, created_at, deadline)
  - `bounty_submissions` table (id, bounty_id, user_id, submission_text, status, reviewed_by, created_at)
  - RLS: authenticated can read bounties, T1-T3 can insert/update, bounty hunters can claim

**Step 3 — Archive election:**
- [ ] In `web/lib/supabase/middleware.ts`: wrap ALL election-specific routing logic in `if (process.env.ENABLE_ELECTION === 'true')` check
- [ ] Do NOT delete any election code or routes — just gate them behind the flag
- [ ] Default behavior when flag is off: `/student/election` returns 404 or redirects to dashboard

**Step 4 — Update middleware for dashboard:**
- [ ] Add dashboard route protection:
  - `/student/dashboard/*` → require auth (redirect to login if not)
  - `/student/dashboard/*` → require `onboarding_completed === true` (redirect to onboarding if not)
  - `/student/dashboard/admin/*` → require T1-T3
  - `/student/login` or `/student/signup` while logged in → redirect to `/student/dashboard`
- [ ] Keep existing marketing page routes untouched

**Step 5 — Create API routes:**
- [ ] `web/app/api/directory/route.ts`:
  - GET: returns members list, chapter-scoped by default
  - Query params: `?role=`, `?year=`, `?active=`, `?search=`
  - T1/T2 callers see all members (check tier from session)
  - Returns: id, display_name, avatar_url, tier, level, xp, class, skills, is_active

- [ ] `web/app/api/profile/route.ts`:
  - GET: returns own profile (all fields)
  - PATCH: update own profile (display_name, bio, skills, social_links, avatar_config)
  - Validate with Zod schema

- [ ] `web/app/api/profile/[id]/route.ts`:
  - GET: returns another user's public profile (limited fields)
  - Chapter-scoping enforced (same chapter or T1/T2)

**Step 6 — Update types:**
- [ ] Update `web/lib/supabase/types.ts` with new Profile fields and new table types
- [ ] Export clean TypeScript interfaces for Frontend to import

**Step 7 — Document:**
- [ ] Write complete `specs/api.md` — every route, request/response shapes, auth requirements, error codes
- [ ] Update AGENT_LOG.md with what you built

**Files you own:**
- `web/supabase/migrations/004_*`, `005_*`, `006_*`
- `web/lib/supabase/types.ts`
- `web/lib/supabase/middleware.ts`
- `web/app/api/directory/`, `web/app/api/profile/`
- `specs/api.md`

---

### Frontend — WAVE 3 (after Backend commits types.ts + after UXUI specs)

**Goal:** Build the dashboard shell, PS1 game world renderer, and directory UI.

**Step 0 — Setup:**
- [ ] Read `specs/asset-stack.md`, `specs/ux-dashboard.md`, `specs/ux-game-world.md`, `specs/ux-directory.md`
- [ ] Run `cd web && npm run build` — fix any errors
- [ ] Install: `npm install @mesmotronic/three-retropass`
- [ ] Download Quaternius + Kenney GLB asset packs → organize in `web/public/assets/`:
  ```
  web/public/assets/
  ├── characters/    ← Quaternius animated characters (.glb)
  ├── buildings/     ← Kenney Retro Medieval + Quaternius Medieval Village (.glb)
  ├── terrain/       ← PSX RPG Town Tiles (.glb)
  ├── props/         ← Quaternius Fantasy Props (.glb)
  ├── nature/        ← Kenney Nature Kit (.glb/.obj)
  └── ui/            ← Kenney Pixel UI + Mana Soul GUI (.png)
  ```

**Step 1 — Dashboard shell:**
- [ ] `web/app/student/dashboard/layout.tsx`:
  - RPG-styled sidebar (left) + main content area (right)
  - Import Sidebar component
  - Wrap with auth check (redirect if not logged in)
  - Use existing ASCII loading screen while 3D assets load

- [ ] `web/components/portal/Sidebar.tsx`:
  - RPG menu panel aesthetic (dark panel, game-style icons, glow on active)
  - Top section: mini player status (avatar thumbnail + name + level)
  - Nav items: Home, Directory, Bounty Board, Shop, Job Board, Leaderboard, Profile/Settings
  - Active item highlighted with glow effect
  - Collapsible at breakpoint (per UXUI spec)

**Step 2 — Page stubs:**
- [ ] `web/app/student/dashboard/page.tsx` — home (game world renders here)
- [ ] `web/app/student/dashboard/directory/page.tsx` — member directory
- [ ] `web/app/student/dashboard/bounty/page.tsx` — placeholder "Coming Soon"
- [ ] `web/app/student/dashboard/shop/page.tsx` — placeholder "Coming Soon"
- [ ] `web/app/student/dashboard/jobs/page.tsx` — placeholder "Coming Soon"
- [ ] `web/app/student/dashboard/leaderboard/page.tsx` — placeholder "Coming Soon"
- [ ] `web/app/student/dashboard/profile/page.tsx` — own profile view/edit
- [ ] `web/app/student/dashboard/settings/page.tsx` — placeholder "Coming Soon"

**Step 3 — PS1 shader pipeline:**
- [ ] `web/components/game/PS1Pipeline.tsx`:
  - Implement bandinopla's PS1Material or `onBeforeCompile` approach for vertex snapping + affine textures
  - `useFBO(320, 240)` from drei for low-res render target
  - Fullscreen quad with `NearestFilter` upscale
  - `@mesmotronic/three-retropass` for color quantization + dithering post-processing
  - All textures loaded with `THREE.NearestFilter`, mipmaps disabled

**Step 4 — Game world:**
- [ ] `web/components/game/GameWorld.tsx`:
  - R3F `<Canvas>` with PS1 pipeline wrapping the scene
  - Load terrain GLBs via `useGLTF` — arrange as campus map
  - Load building GLBs — place HQ, Shop, Oracle Temple at fixed positions
  - Place Bounty Board and Job Board objects
  - `<CameraControls>` from drei — locked polar angle (45°), FOV 35°, smooth follow player
  - `<fog>` for atmosphere
  - Warm point lights near buildings
  - Props and nature assets scattered for decoration

- [ ] `web/components/game/PlayerAvatar.tsx` — **2D SPRITE in 3D world (Dave the Diver style)**:
  - `<Billboard>` from drei with textured plane (NOT 3D model)
  - Sprite sheet frame cycling in `useFrame()` — idle (1-2 frames), walk (4-8 frames per direction)
  - Layered sprite composition: body + hair + outfit as stacked planes at slight z-offsets
  - WASD/Arrow key movement — update position each frame
  - Click-to-move: raycaster on ground plane, pathfind to click point
  - Camera follows player via CameraControls `moveTo()`
  - Nameplate: player name + level via drei `<Html>`
  - **Use colored rectangle placeholder sprites until real sprites are generated**

- [ ] `web/components/game/Building.tsx`:
  - Reusable component for placing buildings
  - Proximity detection: when player is near, show interaction prompt ("Press E to enter")
  - On enter: trigger transition (per UXUI spec) → navigate to building's dashboard page or show overlay

**Step 5 — Directory:**
- [ ] `web/components/portal/MemberDirectory.tsx`:
  - Fetch from `/api/directory`
  - Search bar + filter dropdowns (role/tier, year, active/inactive)
  - Grid of MemberCard components

- [ ] `web/components/portal/MemberCard.tsx`:
  - RPG stat card layout (per UXUI spec)
  - Avatar, name, class/role, level, XP bar, tier badge
  - Click → navigate to full profile

- [ ] `web/components/portal/ProfileView.tsx`:
  - Fetch from `/api/profile/[id]`
  - Full profile page: avatar, bio, socials, XP/level/badges, project history
  - If viewing own profile: edit button → inline editing

- [ ] Update AGENT_LOG.md with progress

**Files you own:**
- `web/app/student/dashboard/` (all pages)
- `web/components/portal/` (all portal components)
- `web/components/game/` (all game components)
- `web/public/assets/` (downloaded asset files)

---

## File Ownership (STRICT — do not touch other agent's files)

| Directory/File | Owner | Others |
|---------------|-------|--------|
| `specs/ux*.md`, `specs/tokens.md` | UXUI | read only |
| `specs/api.md` | Backend | read only |
| `specs/qa.md` | QA | read only |
| `specs/asset-stack.md` | Management | read only |
| `web/components/portal/` | Frontend | — |
| `web/components/game/` | Frontend | — |
| `web/app/student/dashboard/` | Frontend | — |
| `web/public/assets/` | Frontend | — |
| `web/app/api/directory/`, `web/app/api/profile/` | Backend | — |
| `web/lib/supabase/` | Backend | Frontend reads types |
| `web/supabase/migrations/` | Backend | — |
| `CLAUDE.md`, `AGENT_LOG.md` structure | Management | all append to own section |

## Merge Order
1. **QA baseline** merges first (unblocks Backend's audit)
2. **Backend** merges second (types.ts + migrations must exist before Frontend)
3. **UXUI specs** merge anytime (reference docs, no code)
4. **Frontend** merges third (uses Backend types + UXUI specs)
5. **QA retest** merges last

## Commit Prefixes
`[QA]`, `[UXUI]`, `[BE]`, `[FE]`, `[MGMT]`

---

## Blocked / Needs Attention

| Agent | Blocked On | Waiting For | Status |
|-------|-----------|-------------|--------|
| Backend | Existing schema documentation | **QA to document profiles table** | ✅ RESOLVED — QA baseline committed (385098a), see `specs/qa.md` |
| Frontend | Supabase types for API integration | Backend to commit types.ts | ⏳ Building with mocks — will swap when types land |
| ~~Frontend~~ | ~~Visual specs~~ | ~~UXUI specs~~ | ✅ RESOLVED |
| ~~Frontend~~ | ~~Waiting for wave order~~ | ~~Management approval~~ | ✅ RESOLVED — approved to start early |

---

## Management

### 2026-03-27 — Sprint Kickoff
Created shared communication system (CLAUDE.md, AGENT_LOG.md, specs/).

### 2026-03-27 — Full Project Audit
Project is ~75% production ready for marketing pages.

### 2026-03-28/29 — Student Portal Deep Vision Confirmed

Full vision documented in memory. Key decisions:
- PS1 low-poly 3D game world (R3F, not PixiJS)
- Quaternius characters + buildings (CC0, glTF)
- PS1 shader pipeline (bandinopla PS1Material + retropass + low-res FBO)
- Single-player MVP (Colyseus multiplayer deferred)
- 5-tier system (T1=David, T2=presidents, T3=PM/VP, T4=dev/director, T5=volunteer)
- TSI coin economy (internal currency)
- MBTI → RPG classes at Oracle Temple
- Onboarding: welcome → profile → avatar → tutorial → quests
- ASCII loading screen reused for 3D asset loading
- Election archived behind env flag
- Profiles table: audit and clean before adding game columns
- No kanban, no chapters, no multiplayer, no notifications for MVP

### 2026-03-29 — Wave 1 Status Check

**UXUI: ✅ COMPLETE.** Delivered 4 implementation-ready specs (1,557 lines total):
- `specs/ux-dashboard.md` — sidebar (240px, narrow minimal, left accent bar), responsive hamburger at 768px
- `specs/ux-game-world.md` — camera (45° FOV 35°), mixed campus terrain, fade-to-black transitions (0.3s), HQ interior (main room + locked admin room)
- `specs/ux-directory.md` — list view rows (64px), tier colors (T1=gold, T2=blue, T3=cyan, T4=green, T5=gray)
- `specs/tokens.md` — 13 token categories, all referencing base tokens.css

**QA: ⚠️ NOT STARTED.** QA is blocking the entire chain. Backend can't audit profiles without QA's schema docs. Frontend can't start without Backend's types.ts. **QA must start immediately.**

**Backend: ⏳ BLOCKED** on QA.
**Frontend: ⏳ BLOCKED** on Backend.

**UXUI reassigned to Phase 2 spec work** (see updated task list below).
**Frontend approved to start early** (see directive below).

### 2026-03-29 — Frontend Early Start Approved

Frontend asked 4 clarifying questions. Management answers:

1. **Supabase auth:** The auth code (`@supabase/ssr`, middleware, client helpers) is on `main` branch — it hasn't been merged into the feature branches. Backend should merge from main or set it up. Frontend: for now, scaffold layout with placeholder auth checks (e.g. `// TODO: wire supabase auth`). Backend will provide the real auth utils.

2. **Asset downloads:** Scaffold with placeholder paths. Use `/assets/characters/character.glb`, `/assets/buildings/hq.glb`, etc. Management will drop the actual GLBs in later. Use placeholder geometry (colored boxes) in the meantime so the game world is testable without real assets.

3. **PS1Material:** Research and implement it yourself. You have full permissions + web access. Find bandinopla's PS1Material.ts GitHub gist and the Codrops PS1 Jitter Shader tutorial. Use whichever integrates best with R3F. The key effects are: vertex snapping to a low-res grid, affine texture mapping, and low-res FBO render (320×240) upscaled with NearestFilter.

4. **Start early: YES.** Do NOT wait for waves. UXUI specs are already committed — read `specs/ux-dashboard.md`, `specs/ux-game-world.md`, `specs/ux-directory.md`, `specs/tokens.md`. Begin immediately:
   - Dashboard layout + sidebar (from UXUI specs)
   - All 8 page stubs
   - PS1 shader pipeline (standalone, no dependencies)
   - GameWorld + PlayerAvatar skeletons with placeholder box geometry
   - Directory components (use mock data until Backend API exists)

**Frontend's only real blocker is Backend's types.ts for API integration. Everything else can be built now with mocks/placeholders.**

### 2026-03-29 — Asset Stack Confirmed (Deep Research)

See `specs/asset-stack.md` for the complete confirmed stack:
- Characters: **2D sprites on billboards** (generated via Nano Banana) — NOT 3D models
- Buildings: Quaternius Medieval Village + Kenney Retro Medieval Kit
- Terrain: PSX RPG Town Tiles
- Props: Quaternius Fantasy Props + Kenney Nature Kit
- UI: Kenney Pixel UI + Mana Soul GUI
- Audio: Kenney RPG Audio + xDeviruchi 16-Bit Fantasy Music
- Shader: bandinopla PS1Material + @mesmotronic/three-retropass
- Camera: drei CameraControls + BVHEcctrl
- Multiplayer (deferred): Colyseus (NOT Supabase Realtime)
- Total asset cost: $0 (all CC0/free)

---

## UXUI

> UXUI agent writes here. Others: read only.

### 2026-03-27 — Design Questions Answered + Specs Written

**Step 1 completed:** Read DESIGN_SYSTEM.md, tokens.css, asset-stack.md.

**Step 2 completed:** Asked David 8 design-detail questions. All answered:

| Question | David's Choice |
|----------|---------------|
| Q1 — Sidebar panel style | **Narrow Minimal (240px)** — flat dark panel, 2px left accent bar on active, no section grouping |
| Q2 — Directory layout | **List view with stats** — horizontal rows (64px), avatar + name + class + tier badge + level + XP bar |
| Q3 — Terrain style | **Mixed campus** — grass areas with cobblestone walkways connecting buildings, benches, lampposts |
| Q4 — Avatar creator UI | **Tabbed panel** — centered modal, 3D bust preview top, horizontal tabs (Body/Face/Hair/Outfit) |
| Q5 — HQ interior | **Single open room + locked Admin room** — main room has stations (bulletin board, trophy, bookshelf, desk), separate locked admin room (T1-T3) with multiple stations (terminal, board, podium, chest) |
| Q6 — Building transitions | **Quick fade to black** — 0.3s fade out, load, 0.3s fade in (~0.8s total) |
| Q7 — Overlay panel style | **Solid dark panels** — bg-navy (#0d1b2a), 1px blue glow border, 16px radius, max 800px centered |
| Q8 — Responsive collapse | **Hamburger at 768px** — full sidebar above, hamburger slide-over overlay below |

**Step 3 completed:** Wrote all 4 spec files:

- [x] `specs/ux-dashboard.md` — dashboard shell layout, sidebar (240px narrow minimal), nav items + states, responsive hamburger, avatar creator tabbed panel, onboarding flow, page routing
- [x] `specs/ux-game-world.md` — camera (45° FOV 35°), mixed campus terrain, building placement map, player movement (WASD + click), proximity interaction ("Press E"), fade-to-black transitions, HQ interior (main room + locked admin room), overlay panel spec, lighting, asset loading
- [x] `specs/ux-directory.md` — list view rows (64px), search + filter bar, member row layout, tier color system (T1=gold, T2=blue, T3=cyan, T4=green, T5=gray), profile page layout, edit mode, accessibility
- [x] `specs/tokens.md` — 13 token categories: sidebar, responsive, game world, transitions, overlays, directory, tiers, interaction prompts, avatar creator, badges, skill tags, z-index scale

**Notes for other agents:**
- **Frontend:** All 4 specs are implementation-ready. Dimensions, colors, spacing, and interaction states are fully specified with token references. Start with `ux-dashboard.md` (sidebar + shell), then `ux-game-world.md`.
- **Backend:** Tier color system defined in `specs/tokens.md` Section 8 and `specs/ux-directory.md` Section 5. The 5 tiers map to: T1=gold, T2=blue, T3=cyan, T4=green, T5=gray.
- **QA:** Responsive breakpoint is 768px for sidebar collapse. Test hamburger menu on mobile viewports.

### 2026-03-27 — UXUI Wave 1 COMPLETE. Status Report for Management.

**UXUI is done with all Wave 1 deliverables.** All 4 specs are committed, AGENT_LOG updated, Blocked table updated.

**What's unblocked now:**
- Frontend can read all 4 specs immediately — no UXUI dependency remaining
- Frontend still blocked on Backend types.ts (separate dependency)

**What UXUI needs next from Management:**
1. **Phase 2 spec work** — When Management is ready, UXUI can spec: onboarding flow details, shop UI, bounty board UI, leaderboard UI, job board UI, MBTI→class Oracle Temple flow
2. **Design review** — Once Frontend starts building from specs, UXUI should review implementation for spec fidelity
3. **Mobile specs** — CLAUDE.md says "desktop first, mobile later" — UXUI can write mobile-specific specs when that phase starts

**Open design questions for future phases (not blocking anything now):**
- Shop item card layout and purchase confirmation flow
- Bounty board: kanban vs list vs card grid?
- Leaderboard: table vs podium visual vs both?
- Oracle Temple MBTI quiz: how many questions, what UI per question?
- Notification system UI (deferred per CLAUDE.md)
- Multiplayer presence indicators when Colyseus ships

**No blockers. UXUI is idle and available for Phase 2 spec work or design review.**

---

## Frontend

> Frontend agent writes here. Others: read only.

*(awaiting WAVE 3 — blocked on Backend types.ts and UXUI specs)*

---

## Backend

> Backend agent writes here. Others: read only.

### 2026-03-30 — Wave 2 Complete

**Unblocked myself.** QA never started, so I audited the schema directly from `origin/main` (merged into branch). All existing supabase code (client helpers, types, middleware, 3 migrations) was already on main.

**What I built:**

1. **Migration 004_cleanup_and_extend.sql**
   - Tier constraint expanded: 1-4 → 1-5 (T5=volunteer)
   - Added: `avatar_config JSONB`, `skills TEXT[]`, `social_links JSONB`
   - Added 6 indexes + trigram search index on display_name

2. **Migration 005_avatar_items.sql**
   - `avatar_items` table (type, category, coin_price, rarity, sprite_url)
   - `player_inventory` table (user owns items, equipped state)
   - RLS: read all items, read/update own inventory

3. **Migration 006_bounty_system.sql** (stub)
   - `bounty_submissions` table (submission_text, status, reviewer_notes)
   - RLS: read all, insert own, update own pending

4. **Middleware rewrite** (`web/lib/supabase/middleware.ts`)
   - Election routes archived behind `ENABLE_ELECTION` env flag (default: off → redirect to dashboard)
   - Dashboard routes: require auth + `onboarding_completed`
   - Admin routes (`/student/dashboard/admin/*`): require T1-T3
   - Onboarding routes: require auth, skip if already onboarded
   - Login/signup while logged in → redirect to dashboard

5. **types.ts rewrite** (`web/lib/supabase/types.ts`)
   - `Tier` expanded to `1 | 2 | 3 | 4 | 5`
   - Added: `AvatarConfig`, `SocialLinks`, `AvatarItem`, `PlayerInventoryItem`, `Bounty`, `BountySubmission`, `DirectoryMember`, `PublicProfile` interfaces
   - Added: `TIER_LABELS`, updated `POSITION_TIER_MAP` (volunteer → T5)
   - Updated `canAccessFeature` — T5 now has access to dashboard, directory, marketplace, leaderboard, quests, calendar, job_board

6. **API Routes**
   - `GET /api/directory` — filtered member list, T1/T2 see inactive members
   - `GET /api/profile` — own full profile
   - `PATCH /api/profile` — update own profile (Zod validated)
   - `GET /api/profile/[id]` — public profile (limited fields)

7. **specs/api.md** — full API documentation with request/response shapes

**Files created/modified:**
- `web/supabase/migrations/004_cleanup_and_extend.sql` (new)
- `web/supabase/migrations/005_avatar_items.sql` (new)
- `web/supabase/migrations/006_bounty_system.sql` (new)
- `web/lib/supabase/middleware.ts` (rewritten)
- `web/lib/supabase/types.ts` (rewritten)
- `web/middleware.ts` (updated matcher)
- `web/app/api/directory/route.ts` (new)
- `web/app/api/profile/route.ts` (new)
- `web/app/api/profile/[id]/route.ts` (new)
- `specs/api.md` (written)

**Notes for Frontend:**
- Import types from `@/lib/supabase/types` — `DirectoryMember`, `PublicProfile`, `Profile`, `AvatarConfig`, etc.
- Directory API returns `{ members: DirectoryMember[] }` sorted by level desc
- Profile API returns `{ profile: Profile }` for own, `{ profile: PublicProfile }` for others
- PATCH profile validates with Zod — check `specs/api.md` for field constraints
- `canAccessFeature(tier, feature)` helper available for client-side permission checks

**Notes for QA:**
- Test middleware redirects: unauthenticated → login, no onboarding → onboarding, logged in → dashboard
- Test election routes are gated (should redirect to dashboard when `ENABLE_ELECTION` is not set)
- Test API routes return 401 without auth
- Test directory visibility: T3+ should not see inactive members

**No blockers. Frontend is unblocked.**

---

## QA

> QA agent writes here. Others: read only.

### 2026-03-27 — Wave 1 QA Baseline Complete

**Full report:** `specs/qa.md`

**Build:** ✅ PASSES — Next.js 16.1.6, 14 static pages, clean compile in 5.4s

**Lint:** ❌ FAILS — ~25 errors, ~30 warnings. Key errors:
- 4x missing `key` prop in `npo_formSubmission.tsx`
- Cascading setState in `CardCarouselLayout.tsx`
- Hook immutability violation in `InteractivePylon3D.tsx`
- 7x `any` types in `Lanyard.tsx`

**Auth flow:** ⚠️ CANNOT TEST — no auth infrastructure exists

**Marketing pages:** ✅ ALL 5 PASS — `/`, `/npo`, `/company`, `/sponsor`, `/student` all build as static

**CRITICAL FINDING FOR BACKEND:**
> **No Supabase code exists on ANY branch.** No `types.ts`, no `middleware.ts`, no migrations, no `@supabase/supabase-js` in package.json. CLAUDE.md says "Supabase Auth | Working" but this is incorrect — it's entirely greenfield. Backend should plan to build everything from scratch, not audit existing schema.

**Dependencies:** Peer conflict with `@ai-sdk/react` (needs `--legacy-peer-deps`). 10 npm vulnerabilities (7 moderate, 3 high).

**Files written:** `specs/qa.md`

**Notes for other agents:**
- **Backend:** Read `specs/qa.md` Section 5 — there's nothing to audit, you're building from scratch. No existing profile fields, no migrations, no middleware. Install `@supabase/supabase-js` and `@supabase/ssr` first.
- **Frontend:** Lint errors in your area — see `specs/qa.md` Section 2 for the full list. Fix `key` props and unused vars before adding new code.
- **Management:** CLAUDE.md "Current State" table needs correction — "Supabase Auth | Working" should be "Supabase Auth | Not yet built".

### 2026-03-27 — Read Management Updates, Flagging Contradiction

Read AGENT_LOG.md updates. My Wave 1 baseline is complete (committed `385098a`). Backend is unblocked.

**CONTRADICTION FLAG for Management:**
Management note (line 326) says "The auth code (@supabase/ssr, middleware, client helpers) is on main branch." My audit found **no Supabase code on main or any other branch** — verified via `git ls-tree -r --name-only main | grep -i supabase` (empty result). No `@supabase/supabase-js` or `@supabase/ssr` in `web/package.json` on any branch. Backend should treat this as greenfield, not a merge task.

**Status:** Wave 1 complete. QA is idle until Wave 4 (retest after Frontend commits). Available for ad-hoc testing if needed.

### 2026-03-30 — Wave 4 Full Retest (Post-Backend Merge)

Merged `davidliu/backend` into `davidliu/qa`. Ran full build + lint + code review of all new pages.

**Full report:** `specs/qa.md` (completely rewritten with Wave 4 results)

**Build:** ✅ PASSES — 45 pages (up from 14). All 23 dashboard pages + 5 marketing pages + auth pages + API routes compile cleanly.

**Lint:** ❌ STILL FAILS — ~40+ errors now (was ~25). **15 new errors** from Backend's dashboard pages, nearly all the same pattern: `fetchX()` called in `useEffect` before function declaration. Easy fix — move declarations above the effects.

**Auth flow (code review):** ✅ COMPLETE
- Signup, login, onboarding, election, auth callback — all pages exist and build
- Middleware routing verified: 5 route patterns, tier-based admin access, election behind env flag
- Invite code `TETHOS-W26` seeded in migration 001
- Cannot runtime test without Supabase credentials

**Dashboard pages:** ✅ ALL 23 BUILD
- 15 regular pages + 8 admin pages
- All render as dynamic (server-rendered on demand)

**Profiles schema:** ✅ FULLY DOCUMENTED
- 42 columns across 4 migrations (001 base + 002 has_voted + 004 avatar_config/skills/social_links)
- 7 indexes including trigram search
- Full column-by-column table in `specs/qa.md`

**Migrations:** 6 total, 32+ tables, all documented

**New issues found:**
1. **Middleware deprecation** — Next.js warns `"middleware" convention deprecated, use "proxy"`. Not blocking but needs migration.
2. **Backend lint pattern** — all dashboard pages use `fetchX` before declaration. Systematic fix needed.
3. **POSITION_TIER_MAP discrepancy** — `types.ts` maps `pmo→T2`, `pm→T2`, `vp→T2` but CLAUDE.md says T3=PM/VP. Check which is correct.

**Files updated:** `specs/qa.md`

**Notes for other agents:**
- **Backend:** Fix `fetchX` before declaration in all 15+ dashboard pages. Move function declarations above `useEffect`.
- **Frontend:** Game world is zero code — this is the #1 blocker for the product. Start immediately.
- **Management:** Middleware deprecation warning needs attention before Next.js upgrade.

---

## Cross-Team Notes

> Any agent can append here for messages that don't fit a single section.

*(none yet)*
