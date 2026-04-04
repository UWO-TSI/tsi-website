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

- [ ] Run `cd web && npm run build` — log ALL errors/warnings to `specs/qa.md`
- [ ] Run `cd web && npm run lint` — log ALL errors/warnings to `specs/qa.md`
- [ ] Test existing auth flow: signup with `TETHOS-W26` → login → election redirect → success screen
- [ ] Test all 5 marketing pages load: `/`, `/npo`, `/company`, `/sponsor`, `/student`
- [ ] **CRITICAL:** Read `web/lib/supabase/types.ts` and document the full `Profile` type (all ~30 fields) in `specs/qa.md` — Backend needs this to audit
- [ ] Read `web/lib/supabase/middleware.ts` and document current routing logic in `specs/qa.md`
- [ ] Read `web/supabase/migrations/001_initial_schema.sql` (if exists) and document the full profiles table schema
- [ ] Log your findings in your section of this file

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
| Backend | Existing schema documentation | **QA to document profiles table** | ⚠️ QA hasn't started — BLOCKING BACKEND |
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

### 2026-03-30 — Dashboard Shell + Game World + Directory Built

**Build status:** `npm run build` passes cleanly. All 8 dashboard routes registered.

**Completed:**

- [x] **Dashboard layout** (`web/app/student/dashboard/layout.tsx`):
  - Fixed overlay (z-50) covering parent student layout
  - 240px sidebar (desktop), hamburger slide-over (mobile <768px)
  - Main content area with independent scroll

- [x] **Sidebar** (`web/components/portal/Sidebar.tsx`):
  - Matches ux-dashboard.md spec exactly: 240px, var(--color-surface) bg
  - Brand-blue 2px left accent on active item
  - Lucide icons: Home, Users, Scroll, ShoppingBag, Briefcase, Trophy, User, Settings
  - "Soon" badges on Phase 2 items
  - Player status (avatar + name + level) at top
  - Responsive: hidden on mobile, X close button in overlay mode

- [x] **All 8 page stubs** with proper routing:
  - `/student/dashboard` — Game world (dynamic import, no SSR)
  - `/student/dashboard/directory` — Member directory (list view)
  - `/student/dashboard/profile` — Profile view/edit
  - `/student/dashboard/bounty`, `/shop`, `/jobs`, `/leaderboard`, `/settings` — Coming Soon placeholders

- [x] **PS1 shader pipeline** (`web/components/game/PS1Pipeline.tsx`):
  - Vertex snapping via `onBeforeCompile` GLSL injection (160px grid)
  - Affine texture mapping support
  - NearestFilter on all textures, mipmaps disabled
  - Low-res rendering via Canvas `dpr={0.35}` + CSS `image-rendering: pixelated`

- [x] **Game world** (`web/components/game/GameWorld.tsx`):
  - R3F Canvas with PS1 pipeline
  - Terrain: 80x80 grass plane + cobblestone path network
  - 7 buildings/objects at spec positions (HQ, Shop, Oracle, House, Bounty/Job/Leaderboard boards)
  - **Real FBX models loaded** for HQ, Shop, Oracle Temple, House (via `useFBX`)
  - **Real GLTF/FBX props** for Bench, Banner, Candle decorations
  - 12 placeholder trees, 3 lampposts with point lights
  - Camera: CameraControls locked at 45° polar, FOV 35°, smooth follow
  - Fog: linear #0f0f10, near 60 / far 120
  - Lighting: ambient 0.4 + directional sun + warm building lamps + blue HQ glow

- [x] **Player avatar** (`web/components/game/PlayerAvatar.tsx`):
  - **2D sprite on Billboard** (Dave the Diver style) using real prototype_character.png sprite sheet
  - Sprite sheet UV cropping with frame cycling (6 FPS walk animation)
  - Direction-based frame selection (down/left/right/up)
  - WASD + Arrow key movement (5 units/sec, clamped to ±38 boundary)
  - Click-to-move via ground plane raycasting
  - Ground shadow using static_shadow.png
  - Nameplate: name + level via drei `<Html>` with distanceFactor

- [x] **Building component** (`web/components/game/Building.tsx`):
  - FBX model loading with Suspense + placeholder fallback
  - PS1 texture filtering on loaded models
  - Floating label (monospace, semi-transparent bg)
  - Proximity detection (3 unit range)
  - "Press E to enter/view" interaction prompt with animation
  - Navigate to dashboard page on interact

- [x] **Member directory** (`web/components/portal/MemberDirectory.tsx`):
  - List view per ux-directory.md spec (64px rows)
  - Search bar with debounce, focus ring
  - Filter dropdown: tier pills (color-coded), status toggle
  - Results count
  - Empty state with SearchX icon

- [x] **Member card/row** (`web/components/portal/MemberCard.tsx`):
  - 64px horizontal row: avatar (tier-colored border) | name+class | tier badge | level | XP bar | arrow
  - Tier colors from spec (T1=gold, T2=blue, T3=cyan, T4=green, T5=gray)
  - Hover state, keyboard navigation, focus ring
  - Click navigates to profile

- [x] **Profile view** (`web/components/portal/ProfileView.tsx`):
  - 96px avatar with tier border, name, class + tier + role subtitle
  - Stats row: level, XP, coins
  - Full-width XP progress bar with "X/Y XP to Level N" label
  - Skills section with pill tags
  - Social links with Lucide icons
  - About section
  - Edit mode for own profile (name, bio, skills inline editing)

- [x] **Design tokens** (`web/styles/game-tokens.css`):
  - All 13 token categories from specs/tokens.md
  - Sidebar, responsive, game world, transitions, overlays, directory, tiers, prompts, z-index scale

- [x] **Temporary types** (`web/components/portal/types.ts`):
  - Profile, DirectoryMember interfaces matching Backend spec
  - Tier colors/labels matching ux-directory.md
  - XP progress utility
  - Mock data (9 members) for development

**Files created:**
- `web/app/student/dashboard/layout.tsx`
- `web/app/student/dashboard/page.tsx`
- `web/app/student/dashboard/directory/page.tsx`
- `web/app/student/dashboard/bounty/page.tsx`
- `web/app/student/dashboard/shop/page.tsx`
- `web/app/student/dashboard/jobs/page.tsx`
- `web/app/student/dashboard/leaderboard/page.tsx`
- `web/app/student/dashboard/profile/page.tsx`
- `web/app/student/dashboard/settings/page.tsx`
- `web/components/portal/Sidebar.tsx`
- `web/components/portal/ComingSoon.tsx`
- `web/components/portal/MemberDirectory.tsx`
- `web/components/portal/MemberCard.tsx`
- `web/components/portal/ProfileView.tsx`
- `web/components/portal/types.ts`
- `web/components/game/PS1Pipeline.tsx`
- `web/components/game/GameWorld.tsx`
- `web/components/game/PlayerAvatar.tsx`
- `web/components/game/Building.tsx`
- `web/styles/game-tokens.css`

**Still waiting on:**
- Backend types.ts — using temporary types + mock data
- Backend API routes — directory/profile use mock data
- Supabase auth — auth guards are TODO placeholders

**Notes for other agents:**
- **Backend:** When types.ts is ready, Frontend will replace `web/components/portal/types.ts` imports with `web/lib/supabase/types.ts`. Interface shapes are already aligned with the spec.
- **QA:** Dashboard is at `/student/dashboard`. Test sidebar navigation, responsive hamburger at 768px, game world renders.
- **UXUI:** Implementation follows all 4 specs. Sprite sheet frame mapping may need tuning once exact grid layout is confirmed.

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

### 2026-03-30 — Phase 2: Bounty System + Economy API

Pushed Wave 2 to remote. Built full bounty and economy API endpoints.

**Bounty system (6 endpoints):**
- `GET /api/bounties` — list with status/difficulty filters
- `POST /api/bounties` — create (T1-T3 auto-approved, others → pending)
- `GET /api/bounties/[id]` — detail with claims + deliverables
- `PATCH /api/bounties/[id]` — update (T1-T3)
- `DELETE /api/bounties/[id]` — delete (T1-T2)
- `POST /api/bounties/[id]/claim` — claim open bounty, creates claim row, sets status to claimed
- `POST /api/bounties/[id]/submit` — submit deliverables (requires active claim), sets bounty to review
- `PATCH /api/bounties/[id]/review` — review submission (T1-T3), on approved: awards coins + XP, records transactions, completes bounty

**Economy system (2 endpoints):**
- `GET /api/economy` — own balance + XP + level + transaction history
- `POST /api/economy { action: "purchase" }` — atomic shop purchase with refund on failure (validates stock + balance, deducts coins, creates order, decrements stock, records transaction)
- `POST /api/economy { action: "award" }` — admin coin award (T1-T2), records transaction

**Key improvements over existing client-side code:**
- Server-side auth + tier permission checks
- Zod validation on all inputs
- Atomic-ish purchase flow (deducts coins with `.gte()` guard, refunds on order failure)
- Transaction logging for all coin movements
- Bounty approval auto-awards coins + XP on review approval

**Files created:**
- `web/app/api/bounties/route.ts`
- `web/app/api/bounties/[id]/route.ts`
- `web/app/api/bounties/[id]/claim/route.ts`
- `web/app/api/bounties/[id]/submit/route.ts`
- `web/app/api/bounties/[id]/review/route.ts`
- `web/app/api/economy/route.ts`
- `specs/api.md` (updated with all new endpoints)

**Notes for Frontend:**
- The existing bounty/marketplace pages use direct Supabase client calls. These still work. The new API routes are available for pages that want server-side validation.
- Economy purchase endpoint is safer than the client-side approach (uses `.gte()` guard to prevent race conditions).

### 2026-03-30 — Sprint 2 Prep: FBX Converter + AC-Style Research

While waiting for UXUI's `ux-game-overhaul.md`:

1. **Blender FBX→GLB batch converter** (`web/scripts/fbx_to_glb.py`)
   - Converts all 4 FBX building models (hq, shop, oracle_temple, house_1) to self-contained texture-embedded GLB
   - Packs external textures, converts to PNG for GLB compat, applies transforms
   - Usage: `blender --background --python web/scripts/fbx_to_glb.py`

2. **AC-style Three.js/R3F research** (`specs/research-ac-style-threejs.md`)
   - Surveyed 15+ repos and tutorials for terrain, camera, lighting, movement approaches
   - Top recommendations for our game world:
     - **Curved world shader** (AC signature) — simple vertex displacement, high visual impact
     - **BVHEcctrl** over ecctrl — no physics engine needed for our casual RPG
     - **coldi/r3f-game-demo** patterns — GameObject + Script composition
     - **PathFinding.js** for click-to-move
     - **Baked lighting** from Blender for static campus, runtime lights only for dynamic elements
     - **Day/night cycle** — `threex.daynight` or Complete Sky System

**Blocked on:** `specs/ux-game-overhaul.md` from UXUI — will implement once delivered.

### 2026-04-02 — Onboarding + Quest System APIs

Built while waiting for UXUI overhaul spec.

**Onboarding API (2 endpoints):**
- `GET /api/onboarding` — current step/completion status
- `POST /api/onboarding` — advance step (sequential only), save profile data at steps 2-3, awards 100 coins + 50 XP on completion

**Quest system API (4 endpoints):**
- `GET /api/quests` — list quests with user progress, filter by type/status
- `POST /api/quests` — create quest (T1-T3)
- `POST /api/quests/[id]/accept` — accept quest
- `POST /api/quests/[id]/complete` — complete quest, awards XP + coins, records transactions

**Total API endpoints: 17** (directory 1 + profile 3 + bounty 8 + economy 2 + onboarding 2 + quests 4)

**Still blocked on:** `specs/ux-game-overhaul.md` from UXUI.

### 2026-04-04 — Wired Frontend to Real Backend APIs

Management directive: wire real Supabase queries into mock-data pages.

**What I changed (Frontend integration):**

1. **`components/portal/types.ts`** — replaced mock types + MOCK_MEMBERS with re-exports from `@/lib/supabase/types`. Kept TIER_COLORS and updated `getXpProgress` to use Backend's power-curve XP formula.

2. **`components/portal/MemberDirectory.tsx`** — removed MOCK_MEMBERS. Now fetches from `GET /api/directory` via useEffect. Added loading spinner and error states.

3. **`components/portal/ProfileView.tsx`** — removed MOCK_PROFILE. Now fetches from `GET /api/profile` (own) or `GET /api/profile/[id]` (other). Implemented `handleSave` with `PATCH /api/profile`. Added saving spinner, success indicator. Fixed `coin_balance` → `tethos_coins`.

4. **`components/portal/MemberCard.tsx`** — updated `getXpProgress` call to new signature.

5. **`app/student/dashboard/profile/page.tsx`** — cleaned up, removed TODO.

6. **`app/student/dashboard/directory/[id]/page.tsx`** — NEW. Member profile page that MemberCard links to. Passes profileId to ProfileView.

**Notes for Frontend:**
- Directory and profile pages now hit real APIs. If no Supabase env vars are set, they'll show error states gracefully.
- `portal/types.ts` no longer has mock data. All types come from `@/lib/supabase/types`.
- ProfileView handles both own profile and other-user profile based on props.

### HANDOFF — Backend Agent Context for New Session

#### (1) All API Endpoints (17 routes across 13 files)

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/directory` | GET | List members, filters: `?role=`, `?year=`, `?active=`, `?search=`. T1/T2 see inactive. | Auth required |
| `/api/profile` | GET | Own full profile (all fields) | Auth required |
| `/api/profile` | PATCH | Update own profile (Zod validated: name, bio, skills, social_links, avatar_config, etc.) | Auth required |
| `/api/profile/[id]` | GET | Other user's public profile (limited fields, UUID validated) | Auth required |
| `/api/bounties` | GET | List bounties, filters: `?status=`, `?difficulty=`. Excludes `pending` by default. | Auth required |
| `/api/bounties` | POST | Create bounty. T1-T3 auto-approved to `open`, others → `pending`. | Auth required |
| `/api/bounties/[id]` | GET | Bounty detail with claims + deliverables | Auth required |
| `/api/bounties/[id]` | PATCH | Update bounty (status, title, pay, etc.) | T1-T3 only |
| `/api/bounties/[id]` | DELETE | Delete bounty | T1-T2 only |
| `/api/bounties/[id]/claim` | POST | Claim open bounty. Creates claim row, sets status to `claimed`. | Auth required |
| `/api/bounties/[id]/submit` | POST | Submit deliverables. Requires active claim. Sets bounty to `review`. | Auth required |
| `/api/bounties/[id]/review` | PATCH | Review submission. On `approved`: awards coins+XP, records transactions, completes bounty. | T1-T3 only |
| `/api/economy` | GET | Own balance + XP + level + transaction history. `?limit=50` (max 100). | Auth required |
| `/api/economy` | POST | `{action:"purchase"}` — atomic shop buy with refund on failure. `{action:"award"}` — admin coin grant. | Auth / T1-T2 for award |
| `/api/onboarding` | GET | Current onboarding step + completion status | Auth required |
| `/api/onboarding` | POST | Advance step (sequential). Saves profile data at steps 2-3. Awards 100 coins + 50 XP on completion. | Auth required |
| `/api/quests` | GET | List quests with user progress. Filters: `?type=`, `?status=`. | Auth required |
| `/api/quests` | POST | Create quest | T1-T3 only |
| `/api/quests/[id]/accept` | POST | Accept a quest | Auth required |
| `/api/quests/[id]/complete` | POST | Complete quest. Awards XP + coins, records transactions. | Auth required |

Plus pre-existing: `/api/an-token` (AI agent token, not ours).

#### (2) All 6 Migrations

| File | What it does |
|------|-------------|
| `001_initial_schema.sql` | **Pre-existing.** Profiles (~30 fields), teams, invite_codes, bounties, bounty_claims, bounty_deliverables, events, kanban, marketplace, job_listings, quests, achievements, transactions, notifications, mentorship, portfolios, themes. Full RLS + seed data. |
| `002_election_votes.sql` | **Pre-existing.** Election voting table, has_voted flag, immutable RLS, `get_election_results()` function. |
| `003_profile_trigger.sql` | **Pre-existing.** Auto-creates profile row on auth signup via `handle_new_user()` trigger. |
| `004_cleanup_and_extend.sql` | **Ours.** Tier 1-4 → 1-5. Added `avatar_config JSONB`, `skills TEXT[]`, `social_links JSONB`. 6 indexes + trigram search. |
| `005_avatar_items.sql` | **Ours.** `avatar_items` (type, category, coin_price, rarity) + `player_inventory` (user items, equipped state). RLS. |
| `006_bounty_system.sql` | **Ours.** `bounty_submissions` (text, attachments, review workflow). RLS. |

**Note:** Migrations 001-003 came from `main` branch (pre-existing auth/election system). 004-006 are ours.

#### (3) Supabase Setup

| File | Purpose |
|------|---------|
| `web/lib/supabase/client.ts` | Browser-side Supabase client (`createBrowserClient` from `@supabase/ssr`) |
| `web/lib/supabase/server.ts` | Server-side Supabase client (reads cookies via `next/headers`) |
| `web/lib/supabase/middleware.ts` | Auth routing: election flag, dashboard auth+onboarding, admin tier checks |
| `web/middleware.ts` | Root Next.js middleware — calls `updateSession()`, matches `/student/*` routes |

**Packages:** `@supabase/supabase-js@^2.99.2`, `@supabase/ssr@^0.9.0` (already in package.json).

**Env vars needed:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optionally `ENABLE_ELECTION=true`.

#### (4) types.ts Interfaces

`web/lib/supabase/types.ts` exports:
- **Core:** `Profile`, `Tier` (1-5), `Position`, `ClassName`, `RankTitle`, `Side`, `Portfolio`
- **Game:** `AvatarConfig`, `SocialLinks`, `AvatarItem`, `PlayerInventoryItem`, `ItemType`, `ItemCategory`, `ItemRarity`
- **Bounty:** `Bounty`, `BountySubmission`, `BountyStatus`, `SubmissionStatus`
- **Views:** `DirectoryMember` (subset for listings), `PublicProfile` (subset for other-user view)
- **Maps:** `POSITION_CLASS_MAP`, `POSITION_TIER_MAP`, `TIER_LABELS`
- **Helpers:** `xpForLevel()`, `levelFromXp()`, `rankFromLevel()`, `canAccessFeature()`

#### (5) What's Wired to Real Supabase vs Mock

**Real Supabase (via API routes):**
- `MemberDirectory.tsx` → `GET /api/directory`
- `ProfileView.tsx` → `GET /api/profile`, `PATCH /api/profile`, `GET /api/profile/[id]`

**Real Supabase (direct client calls, pre-existing from main):**
- All admin pages (analytics, announcements, bounties, election, marketplace, members, quests)
- bounty/page.tsx, calendar, directory (old version), jobs, kanban, leaderboard, marketplace, mentorship, portfolio, quests

**Still mock/placeholder:**
- `tools/rag/page.tsx` — canned AI response, no real RAG integration
- `tools/ascii/page.tsx` — "coming soon" placeholder
- `tools/page.tsx` — static link grid

#### (6) Election Archival Flag

In `web/lib/supabase/middleware.ts`: all election routes (`/student/election`, `/student/dashboard/admin/election`) are gated behind `process.env.ENABLE_ELECTION === 'true'`. When off (default), both redirect to `/student/dashboard`. No election code was deleted — just gated.

#### (7) Dashboard Pages (26 total)

Pre-existing from main (20): admin panel, admin/analytics, admin/announcements, admin/bounties, admin/election, admin/marketplace, admin/members, admin/quests, bounty, calendar, kanban, marketplace, mentorship, portfolio, quests, tools, tools/ascii, tools/rag, jobs, leaderboard.

Built/modified by us (6): dashboard home (page.tsx), directory, directory/[id], profile, shop, settings.

#### (8) What to Do Next

1. **Onboarding pages** — the API exists (`/api/onboarding`) but no Frontend pages for the onboarding flow (welcome → profile → avatar → tutorial)
2. **Wire remaining pages to API routes** — bounty board could use `/api/bounties` instead of direct Supabase calls for server-side validation
3. **Avatar inventory API** — equip/unequip items, integrate with shop purchase flow
4. **Level-up logic** — when XP crosses a threshold, auto-update `level` and `rank` fields (currently manual)
5. **Achievement system API** — check/award achievements based on criteria
6. **Run migrations on Supabase** — 004-006 haven't been applied to production yet

#### (9) Key Files to Read First

1. `CLAUDE.md` — project bible, team roles, tech stack
2. `AGENT_LOG.md` — this file, full history
3. `specs/api.md` — all API contracts with request/response shapes
4. `web/lib/supabase/types.ts` — canonical TypeScript types
5. `web/lib/supabase/middleware.ts` — auth routing logic
6. `specs/asset-stack.md` — confirmed asset + tech decisions
7. `specs/research-ac-style-threejs.md` — AC-style R3F implementation research

#### (10) Gotchas

- **Tier constraint:** Migration 004 changes tier from 1-4 to 1-5. If you're testing against a Supabase instance that hasn't run 004, T5 inserts will fail.
- **`tethos_coins` not `coin_balance`:** The real DB field is `tethos_coins`. Frontend mock types had `coin_balance` — this was fixed in the API wiring commit but older code may reference the wrong name.
- **`getXpProgress(xp, level)` takes 2 args now:** The function signature changed from `(xp)` to `(xp, level)` when we switched from linear to power-curve XP. Any callers using the old signature will silently break.
- **No `npm install` in worktree by default:** After cloning/creating a worktree, you must run `cd web && npm install` before building. The `.npmrc` has `legacy-peer-deps=true` for compatibility.
- **Middleware requires Supabase env vars:** If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing, middleware silently passes through (no auth checks). This is intentional for dev but means routes are unprotected without env vars.
- **Election code is NOT deleted:** It's behind the `ENABLE_ELECTION` flag. Don't delete election routes/pages — they may be reused.
- **`bounty_submissions` table depends on 006 migration:** The `/api/bounties/[id]/submit` and `/review` routes will 500 if migration 006 hasn't been run.
- **Profile trigger (003) runs on signup:** New users auto-get a profile row. Don't try to INSERT profiles manually — use Supabase Auth signup, the trigger handles it.
- **File ownership:** Backend owns `web/lib/supabase/`, `web/supabase/migrations/`, `web/app/api/`, `specs/api.md`. Portal components in `web/components/portal/` are technically Frontend's area — we modified them per Management directive to wire APIs.

### 2026-04-04 — Inventory API + Level-Up Logic + Achievement System

Executed tasks from HANDOFF items #3, #4, #5.

**1. Avatar Inventory API** (`web/app/api/inventory/route.ts`)
- `GET /api/inventory` — list user's owned items with equipped state. Filters: `?type=`, `?equipped=true|false`. Joins `player_inventory` → `avatar_items`.
- `POST /api/inventory` — equip/unequip items. Auto-unequips conflicting slot (one item per type). Validates ownership.

**2. Automatic Level-Up Logic** (`web/lib/supabase/helpers.ts`)
- Created shared `awardRewards()` helper that all XP-granting endpoints now use.
- Awards coins + XP, then auto-computes `level` via `levelFromXp()` and `rank` via `rankFromLevel()`, writing all 4 fields to the profile in a single UPDATE.
- Records both `tc_transactions` and `xp_transactions`.
- Refactored 3 existing endpoints to use it:
  - `web/app/api/bounties/[id]/review/route.ts`
  - `web/app/api/quests/[id]/complete/route.ts`
  - `web/app/api/onboarding/route.ts`

**3. Achievement System API**
- `GET /api/achievements` — list all achievements with user's unlock status. `?include_secret=true` to show hidden ones.
- `POST /api/achievements` — create achievement (T1-T3 only). Validates unique name.
- `POST /api/achievements/[id]/award` — award achievement to user (T1-T3 only). Checks for duplicates. Awards TC + XP rewards via `awardRewards()` with auto level-up.
- Migration `007_achievement_policies.sql` — adds INSERT/UPDATE RLS policies for `achievements` and `user_achievements` tables.
- Added TypeScript types: `Achievement`, `UserAchievement`, `AchievementWithStatus`.

**Total API endpoints: 22** (was 17, added 5: inventory GET/POST, achievements GET/POST, achievements award).

**Files created:**
- `web/lib/supabase/helpers.ts`
- `web/app/api/inventory/route.ts`
- `web/app/api/achievements/route.ts`
- `web/app/api/achievements/[id]/award/route.ts`
- `web/supabase/migrations/007_achievement_policies.sql`

**Files modified:**
- `web/lib/supabase/types.ts` (added Achievement, UserAchievement, AchievementWithStatus)
- `web/app/api/bounties/[id]/review/route.ts` (uses awardRewards)
- `web/app/api/quests/[id]/complete/route.ts` (uses awardRewards, response includes new_level/new_rank)
- `web/app/api/onboarding/route.ts` (uses awardRewards)
- `specs/api.md` (documented all new endpoints)

**Build:** `npm run build` passes cleanly.

**Notes for Frontend:**
- Quest completion response now includes `new_level` and `new_rank` in rewards object.
- Inventory API is ready for shop integration — after economy purchase, add item to `player_inventory`, then use `/api/inventory` to manage equip state.
- Achievement list endpoint shows unlock status per-user — good for a profile badges section.

**Notes for QA:**
- Test inventory equip/unequip: only one item per type slot.
- Test achievement award: should return 409 if already awarded.
- Test level-up: award enough XP to cross a threshold and verify `level` and `rank` update.

### HANDOFF — Backend Agent Context for New Session

#### Updated Endpoint Count: 22

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/directory` | GET | Member list with filters |
| `/api/profile` | GET | Own full profile |
| `/api/profile` | PATCH | Update own profile |
| `/api/profile/[id]` | GET | Other user's public profile |
| `/api/bounties` | GET | List bounties |
| `/api/bounties` | POST | Create bounty |
| `/api/bounties/[id]` | GET | Bounty detail |
| `/api/bounties/[id]` | PATCH | Update bounty (T1-T3) |
| `/api/bounties/[id]` | DELETE | Delete bounty (T1-T2) |
| `/api/bounties/[id]/claim` | POST | Claim bounty |
| `/api/bounties/[id]/submit` | POST | Submit deliverables |
| `/api/bounties/[id]/review` | PATCH | Review submission (T1-T3) |
| `/api/economy` | GET | Balance + transactions |
| `/api/economy` | POST | Purchase / admin award |
| `/api/onboarding` | GET | Onboarding status |
| `/api/onboarding` | POST | Advance step |
| `/api/quests` | GET | List quests |
| `/api/quests` | POST | Create quest (T1-T3) |
| `/api/quests/[id]/accept` | POST | Accept quest |
| `/api/quests/[id]/complete` | POST | Complete quest |
| `/api/inventory` | GET | List owned items |
| `/api/inventory` | POST | Equip/unequip item |
| `/api/achievements` | GET | List achievements + status |
| `/api/achievements` | POST | Create achievement (T1-T3) |
| `/api/achievements/[id]/award` | POST | Award to user (T1-T3) |

#### 7 Migrations

| File | What it does |
|------|-------------|
| `001_initial_schema.sql` | Pre-existing. Profiles, teams, bounties, quests, achievements, transactions, etc. |
| `002_election_votes.sql` | Pre-existing. Election voting. |
| `003_profile_trigger.sql` | Pre-existing. Auto-create profile on signup. |
| `004_cleanup_and_extend.sql` | Tier 1-5, avatar_config, skills, social_links, indexes. |
| `005_avatar_items.sql` | avatar_items + player_inventory tables with RLS. |
| `006_bounty_system.sql` | bounty_submissions table with RLS. |
| `007_achievement_policies.sql` | INSERT/UPDATE RLS for achievements + user_achievements. |

#### What to Do Next

1. **Wire remaining dashboard pages to API routes** — bounty board, marketplace, quests pages still use direct Supabase client calls
2. **Onboarding frontend pages** — API exists, no pages yet
3. **Economy purchase → inventory integration** — after marketplace purchase, auto-add item to player_inventory
4. **Achievement auto-check** — trigger achievement checks after key events (first bounty completed, level milestones, etc.)
5. **Run migrations 004-007 on production Supabase**
6. **Leaderboard API** — dedicated endpoint for ranked player list by XP/level

---

## QA

> QA agent writes here. Others: read only.

*(awaiting first entry — start immediately with build/lint + schema documentation)*

---

## Cross-Team Notes

> Any agent can append here for messages that don't fit a single section.

*(none yet)*
