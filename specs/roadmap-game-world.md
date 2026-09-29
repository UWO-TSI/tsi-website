# Game World Roadmap — 2026-07-22 onward

> **Owner:** reviewer (planning) + David (all verdicts). Build agents execute phases, not the whole file.
> **Companion:** `specs/sprint-2026-08-launch-track.md` covers the launch/community half. This file is the game itself.
> **Method:** the world advances through David's standing loop (find → implement → screenshot-QA → verdict → repeat). This roadmap doesn't replace the loop — it gives it a horizon, and formalizes the experiment workflow around the new `/lab`.

---

## The Lab (shipped 2026-07-22)

Dev-only testing unit at `/lab` — 404s in production, mounts the REAL game code (successor to the ad-hoc `water-harness/*.html` replicas, which drifted from the game by design).

| Bench | What it does |
|-------|--------------|
| `/lab/world` | The actual island + experiment panel: time-of-day scrub (skies at any hour without stubbing the clock), weather force (sunny/cloudy/rain), seasonal-palette override with live color pickers (no draft rows needed), pastel-grade sliders (desat / warm cast / black lift — the open AC verdict), spawn presets (village / beach cove), copy-values-as-JSON for baking. |
| `/lab/item` | Isolated GLB inspector over every `.glb` in `public/`: orbit + top-down (catches sideways skin-bakes before they ship — the campfire/bench/towel lesson), +90°X fix toggle, player-height (1.4u) scale reference, bbox + mesh/material readout. |

**Workflow:** experiment on a bench → screenshot → David verdict → bake the values into game constants in a normal commit → mock-QA as usual. Lab hooks in game code are three tiny dev-only reads (`getLabHour`, lab palette in `useActivePalette`, grade uniforms in PostFX) that compile to no-ops in production.

**Lab v2 candidates (build as needed, not speculatively):** biome sandbox scene (empty terrain patch + asset painter for composing new zones before they earn island space); sky-texture set A/B (drop new painted skies in a folder, compare at any hour); NPC dialogue bench (persona prompt → chat without touching prod personas); FPS regression harness on fixed camera paths.

---

## Phase A — Pre-launch world polish (now → end of August)

The world is already good. Phase A is finishing moves, gated by the same loop + verdicts.

1. **Lighting chemistry finale.** The pastel grade awaits David's re-verdict (open since 2026-07-15) — now answerable in minutes via `/lab/world` grade sliders against his 9 AC reference snapshots. Bake the winning values; close `specs/lighting-research.md` action map (L4/L7 stay rejected, L11 shipped).
2. **Cliff system + elevation (the marquee).** `unit-cliff` (45 pieces) is flagged; the river-kit bank archive (`7143205`) was the prep. Scope: a second terrain tier on the island's north arc — cliff walls from the kit or procedural (river-v2 lesson: kit pieces waffle; procedural ribbons won), 1-2 ramps/slopes, waterfall tie-in at the river source, minimap update. This is the biggest remaining "looks like a real game" delta and it unlocks ACNH's signature layered composition. Needs a David design verdict on island silhouette before build (mock in the lab/world.html cams first).
3. **Flag-list continuation** (from `specs/asset-flags.md`, in priority order): brick road accent around the fountain plaza → plaza-deco stalls (session-class job) → park-fence garden beds → hedge around HQ. Each is a loop iteration, no spec needed.
4. **Sky set variety.** Current painted skies are morning/afternoon/evening × (sunny|rain). Candidates: distinct dawn set (the 5-7am ramp reuses morning), night cloud variants. Test in `/lab/world` with the time scrub before committing art.
5. **Perf + budget guardrails.** F3 profiler after every heavy drop; 50MB asset cap (David's Q3 ruling) — `du -sh web/public/assets` in QA waves; shadow rig stays 1024@30Hz player-follow (Wave 28 numbers).

## Phase B — Post-launch content machine (September → November)

Launch flips the audience from David to members. Phase B makes the world *change* on a cadence (principle #8) with admin tooling, not code pushes.

1. **Seasonal machine v1.** Autumn palette (October: the Halloween palette exists; garland set already maps to it) → winter: the dump ships `*-snow` variants of trees/bushes/fences — a `season` flag on placements + palette-driven swap. Weather calendar upgrade: `weatherForDate` hash → admin-scheduled table (the code comment already plans this seam).
2. **Collection book seasons.** ACNH's core retention: species rotate monthly. Add `available_months` to species defs + admin CRUD; monthly species drop becomes a content-cadence ritual alongside shop/NPC drops. New groups when assets allow (deep-sea, winter bugs).
3. **Daily village life v2.** v1 = NPCs migrate to warm spots at night. v2: per-NPC daily schedules (shop hours, oracle ceremonies at fixed hours, plaza gatherings), a daily fortune at the Oracle (already specced in llm-npc), and event-day plaza dressing (the market cart + stalls + garlands respond to a scheduled event).
4. **Event-month drops.** The dump's spooky/easter/june-bride fence + prop sets, mapped to months; New Year countdown arch is already re-derivable from the pipeline (market-cart extraction note).
5. **Member-visible world change from play:** flower picks already regrow; consider member-planted flowers (persisted positions, tiny table) as the first world-mutation feature — cheap, social, ACNH-native. David verdict first (server state).

## Phase C — Phase-2 big rocks (post-November, order = David's call)

- **Multiplayer presence (Colyseus)** when member traffic justifies it — the world/HUD/ghosts are already shaped for it (server list overlay, ghost replay, positions heartbeat).
- **Avatar creator** (Nano Banana sprite pipeline) — still explicitly deferred by David (2026-07-22 confirmation).
- **Interiors v2:** HHP-style room-slider decoration (flagged Phase-2 in lighting research), member-visible HQ trophy shelf fed by collections/bounties.
- **Oracle v2 card-game encounter** (`ux-oracle-v2.md`).
- **Cliff tier expansion → highlands biome** if Phase A's cliff system lands well: pine/snow-line biome, second waterfall, lookout landmark.
- **Horizon life** (single cargo-ship silhouette) — only if David re-wants it; he cut distant clutter once.

## Engineering notes (standing)

- `GameWorld.tsx` is ~2,200 lines and the loop keeps feeding it. When the loop cools (post-launch), extract: TimeOfDayCycle + sky, HUD dock cluster, interaction/keybind system. Not during the loop — merge friction would slow David down.
- Lab hooks must stay additive and dev-gated; anything a bench proves gets baked as constants, never left reading the store.
- Migrations/next slot and content-pipeline conventions unchanged (see CLAUDE.md working rules).
