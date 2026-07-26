# Sprint: Refinement Round — David's Playtest (2026-07-22)

> **Source:** structured playtest interview with David, 2026-07-22. His pain points, verbatim rulings, and the plan they produced. Companion to `specs/roadmap-game-world.md` (this round reorders its Phase A by what the founder actually felt while playing).
> **Owner:** `build`. Reviewer: David.

---

## What David reported

1. **Fishing reel** — biggest issue. Rarity shouldn't be announced during the fight; first-time fish should be "???" with a blacked-out silhouette. Difficulty must properly scale with rarity (bigger bar + calmer fish for commons). Ladder should be **common / uncommon / rare / epic / legendary / sea king**. Every species needs its own movement behavior via parameter fields (jitter, acceleration, etc.) — parameterized, not one memorizable pattern. Sizes should make sense. Catches need micro-animation, screen shake, a reveal moment; legendary/sea-king catches should be dopamine events.
2. **World feels empty/aimless** — retention pick: **a new place to explore → cliff highlands**.
3. **Visual inconsistencies** — trees cut in half, sideways assets; "needs QA and double look."
4. **Controls** — walk too slow + sprint weak, camera too far, click-to-move misclicks. Rulings: faster walk + stronger sprint, camera closer, **remove click-to-move on desktop** (touch keeps taps).
5. **UI style clash** (retro terminal vs modern sleek) — acknowledged, "can be changed later, not a big issue."
6. **Sea King ruling: "Both"** — Golden Koi holds the Sea King crown now; when a marquee fish gets extracted from the dump it takes the crown and koi drops to legendary.

## R1 — SHIPPED this session

**Fishing v2** (`FishingOverlay.tsx`):
- 6-tier ladder with weights (100/48/18/7/2.5/1) and per-tier bar widths (0.30 → 0.17). Legendary rung intentionally vacant pending the next marquee extraction. Koi = Sea King (teal chip), catfish = Epic.
- Mystery: unknown species render "???" + blacked-out icon during the reel; rarity is never shown mid-fight. Catch card does the reveal: name + size + rarity chip + **NEW!** badge. Owned-species set loads from `/api/collections`, fails closed to mystery.
- Per-species movement fields: `{ speed, accel, jitter, dartChance, dartMul, retargetMs }` — velocity-seeking AI, hand-tuned personality per fish (bluegill jittery-quick, carp heavy-persistent, black bass aggressive darts, catfish slow cruise + violent lunges, koi erratic bursts).
- Sizes: per-species cm ranges, skewed roll (big catches are the brag), shown on the card.
- Celebration scales by tier: screen shake (4→12px), confetti bursts from rare up (canvas-confetti, tier-tinted), gold-glow card + longer hold for legendary/sea-king, card pop animation.

**Feel pass:**
- `PLAYER_SPEED` 6.3 → 7.4; sprint multiplier 1.6 → 1.85 (FOV-widen threshold raised to match).
- Camera default `[0,19,-24]` → `[0,16.5,-21]`, `minDistance` 12 → 9.
- Click-to-move gated to coarse pointers only — desktop misclick class eliminated, touch keeps tap-to-walk.

## R2 — Cliff Highlands (the retention pick)

The north elevation tier. Sequence per the roadmap: David design verdict on island silhouette (mock via world-cam harness / `/lab/world` shots) → terrain elevation model (coast.ts extension for a second tier) → cliff faces (river-v2 lesson says procedural ribbons over kit assembly; `unit-cliff` pieces as reference/detail) → 1-2 ramps, waterfall source tie-in, lookout landmark, minimap layer. New fishing spot on the upper river = natural home for future high-tier fish. **Big build; own sprint-week.**

## R3 — Visual QA hunt

David: "trees are cut in half, assets are sideways, needs QA and double look."
- Sweep every placed asset class with the established doctrine: lineup render + top-down check (the item bench `/lab/item` makes this fast now).
- Terrain-clipping pass: props vs the organic-coast heightfield (half-buried trees = placements predating the terrain swell — re-solve their ground Y).
- Output: one fix commit per asset class, before/after shots, logged as a QA wave.

## R4 — Fishing follow-ups (small, after R2/R3)

- **Fish-asset audit result (2026-07-22, subagent sweep):** the repo ships exactly **10 fish** end-to-end (10 GLBs in `assets/acnh/fish/` → 10 icons → 10 FISH/CollectionBook rows). The other ~70 ACNH fish exist only in the external dump (`~/Downloads/GLB`, laptop — not on the desktop, checked). The FBX→GLB converters are committed, but the icon-render harness and the orientation/LUT-normalize steps were ad-hoc and never committed.
- **Fish expansion plan (blocked on dump access):** David copies the dump's fish set to a reachable path (or runs extraction on the laptop). Then: (1) commit a repeatable icon harness (headless three.js render → transparent 128px PNG — replaces the lost ad-hoc one), (2) batch-verify orientation via the `/lab/item` doctrine, (3) fill the 6-tier ladder with real ACNH species data (legendary gets real fish — stringfish/golden trout class; Sea King crown to coelacanth/oarfish/whale-shark class, koi drops to legendary per the "Both" ruling), (4) FISH + CollectionBook rows, availability windows per species. This is the point where the fishing loop gets ACNH-deep. Subagent-friendly batch job.
- Marquee fish extraction (David's machine, dump `Creatures/`): the new crown takes Sea King, koi drops to legendary per the "Both" ruling. One FISH row + CollectionBook row + icon render.
- Personal-best sizes: needs a `member_collections` size column (migration — **on hold** with the rest, fold into the Launch Track L1 batch).
- Collection Book: show rarity chips + sizes there too once sizes persist.

## Backlog (acknowledged, later)

- **UI style unification** — retro terminal vs modern sleek. David: later. When it comes up: pick one voice per surface (world HUD = cozy game chrome; dashboard pages = portal terminal), document in tokens.

## NEW FEATURE (David idea, 2026-07-22): TSI Art Museum

> "An art museum or a section in the museum where people are free to paint and draw, and people can donate T coins for the art they like. By the end of the year, art with the highest TC will be in the TSI museum archives permanently."

Community-first (principle #1) and a real reason to visit monthly (principle #8). Sketch:
- **Create:** easel station in a museum room (new interior or a gallery wing) → simple canvas paint tool (pencil/brush/eraser/palette, ~512px), saves PNG to Supabase storage + `artworks` row.
- **Appreciate:** gallery wall renders member pieces; donate TC to pieces you like (donation = TC transfer with a ledger row).
- **Archive:** year-end, top-TC pieces move to a permanent "TSI Archives" wall (rotating annual cohorts — the museum accretes club history).
- **Open rulings for David before build:**
  1. Where does donated TC go — to the artist (member-to-member transfer of already-earned TC) or burned as pure votes? (Principle #3 says TC = monetary-value work; a transfer is arguably fine, a mint is not.)
  2. Moderation: T1/T2 hide/remove, report button?
  3. Placement: new Museum building on the island (pairs beautifully with Cliff Highlands — museum on the bluff?) vs a wing in an existing interior.
- Needs: 1 migration (artworks + donations ledger — joins the on-hold batch), storage bucket, paint tool UI, gallery renderer, donate flow. **Medium-large; propose as its own sprint after R2.**

## Sequencing

R1 ✅ shipped → R3 visual QA hunt (fast, high-irritation-relief) → R2 cliff highlands (big) → R4 fishing follow-ups → Museum sprint (after David's 3 rulings). Launch Track (`sprint-2026-08-launch-track.md`) runs in parallel — its migration batch (L1) now also carries the size column + artworks tables when David lifts the hold.
