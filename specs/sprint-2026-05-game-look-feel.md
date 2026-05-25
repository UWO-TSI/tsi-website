# Sprint: World-Building Polish + Content Pipeline Architecture

> **Goal:** Make the world feel **like a real place** in single-player mode, AND set up the architecture that makes monthly content drops easy for admins later.
> **Sprint window:** 2026-05-25 → ~2026-06-22 (~4 weeks)
> **Frame:** Community-first hangout (`CLAUDE.md` design principle #1). World must feel alive even without NPCs or other players this sprint.
> **Owner:** `build` agent. Reviewer: David.

---

## Scope decisions confirmed 2026-05-25

- **NPC sprites deferred** — David wants world-building focus first. NPC behavior code waits until sprites land.
- **NPCs will be LLM-driven (γ tier) when they ship** — Claude Haiku 4.5 + Memory tool. Spec: `specs/llm-npc-system.md` (forward-looking, not in-scope).
- **NPC population mix when they ship:** few **permanent named NPCs** (shopkeeper, oracle, mayor, etc. — recurring characters with personas) + **dynamic filler NPCs** based on real-player count.
- **Content drop architecture lands THIS sprint.** Foundation for admin tooling sprint that follows.

---

## Why this sprint exists

David's pitch is a community hangout. Two threats to that pitch:
1. **World feels static / shallow** — flat ground, straight river, identical buildings, no atmosphere. Members lose the "this is a place" feel after one visit.
2. **Content can't be updated without a developer.** If every event/shop-item/seasonal-skin requires a code push, the monthly cadence dies in week 2.

This sprint addresses both. World-building polish for #1, content pipeline architecture for #2.

---

## Definition of Done

A new visitor opens the game world and within 30 seconds feels:
1. **In a place, not a diagram** — terrain undulates, paths curve, the river bends, buildings vary
2. **In a world, not a model** — ambient life drifts, ambient audio plays, time-of-day affects everything
3. **In control** — player movement feels responsive, polished
4. **In quality** — no jarring transitions, no popping textures, no silent dead spots

An admin can:
5. **Add a new event without code** — paste form in admin panel, event appears in-world by next page load
6. **Add a new shop item without code** — upload sprite, set TC price, item appears in shop
7. **Switch seasonal palette without code** — toggle in admin, world recolors instantly
8. **Define an NPC persona without code** (data structure only; UI to write the persona, no LLM wiring yet)

`npm run build` passes. `npm run lint` errors ≤ 39 (baseline). Visual QA verifies 1-4. Admin QA verifies 5-8.

---

## Deliverables

### A. World-Building Polish

#### A1. Terrain undulation
- Replace flat-plane ground with a low-poly heightmapped terrain
- Subtle rolling hills (max delta ~0.6 units over the playable area)
- Player avatar stays grounded (raycast against terrain)
- Camera follows terrain smoothly (no jitter)
- Building footprints stay flat (carve flat slabs into terrain where buildings sit)

**Tech:** Three.js `PlaneGeometry` with per-vertex y-displacement via Perlin/Simplex noise. Or pre-baked GLB terrain mesh from `specs/asset-stack.md` (PSX RPG Town Tiles).
**Files:** `web/components/game/terrain.ts` (extend existing), `web/components/game/GameWorld.tsx`

#### A2. Path softening
- Current paths have sharp pixel edges. Replace with alpha-blended edges that fade into grass
- Reuse existing path texture; add a 16-pixel alpha falloff at the edges
- Curve the paths gently (current ones are straight lines)

**Tech:** Replace flat path mesh with a curved spline mesh, decal-style alpha texture
**Spec:** `specs/ux-game-world-v2.md` §4.2
**Files:** new `web/components/game/Path.tsx`

#### A3. River curve + flow animation
- Current river is straight. Bend it into 2-3 gentle curves across the map
- Add a slow scrolling texture animation for flow direction
- Add a subtle reflection of the sky on the surface (cheap fake reflection via environment map alpha)

**Tech:** spline-based mesh, `useFrame` for texture offset, environment cube map at lower resolution
**Spec:** `specs/ux-game-world-v2.md` §5
**Files:** `web/components/game/River.tsx` (new or refactor)

#### A4. Building silhouette variety
- Currently all buildings use placeholder geometry of similar shape. Each of HQ / Shop / Oracle Temple needs a distinct silhouette
- HQ: large rectangular hall, peaked roof, banner pole
- Shop: smaller cottage, awning, shop sign
- Oracle Temple: tall narrow structure, dome or spire, brazier flames at entrance
- Use Kenney Retro Medieval Kit + Quaternius Medieval Village MegaKit GLBs (already in `specs/asset-stack.md`)

**Spec:** `specs/ux-game-world-v2.md` §6
**Files:** `web/components/game/Building.tsx` (extend with `variant` prop)

#### A5. Ambient props (signposts, stepping stones, fences, lanterns)
- Add ~20 small environmental props scattered around the map
- Signposts pointing toward each building
- Stepping stones across the narrow part of the river
- Wood fences around the courtyard
- Lanterns near building entrances (glow at night)

**Spec:** `specs/ux-asset-map.md` §3 (missing props list)
**Files:** `web/components/game/AmbientProps.tsx` (new)

#### A6. Ambient life particles
- **Butterflies** — 3-5 procedural butterflies on sine-wave paths near flower clusters (day only)
- **Leaves / pollen** — 50-100 sprite drift particles
- **Background birds** — 1-2 circling at high altitude
- **Fireflies** — replace butterflies at night
- All offscreen-culled

**Files:** `web/components/game/AmbientLife.tsx` (new)

#### A7. Ambient audio
- Background loops (one at a time, crossfade on time-of-day):
  - Dawn: soft chirping, distant town hum
  - Day: birdsong, light wind
  - Dusk: cicadas, softer birds
  - Night: crickets, owl hoots, soft wind
- One-shot SFX: footsteps (4 surface variants), building enter/exit whoosh, click ping, UI confirmations
- Volume controls in settings (master / ambient / SFX), persist to localStorage
- **Default muted** with a clear "Click to enable sound" prompt corner (browser autoplay rule)
- Source: Kenney RPG Audio + Kenney Interface Sounds (CC0) + xDeviruchi music (free commercial)

**Files:** `web/lib/game/audio.ts` (new), `web/components/game/AudioController.tsx` (new), `web/public/audio/` (new dir)

#### A8. Player movement polish
- Easing on direction changes (~150ms rotation lerp instead of instant snap)
- Subtle bob while walking (sine on y, ~0.05 units, 4Hz)
- Walk-cycle speed scales with movement speed
- Idle breathing animation when stationary
- Click-to-move target indicator (expanding ring sprite, ~400ms)
- Verify camera follow damping feels right

**Files:** `web/components/game/PlayerAvatar.tsx`, new `web/components/game/MoveTargetIndicator.tsx`

#### A9. Transition & loading polish
- Brief fade-out (~300ms) when entering a building
- Fade-in (~500ms) on interior or exterior reload
- Suspense fallback during R3F mount: monospace text "Connecting to TSI World..." + blinking cursor (reuse ASCII dissolve loader from prior work)
- Loading placeholder for any sprite/GLB still loading

**Files:** `web/components/game/TransitionOverlay.tsx`, `web/app/student/dashboard/page.tsx` Suspense wrap

---

### B. Content Pipeline Architecture

This is the foundation for the next sprint's admin tooling. Without it, monthly content drops require code pushes — non-starter.

#### B1. Data-driven content tables (Supabase)

New migration `013_content_pipeline.sql` (avoid the `013_recruitment_status_v2.sql` filename collision — use `014_content_pipeline.sql` if 013 is taken):

```sql
-- NPC personas (LLM-driven NPCs are the future; this table is the schema today)
create table npc_personas (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,            -- 'mayor', 'shopkeeper'
  display_name text not null,            -- 'Mayor Eliza'
  sprite_url text,                       -- nullable until sprites land
  spawn_zone text not null,              -- 'courtyard' | 'shop' | 'temple' | 'roaming'
  is_permanent boolean default false,    -- permanent vs dynamic-filler
  persona_prompt text,                   -- LLM system prompt (used in future LLM-NPC sprint)
  canned_dialogue text[],                -- fallback canned lines if LLM disabled
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Shop items
create table shop_items (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  category text not null,                -- 'avatar-outfit' | 'avatar-effect' | 'merch' | 'profile-customization'
  sprite_url text not null,
  description text,
  tc_price integer not null,
  rarity text,                            -- 'common' | 'rare' | 'epic' | 'legendary'
  stock integer,                          -- null = unlimited
  active boolean default true,
  released_at timestamptz default now(),
  retired_at timestamptz
);

-- Seasonal palettes
create table seasonal_palettes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,             -- 'default' | 'halloween' | 'frost' | 'spring' | 'exam-week'
  display_name text not null,
  palette jsonb not null,                -- { sky, grass, accent, fog, ... }
  active boolean default false,           -- only one active at a time
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  created_at timestamptz default now()
);

-- Events (already exists via existing events API — extend if needed)
-- Verify the existing schema supports: QR check-in code, IRL flag, XP/TC rewards on check-in
```

RLS policies:
- Authenticated members can read all active rows
- T1/T2 can insert/update/delete
- Edits trigger `updated_at` via existing `update_updated_at_column()` function

#### B2. Game world reads from these tables

Replace hardcoded constants in `GameWorld.tsx`, `NatureModels.tsx`, etc. with Supabase fetches at world-mount time. Cache in React Query (already in repo). Fall back to bundled JSON defaults if Supabase is unreachable so dev mode still works.

**New module:** `web/lib/game/contentLoader.ts` — exports `useNPCPersonas()`, `useShopItems()`, `useActivePalette()`, all SWR/React-Query-cached.

#### B3. Content versioning + preview

- Admin can edit a row in any of the above tables
- Edits are NOT live immediately. They land in a `draft` state
- Admin can preview the world with their drafts active via `/student/dashboard?preview=draft-{userId}`
- A "Publish" button moves drafts to live (writes a `published_at` timestamp)
- Rollback: keep a `content_versions` table that snapshots before each publish

**New migration:** include in `013_content_pipeline.sql` (or `014_*`):
```sql
create table content_drafts (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,              -- 'shop_items' | 'npc_personas' | ...
  row_id uuid not null,
  draft_data jsonb not null,
  author uuid references profiles(id),
  status text default 'draft',           -- 'draft' | 'published' | 'discarded'
  created_at timestamptz default now(),
  published_at timestamptz
);
```

#### B4. Stub admin pages (full UI = next sprint)

Build the page shells now so next sprint's admin tooling sprint has somewhere to land:
- `/student/dashboard/admin/content/npcs` — list NPCs (read-only this sprint, CRUD next sprint)
- `/student/dashboard/admin/content/shop` — list shop items (read-only this sprint)
- `/student/dashboard/admin/content/palettes` — list palettes + which is active (read-only)
- `/student/dashboard/admin/content/events` — extend the existing events admin

T1/T2 only (gate via middleware).

---

## Out of scope

- LLM-driven NPC dialogue — separate sprint, spec at `specs/llm-npc-system.md`
- NPC sprite generation (Nano Banana) — held until NPC sprint
- Admin tooling UI for editing content (CRUD forms) — next sprint
- Multiplayer presence — Phase 2 deferred
- Mobile-specific game world layout — flagged but deferred
- Tier-1 punch list (settings tabs, oracle, leaderboard, bounty submit) — sprint after admin tooling
- Avatar Creator — Phase 3+

---

## Migration filename collision

Working tree currently has unstaged `web/supabase/migrations/013_recruitment_status_v2.sql` (recruitment work, not mine). When build agent writes the content-pipeline migration, use **`014_content_pipeline.sql`** to avoid stomping it.

---

## QA checklist (qa agent)

### Build/runtime
- [ ] `npm run build` passes
- [ ] `npm run lint` errors ≤ 39 (no regression)
- [ ] Dev server starts on port 3000 (or 3001), `/student/dashboard` renders
- [ ] No new console errors at world mount

### Visual (A1-A9)
- [ ] Terrain visibly undulates (not flat)
- [ ] Paths curve and edges fade into grass
- [ ] River curves, has visible flow animation
- [ ] HQ / Shop / Oracle Temple are visually distinct
- [ ] ~20 ambient props placed (signposts, stepping stones, fences, lanterns)
- [ ] Butterflies visible during day, fireflies at night
- [ ] Ambient audio plays after "enable sound" click; switches at time-of-day
- [ ] Footstep SFX syncs with player walk
- [ ] Player movement has bob, easing on direction change
- [ ] Building enter/exit transition fades smoothly

### Performance
- [ ] FPS ≥ 50 on Chrome desktop with everything enabled
- [ ] Mobile (iPhone Safari) — does not hard-crash; renders something even if degraded

### Content pipeline (B1-B4)
- [ ] Migration applies clean to a fresh local Supabase
- [ ] All 4 stub admin pages return HTTP 200 for T1/T2 users
- [ ] Game world fetches content from Supabase, falls back to bundled JSON when Supabase env vars missing
- [ ] Preview URL `?preview=draft-{userId}` renders world with that user's drafts

---

## Reviewer sign-off

David signs off when:
- 30-second first-impression test passes (Definition of Done 1-4)
- Admin can manually insert a shop_items row via Supabase dashboard and the item appears in the in-world shop after page reload (Definition of Done 6, abbreviated form before full admin UI lands)
- Migration applies clean
- Build + lint green
- No P0/P1 regressions

---

## Forward-looking: what next-sprint admin tooling looks like

(Documenting so build agent knows what they're laying foundation for.)

Next sprint will build CRUD UIs for the 4 admin content pages above:
- NPC editor: name, sprite upload, persona prompt textarea (for LLM), canned dialogue line editor, spawn zone selector, is-permanent toggle
- Shop editor: name, category, sprite upload, price, rarity, stock, activate/retire
- Palette editor: live color pickers showing world preview, schedule start/end dates
- Events editor: extend existing events admin with QR check-in generation, IRL flag, reward grant

After admin tooling: LLM-NPC implementation (see `specs/llm-npc-system.md`).
