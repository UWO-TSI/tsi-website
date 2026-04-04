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

- [x] `specs/ux-shop.md` — E-commerce catalog, standard product cards, dual currency, category tabs, product detail, cart stub
- [x] `specs/ux-bounty.md` — 2-col card grid overlay, claim/submit/review flow, Bounty Hunter application
- [x] `specs/ux-leaderboard.md` — Ranked table, time period tabs, your-row highlight
- [x] `specs/ux-jobs.md` — Full-page job board, search + filters, member submission form
- [x] `specs/ux-oracle.md` — Card-based MBTI quiz (12 Q), 4 classes + 16 subclasses, class reveal animation
- [x] `specs/ux-onboarding.md` — Welcome → profile → avatar → quest checklist (6 quests, 275 XP)
- [x] Design review of Backend's dashboard implementation — findings in `specs/ux-review.md`
- [x] Update AGENT_LOG.md

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

### 2026-03-30 — SPRINT 2: Animal Crossing Visual Overhaul

**Direction from David:** The game must LOOK and FEEL like Animal Crossing. The current implementation is too dark, too pixelated, too PS1. We're going for cozy, bright, colorful, inviting — not gritty/retro.

**PS1 shader is REMOVED.** No more vertex snapping, no low-res render, no pixelation. Full resolution, antialiased, clean rendering.

**All branches now have the working merged codebase (test-merge).** Game world renders: blue sky, green terrain, placeholder buildings, trees, character sprite walks, building interaction works.

**What needs fixing NOW (in priority order):**

---

#### @UXUI — URGENT: Refined Visual Guide for Animal Crossing Style

**Your existing specs described a PS1/terminal aesthetic. That direction has changed. David wants Animal Crossing.**

Write a NEW spec: `specs/ux-game-world-v2.md` that gives Frontend a **clear visual blueprint** for an Animal Crossing-style world. Include:

1. **Reference images** — describe exactly which Animal Crossing scenes/screenshots to emulate. Name specific games (AC: New Horizons, AC: Wild World, etc.) and describe the camera angle, lighting mood, color palette, and terrain feel.

2. **Camera** — Animal Crossing uses a slightly elevated perspective camera (not true isometric). Describe the exact angle, distance, and FOV that matches. Should camera rotate freely or be locked?

3. **Terrain** — AC has rolling gentle hills, lush multi-tone grass, dirt paths with soft edges, flowers, rivers/ponds with rounded edges, cliffs. Describe what our terrain should look like — flat or with gentle elevation? What ground colors? Path style (dirt, stone, brick)?

4. **Buildings** — AC buildings are rounded, pastel-colored, have cute proportions (slightly oversized doors, small windows, decorative chimneys, awnings). Describe the exact style for each building (HQ, Shop, Oracle Temple). Include colors, proportions, decorative elements.

5. **Trees & vegetation** — AC trees are round and lush (not pointy cones). Describe shape, color variety, size. Include bushes, flowers (multiple colors), stumps, weeds.

6. **Lighting** — AC has bright, warm daylight with soft shadows. Golden hour glow. Describe the exact lighting setup.

7. **Color palette** — provide exact hex colors for: grass (multiple tones), paths, sky, water, building walls, roofs, tree trunks, foliage, flowers. This should be a definitive palette Frontend copies.

8. **Props & details** — fences, signs, wells, bridges, stepping stones, market stalls, streetlamps. What should be scattered around the village?

9. **Overall feel** — describe the MOOD. Cozy, welcoming, playful, lived-in. Not sterile or empty.

**Ask David any clarifying questions FIRST (multi-choice). Then write the spec. Frontend is blocked until you deliver this.**

---

#### @Frontend — BLOCKED on UXUI v2 spec. Prep work:

While waiting for `specs/ux-game-world-v2.md`:

1. **Convert building FBX assets to GLB in Blender** — the Quaternius FBX files have external textures. Write a Blender Python script (or use the Blender CLI) to batch-convert all FBXs in `public/assets/buildings/` to self-contained `.glb` files with textures embedded. This unblocks real 3D models.

2. **Research Animal Crossing R3F implementations** — search GitHub for any existing AC-style Three.js/R3F projects. Look for terrain generation approaches, camera rigs, and lighting setups that match the AC feel.

3. **Once UXUI delivers v2 spec** — implement the visual overhaul. Replace the current placeholder geometry with AC-style terrain, buildings, vegetation per the spec's exact color palette and proportions.

4. **Fix the terrain z-fighting** — paths and grass at the same Y cause flicker. Use proper Y offsets or polygon offset.

5. **Do NOT add PS1 shader back.** Clean, antialiased rendering only.

---

#### @Backend — Continue Phase 2 wiring

1. Wire real Supabase queries into the dashboard pages that are using mock data
2. Test all API endpoints work with real Supabase (need env vars set)
3. Implement the MBTI quiz endpoint using `specs/oracle-questions.md`
4. Add event system API (CRUD events, RSVP)

---

#### @QA — Integration testing

1. Merge all branches into your QA branch
2. Run `npm run build` — log any new errors
3. Test the game world in browser — character movement, building interaction, sidebar nav
4. Test all dashboard pages load without errors
5. Cross-browser test (Chrome, Safari, Firefox)
6. Log everything to `specs/qa.md`

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

### 2026-03-29 — Spec Updates + Phase 2 COMPLETE

**Spec updates for art direction pivot:**
- Updated `specs/ux-game-world.md` Section 5 — PlayerAvatar rewritten from 3D Quaternius models to 2D billboard sprites (Dave the Diver style). Added sprite sheet animation (8 FPS), layered composition (4 layers at z-offsets), NearestFilter.
- Updated `specs/ux-dashboard.md` Section 6.2 — Avatar creator preview changed from 3D bust to 2D layered sprite at 4× scale with `image-rendering: pixelated`.
- Updated `specs/tokens.md` Section 10 — Added sprite layer tokens (z-offset, frame rate, billboard dimensions).

**Phase 2 design questions asked (all answered by David):**

| Question | David's Choice |
|----------|---------------|
| Shop layout | **Full-page e-commerce catalog** — real merch, not avatar cosmetics |
| Product card | **Standard e-commerce card** — photo, name, price, add-to-cart |
| Shop currency | **Both** — real money (Stripe) + TSI coins |
| Bounty board | **Card grid overlay** — 2-column cards with filter tabs |
| Leaderboard | **Ranked table** — simple, time period tabs, your-row highlighted |
| Oracle quiz | **Card-based** — question presented, 2-4 answer cards in front, click most accurate, progress bar at bottom |
| Job board | **Full-page** — search + filters, job listing cards, member submission |
| Onboarding tutorial | **Quest checklist** — self-directed exploration with XP rewards (6 quests, 275 XP total) |

**Phase 2 specs written (all committed, 1,488 lines total):**

- [x] `specs/ux-shop.md` — E-commerce catalog, standard product cards, dual currency (real money + TSI coins), category tabs, product detail page with variants, cart stub
- [x] `specs/ux-bounty.md` — 2-col card grid overlay, bounty cards (title/reward/deadline/difficulty/tags), claim flow (6 steps), submission form, Bounty Hunter application
- [x] `specs/ux-leaderboard.md` — Ranked table, time period tabs (weekly/monthly/all-time), your-row sticky highlight, responsive column hiding, gold/silver/bronze rank colors
- [x] `specs/ux-jobs.md` — Full page with search + filter tabs, job listing cards (company/role/type/location), type-colored badges, member submission form, admin review flow
- [x] `specs/ux-oracle.md` — Card-based MBTI quiz (12 questions, 2-4 answer cards each), 4 main classes (Warrior/Mage/Healer/Rogue), 16 subclasses, dramatic class reveal animation, post-quiz class info page
- [x] `specs/ux-onboarding.md` — 3-step flow (welcome → profile → avatar), starter quest checklist widget (6 quests, 275 XP), XP toast notifications, collapsible widget, edge cases

**Notes for other agents:**
- **Frontend:** All Phase 2 specs are ready. Priority order for building: onboarding first (it's the entry point), then shop and oracle (most complex), then bounty/leaderboard/jobs (overlay-based).
- **Backend:** Shop needs product catalog API + Stripe integration. Bounty system needs the `bounties` + `bounty_submissions` tables from migration 006. Oracle needs `class`/`subclass` fields on profiles (already in migration 004). Jobs needs a `job_listings` table (not yet specified in migrations — Backend should add).
- **QA:** Test onboarding flow end-to-end. Test quest completion XP awards. Test Oracle quiz scoring (12 questions → MBTI type → class/subclass mapping).

**UXUI Phase 2 is COMPLETE. All 10 spec files delivered (Wave 1 + Phase 2). Remaining UXUI work: design review once Frontend starts building.**

### 2026-03-30 — Design Review of Backend's Dashboard + MBTI Quiz Bank

**Design review completed.** Full findings in `specs/ux-review.md`. Key deviations from UXUI specs:

| Issue | Severity | Spec Says | Backend Built |
|-------|----------|-----------|---------------|
| Sidebar width | 🔴 Major | 240px | 224px (`w-56`) |
| Sidebar background | 🔴 Major | `--color-surface` (#111827) | `--color-bg-alt` (#111113) |
| Active indicator | 🔴 Major | 2px left accent bar | Blue bg glow |
| Section grouping | 🔴 Major | No grouping (flat list) | Has "Personal" + "Admin" sections |
| Nav font | 🔴 Major | Test Söhne (default) | IBM Plex Mono (font-mono) |
| Directory layout | 🔴 Major | List view (64px rows) | Grid cards (4-col) |
| Tier badges | 🔴 Major | Color-coded T1-T5 pills | Missing entirely |
| XP bars | 🔴 Major | Inline per member row | Missing |
| Topbar | 🟡 Added | Not spec'd | Notifications + search + profile dropdown |
| CSS var names | 🟡 Drift | tokens.css names | Different names (`--glass-border`, `--color-text-primary`) |

**10 priority fixes listed for Frontend** in `specs/ux-review.md` Section "Priority Fix List."

**MBTI Quiz question bank created:** `specs/oracle-questions.md`
- 12 questions (3 per MBTI axis: E/I, S/N, T/F, J/P)
- 2–4 answer cards per question
- Scoring key + tie-breaker rule
- Full class mapping table (4 classes, 16 subclasses)
- Implementation notes (shuffle order, answer storage, API endpoint)

**Notes for Frontend:**
- Read `specs/ux-review.md` before building — tells you exactly what to fix in Backend's sidebar and directory
- The quiz questions in `specs/oracle-questions.md` are ready to be turned into a JSON data file

**Notes for Backend:**
- Your CSS variable names don't match `tokens.css` — see review for specifics. Frontend will fix during integration.
- `Kanban` page should be gated/removed — CLAUDE.md explicitly excluded it from MVP.
- "Marketplace" should be renamed to "Shop" for consistency with specs.

### 2026-03-30 — Sprint 2: Animal Crossing Visual Guide Delivered

**`specs/ux-game-world-v2.md` is committed. Frontend is UNBLOCKED.**

David's Sprint 2 answers:
- **Time of day:** Dynamic cycle (real-world time, like actual AC)
- **Building style:** Full AC cartoon — rounded, pastel, oversized doors, cute proportions
- **Terrain:** Gentle rolling hills (not flat)
- **Water:** Stream/river cutting through campus with wooden bridge

**Spec covers (with exact hex codes):**
- 60+ definitive color values across 7 categories (sky, grass, water, buildings, trees, flowers, props)
- Camera: 50° FOV, 55-60° polar, locked azimuth, smooth follow
- Terrain: noise-based vertex-colored hills, feathered dirt paths, 4-tone grass
- River: transparent teal, animated UV ripples, sparkle particles, wooden bridge
- 6 buildings fully described (HQ, Shop, Oracle Temple, Bounty Board, Job Board, Leaderboard)
- Trees: round fluffy canopies (NOT cones), 4 tree types, sphere shapes
- 7-color flower system scattered in grass
- Dynamic time-of-day cycle (7 phases: dawn through night, full light table)
- 15+ prop types for environmental detail (fences, signs, benches, wells, lamps)
- Ambient animations (clouds, water, flowers, trees, butterflies, chimney smoke)
- Clear list of what to REMOVE (PS1 pipeline) and what to KEEP (R3F, building interactions)
- 12-step implementation priority for Frontend

**Notes for Frontend:**
- READ `specs/ux-game-world-v2.md` — replaces old game world spec
- PS1Pipeline.tsx, RetroPass, NearestFilter, low-res FBO, vertex snapping — ALL REMOVED
- Start with steps 1-5: remove PS1, add sky, terrain colors, building colors, sphere trees
- Hex palette is definitive — copy exactly
- Time-of-day: start with fixed midday, add cycle later

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

### 2026-03-30 — Sprint 2: Animal Crossing Overhaul Prep

**Direction change acknowledged.** PS1 shader removed. Going cozy/bright/AC-style.

**Completed:**
- [x] `scripts/fbx_to_glb.py` — Blender Python batch converter for FBX → self-contained GLB with embedded textures. Run with: `blender --background --python scripts/fbx_to_glb.py -- --input web/public/assets/buildings --output web/public/assets/buildings`
- [x] Fixed terrain z-fighting — replaced Y-offset layering with `polygonOffset` on all overlapping terrain materials. All geometry now at Y=0.
- [x] Installed `@supabase/ssr` + `@supabase/supabase-js` (required by Backend's merged code)
- [x] Build passes cleanly with all Backend routes (admin, calendar, kanban, marketplace, etc.)
- [ ] Researching AC-style R3F implementations on GitHub (in progress)
- [ ] **BLOCKED on UXUI** — waiting for `specs/ux-game-world-v2.md` to implement full visual overhaul

**AC style changes already applied (by management/linter):**
- Building.tsx → ACBuilding with cone roofs, windows, doors + BoardSign for flat objects
- GameWorld.tsx → brighter colors (#5da34e grass, #d4c5a0 paths), round trees, pond, warm lighting (0.7 ambient), no PS1 shader
- Layout.tsx → flex-based sidebar instead of margin-left

### HANDOFF — Context for New Frontend Agent

**Read these files first (in order):**
1. `CLAUDE.md` — project overview, tech stack, team roles
2. `AGENT_LOG.md` — this file, all team communication
3. `specs/ux-game-world-v2.md` — THE source of truth for game world visuals (AC style)
4. `specs/ux-dashboard.md` — sidebar/layout spec
5. `specs/ux-directory.md` — member directory list view spec
6. `specs/ux-review.md` — UXUI's review of Backend's dashboard (10 priority fixes)
7. `web/lib/supabase/types.ts` — Backend's canonical type definitions

---

#### 1. Game Components I Built

| Component | File | Status |
|-----------|------|--------|
| **GameWorld** | `web/components/game/GameWorld.tsx` | v2 AC overhaul done — terrain, river, bridge, trees (4 types with wind sway), bushes, flowers, props, gradient sky, clouds, hemisphere lighting |
| **PlayerAvatar** | `web/components/game/PlayerAvatar.tsx` | 2D sprite on Billboard (Dave the Diver style), sprite sheet UV cropping, WASD + click-to-move, nameplate |
| **Building** | `web/components/game/Building.tsx` | ACBuilding (pastel walls, bold roofs, chimneys, flower boxes, awnings), BoardSign, LeaderboardMonument, proximity "Press E" |
| **TransitionOverlay** | `web/components/game/TransitionOverlay.tsx` | Fade-to-black state machine (0.3s in/out), TransitionProvider context |
| **OverlayPanel** | `web/components/game/OverlayPanel.tsx` | Solid dark panel (#0d1b2a) for bounty/job/leaderboard boards, Escape to close |
| **Sidebar** | `web/components/portal/Sidebar.tsx` | 240px, brand-blue 2px left accent, 8 nav items, player status, responsive hamburger at 768px |
| **MemberDirectory** | `web/components/portal/MemberDirectory.tsx` | Fetches `/api/directory`, search + tier/status filters, loading/error/empty states |
| **MemberCard** | `web/components/portal/MemberCard.tsx` | 64px row: avatar, name+class, tier badge, level, XP bar |
| **ProfileView** | `web/components/portal/ProfileView.tsx` | Fetches `/api/profile` or `/api/profile/[id]`, edit mode, skills, social links |
| **ComingSoon** | `web/components/portal/ComingSoon.tsx` | Placeholder for Phase 2 pages |
| **Dashboard Layout** | `web/app/student/dashboard/layout.tsx` | Fixed overlay, sidebar + main, TransitionProvider wrapper |

---

#### 2. Rendering Bugs Found and Fixed

| Bug | Cause | Fix |
|-----|-------|-----|
| **Black screen** | SoftShadows/ContactShadows from drei interfering with material pipeline | Removed both components |
| **Invisible terrain/buildings** | `toneMapping` in Canvas `gl` prop not applied as renderer property | Moved to `onCreated` callback |
| **Sky sphere invisible** | Scale 300 exceeded camera far clip (150) | Reduced to scale 100, increased far to 300 |
| **Flat blue background (no gradient)** | Same far clip issue — sky sphere beyond frustum | Fixed with far clip increase |
| **Z-fighting on terrain** | Paths/grass at same Y with small offsets | Replaced with `polygonOffset` on all overlapping materials |
| **Fog washing out geometry** | Fog near=35 too close to camera distance=15 | Pushed to near=50, far=100 |

**Current known issue:** The 6 Next.js dev tool errors reported by David haven't been individually diagnosed. Likely hydration warnings or missing keys — needs `npm run dev` testing.

---

#### 3. Placeholder Geometry vs Real Assets

| Element | Status |
|---------|--------|
| **Buildings** | ALL placeholder geometry (colored boxes with cone roofs). FBX files exist in `/assets/buildings/` but aren't loaded — FBX loading was disabled due to missing textures. Run `scripts/fbx_to_glb.py` in Blender to convert to GLB. |
| **Trees** | Placeholder geometry (cylinder trunks + sphere/dodecahedron canopies). No real tree models. |
| **Character sprite** | Real `prototype_character.png` sprite sheet loaded. Sprite sheet grid layout (cols/rows) is estimated — needs tuning. |
| **Props** | All placeholder geometry (benches, fences, lamps, well, mushrooms, stumps). GLTF props exist in `/assets/props/` but aren't loaded. |
| **Terrain** | Flat circle + planes. No heightmap or vertex displacement for rolling hills (v2 spec Section 4.1 wants gentle hills). |
| **River** | Flat blue plane. No UV animation, no sparkles, no lily pads (v2 spec Section 5 wants animated water). |

---

#### 4. AC v2 Spec Implementation Status

| v2 Spec Section | Status |
|----------------|--------|
| Camera (FOV 50°, polar 55-60°, distance 15) | ✅ Done |
| Color palette (60+ hex values) | ✅ Applied to all geometry |
| Gradient sky (#87CEEB → #B8E4F0) | ✅ Done (shader sphere) |
| Clouds | ✅ Done (drei Cloud) |
| HemisphereLight | ✅ Done |
| ACES tone mapping | ✅ Done (onCreated) |
| Terrain (circular island, paths, pond) | ✅ Basic — **missing** gentle rolling hills |
| River + bridge | ✅ Basic geometry — **missing** water animation, sparkles |
| Building colors/proportions | ✅ AC palette applied |
| Trees (sphere canopies, wind sway) | ✅ Done (4 varieties) |
| Bushes, flowers, fences, props | ✅ Done |
| Time-of-day cycle | ❌ Not started (v2 spec Section 8.1) |
| Water animation/sparkles | ❌ Not started |
| Butterflies/particles | ❌ Not started |
| Smoke from chimney | ❌ Not started |
| Audio | ❌ Not started |

---

#### 5. Pages — Mock Data vs Real API

| Page/Component | Data Source |
|---------------|------------|
| MemberDirectory | ✅ Real API (`GET /api/directory`) |
| MemberCard | ✅ Real API (via directory) |
| ProfileView | ✅ Real API (`GET/PATCH /api/profile`, `GET /api/profile/[id]`) |
| Sidebar player status | ❌ Hardcoded "Player" / "Lv. 1" — needs auth context |
| PlayerAvatar nameplate | ❌ Hardcoded "Player" / "Lv. 1" — needs auth context |
| Game world building data | ❌ Hardcoded in BUILDINGS array |
| Bounty/Shop/Jobs/Leaderboard/Settings | ❌ ComingSoon placeholder pages |

---

#### 6. What to Do Next (Priority Order)

1. **Fix the 6 Next.js dev errors** — run `npm run dev`, open error overlay, fix each
2. **Convert FBX → GLB** — run `scripts/fbx_to_glb.py` in Blender, then update Building.tsx to load real `.glb` models
3. **Wire auth context into Sidebar + PlayerAvatar** — pull user profile from Supabase session, show real name/level
4. **Implement gentle rolling hills** on terrain (v2 spec Section 4.1 — vertex displacement with Perlin noise)
5. **Animated water** — UV scroll + sine displacement + sparkle particles (v2 spec Section 5)
6. **Apply UXUI review fixes** — `specs/ux-review.md` has 10 priority items (sidebar width, bg color, active indicator, etc.)
7. **Time-of-day cycle** — v2 spec Section 8.1 has full lighting table by hour
8. **Build onboarding flow** — `specs/ux-onboarding.md` describes welcome → profile → avatar → tutorial → quests

---

#### 7. Gotchas

- **PS1 shader is DEAD.** `PS1Pipeline.tsx` was deleted. Do NOT re-add vertex snapping, low-res FBO, or NearestFilter. Clean antialiased rendering only.
- **`shadows="soft"` on Canvas** may not work in all R3F versions. Use `shadows` (boolean) and set shadow type via `onCreated`.
- **toneMapping/outputColorSpace must go in `onCreated`**, not in the `gl` prop object. The gl prop passes to WebGLRenderer constructor which doesn't accept these.
- **Sky sphere scale must be < camera far clip.** Currently scale=100, far=300. If you change far, adjust sky scale.
- **drie's `SoftShadows` and `ContactShadows`** caused invisible geometry in testing. Avoid unless confirmed working.
- **Sprite sheet grid** (SHEET_COLS=3, SHEET_ROWS=10) is estimated. The actual `prototype_character.png` layout hasn't been confirmed — frame cycling may show wrong frames.
- **The dashboard layout uses `fixed inset-0 z-50`** to overlay the parent student marketing layout. This means the marketing Navbar still renders underneath (hidden). It's a workaround — ideally use route groups.
- **Building FBX files have external textures** — they render as white/untextured if loaded directly. Must convert to GLB with `scripts/fbx_to_glb.py` first.
- **`web/components/portal/types.ts`** now re-exports from `@/lib/supabase/types`. Don't add types here — add to Backend's types.ts instead.

---

### 2026-04-04 — Sprint 3: Terrain Hills, Water Animation, Time-of-Day, Ambient Life

**Build status:** `npm run build` passes cleanly.

**Completed:**

- [x] **Rolling hills terrain** — replaced flat circle with 128×128 vertex-displaced PlaneGeometry using FBM noise (4 octaves). Terrain features:
  - Gentle mounds 0.5–2.0 units across the island
  - Oracle Temple hill rises 3.5 units (smooth quadratic falloff, 12-unit radius)
  - River valley dips terrain to 0 near z=3
  - Paths automatically flattened (92% reduction for N-S, 85% for E-W corridors)
  - Island edge falloff from radius 32–40
  - Vertex colors: 4-tone grass blend (primary/secondary/highlight/shadow) driven by height + noise
  - All objects (trees, bushes, flowers, props, buildings) now placed at terrain height via `getTerrainHeight()`

- [x] **Terrain utility module** (`web/components/game/terrain.ts`):
  - Exported `getTerrainHeight(x, z)` — used by GameWorld and PlayerAvatar
  - Exported `valueNoise(x, y)` — used for terrain vertex coloring
  - Value noise → FBM pipeline for height generation

- [x] **Player ground-following** — PlayerAvatar now sets `pos.y = getTerrainHeight(pos.x, pos.z)` each frame, so player walks up/down hills naturally

- [x] **Animated water** — River replaced with:
  - 160×6 segment PlaneGeometry for vertex displacement
  - Triple sine wave ripples at different frequencies/amplitudes
  - 50 sparkle Points that twinkle on/off (phase-shifted sine visibility)
  - Water surface at semi-transparent 0.72 opacity with low roughness

- [x] **Time-of-day cycle** — merged GradientSky + Lighting into `TimeOfDayCycle` component:
  - 7-phase keyframe table (dawn → morning → midday → afternoon → golden hour → evening → night) from v2 spec Section 8.1
  - Reads real-world `Date` for current hour, interpolates between adjacent phases
  - Dynamic sky gradient (shader uniform updates), sun color/intensity, ambient color/intensity
  - Fog color auto-matches sky bottom color
  - Night→dawn wrap-around interpolation handles midnight crossing

- [x] **Ambient animations** (v2 spec Section 10):
  - **Flower sway:** per-cluster rotation (0.3Hz, 0.05 amplitude) with phase offsets
  - **Butterflies:** 5 Points on gentle Lissajous looping paths, terrain-height-aware
  - **Chimney smoke:** 20 particle Points drifting upward from HQ chimney with lateral sway

**Files created:**
- `web/components/game/terrain.ts`

**Files modified:**
- `web/components/game/GameWorld.tsx` (major: terrain, river, time-of-day, ambient)
- `web/components/game/PlayerAvatar.tsx` (ground-following)

**What to do next (updated priority):**
1. **Convert FBX → GLB** — needs Blender installed, not available on this machine
2. **Wire auth context** — Sidebar + PlayerAvatar still show hardcoded "Player" / "Lv. 1"
3. **Building roof colors** — `roofColor` is defined in BUILDINGS array but not passed to Building component (derives from wall color * 0.55 instead)
4. **Build onboarding flow** — `specs/ux-onboarding.md`
5. **Polish terrain** — paths on Oracle hill approach are missing (terrain rises but no visible stone path)
6. **Night window glow** — buildings should have brighter emissive windows at evening/night
7. **Audio** — ambient background music + sound effects not started

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

---

## QA

> QA agent writes here. Others: read only.

*(awaiting first entry — start immediately with build/lint + schema documentation)*

---

## Cross-Team Notes

> Any agent can append here for messages that don't fit a single section.

*(none yet)*
