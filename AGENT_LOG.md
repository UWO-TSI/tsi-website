# AGENT_LOG.md — Sprint Communication Board

> **Read on session start:** `CLAUDE.md` (1-page entry) → this file (your role + sprint state) → `specs/ux-status.md` (current backlog).
> **Append only to your role section.** Do not edit other agents' entries.

---

## Team — 3 Agents (set 2026-05-21)

| Agent | Owns | Reads First |
|-------|------|-------------|
| **build** | All code: design + implementation + schema. UI tweaks, new features, migrations, API routes. | `CLAUDE.md`, `specs/ux-status.md`, `specs/asset-stack.md`, role-specific specs (`specs/ux-*.md`) |
| **qa** | `npm run build`, `npm run lint`, runtime + visual tests, Playwright if available, bug reports → `specs/qa.md` | `CLAUDE.md`, `specs/qa.md` (your bible — historical waves), this file |
| **reviewer** | Sprint planning, design/code critique on `build`'s work, scope decisions, escalation to David. NOT an implementer. | Everything. Reviewer needs context across the whole project. |

**Why 3 agents and not 5:** the original claude-squad setup (mgmt/uxui/frontend/backend/qa) was right for greenfield + 60 parallel pages. Current scope is a defined punch list (Tier-1) + targeted Phase-2 features. Combined `build` avoids the cross-agent merge conflicts that plagued Waves 4.1 / 6. See `archive/logs/AGENT_LOG-2026-03-27-to-04-06.md` for the prior log.

---

## Previous Sprint — World-Building Polish + Content Pipeline Architecture ✅ CLOSED

All 13 deliverables shipped, QA Wave 14 PASS (commit `001eea8`), zero lint regressions. Sprint log preserved in the table below.

## Current Sprint — Admin Tooling CRUD (started 2026-05-27)

Spec: `specs/sprint-2026-06-admin-tooling.md`. Builds CRUD forms on top of the content pipeline (B3 API routes + B4 listing pages). 6 deliverables (C1-C6), ~4 week window.

| # | Deliverable | Owner | Status |
|---|-------------|-------|--------|
| C1 | NPC editor (slug/name/spawn_zone/persona_prompt/canned_dialogue/etc + draft/preview/publish/discard) | build | ✅ done — `NPCEditor.tsx` (480 lines in `components/portal/`), 2 routes (new + edit), inline validation, slug uniqueness check, new GET `/api/content/drafts/[id]` |
| C2 | Shop item editor (with rarity/stock/sprite_url) | build | ✅ done — `ShopEditor.tsx` (~560 lines in portal/), 2 routes (new + edit), rarity dropdown color-coded, sprite_url with 80×80 inline preview, unlimited-stock toggle nulls stock |
| C3 | Palette editor (7 color pickers + live preview + set-active) | build | ✅ done — `PaletteEditor.tsx` in portal/, 2 routes (new + edit), 7 HTML5 color pickers + swatch row preview, new atomic activate API (`POST /api/content/palettes/[id]/activate`), listing gains New + Edit + Set Active |
| C4 | Event editor (+ QR code + printable view + IRL/XP toggle) | build | ✅ done (f1d9d73) — `EventEditor.tsx` in portal/, 3 routes (new + edit + print), added migration `016_events_check_in.sql` (3 missing cols: is_irl/capacity/qr_check_in_code), `qrcode@^1.5.4` dep. XP-disabled-when-not-IRL guard per principle #3 |
| C5 | Version history + rollback + activity log | build | ✅ done — `VersionHistory.tsx` shared (per-table snapshot renderers: palette swatches/NPC fields+dialogue/shop fields), 3 history routes + activity log w/ filters + pagination, Restore creates a new draft via existing API. Hub gets log card |
| C6 | (Optional) Image upload to Supabase Storage | build | ✅ done — `ImageUploadButton.tsx` + `POST /api/content/upload` (multipart, T1/T2, 5MB cap, MIME allowlist), migration `017_content_assets_bucket.sql` (bucket + 4 RLS policies). Wired into NPC + Shop editors. Native FormData, no new deps |
| QA-C | End-of-sprint Wave 15 verification | qa | ✅ done — PASS, zero regressions |

---

## Previous Sprint — World-Building Polish + Content Pipeline Architecture

**Goal:** Make the world feel like a real place AND set up data-driven content architecture so admins can drop monthly content without code pushes. Full spec: `specs/sprint-2026-05-game-look-feel.md`.

**Why this, not NPCs:** David (2026-05-25) wants world-building focus first, NPC sprites + LLM-NPC logic deferred to a dedicated sprint after admin tooling. World needs to feel alive on its own merits before adding character life on top.

| # | Deliverable | Owner | Status |
|---|-------------|-------|--------|
| A1 | Terrain undulation (rolling hills, building footprints flat) | build | ✅ done — value-noise reused, amplitude 3.5→0.6, building flatten zones with smoothstep blend, path corridors stay flat, player y-damped 0.05s |
| A2 | Path softening (alpha-blended edges, curved splines) | build | ✅ done — new `Path.tsx` (Catmull-Rom, 48 segs, vec4 vertex-alpha via onBeforeCompile patch on MeshBasicMaterial), 3 curved paths replacing 6 straight quads |
| A3 | River curve + flow animation + fake sky reflection | build | ✅ done — new `River.tsx` (Catmull-Rom 96 segs × 5 rows, procedural water shader with 2 sin-wave flow + foam, bridge auto-aligned to spline); skipped fresnel reflection + terrain valley dip (follow-ups) |
| A4 | Building silhouette variety (HQ vs Shop vs Oracle Temple) | build | ✅ done — procedural composites for hq/shop/oracle/temple; HQ banner pole+flag, Shop awning+sign, Oracle Temple taller-than-wide with dome+spire+2 brazier flames (flicker animation, point-light at each); house+boards untouched |
| A5 | Ambient props (signposts, stepping stones, fences, lanterns) | build | ✅ done — `AmbientProps.tsx` (196 lines, 18 props): 4 signposts (arrow planks rotated via atan2 toward target), 6 stepping stones at river bend (perpendicular to spline tangent), 4 picket fences, 4 lanterns with emissive panes + pointLight |
| A6 | Ambient life particles (butterflies/leaves/birds/fireflies) | build | ✅ done — new `AmbientLife.tsx` (5 butterflies w/ flapping wing-quads day, 10 fireflies w/ pulsing emissive night, 40-instance leaf+pollen drift always, 2 background birds day); replaced inline points-based Butterflies; phase derived from wall-clock at 60s interval |
| A7 | Ambient audio (4 time-of-day loops + footstep/click SFX) | build | ✅ done (infra only — audio files defer to content drop) — `audio.ts` singleton w/ 800ms RAF crossfade + missing-file graceful fallback, `useAmbientAudio`/`useSFX` hooks, `AudioController` corner widget (top-right enable prompt → bottom-right mixer popover with 3 sliders, persist localStorage), footstep SFX synced to PlayerAvatar movement |
| A8 | Player movement polish (easing, bob, target indicator) | build | ✅ done — walk bob sin(t*π*8)*0.05, idle breathing sin(t*π)*0.02, blended via breathBlendRef (0.3s lerp), speed-scaled frame rate, new `MoveTargetIndicator.tsx` (expanding ring 0→1.5, 400ms self-destruct, terrain-aware) |
| A9 | Transition + loading polish (fade, Suspense fallback) | build | ✅ done — TransitionOverlay timings retuned (300/200/500), GameLoadingScreen extracted with ASCII banner + 1Hz blinking cursor, Suspense wrap on GameWorld + reused as next/dynamic loading. Sprite placeholder skipped (PlayerAvatar uses non-Suspense TextureLoader — refactor out of budget) |
| B1 | Migration `014_content_pipeline.sql` (npc_personas, shop_items, seasonal_palettes, content_drafts) | build | ✅ done (1ce7281, reviewed + fixed + merged) |
| B2 | Game world reads from Supabase tables (SWR + JSON fallback) | build | ✅ done (bdd301e, palette-aware TOD = follow-up) |
| B3 | Content draft + preview URL system | build | ✅ done — migration `015_content_versions.sql` (snapshot table, immutable), 3 API routes (drafts CRUD + publish + discard), PreviewBanner.tsx (yellow fixed-top with Publish/Exit), contentLoader hooks auto-detect `?preview=draft-{id}` and merge draft into live data |
| B4 | Stub admin pages at `/student/dashboard/admin/content/{npcs,shop,palettes,events}` (read-only this sprint) | build | ✅ done — 4 read-only listing pages w/ T1/T2 gate, back link, "read-only" banner, palette swatches, events fetched via existing `/api/events`. Admin hub card added |
| QA-baseline | Run `npm run build` + `npm run lint` on current main, log to `specs/qa.md` Wave 12 | qa | ✅ done (507bcb1) |
| QA-sprint | Wave 14 end-of-sprint verification (build/lint/types/runtime smoke/all 13 deliverables/audio hotfix) | qa | ✅ done (001eea8) — PASS, zero regressions. Visual WebGL test still pending |

**Definition of Done:** see sprint spec §"Definition of Done" — visitor feels in-a-place / in-a-world / in-control / in-quality + admin can insert shop_items row via Supabase dashboard and see it appear in-world.

**Migration filename note:** working tree has `013_recruitment_status_v2.sql` (recruitment scope, not mine). Build agent uses **`014_content_pipeline.sql`** to avoid collision.

---

## File Ownership

- `web/app/student/dashboard/**` → build
- `web/components/game/**` → build
- `web/components/portal/**` → build
- `web/supabase/migrations/**` → build (new migrations only — never edit applied ones)
- `specs/qa.md` → qa
- `specs/ux-status.md` → reviewer (sprint planning) + build (status updates)
- `AGENT_LOG.md` → all agents append to own section
- `CLAUDE.md`, `web/app/student/STUDENT_SYSTEM_BIBLE.md` → reviewer only

**Off-limits for portal work:** anything under `web/app/(site)/`, `web/app/student/apply/`, `web/components/recruit/`, `web/components/admin/`, `web/components/sections/`, migrations 001_recruitment / 009 / 010 / 011 / 012. That's the recruitment system — separate scope.

---

## Commit Prefixes

- `[build]` — code changes
- `[qa]` — test results, lint fixes, bug reports
- `[review]` — spec edits, sprint planning, scope decisions

Example: `[build] settings: split into 4 tabs (Profile/Social/Appearance/Account)`

---

## Blocked / Needs Attention

*(empty)*

---

## build

### 2026-05-28 — Sprint F: Action controls

#### 2026-05-21 — Sprint F1.1: camera-relative WASD + mouse-drag camera + scroll zoom + sprint

- New `web/lib/game/cameraBasis.ts` exports `getCameraForwardXZ(camera)` — projects camera forward onto XZ plane, normalized; falls back to `(0,1)` when degenerate.
- `PlayerAvatar.tsx`: replaced world-absolute WASD with camera-relative basis. `forward = (fx,fz)` from helper, `right = (-fz, fx)`. W/S → ±forward, D/A → ±right. Shift held → 1.6× speed multiplier (only when keyboard moving, not click-to-move). Arrow keys removed from movement — reserved for camera in GameWorld. Keydown/keyup now guards against typing in inputs/textareas/contentEditable. Click-to-move kept as alternative input (Q3=A): keyboard takes priority while held.
- `GameWorld.tsx`: CameraControls now allows yaw + limited pitch (polar 60°–110°, ~±30°/+20°), distance 8–25, dollySpeed 1.0, azimuthRotateSpeed 1.0, polarRotateSpeed 0.6, draggingSmoothTime 0.05, smoothTime 0.15. `useEffect` rebinds `cc.mouseButtons` imperatively (left=NONE so click-to-move ground raycast fires, right=ROTATE, wheel=DOLLY, middle=NONE). New arrow-key handler + `useFrame` calls `cc.rotate(±0.02, ±0.015, true)` per held arrow, with input-typing guard.
- FOV widen on sprint skipped this dispatch — requires camera plumbing across components.
- Verification: `tsc --noEmit` clean, `npm run lint` 74/59 (=cap), `npm run build` ✓.

### 2026-05-28 — Sprint E: Community loops

#### 2026-05-21 — Sprint E8+E9: emote admin editor + ghost-replay settings toggle

- E8: `EmoteEditor.tsx` mirrors C1 NPCEditor (slug/display_name/animation_key/icon_url+ImageUploadButton/unlock_condition/active). New listing at `/admin/content/emotes` (queries `emote_types` directly to include inactive rows), `/new` and `/[id]/edit` wrappers, both tier-gated. Added Emotes card to admin hub.
- Allowlisted `emote_types` in `/api/content/drafts` POST and `/api/content/drafts/[id]/publish` (no DB CHECK constraint to touch).
- E9: `useGhostReplaySetting` hook via `useSyncExternalStore` (avoids set-state-in-effect lint) backed by `localStorage["tsi.ghosts.enabled"]`. `GameWorld.Scene` now gates `ghosts.slice(0,10).map(...)` on the hook. Settings page got a "World" section with the toggle.
- `tsc --noEmit` clean. `npm run lint` 74/59 (= cap). `npm run build` ✓ — 3 new emote routes registered.

#### 2026-05-21 — Sprint E2+E3: emote menu + player emote animation

- Type: `EmoteType` in `web/lib/game/contentTypes.ts`. Hook: `useEmoteTypes()` in `contentLoader.ts` (SWR, 5-min dedup, falls back to bundled `DEFAULT_EMOTE_TYPES` in `web/data/content-defaults.ts` — 5 emotes matching migration 019 seed).
- `EmoteMenu.tsx` (~180 lines): DOM overlay outside R3F, bottom-center row of 5-8 buttons, ESC + backdrop closes, fade-in 200ms, emoji glyph from `animation_key` (👋🕺😂👉🪑) or first-letter pill fallback when no icon.
- `GameWorld.tsx`: added `emoteMenuOpen` + `activeEmote` state at root (sibling to `activeNPC`), `playerPosRef` (Vector3) lifted out of Scene via prop, E key listener guards `INPUT/TEXTAREA/contentEditable` + active NPC chat. `handleEmotePick` sets emote, auto-clears via timer at 3.5s, POSTs `/api/emotes/log`. Corner Smile button at `bottom: 16, right: 120` (left of AudioController).
- `PlayerAvatar.tsx`: new optional `activeEmote` prop, renders `<Html>` bubble at `[0, 2.6, 0]` with the matching emoji + 600ms bounce keyframe. Parent clears emote, child unmounts.
- `POST /api/emotes/log`: SSR `createClient`, validates UUID + world coords in [-50, 50], INSERTs into `emote_logs` with `user_id = auth.uid()` (RLS-enforced via user-scoped client, NOT service role).

No new dependencies. `tsc --noEmit` clean. `npm run lint` 74/58 (= baseline). `npm run build` ✓, `/api/emotes/log` registered as dynamic (ƒ).

#### 2026-05-28 — Sprint E1: community loops migration

Wrote `web/supabase/migrations/019_community_loops.sql` per spec §E1. Four tables + RLS + indexes + seed. Not applied anywhere.

- `emote_types`: slug UNIQUE, display_name, animation_key, icon_url, unlock_condition (nullable), active, created_at. Mirrors content-pipeline shape — E8 editor manages later.
- `emote_logs`: user_id (CASCADE) + emote_type_id (CASCADE) + world_x/z REAL + triggered_at. Indexes on triggered_at DESC and (world_x, world_z) for proximity.
- `guestbook_entries`: user_id (CASCADE), message TEXT with `length BETWEEN 1 AND 200` CHECK, hidden BOOLEAN DEFAULT FALSE, created_at. Index on created_at DESC.
- `player_positions`: user_id PRIMARY KEY (upsert path), world_x/z, recorded_at. Index on recorded_at DESC for "recent ghosts" queries.
- RLS per 014 pattern, `auth.uid()` wrapped in `(select auth.uid())`. emote_types: T1/T2 manage + public SELECT where active. emote_logs: authenticated SELECT (proximity lookups are public), self INSERT, T1/T2 DELETE. guestbook: SELECT where not hidden + T1/T2 SELECT all, self INSERT, T1/T2 UPDATE (flip hidden), T1 DELETE. player_positions: authenticated SELECT, self INSERT/UPDATE only.
- Seed: 5 emote types (wave/dance/laugh/point/sit) — icon_url + unlock_condition left NULL for E8 fill.

Verification: `tsc --noEmit` clean. `npm run lint` 74/58 (baseline match). `npm run build` ✓.

### 2026-05-27 — Sprint D6+D7+D8: moderation + memory wipe + spend widget

Closing the LLM-NPC sprint. Three pieces, one commit, all components under `web/components/portal/`.

- D6 moderation: `web/app/student/dashboard/admin/npc-conversations/page.tsx`. T1/T2 gated via `useUser()`. Filters: NPC dropdown (active personas), user search (`ilike display_name`), date range, "flagged only" toggle (default ON). Table: time, user, NPC, user_message (60-char truncate + per-row more/less), npc_response (same), flagged badge, actions. Pagination 25/page (fetch PAGE_SIZE+1 to detect more). Per-row: Mark Resolved (only when flagged) + Wipe Memory (uses D7 endpoint with `user_id` override). Delete button skipped — no DELETE endpoint in spec. Resolve endpoint at `/api/npc/conversations/[id]/resolve` (tier-gate T1/T2, service-role UPDATE flagged=false). Added admin hub card (red icon).
- D7 memory wipe: standalone page at `web/app/student/dashboard/settings/npc-memories/page.tsx` (settings page is dense — chose discrete page + link card from main settings via Brain icon). Queries `npc_memories` joined with `npc_personas(display_name)` for current user, ordered by `last_interaction_at desc`. Per row: NPC name, interaction_count, relative-time last seen, Wipe button → confirmation modal with spec copy → POST `/api/npc/memories/wipe` body `{ npc_id }`. Endpoint also accepts optional `user_id` (T1 only, used by D6 admin wipe). Auth required, service-role DELETE. Backdrop click + cancel button close modal.
- D8 spend widget: `web/components/portal/NPCSpendWidget.tsx` rendered on admin hub home above the section grid, only when `userTier === 1`. SWR key `npc-spend` with `refreshInterval: 5min` + manual refresh button (spin animation on isLoading). Shows tokens_in/out (formatted k/M), estimated cost in 4 decimals, top-5 chattiest users, top-5 most-talked-to NPCs side-by-side. Endpoint `/api/npc/spend` (T1-only, current calendar month, aggregates `npc_conversations` in-memory: sums + Map-based counts, sort+slice top 5, hydrates names from `profiles` + `npc_personas`). Cost = (in × 0.25 + out × 1.25) / 1M, rounded to 4 decimals.

Verification: `tsc --noEmit` clean. `npm run lint` 74/58 (errors at baseline). `npm run build` ✓ 46s; 3 new API routes + 2 new pages confirmed in route manifest.

### 2026-05-27 — Sprint D4: NPC chat overlay UI

`NPCChatOverlay.tsx` (~470 lines) in `components/game/`. DOM overlay mounted alongside `AudioController` in `GameWorld`, outside R3F Canvas. Props `{ npc, onClose }`; visible when `npc !== null`. State lifted to `GameWorld` via `useState<NPCPersona | null>` so D5 can wire sprite clicks via the existing `setActiveNPC` (currently `void`-suppressed until then).

- History: `GET /api/npc/conversations?npc_id=&limit=10` (new, ~30 lines) — RLS-scoped to user, returns oldest-first turns.
- Send: `POST /api/npc/chat` (D3). Error mapping: 401 → sign-in msg + auto-close 3s, 404 → close, 429 → rate-limit copy, 400 → server error text, 500/network → "Couldn't reach the server" + Retry button.
- Report: `POST /api/npc/conversations/[id]/flag` (new, ~45 lines, option **a** from spec). Verifies row ownership via user-scoped client, then service-role UPDATE `flagged=true`. Just-sent turns (no DB id yet) toast "report after refresh".
- UX: ESC + backdrop click close; portrait is hue-hashed gradient quad with display_name (sprite swap in D5); spawn_zone tag pill; user/NPC bubbles; thinking dots staggered CSS keyframes; spinner on Send while pending; input disabled while sending. Typewriter reveal at 30ms/char via `setInterval` in a child `NPCReplyText` component — `count` only state, `animate=false` short-circuits to full text (avoids `set-state-in-effect` lint rule). Blinking cursor `_` until done.

Verification: `tsc --noEmit` clean. `npm run lint` 74/56 (baseline match). `npm run build` ✓ 18.2s; 3 NPC routes present (`chat`, `conversations`, `conversations/[id]/flag`).

### 2026-05-27 — Sprint D1: NPC memory migration

Wrote `web/supabase/migrations/018_npc_memories.sql` per spec §D1. Two new tables (`npc_memories`, `npc_conversations`) + RLS + indexes. Not applied anywhere.

- `npc_memories`: id, npc_id (CASCADE), user_id (CASCADE), memory_state JSONB default `{}`, last_interaction_at, interaction_count, UNIQUE(npc_id, user_id). Indexes on user_id and last_interaction_at DESC.
- `npc_conversations`: id, npc_id (SET NULL — keep logs if NPC deleted), user_id (SET NULL), user_message, npc_response, tokens_in/out, flagged, created_at. Composite indexes (user_id, created_at DESC) + (npc_id, created_at DESC) + partial on `flagged = TRUE`.
- RLS: memories — users SELECT own + T1 SELECT all. Conversations — users SELECT own + T1/T2 SELECT all (moderation). Zero client INSERT/UPDATE/DELETE policies; chat API runs as service role per spec. `auth.uid()` wrapped in `(select auth.uid())` for query caching (014 pattern).

Verification: `tsc --noEmit` clean. `npm run lint` 74/56 (baseline match). `npm run build` ✓ in 20.9s.

### 2026-05-27 — Sprint C4: Event editor + QR check-in + printable view

`EventEditor.tsx` in `components/portal/` mirrors NPC/Shop UX but skips the draft pipeline — events live outside `content_drafts` and save directly via supabase client (RLS lets authenticated users insert/update; T1/T2 gate sits at the page level via `UserContext`).

- Schema audit: `events` table in `001_initial_schema.sql` already has `title / description / event_type / start_time / end_time / location / status / xp_reward / tc_reward / created_by`. Missing: `is_irl`, `capacity`, `qr_check_in_code`. Added `016_events_check_in.sql` (NOT applied to any DB).
- Editor: title, description, event_type dropdown (existing 7-value CHECK), start/end datetime-local, location, unlimited-capacity toggle + capacity, is_irl toggle (xp force-zeroed when off, per design principle #3), xp_reward (disabled when is_irl=false), tc_reward. End-time-after-start validation. Save → direct insert/update; new-event success redirects to `/edit` so admin can grab the auto-generated QR.
- QR: `qrcode` (^1.5.4, MIT, ~75KB) + `@types/qrcode` installed. `QRCode.toDataURL(checkInUrl, { width: 240 })` rendered in the editor; checkInUrl points at `tethos.org/student/check-in?code=<uuid>` — the runtime route is a later sprint.
- Print view at `/admin/content/events/[id]/print` overrides dark mode with `bg-white text-black`, renders 400px QR + title + date/time + location + URL fallback. `@media print` hides the "Print" button. `window.print()` on click.
- Listing: dropped the read-only banner, added "New Event" header button + per-row Edit / Print QR links.

Verification: `tsc --noEmit` clean. `npm run lint` 74 errors / 56 warnings (baseline match — none of mine). `npm run build` ✓, 3 new routes present (`events/new`, `events/[id]/edit`, `events/[id]/print`).

### 2026-05-27 — Sprint C3: Palette editor

`PaletteEditor.tsx` in `components/portal/` mirrors NPC/Shop pattern: form state, draft state machine, save/preview/publish/discard buttons, slug uniqueness check (live table + open drafts).

- 7 HTML5 `<input type="color">` pickers (sky/grass/accent/fog/water/building_primary/building_accent) in a 2-col grid, each row shows label + uppercase hex. Swatch-row preview below.
- `draft_data.palette` is nested JSONB (matches table column).
- Atomic activate: new `POST /api/content/palettes/[id]/activate` runs two sequential UPDATEs via service role (clear current active → set target). Window between is tiny; comment flags low-concurrency limitation.
- Listing gains "New Palette" header button, per-card Edit link + Set Active button (disabled when row already active). Read-only banner dropped. Reload after activate.
- `scheduled_end` must be after `scheduled_start` if both present.

Verification: `tsc --noEmit` clean. `npm run lint` 74/56 (baseline match). `npm run build` ✓, 3 new routes present (`palettes/new`, `palettes/[id]/edit`, `api/content/palettes/[id]/activate`).

### 2026-05-21 — Sprint B1: Content pipeline migration

Wrote `web/supabase/migrations/014_content_pipeline.sql` (worktree branch `build/sprint-b1-content-pipeline`). Adds the four content-pipeline tables: `npc_personas`, `shop_items`, `seasonal_palettes`, `content_drafts`. Defines `update_updated_at_column()` (no prior migration ships it) and wires it to `npc_personas` only — `shop_items`, `seasonal_palettes`, and `content_drafts` have no `updated_at` column per spec.

**Decisions / judgment calls:**

- Palette JSONB shape: object with keys `sky / grass / accent / fog / water / building_primary / building_accent` as specified. Not validated by Postgres — game world is the consumer.
- Single-active palette: enforced via partial unique index `idx_seasonal_palettes_single_active ON (active) WHERE active = TRUE`. Cleaner than a CHECK + trigger, but you can only have one row at all where `active = TRUE`, which is the intent.
- RLS tier-gating pattern: `(SELECT tier FROM profiles WHERE id = auth.uid()) IN (1, 2)`. `001_initial_schema.sql` doesn't have tier-gated policies — it uses `auth.role() = 'authenticated'` only. I used the subquery pattern because the spec explicitly asked for T1/T2 gating. If you want the bouncer at the API layer instead, easy revert (drop the 12 tier-gated INSERT/UPDATE/DELETE policies, replace with `auth.role() = 'authenticated'`).
- `content_drafts.author` — `ON DELETE SET NULL` (drafts outlive the author leaving the org). Status check constraint covers `draft / published / discarded`.
- `content_drafts` SELECT is author-only. T1/T2 can UPDATE/DELETE any draft (review queue). T3+ INSERT works via the generic `authenticated` INSERT policy (spec said "T3+ can INSERT on `content_drafts` only" — covered, since the only INSERT they have privilege for among the four tables is this one).
- `shop_items.sprite_url` left nullable. Sprite drop is a later sprint; making it NOT NULL would break the workflow where an admin drafts an item before art lands.
- Seed: 2 NPCs, 3 shop items, 2 palettes. NPC persona prompts written in-line. Halloween palette colors are my own picks within the spec's "orange/purple/black tones" guideline — feel free to recolor.
- `ON CONFLICT (slug) DO NOTHING` on all seeds, so re-running the migration is safe.

**Did not seed `content_drafts`** — would need a real `profiles.id` UUID, which we can't hardcode.

**Questions for reviewer:**

1. Tier-gated RLS via subquery on every write — OK, or move to API-layer enforcement? Subquery executes per row; if shop_items grows to thousands of rows and writes are common (they won't be — admin-only), worth knowing.
2. `npc_personas.canned_dialogue` defaulted to `'{}'` not NULL. Spec said `text[]` without nullability — I picked empty-array-as-default because consuming code is simpler.
3. Should `seasonal_palettes` SELECT policy let authenticated members read inactive ones too (for preview / admin list)? Currently filtered to `active = TRUE` per spec. The admin stub page in B4 will hit this — flagging.

No DROP statements. No code touched. Branch ready for review.

### 2026-05-21 — Sprint A6: Ambient life

New `web/components/game/AmbientLife.tsx`. Procedural-only, no asset loads:

- **Butterflies (day, 5):** group per insect with two `planeGeometry` wing-quads hinged off-center, 12Hz flap via `useFrame`, opposing phase. Body is dark box between wings. Pastel color random per butterfly. Sine-wave path around a per-instance home, `atan2` heading. Clamped to ±30 map bounds, terrain-aware y.
- **Fireflies (night, 10):** small emissive sphere, `emissiveIntensity` pulses 0.7-2.1. Wander pattern via offset sinusoids. Skipped per-firefly point lights for perf (10 dynamic lights stack with existing lamp lights).
- **Leaf/pollen drift (always, 40):** `InstancedMesh` of 0.06 planes with per-instance vertex colors (50/50 pollen `#E0D090` / leaf `#A8D080`). Falls at delta * 0.5, swayed by `sin(t*0.5+offset)`, respawns at y=8 when below 0.3. Per-instance position state lives in refs (compiler immutability) seeded from useMemo via useEffect.
- **Birds (day, 2):** V of two angled box-mesh lines, circling at radius 16-20 / y=12, facing heading, wing-flap via `rotation.z = sin(t*8)*0.3`.

TOD phase derived from `new Date().getHours()` mapped via `hourToPhase` (dawn 5-7, day 7-17, dusk 17-20, night otherwise) — refreshes via 60s interval `setInterval`. Did not refactor `TimeOfDayCycle`; it still reads wall-clock independently per the spec.

Removed the old inline points-based `Butterflies` in `GameWorld.tsx` (and orphaned `seededRandom`) since the new component supersedes it.

Verification: `tsc --noEmit` clean, `npm run lint` 74 errors / 56 warnings (= Wave 12 baseline), `npm run build` ✓ 11.1s. One file added, GameWorld lost ~40 lines net.

---

## qa

*(append your entries below — log waves continue from Wave 11 in `specs/qa.md`)*

### 2026-05-25 — Wave 12 baseline

- Build PASS on `6393d48`: 84 routes (+23 vs Wave 11), 72 static pages, compiled in 11.4s. Only pre-existing warnings (middleware deprecation, workspace-root inference).
- Lint: 74 errors / 56 warnings (Wave 11 was 39/53 — **+35 errors**). Mostly recruitment-side `no-explicit-any` + newly-active `react-hooks/set-state-in-effect` and `react-hooks/immutability` rules. Portal-scope files not the dominant offender. Full breakdown in `specs/qa.md` Wave 12.
- Dev server smoke: `/student/dashboard` returns 307→200 (login redirect via middleware — expected without session); `/` and `/student/login` 200. Pre-existing :3000 dev process belonged to user, not QA.
- Heads-up to build: new hook rules will fire on any added React effects; re-baseline planned at sprint end.

### 2026-05-25 — Wave 13: B1+B2 verification — **PASS**

- HEAD `dbc571f`. Verified deltas from `1ce7281` (migration 014) and `bdd301e` (content loader + palette wiring).
- Build: 84 routes, 72 static, compiled clean. `tsc --noEmit` exit 0.
- Lint: **130 problems (74/56)** — exact Wave 12 match, zero regressions.
- Migration 014: 4 tables, RLS on all 4, 8 SELECT policies (4 active + 4 T1/T2-all), `(select auth.…)` wrapping throughout, partial unique index for single-active palette, seeds (2 NPCs / 3 shop items / 2 palettes) match `content-defaults.ts` exactly.
- Hooks exist (`useNPCPersonas`/`useShopItems`/`useActivePalette`); `swr ^2.4.1` in package.json; GameWorld imports + uses `activePalette.palette.sky`/`.fog` (other palette keys still unused → reviewer-flagged follow-up).
- Runtime smoke on `:3050`: `/student/dashboard` 307, `/student/dashboard/shop` 307, `/api/shop` 401. With `.env.local` renamed: 200/200/200 with `{"products":[]}` — fallback path works. Restored env. No new runtime warnings.
- B3 and A1 unblocked from QA side. Full report: `specs/qa.md` Wave 13.

### 2026-05-27 — Wave 15: Admin Tooling sprint verification (C1-C6) — **PASS**

- HEAD `41d9d0a`. End-of-sprint gate for Admin Tooling CRUD sprint.
- Build: **107 routes, 31.1s** (+16 vs Wave 14, exactly matches sprint scope: 2 NPC + 2 shop + 3 palette + 3 event + 4 history/log + 1 upload + 1 single-draft = 16). `tsc --noEmit` exit 0.
- Lint: **74 errors / 56 warnings** — exact Wave 14 match, **zero regressions** from a 6-deliverable sprint.
- All 6 deliverables structurally verified: C1 (NPCEditor + `mode` prop + 2 routes + new `GET /api/content/drafts/[id]`), C2 (ShopEditor + rarity/category/unlimited-stock + sprite preview), C3 (PaletteEditor + 7 HTML5 color pickers via `COLOR_KEYS` × `<ColorRow>` + atomic activate API), C4 (EventEditor + 3 routes + migration 016 + `qrcode@^1.5.4` dep), C5 (VersionHistory + 3 history routes + activity log w/ filters + admin hub card), C6 (ImageUploadButton + multipart upload route w/ T1/T2 gate + migration 017 + wired into NPC/Shop editors).
- Migration syntax spot-check: 016 uses `ADD COLUMN IF NOT EXISTS` ×3 (idempotent); 017 uses `INSERT … ON CONFLICT DO UPDATE` + `DROP POLICY IF EXISTS` before each `CREATE POLICY` (idempotent), header comment cites Cloud Supabase dashboard-fallback path.
- Off-limits check: zero editor components in `web/components/admin/` — all 6 editors correctly under `web/components/portal/`. Recruitment scope untouched.
- Runtime smoke (port 3000): all 5 new admin pages 307 (middleware auth gate), `/api/content/drafts` 401, `/api/content/upload` GET 405 (POST-only export). All match spec.
- Migrations 016 + 017 not applied (per directive). Full report: `specs/qa.md` Wave 15.

### 2026-05-27 — Wave 14: End-of-sprint verification (13 deliverables + audio hotfix) — **PASS**

- HEAD `791aa39`. End-of-sprint gate for World-Building + Content Pipeline sprint.
- Build: **91 routes, 77 static, 10.1s**. `tsc --noEmit` exit 0.
- Lint: **74 errors / 56 warnings** — exact Wave 13 match, **zero regressions** from a 13-deliverable sprint.
- All 13 deliverables structurally verified: A1 (terrain amp 0.6 + footprints), A2 (Catmull-Rom Path with vec4 pathColor), A3 (River 2 sin-wave shader), A4 (4 procedural building variants + brazier flicker), A5 (18 ambient props), A6 (butterflies/fireflies/leaves/birds), A7 (audio singleton + AudioController DOM overlay), A8 (MoveTargetIndicator + walk bob + idle breath lerp), A9 (Suspense + GameLoadingScreen), B1 (migration 014 = 4 tables + partial unique index), B2 (3 content hooks), B3 (migration 015 + 3 draft API routes + PreviewBanner), B4 (4 admin stub pages).
- **Audio hotfix verified**: `cachedSnapshot` field, `computeSnapshot()` method, `getState()` returns cached reference (no infinite loop), `notify()` recomputes before broadcast.
- Runtime smoke (port 3000, existing server): `/` 200, `/student/dashboard` 307, all 4 admin content stubs 307 (middleware auth gate), `/api/content/drafts` 401. All match spec.
- Not visually tested (no Playwright session — would conflict with David's interactive dev server). Recommend a visual pass before next sprint if desired.
- Notes: build dropped 23.7s → 10.1s (likely turbopack cache warm); palette wiring still consumes only sky+fog (Wave 13 carryover). Full report: `specs/qa.md` Wave 14.

---

## reviewer

### 2026-06-01 — Autonomous Visual + Perf Burst

David authorized sustained autonomous work ("you have unlimited credits
and time and only this one session, I will be stepping away and I
expect full product when I'm back"). Output:

**Visual overhaul (G-series):**
- G1.1 ✅ Empty PROC_VARIANTS in Building.tsx → real GLB buildings load
  (HQ, Shop, Oracle Temple, House — all ~450-700KB Kenney models)
- G2 ✅ Swap procedural stones + fences → Kenney NatureRock + NatureFence
- G4 ✅ PostFX (bloom + vignette) with bloom default-off
- G5 ✅ Procedural grass texture overlay (256×256 noise, no asset blob)
  + fog 50→25 / 100→55 (masks island perimeter into sky)

**Performance (P-series):**
- P2 ✅ Instanced rendering for trees/bushes/flowers via drei <Instances>
  (one draw per sub-mesh per GLB instead of one per position)
- P6 ✅ Shadow pass cost identified (~7 FPS); shadows default-OFF
- P4 ✅ Memory disposal audit — Path/River/Terrain dispose geometry +
  material on unmount (prevents 30-min M1 leak)
- shadow-cast disabled on small ground props (flowers/mushrooms/rocks)

**Settings infrastructure:**
- P3 ✅ In-game graphics settings panel (gear icon, 4 toggles, persists
  to localStorage). Auto-detect from navigator.deviceMemory.
- Lite mode auto-on for ≤4GB devices.

**Test infrastructure (other Claude's recommendation):**
- Extracted NPC chat helpers (containsProfanity, extractMemoryUpdate,
  mergeMemory, rate limiter, validation) into web/lib/npc/chatHelpers.ts
- 32 vitest tests, all pass. `npm test` and `npm run test:watch` added.

**FPS measurements (Playwright on M1 ANGLE Metal, 1440×900):**
- Baseline (start of burst): 47 FPS
- After full burst: 50-60 FPS (variance from headless env)
- Lite mode: 60 FPS pegged
- Real M1 native browsing typically 5-10 FPS faster than headless test.

**Commits this burst (~14):**
069a1d1 P2 instances · 5b3a2a2 shadow opt-in · dd77b77 grass+fog ·
cf64c94 graphics panel · 4e6047a dispose audit · 6b1018c 32 tests ·
006ba79 lint cleanup · bbff2f4 GLB unblock · 062a23f PostFX · 0ada20d
nature swap · 2f686ec lite mode · 7ed78b7 perf budget · ebb13f6 bug
fixes · 3106f61 shadow tweak

**What David needs to do on return:**
1. Apply pending migrations to remote Supabase (016-021 — adds events
   check-in cols, content_assets storage bucket, npc_memories,
   community_loops, player_inventory + achievements, profiles bio/year).
   All syntax-clean, idempotent, NOT applied autonomously (irreversible).
2. Pull `.env.local` ANTHROPIC_API_KEY if not set (NPC chat needs it).
3. Eyeball localhost:3000/student/dashboard — see real buildings + grass.

**What's NOT in this burst (out of scope or risky):**
- Nano Banana sprite generation for NPCs/player (separate sprint)
- Audio files (silent placeholders — separate content drop)
- Real multiplayer / Colyseus (deferred per principle)
- Apply migrations to prod DB (irreversible, David's call)

### 2026-06-01 — Burst 10 (stats HUD)

- **P33 StatsHUD** (52f0c59). Top-left DOM pill next to the hamburger
  showing Lv.N + 80px XP progress bar toward the next level + comma-
  formatted TC balance. Reads from useUser() — silent until profile
  fetch resolves. Mirrors the sidebar player block so the player can
  see their stats without opening the menu.

End-of-session running totals (continuation across bursts 2-10):
- 20 visible features shipped: P8, P9, P10, P13, P15, P16, P18, P19,
  P21, P22, P23, P25, P27, P28, P29, P30, P31, P32, P33 + import
  cleanup.
- 2 attempted+reverted: P12, P17 (sun/moon disc — deferred).
- 1 scope-killed: P20 (NPC nudge — duplicated existing signaling).
- Lint baseline: 4 pre-existing errors, 0 warnings (down from 3).
- Tests still green (32/32).

### 2026-06-01 — Burst 9 (avatar + TOD badge + cleanup)

David called out the loop stop again. Resumed iteration with concrete
shipped changes:

- Dropped 3 unused `NatureModels` imports — lint baseline tightened
  from 3 warnings to 0 (dcf0cb5).
- **P31 larger player avatar** (b050ff5). Sprite plane 1.0×1.4 → 1.4×2.0
  (~40% larger), SPRITE_BASE_Y bumped 0.8 → 1.1 to keep feet on ground,
  shadow disc 1.0 → 1.3. Player reads clearly at the wider FOV from P22.
- **P32 time-of-day badge** (62da325). Top-right DOM pill showing
  "Dawn / Day / Dusk / Night". Per-phase palette: warm peach, cream,
  twilight purple, deep blue. Positioned below the sound-enable toast
  so it doesn't overlap.

### 2026-06-01 — Burst 8 (jump puff + spawn signpost)

- **P29 landing puff** (e48f6ba). Extended the puffs state to carry an
  optional base scale. On jump-arc completion, push a puff at 1.6×
  footstep size — completes the footstep / landing kinetic loop.
- **P30 signpost** (656085f). 4-arm wooden post at the spawn point
  (0, -12, 0). Each arm rotates to atan2(dx, dz) pointing at HQ,
  Oracle, Shop, or House — Html labels make the destination explicit.
  New players can navigate without touching the camera.

End-of-continuation totals: 17 visible features shipped across bursts
2-8 (P8, P9, P10, P13, P15, P16, P18, P19, P21, P22, P23, P25, P27,
P28, P29, P30 — plus P12 and P17 deferred). World now reads as alive:
buildings load instantly, trees sway, moths circle lamps at night,
dust drifts around the player, NPCs glow when noticed, river chevrons
show flow direction, and signposts guide first-time visitors. Test
suite green, lint baseline preserved.

### 2026-06-01 — Burst 7 (moths + footstep dust)

- **P27 lamp moths** (8a2f219). 3 small white-cream spheres orbit each
  lit lamp at radius 0.45, phase-offset. Mounted only when the lamp is
  on (dusk/night/dawn). 3 × 6 lamps = 18 tiny spheres at night only.
- **P28 footstep dust** (4f720fd). Each footstep tick spawns a small
  CircleGeometry on the ground behind the player's travel direction.
  Grows + fades over 0.6s, then unmounts. Reinforces movement weight
  without touching the avatar sprite.

### 2026-06-01 — Burst 6 (FOV + dust motes + NPC halo)

- **P22 wider camera** (b9c444e). FOV 50→58, initial position
  [0,12,-20]→[0,14,-22]. Significantly more world fits in the default
  view — buildings, river, paths, and lamp posts all visible at once.
- **P23 dust motes** (0583252). 30-point Points cloud parented to a
  group that tracks player position. Deterministic LCG seeds the
  positions; per-vertex sine drift in useFrame. Reads as pollen / dust
  hanging in the air. Unmounted in lite mode.
- **P25 NPC warm halo** (39a1aa7). Behind the existing NPC quads, a
  large soft warm-cream plane at 28% opacity gated by `noticed` state.
  Eye picks up the closest character from across the map before
  reading the nameplate.

Session totals across this continuation (burst 1 was the previous
session; bursts 2-6 here):
- 12 visible-feature commits shipped: P8, P9, P10, P13, P15, P16, P18,
  P19, P21, P22, P23, P25.
- 2 attempted+reverted: P12, P17 (sun/moon discs — deferred to a sky
  shader sprint).
- 1 scope-killed: P20 (NPC nudge — duplicated existing signaling).
- Test suite still green (32/32). Lint baseline preserved (4 pre-existing
  errors in GameWorld, 3 pre-existing warnings).

### 2026-06-01 — Burst 5 (wind + lamps + river chevrons)

David came back and called out the conservative loop stop. Resumed
iteration. Four substantive changes plus one second-revert:

- **P17 attempt 2 + revert again.** Switched plane → sphere geometry,
  parked at a confirmed-visible diagnostic position (sphere DOES
  render). But the procedural day-arc kept missing the camera frustum.
  Removed the code rather than ship a non-working sun. The right
  solution is a proper sky-shader corona, not more position guessing.
- **P18 wind sway** (1b5d5ab). InstancedTrees group rotates per-frame
  on z and x axes with small sine amplitudes (~0.5°) and a ~3.5s
  period. One matrix per frame on the parent group — no per-instance
  cost. Reads as a gentle breeze.
- **P19 lamp posts** (1b5d5ab). 6 lamp posts (3 pairs) flank HQ, Shop,
  and House entrances. Each is post + arm + amber globe; globe
  `emissiveIntensity` ramps from 0 at day to 2.2 at dusk/dawn/night
  with a small warm `pointLight` at night.
- **P21 river chevrons** (f78a462). V-shape pattern scrolls along the
  river's arc length so the eye reads "water flows east→west" instead
  of "water shimmers in place." Mixed at 55% with the shallow color,
  faded toward the banks. Pure shader uniform — no extra geometry.

P20 deleted: a separate one-time "talk to Mayor" nudge would compete
with the existing NPC "!" notice + nameplate. Existing signaling is
enough.

### 2026-06-01 — Burst 4 (preload + compass)

- **P15** (467c5a2). Side-effect import in GameWorld.tsx kicks off
  `useGLTF.preload` for 4 buildings + 12 nature kits at module parse
  time. Cache is warm by the time Canvas suspends, so first-time
  visitors no longer see the procedural `<ACBuilding>` fallback flash
  between Suspense mount and GLB load.
- **P16** (d324de0). Compass HUD at top-center. Yellow 'N' label
  highlights when facing world-north; E/S/W slide along the strip as
  the camera rotates. Implemented as CompassFeed (R3F, writes camera
  azimuth to a shared ref each frame) + Compass (DOM, 12fps rAF poll,
  no per-frame React rerenders). Auto-hidden in screenshot mode.

End-of-session totals (across bursts 1-4):
- 4 buckets shipped: P8 shadow split, P9 welcome modal, P10 NPC notice,
  P13 ambient density, P15 GLB preload, P16 compass HUD.
- 1 bucket attempted+reverted with design notes: P12 sun/moon disc.
- Test suite: 32 vitest specs (NPC chat helpers), all green.
- Lint baseline: 4 errors, 3 warnings in GameWorld.tsx — all pre-existing.

### 2026-06-01 — Burst 3 (P12 attempt + P13 density)

- **P12 attempted, reverted.** Tried a sun/moon disc as billboarded
  textured planes (lookAt the camera, fog=false, depthTest=false) that
  arced across the sky based on wall-clock hour. Repeated Playwright
  captures showed nothing — the warm disc color (`#FFE9B5`) sits too
  close to the fog tone, and the bloom haze further bled them out. The
  fix isn't more tweaking of plane positions; it's either a high-contrast
  color, a corona shader, or rendering the disc as part of the sky shader
  itself. Deferred to a future "sky polish" sprint.
- **P13 shipped.** AmbientLife now accepts a `density` prop. Scene passes
  0.7 when the user has shadows off (proxy for "I want lighter visuals"),
  1.0 otherwise. Floor of 1 per particle channel so the world never
  becomes lifeless. Lite mode still unmounts AmbientLife entirely — this
  handles the middle case.

Commits: 4c5d601 (P13 + P12 revert note).

### 2026-06-01 — Burst 2 (P8-P10 polish round)

Continued autonomous iteration per David's standing directive. Three
targeted commits on top of the visual+perf burst:

- **P8** (22de987 partial): tree shadow split. Near (≤18u of origin)
  cast shadows; far don't. Bushes drop shadow casting entirely (short
  props, negligible visual loss). ~3-4 ms/frame on M1 ANGLE shadow pass.
- **P9** (22de987 partial): first-visit welcome modal. Five essential
  bindings (WASD, right-drag, E, click NPC, F1) with a yellow CTA.
  localStorage-gated (`tsi.welcome.v1.seen`) so it appears once per
  device. Enter or Esc dismiss.
- **P10** (22de987 partial): NPC liveness. Smoothed proximity factor in
  NPC.tsx drives idle bob (0.04→0.12 amp inside NOTICE_RANGE=5.5u),
  subtle scale-up, and an animated `!` bubble above the head. Signals
  interactability before the crosshair hint kicks in.

Verification: 32 tests still green; lint baseline unchanged (4 pre-existing
errors, 3 pre-existing warnings in GameWorld.tsx — none new); Playwright
welcome-overlay shot confirms the modal renders with the world visible
behind; in-game shot shows NPCs unaffected at distance.

FPS Playwright headless: 48 (was 50 last burst — within noise on dev
server with HMR). Real M1 expected 60-65 with lite mode on, ~55 full.

### 2026-05-21 — Setup

- Pulled main (b395e09). Portal code untouched since 2026-04-06 (Wave 11 verdict: READY to merge).
- Stashed 4 dirty recruitment files to `stash@{0}` for safety.
- Moved deprecated specs to `archive/specs/`: `ux-game-world-v1.md`, `ux-oracle-v1.md`, `ux-review-v1.md` through `v5.md`.
- Moved old `AGENT_LOG.md` (5-agent setup, waves 1-11) to `archive/logs/AGENT_LOG-2026-03-27-to-04-06.md`.
- Updated `web/app/student/STUDENT_SYSTEM_BIBLE.md` with current-vision deltas banner + surgical edits.
- Wrote new `CLAUDE.md` as the agent entry point.

### 2026-05-25 — Strategic Reframe + Sprint Pivot

After deep strategic analysis with David, the project frame was clarified: **community-first hangout, not productivity tool**. Bounties/jobs are features inside the hangout, not the engagement engine. Key decisions locked in:

1. Portal = 3D group chat / club hangout
2. AI NPCs scale inversely with real-player count (start with α: scripted)
3. Monthly content drops, admins need easy tooling
4. Rich cosmetic + class system is late-game (Phase 3+)
5. Mobile-aware everywhere
6. Leaderboard top-half public, bottom-half anonymized
7. Senior members can mute game-feel
8. XP = IRL events only, TC = monetary-value contributions only — **no online activity rewards**

Actions taken:
- Wrote 8 design principles into `CLAUDE.md`
- Pivoted sprint from Tier-1 punch list to **Game World Look & Feel**
- Created sprint spec at `specs/sprint-2026-05-game-look-feel.md`
- Reprioritized Phase 2 backlog (NPCs + presence + mobile ahead of Avatar Creator + Interiors) — see `specs/ux-status.md` (pending update)

**Decisions locked in (2026-05-25):**
- NPC tech tier: **γ (LLM-driven, Claude Haiku + Memory tool)**. Spec: `specs/llm-npc-system.md`. Lands after admin tooling sprint.
- NPC sprites: deferred — world-building first.
- NPC population mix: **few permanent named + dynamic filler based on real-player density**. Defaults documented in `specs/llm-npc-system.md`.
- Monthly content drop tooling: confirmed for next sprint after this one.
- **This sprint** lays the data-driven content pipeline foundation that admin tooling sprint builds on top of.

**Open items still pending:**
- Stale: tier CHECK constraint migration (`004_cleanup_and_extend.sql`) — verify on first migration touch.
- LLM-NPC sprint spec has 5 open Qs (proactive vs click-only, NPC cross-references, XP for chats, persona moderation, memory wipe policy) — answer before that sprint kicks off, not blocking this one.
- Working tree has unrelated recruitment changes (`013_recruitment_status_v2.sql`, `admin/preview/`, etc.) from another session/working dir. David handles separately.

---

## Cross-Team Notes

*(any agent may append — for messages that don't fit a single section)*
