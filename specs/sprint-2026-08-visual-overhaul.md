# Sprint G: Visual Overhaul (AC cozy aesthetic)

> **Goal:** Move the game from "looks like procedural blocks" to "looks like a real game." AC cozy aesthetic, consistent style, varied buildings, full polish layer.
> **Source ask:** David, 2026-06-01: "the visuals and aesthetic of the game, the houses are built with simple blocks where it should rather be a model"
> **Sprint window:** 2026-08-04 → ~2026-08-25 (~3 weeks)
> **Owner:** `build` agent. Reviewer: David.

---

## David's Q&A direction (2026-06-01)

| Q | David's pick |
|---|---|
| Q1 Visual target | **A** — AC cozy aesthetic, same vibe |
| Q2 Style consistency | **A + B** — same overall style across buildings, but each distinct (not identical) |
| Q3 Asset logistics | **My recommendation**: existing GLBs in repo are sufficient for sprint G1; future packs go to `web/public/assets/`, committed to git, capped at ~50MB total |
| Q4 Asset density | **C** — moderate (~10 GLBs, instanced where possible) |
| Q5 Branding | **B** — defer, no TSI logo overlay this sprint |
| Q6 Character sprites | **Defer** — keep player placeholder, NPCs stay billboard quads. Revisit after world build |
| Q7 Postprocessing polish | **A** — bloom + vignette + outline on hover |
| Q8 Sprint shape | **My pick: spike + iterate.** Spike (G1.1 below) already shipped as `bbff2f4` |

---

## What just shipped (G1.1 — the spike)

Commit `bbff2f4` — emptied `PROC_VARIANTS` set in `Building.tsx`. Existing GLBs (`hq.glb`, `shop.glb`, `oracle_temple.glb`, `house_1.glb`) now auto-load via the existing Suspense path. Procedural composites kept as Suspense fallback.

**Validates:** GLB loading infrastructure works end-to-end. No new code needed for the building model swap.

**Expected visual change on reload:** HQ / Shop / Oracle Temple / House render as real 3D models instead of box-and-cone composites. Auto-scaled to the position[]/size[] from BUILDINGS. Materials overridden with AC palette per `GLBBuilding`.

---

## Definition of Done (full sprint G)

A new visitor opens the world and:

1. Buildings render as real GLB models, not procedural composites ✅ G1.1
2. Trees / bushes / flowers / mushrooms feel diverse (already mostly true via NatureModels — verify density)
3. Ambient props (signposts, fences, lanterns) render as Kenney GLBs, not procedural cylinders
4. Hovering over an interactable produces a subtle toon outline highlight
5. Emissive props (lanterns, braziers, fireflies) glow softly via bloom
6. Subtle vignette darkens screen edges during scene transitions
7. FPS stays ≥ 50 on Chrome desktop with all polish enabled

---

## Remaining deliverables

### G1.2 — Verify GLB visual quality (next dispatch)

Manual test required:
- Load `/student/dashboard`
- Verify each building's GLB loads and looks acceptable
- Note any that look worse than their procedural composite
- If any specific GLB is bad, re-add its id to `PROC_VARIANTS` and document why

David is the visual judge here. Reviewer can't verify without browser inspection.

### G2 — Nature props upgrade

`web/components/game/AmbientProps.tsx` currently renders **procedural** signposts / fences / lanterns / stepping stones. Replace with GLBs from the existing Kenney Nature Kit + Kenney Fantasy Props Kit (need to download — see G6).

**Mapping:**
- Signposts → use existing `fence_planks.glb` rotated + a small label decal
- Stepping stones → reuse `rock_smallA.glb` / `rock_smallB.glb` (already in nature kit!)
- Fences → already have `fence_planks.glb` and `fence_simple.glb`
- Lanterns → need to download (not in current asset set)

**Files affected:** `AmbientProps.tsx` (replace 4 procedural sections with `<NatureMesh>` calls or new wrappers).

### G3 — Ground texture / terrain pass

Currently terrain mesh uses vertex colors only — solid green band. Add a tileable grass texture for natural variation.

**Options:**
- Generate a small (256×256) grass texture procedurally in a script + commit
- Use a CC0 ground texture from Kenney "Tiny Town" or ambientCG
- Skip if it adds bundle size we don't want — vertex colors aren't broken, just plain

### G4 — Postprocessing pipeline (Q7=A)

Install `@react-three/postprocessing` (~50KB gzipped). Add EffectComposer with:
- **Bloom** — threshold 0.85, intensity 0.6. Picks up emissive on lanterns/braziers/fireflies/firefly cores.
- **Vignette** — darkens screen edges subtly during scene transitions (eg. opening a building overlay)
- **Outline** — bright yellow toon outline on whatever the player is "hovering" via the existing nearest-interactable system (F1.2)
- (skip FXAA initially — most Chrome on M1 already does temporal AA via the compositor)

**Files affected:** `GameWorld.tsx` (wrap Canvas children in `<EffectComposer>`), new `web/components/game/PostFX.tsx`.

**Perf budget:** ≤ 5% FPS hit on M1 8GB. If exceeded, drop outline first.

### G5 — Replace player avatar sprite (deferred — Q6)

Player PNG at `/assets/characters/prototype_character.png` is a placeholder. David said defer this sprint. **Skip.**

NPC billboards (Mayor / Toren / fillers) — same story. **Skip.**

### G6 — Asset acquisition for G2 (only if G2 ships)

If G2 (props upgrade) is greenlit, need to fetch ~3-5 lantern/signpost GLBs from Kenney. Plan:
- Source: kenney.nl "Pixel Town" or "Fantasy Town Kit" (CC0, free)
- Direct download via `curl` from kenney.nl static URLs to `web/public/assets/props/`
- Total size budget: < 5MB additional

---

## Out of scope

- Custom 3D modeling (Blender) — defer to Phase 3+
- AI-generated 3D models (Meshy.ai / Tripo3D) — defer until CC0 packs proven insufficient
- TSI branding (logo decals on HQ banner, Shop sign) — Q5=B, defer
- Character/NPC sprite sheets via Nano Banana — Q6, defer
- Mobile-optimized lower-poly variants — separate mobile sprint
- WebGPU renderer migration — long horizon

---

## Risks

1. **Existing GLBs might look bad** — they're ~400-700KB which is moderate. If they're stylistically off (e.g., wrong palette, wrong scale, sticky materials), the GLB unblock isn't enough and we need new assets. Mitigation: G1.2 visual verification.

2. **Bundle size growth** — adding @react-three/postprocessing is +50KB. Lantern GLBs add ~1-2MB. Cap at 50MB total `web/public/assets/` to keep `git clone` fast.

3. **Memory disposal regression** — GLBs use more GPU memory than procedural. The 30-min play session leak risk (flagged by other Claude) gets worse with real models. Document `.dispose()` audit as a follow-up.

4. **Outline shader fragility** — `@react-three/postprocessing` outline uses a selection system that doesn't always cooperate with R3F's reconciler. If it breaks, fall back to a per-mesh emissive boost on hover.

---

## Execution order

1. ✅ G1.1 spike — done (`bbff2f4`)
2. David verifies visually on next reload
3. G4 postprocessing (no asset dependency, safe to ship next)
4. G2 props upgrade (requires Kenney lantern download)
5. G3 ground texture (optional polish)
6. G1.2 GLB visual triage (David-driven)

David driving the verify steps; build agent / reviewer handles the rest.
