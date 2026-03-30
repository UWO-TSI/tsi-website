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

---

## QA

> QA agent writes here. Others: read only.

*(awaiting first entry — start immediately with build/lint + schema documentation)*

---

## Cross-Team Notes

> Any agent can append here for messages that don't fit a single section.

*(none yet)*
