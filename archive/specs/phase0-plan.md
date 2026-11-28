# Phase 0 execution plan: make `feat/game-default-island` safe

Written 2026-09-26, read-only research pass (no refs written, no packages installed, no builds run). Covers `specs/development-roadmap.md` "Phase 0" (commit in slices, merge `main` in, reconcile migrations, push + draft PR) against the stable analysis object `wip/game-snapshot-2026-09-26` (662dd76, pushed to origin), which snapshots the worktree's ~226 uncommitted files **excluding `specs/evidence/`**. Merge base of `main` (cfd063c) and the snapshot is `7143205`.

**Read this first if you are the executor:** section 1 has a serious finding — 10 of the 33 merge conflicts are not "branch is newer, take it" cases. They are shared game components that production's applicant/recruitment world (`web/components/recruit/ApplicantWorld.tsx`, `ApplicantIsland.tsx`) still imports directly, and the branch's independent cleanup silently dropped the props/params those live call sites need. Two of these are **verified TypeScript build breaks**, not style risk. Get David's eyes on section 1's "Low confidence" rows before merging `main` in.

---

## 1. Conflict analysis

Command run (read-only — `--write-tree` creates loose objects, updates no ref):

```
git merge-tree --write-tree --name-only --messages main wip/game-snapshot-2026-09-26
```

Result: **33 conflicted paths** (out of ~140 files that differ between the two trees — most of the 140 merge cleanly). Every recommendation below was checked against `git diff 7143205 main -- <path>`, `git diff 7143205 wip/game-snapshot-2026-09-26 -- <path>`, and a direct `git diff main wip/game-snapshot-2026-09-26 -- <path>`, plus grep of actual call sites in `web/components/recruit/`.

### The recruitment-coupling problem (read before touching rows marked "HIGH RISK")

Main kept the applicant-mode plumbing these shared files were originally built with — `avatarMode`, `recruitment`/`collectionScope` props, `applicantVillage.ts`/`applicantLighting.ts`/`applicantTime.ts`, `FishingBobber`'s `towardWater`, `introSweep`'s 5-argument `poses` call, audio phases `applicant-island`/`applicant-hq`. The branch independently renamed/stripped all of it while building new member-only features (`clubhouse`, `islandLighting`, `islandTime`, no `avatarMode`). Verified concrete breaks if the branch is taken wholesale:

- `web/components/recruit/ApplicantWorld.tsx:167` — `startIntroSweep(adapter, cb, () => {}, window, { start: [...], end: [...] })`, a 5th argument. Branch's `startIntroSweep` signature only takes 4 params → **TypeScript excess-argument error**.
- `web/components/recruit/ApplicantWorld.tsx:212` — `<FishingBobber towardWater ... />`. Branch removed the `towardWater` prop entirely as its own bugfix → **prop does not exist on branch's component**.
- `collect(itemKey, scope?: string)` (main, `lib/game/collections.ts:37`) vs `collect(itemKey, sizeCm: number | null = null)` (branch, same function, line 64) — a real type collision on the second parameter, both call sites (`FlowerPickFX.tsx` passing `collectionScope`, new peaceful-loop fishing code passing a size) need to keep working.

Confirmed live call sites (`git show main:web/components/recruit/ApplicantWorld.tsx` / `ApplicantIsland.tsx`):
`avatarMode="applicant"` → `PlayerAvatar`, `HQInterior` · `recruitment` prop → `HQInterior` · `collectionScope` → `FlowerPickFX`, `CollectionBook`, `FishingOverlay` · `zoneOverride="sea"` → `FishingOverlay` · `towardWater` → `FishingBobber` · 5-arg `startIntroSweep` → `introSweep.ts`.

### Table

| # | File | Type | Resolution | Reason | Confidence |
|---|---|---|---|---|---|
|1|`.gitignore`|content|**Union.** Keep main's `!web/lib/recruitment-round-drafts.json`, `web/supabase/.temp/`, `node_modules/` (+comment) AND branch's `!web/data/island-map.json` (+comment). Then add the 5 `!` lines from §4.|Both sides only added distinct `!`/ignore lines since the base; no contradiction. Dropping the island-map line re-hides the world (STATE.md: "this once hid the entire island map").|High|
|2|`AGENT_LOG.md`|content|**Manual combine.** Keep main's replaced "Current" status header; append branch's ~600 lines of dated build/qa/reviewer entries beneath it, ordered by date.|Pure append-log from a much older common point (185 insertions on main, 639 on branch, 1 shared deletion each — both touch the same anchor line). Docs only, no functional risk, but a blind textual union leaves two contradictory "Current" sections.|Med|
|3|`web/components/game/ACNHBuilding.tsx`|add/add|Branch wins.|3-line diff: branch renamed an asset filename (`hq-office-village.glb`→`hq-office.glb`). Confirm the new filename exists under `public/assets` before applying.|High|
|4|`web/components/game/AmbientLife.tsx`|content|Branch wins wholesale.|Branch adds the rigged seagull GLB (`/assets/fauna/seagull.glb`), catch-swoop behavior, tuning-driven params (194+/29- direct diff). Main only has the old static box-wing gulls. Matches the working rule: advanced systems (seagull model/pathing) live in this worktree. No recruitment coupling found.|High|
|5|`web/components/game/AmbientProps.tsx`|content|Branch wins wholesale.|Reworks stepping-stone placement for river v3, adds `Lantern`'s `lampsOn` toggle, simplifies HQ-door glow (11+/16- direct diff). No recruitment coupling.|High|
|6|`web/components/game/CollectionBook.tsx`|content|**Manual combine — HIGH RISK.** Keep main's `collectionScope` prop (drives `sync`, skip-fetch, `mergeWithLocal(map, scope)`); layer branch's new journal-page feature on top. Prefer main's themed `var(--app-*)` colors over branch's hardcoded hex.|`ApplicantIsland.tsx:238` passes `collectionScope={collectionScope}` in production.|Low|
|7|`web/components/game/FishReveal.tsx`|add/add|Branch wins.|3-line diff: adds an `oneLinerFor(fish.key)` flavor quote from the (unconflicted) peaceful-loop module.|High|
|8|`web/components/game/FishingBobber.tsx`|add/add|**Manual combine.** Restore the `towardWater` prop on top of branch's forward-cast bugfix.|`ApplicantWorld.tsx:212` requires `towardWater`; branch's removal was an independent, real bugfix (2026-07-24 note) that must also survive.|Med|
|9|`web/components/game/FishingOverlay.tsx`|content|**Manual combine — HIGH RISK.** Keep main's `collectionScope`/`zoneOverride` params; layer the branch's much larger rod-tier/depth rework on top.|`ApplicantIsland.tsx:237` passes both `collectionScope` and `zoneOverride="sea"`. Branch's direct diff (57+/30-) is small relative to its 836-line divergence from base — i.e. it mostly re-derives main's later state, but drops these two params along the way.|Low|
|10|`web/components/game/FlowerPickFX.tsx`|content|**Take main's version** (restore `collectionScope`).|Branch's only change here is dropping `collectionScope`; no other feature added. `ApplicantWorld.tsx:215` passes `collectionScope={collectionScope}`.|High|
|11|`web/components/game/HQInterior.tsx`|content|**Manual combine — HIGH RISK, do not take branch wholesale.** Keep main's `recruitment`/`avatarMode` props and `applicantVillage`/`applicantLighting`/`applicantTime` imports; add a `clubhouse` boolean alias so the branch's own new caller (`DefaultIslandWorld.tsx:349`, `<HQInterior clubhouse phase={phase} .../>`, not itself conflicted) keeps working.|Branch's diff here is a pure rename (`recruitment`→`clubhouse`, drop `avatarMode`, `applicantLighting`→`islandLighting`) with **zero new functionality** — it exists only to match the branch's own renamed modules.|Low|
|12|`web/components/game/NatureModels.tsx`|content|Branch wins wholesale.|Purely additive: `hideMaterial` prop on `GLBProp`, `models` override on `NatureTree`/`NatureBush`/`NatureFlowerCluster` for seasonal dressing; existing callers keep their defaults.|High|
|13|`web/components/game/PlayerAvatar.tsx`|content|**Manual combine — HIGH RISK.** Keep main's `avatarMode="applicant"` branch (renders `<ApplicantCharacter>` from `@/components/recruit/ApplicantCharacter`); layer branch's other changes on top.|`ApplicantWorld.tsx:234` requires the applicant path; branch removed all `avatarMode`/`applicant` references.|Low|
|14|`web/components/game/ToastHub.module.css`|add/add|Branch wins (cosmetic).|4-line diff: branch hardcodes values main wraps in CSS vars. Verify nothing else sets `--game-toast-bottom`/`--app-*` expecting the var form.|Med|
|15|`web/components/game/grid/GrassTufts.tsx`|add/add|Branch wins.|Adds a `windScale` multiplier (weather feature) with default `=1`; purely additive.|High|
|16|`web/components/game/grid/GridTerrain.tsx`|add/add|Branch wins.|Branch is a superset (763 vs 722 lines from base); no recruitment-specific text found, but only checked at diff-stat level — re-skim before applying.|Med|
|17|`web/components/game/grid/GridWorld.tsx`|add/add|Branch wins.|Adds `getIslandMap()`/`isGridEnabled()` caching and an optional `map` param defaulting to the shipped `island-map.json`, plus `windScale`. `ApplicantWorld.tsx:206` always passes its own explicit `map`, so the new default is inert for recruitment. `GridOcean` (also imported there) is not in the conflict list — confirm it isn't touched incompatibly during the merge.|High|
|18|`web/components/game/interiorShared.tsx`|content|**Manual combine — HIGH RISK.** Restore `avatarMode`, the `ApplicantCharacter` import, and the `easeFacing`-driven `applicantMotion` tracking in `InteriorPlayer`; keep branch's `Piece` multi-material `glassMaterial` array support.|`HQInterior.tsx` (main) passes `avatarMode` through to `InteriorPlayer` here; branch stripped it as part of the same clubhouse-only refactor as #11.|Low|
|19|`web/lib/content/types.ts`|add/add|Branch wins.|Both sides add fields to `PaletteColors`; branch is a superset (adds seasonal tint fields on top of main's fields). Purely additive.|High|
|20|`web/lib/game/audio.test.ts`|add/add|**Manual combine.** Keep main's 3 applicant-phase tests; drop branch's `jump`-SFX assumption if it conflicts with whichever `audio.ts` resolution (#21) is chosen.|Mirrors #21.|Low|
|21|`web/lib/game/audio.ts`|content|**Manual combine — HIGH RISK.** Restore the `"applicant-island"`/`"applicant-hq"` `AmbientPhase` values, the `applicant-*` manifest entries, and the scene/movement gain logic in `ambientTargetVolume`/`sfxTargetVolume` (STATE.md: applicant music gain 0.18, SFX 0.25/0.35). Keep branch's `Set<HTMLAudioElement>` cleanup.|`ApplicantIsland.tsx` drives applicant ambient phases through `AudioManager`; branch removed the whole mechanism.|Low|
|22|`web/lib/game/collections.ts`|add/add|**Manual combine — HIGH RISK.** Keep the `scope` parameter alongside branch's `sizeCm`/`collectWithSize`/`localRecords` catch-record feature.|Genuine type collision on `collect()`'s 2nd parameter — see the coupling note above. Both call sites need their own argument.|Low|
|23|`web/lib/game/envLight.test.ts`|add/add|Branch wins (materially larger suite: 5 scenarios incl. failed-bake safety and foreign-owner protection vs main's 3).|Verify no coverage loss for "accepts an island palette without mutating the member-world default" — the `override` param is unchanged in both.|Med|
|24|`web/lib/game/envLight.ts`|content|**Manual combine — genuine divergent bugfix, engineering call.** Main keeps one `PMREMGenerator` per scene and reuses it; branch creates-and-disposes one per bake inside try/finally (handles bake failure + a "foreign owner" case main doesn't). `applyEnvironment`/`disposeEnvironment` signatures are unchanged on both sides, so `ApplicantWorld.tsx:144-145` is safe either way — this is a perf/safety tradeoff, not a recruitment break.|Both sides independently rewrote the same lifecycle code from the same base for different reasons (`gl`→`renderer` rename + ownership tracking on main; failure-safety on branch).|Low — needs a decision, not just merge mechanics|
|25|`web/lib/game/fishingReel.ts`|add/add|Branch wins.|Adds a `tensionMul` param (rod-tier scaling) with default `=1`; 5-line diff, fully additive.|High|
|26|`web/lib/game/graphicsSettingsStore.test.ts`|add/add|Branch wins.|Superset of main's suite (adds `detect`/`isExplicit`/`unset` coverage).|High|
|27|`web/lib/game/graphicsSettingsStore.ts`|add/add|Branch wins.|Adds `detected` tier state + `detect`/`isExplicit`/`unset` actions, purely additive on top of existing `refresh`/`set`/`reset`.|High|
|28|`web/lib/game/introSweep.test.ts`|add/add|**Manual combine.** Keep main's "uses caller-supplied applicant poses" test alongside branch's remaining tests.|Mirrors #29.|Low|
|29|`web/lib/game/introSweep.ts`|add/add|**Manual combine — HIGH RISK, verified build break.** Restore the optional 5th `poses` parameter (branch's hardcoded values become the default).|`ApplicantWorld.tsx:167-170` calls it with a 5th argument; branch's 4-param signature makes this a TypeScript excess-argument error today — **the production build fails** if branch wins wholesale.|High confidence this breaks; fix itself is a small, low-risk addition|
|30|`web/lib/game/locomotion.test.ts`|add/add|**Manual combine.** Keep branch's `defaultIsland`-based river-bank test as primary; re-add main's `applicantVillage`-based ocean-boundary test as a second `it()` block.|`locomotion.ts` itself is byte-identical on both sides — only the test fixtures diverge, and both fixture modules (`applicantVillage.ts` main-only, `defaultIsland.ts` branch-only) merge in cleanly on their own.|Med|
|31|`web/lib/game/modelMaterials.test.ts`|add/add|Branch wins, but re-verify against whichever `modelMaterials.ts` resolution (#32) lands.|Branch drops some assertions main added while adding its own net-new ones; not fully read line-by-line.|Med|
|32|`web/lib/game/modelMaterials.ts`|add/add|Branch wins, provisionally.|No applicant-specific text in either version; branch is the larger superset (194 vs 127 lines from base). `NatureModels.tsx`'s `GLBProp` (used by recruitment) calls `prepareModel`/`applyModelTextures`/`disposeModelMaterials` — confirm these three exported signatures are unchanged before applying (checked at diff-stat level only).|Med|
|33|`web/lib/game/useGraphicsSettings.ts`|content|Branch wins.|Purely additive: exposes `detect`/`isExplicit`/`unset` (6-line direct diff vs main). `ApplicantIsland.tsx`/`ApplicantWorld.tsx` destructure a subset of the hook's return, so they're unaffected.|High|

**Counts:** 33 conflicts. 20 are safe "branch wins" or trivial add/add (High confidence). 3 are Med (skim before applying: GridTerrain, ToastHub, envLight.test, locomotion.test, modelMaterials — 5 actually, see table). **10 are Low confidence / need manual combine and should not be automated**: `CollectionBook.tsx`, `FishingOverlay.tsx`, `HQInterior.tsx`, `PlayerAvatar.tsx`, `interiorShared.tsx`, `audio.test.ts`, `audio.ts`, `collections.ts`, `envLight.ts`, `introSweep.test.ts` (+ its non-test pair `introSweep.ts` is the one **verified build break**, high-confidence-it's-broken but needs the fix applied). Get David's sign-off on the applicant-world coupling pattern before merging — it may be faster for David to say "kill applicant-mode support in these files, recruitment gets its own copies" than to keep threading it through every merge.

---

## 2. Dependency diff

`web/package.json`: **1 line different**, purely additive — branch added one devDependency:

```diff
+    "@gltf-transform/cli": "^4.4.2",
```

Nothing else in `dependencies` or `devDependencies` differs (confirmed with a full, non-truncated diff). `web/package-lock.json` differs by 1,589 insertions / 8 deletions (the new package's transitive tree) but is **not** in the merge-tree conflict list — git's textual merge can auto-resolve it. Recommendation: after merging, run `cd web && npm install --legacy-peer-deps` (per `.npmrc`/CLAUDE.md convention) to regenerate the lockfile properly rather than trusting the auto-merged one — a textually-clean lockfile merge doesn't guarantee correct resolved versions/integrity hashes.

---

## 3. Migration plan

Confirmed via `git diff main wip/game-snapshot-2026-09-26 --stat -- web/supabase/migrations/`: the only changes are (a) additions the snapshot doesn't have yet — `024_game_coins.sql`, `025_seasonal_seed.sql`, `029_progression.sql` … `034_identity.sql` — and (b) files that exist on `main` but not on the snapshot (`026_bounty_deliverables_rls.sql`, `027_recruitment_fall_2026.sql`, `028_recruitment_archive.sql`, and the three `2026091…` timestamped files), which is simply the branch **lacking** them, not editing them. **No applied migration (001–028 + the three timestamps) is touched by the branch.** 001–023 show zero diff between the two trees.

Draft headers read (`024_game_coins.sql`, `025_seasonal_seed.sql`, `029_progression.sql`…`034_identity.sql`):

- `024_game_coins.sql` — standalone (`profiles.coins` + `earn_coins()`/`sell_catches()`/`buy_gear()`). Superseded in place by 033 (below), but must exist first since 033 migrates its column.
- `025_seasonal_seed.sql` — standalone, "pairs with 024".
- `029_progression.sql` — depends on 001, 014/015, 023. Coin debits call `wallet_apply()` from 033. Header: "apply 029-033 as one batch."
- `030_homes.sql` — depends on 001. Coins go through `wallet_apply()` from 033.
- `031_collections.sql` — depends on 001, 023 (`member_collections`). No coin/wallet dependency.
- `032_study.sql` — depends on 001. Coins settled through `wallet_apply()` from 033.
- `033_economy.sql` — depends on 001, 014, 016, 023, 024 ("if applied"), **029-032** ("whose coin writes already call wallet_apply below" — i.e. 029/030/032's functions must exist so 033 can `CREATE OR REPLACE` them onto the new wallet path). Migrates `024`'s `profiles.coins` into `wallet_ledger`/`wallets`, then drops 024's functions.
- `034_identity.sql` — depends on 001, **033** (`wallet_apply`, for respec charges).

**Apply order is simply the existing numeric order** — no reordering needed, only renaming: `024 → 025 → 029 → 030 → 031 → 032 → 033 → 034`. All eight are one launch-window batch (none apply standalone before launch).

**035 does not exist as a migration file yet.** `web/supabase/tests/035_smoke.sql` already exists (mtime 00:12, the single newest file in the whole tree — newer than the snapshot commit itself), confirming combat's migration is being actively drafted but isn't ready. Do not assign it a timestamp until the file exists with its own dependency header; reserve the next slot after 034's.

**Proposed timestamped names** (after `20260918230000`; executor should substitute the real UTC time at execution via `date -u +%Y%m%d%H%M%S`, keeping this relative order and 1-minute spacing so ordering is unambiguous):

| Old name | New name (example) |
|---|---|
| `024_game_coins.sql` | `20260926090000_game_coins.sql` |
| `025_seasonal_seed.sql` | `20260926090100_seasonal_seed.sql` |
| `029_progression.sql` | `20260926090200_progression.sql` |
| `030_homes.sql` | `20260926090300_homes.sql` |
| `031_collections.sql` | `20260926090400_collections.sql` |
| `032_study.sql` | `20260926090500_study.sql` |
| `033_economy.sql` | `20260926090600_economy.sql` |
| `034_identity.sql` | `20260926090700_identity.sql` |
| (035, once drafted) | `20260926090800_<name>.sql` or later |

**Stray Finder duplicate** — this lives in the **main checkout**, not this worktree: `/Users/DavidLiu/Documents/GitHub/uwotsi/web/supabase/migrations/20260918230000_recruitment_sheet_project_rows 2.sql`. Confirmed byte-identical to the real file (`diff` empty) and untracked (`git status --short` shows `??`) on `main`. Safe to delete with `rm` from the main checkout; unrelated to this worktree's merge, but worth doing in the same housekeeping pass.

---

## 4. `.gitignore`

`git status --short --ignored` in the worktree shows 5 tracked-looking JSON files currently hidden by the blanket `*.json` rule:

```
!! art/characters/base/face_variants.json
!! art/characters/base/ref18_measurements.json
!! art/characters/hair/hair_catalog.json
!! art/characters/palette.json
!! web/public/assets/sky/layers/manifest.json
```

Of these, `face_variants.json`, `ref18_measurements.json`, and `palette.json` were already force-added into the `wip/game-snapshot-2026-09-26` commit (so they're safe there), but the working tree and any future update to them still needs the `!` line to stay trackable normally. `hair_catalog.json` (mtime seconds after the snapshot commit) and `manifest.json` (mtime 2026-07-29, missed since day one) are **not in the snapshot at all** and are genuinely at risk.

`manifest.json` check: it **is** generated, by `web/scripts/extract-sky-textures.mjs:171` (`fs.writeFileSync(path.join(OUT, "manifest.json"), ...)`), from a licensed asset dump not in the repo. But its 20 sibling `.webp` textures in the same directory (`web/public/assets/sky/layers/*.webp`) are already tracked (not `.json`, so the blanket rule never caught them), and `web/lib/game/skyVariants.ts` references manifest keys — nothing in the codebase regenerates it automatically (no CI, no build-step hook), so it must ship committed alongside the textures it indexes, exactly like they are. Confirmed: 20/21 files in that directory are tracked; only `manifest.json` isn't.

Add to `.gitignore` (after resolving the union merge from §1 row 1):

```
!art/characters/base/face_variants.json
!art/characters/base/ref18_measurements.json
!art/characters/hair/hair_catalog.json
!art/characters/palette.json
!web/public/assets/sky/layers/manifest.json
```

Then `git add -f` (or plain `git add`, now that they're un-ignored) `hair_catalog.json` and `manifest.json` specifically — the other three are already in the snapshot.

---

## 5. Repo weight

| Path | Size | Contents |
|---|---|---|
| `specs/evidence/` | 105 MB | 146 PNG screenshots + 4 `.md` |
| `art/` | 22 MB | 40 PNG, 34 GLB, 14 Python, 6 MP4, 6 `.blend`, 4 JSON |

Image tools available (none installed for this check): `sips` (`/usr/bin/sips`), `cwebp` (`/opt/homebrew/bin/cwebp`), ImageMagick `magick`/`convert` (`/opt/homebrew/bin/magick`).

Tested (read-only: converted copies written to the scratchpad, originals untouched) — 8 evidence PNGs sampled every ~20th file, `cwebp -q 82`:

```
5,788,776 bytes (PNG) → 520,626 bytes (WebP)  =  9.0% of original size
```

At that ratio, 105 MB of evidence PNGs would become **~9.4 MB** as WebP at quality 82 (visually near-lossless for UI screenshots; spot sample included both flat-color admin UI and full 3D-rendered scenes).

**Recommendation:** convert `specs/evidence/**/*.png` to WebP (`cwebp -q 82`) in the same commit that first commits `specs/evidence/` (§6, group 10), and update the 4 `specs/evidence/*.md` files' references from `.png` to `.webp` (grep for `\.png` in those 4 files first — likely simple find/replace, verify no external links depend on the `.png` extension). This keeps the evidence in git (it's the only record of what was screenshot-verified) while cutting its weight by ~91%. Do **not** keep evidence out of git entirely — Phase 0's own exit check and every prior sprint log point to these screenshots as the verification record; losing them loses the audit trail alongside the uncommitted code.

`art/` at 22 MB is small enough to commit as-is; no conversion needed. The `.blend` and `.mp4` files are the largest single items there — leave them; they're source files David/agents actively edit, not disposable screenshots.

---

## 6. Commit slicing

Scope: only the ~226 currently uncommitted paths in this worktree (`git status --short`), grouped by roadmap feature area, **not yet resolving any of §1's conflicts** — this step runs before merging `main` in, per the roadmap's own ordering (commit → merge → rename migrations → push). Groups are ordered so each commit's dependencies (shared plumbing, then features that read it) land first, but this is inferred from directory/import naming, not a verified build graph — **the executor must confirm each commit's `tsc`/`vitest` gate and may need to merge two adjacent commits if a dependency runs backwards.**

1. **`[build] island core: shared rendering/content plumbing, seasons and weather`**
   `web/components/game/{ACNHBuilding,AmbienceFX,AmbientLife,AmbientProps,BlobShadows,DefaultIslandWorld.tsx,DefaultIslandWorld.module.css,DefaultIslandMap,IslandAtmosphere,MiniMap,NatureModels,OverlaySheet,PostFX,RainFX}.tsx`, `web/components/game/grid/**`, `web/components/portal/{PaletteEditor,VersionHistory}.tsx`, `web/data/content-defaults.ts`, `web/lib/content/{loader.ts,types.ts}`, `web/app/api/content/drafts/**`, `web/app/student/dashboard/admin/content/log/page.tsx`, `web/lib/game/{envLight,grassTexture,waterShader,modelMaterials,useGraphicsSettings,graphicsSettingsStore(.test),islandLighting(.test),islandTime(.test),islandWeather(.test),season(.test),seasonalLook(.test),sunTimes(.test),qualityTier(.test),fireflyPath(.test),clubhouse(.test),defaultIsland(.test)}.ts`, `web/app/api/weather/**`, `web/public/assets/acnh/terrain/mSandSnow_Alb.png`, `web/public/assets/acnh/plants/*-snow.glb`, `scripts/prepare-hq-lamp.py`, `scripts/restore-hq-textures.py`, `web/vitest.config.ts`, `web/supabase/migrations/025_seasonal_seed.sql`, `specs/island-core*.md`, `specs/seasonal-events*.md`.

2. **`[build] progression: chapters, club goals, letters, notice board`**
   `web/lib/progression/**`, `web/lib/game/progressionBridge(.test).ts`, `web/lib/game/progressionDemo.ts`, `web/components/progression/**`, `web/components/game/progressionSheets.tsx`, `web/components/game/JournalPages.tsx`, `web/components/portal/{ClubGoalEditor,QuestChapterEditor,ProgressionAdminShared}.tsx`, `web/app/api/progression/**`, `web/app/dev/progression/**`, `web/app/student/dashboard/{journal,letters}/**`, `web/app/student/dashboard/admin/content/{chapters,goals}/**`, `web/public/assets/acnh/furniture/{monument-banner,monument-rock,monument-scaffold,monument-sign,bulletinboard}.glb`, `web/supabase/migrations/029_progression.sql`, `specs/progression*.md`.

3. **`[build] homes: personal islet, room decorating, mailbox`**
   `web/lib/homes/**`, `web/lib/homes-sync/**`, `web/lib/game/homeIsland(.test).ts`, `web/components/game/home/**`, `web/app/api/homes/**`, `web/public/assets/acnh/{furniture/{mailbox,home-bed,closet,floor-lamp,lounge-sofa,lounge-table,lounge-tea,lounge-book,lounge-rug,wall-frame,wall-driedflower,wall-clock,antique-clock,plant-monstera,plant-yucca}.glb,interior/**}`, `web/supabase/migrations/030_homes.sql`, `specs/homes*.md`.

4. **`[build] collections/museum: species roster, museum, trophies, showcase`**
   `web/lib/collections/**`, `web/lib/game/{collectionsDemo.ts,collections.ts}`, `web/components/game/CollectionBook.tsx`, `web/app/api/collections/{museum,showcase,trophies,silhouette,journal}/**`, `web/scripts/gen-collections-seed.mjs`, `web/public/assets/acnh/furniture/{museum-case,museum-stand,museum-tank}.glb`, `web/supabase/migrations/031_collections.sql`, `specs/peaceful*.md` (museum half).

5. **`[build] peaceful loop: fishing, foraging, bugs, wardrobe`**
   `web/lib/game/{rods(.test),fishingSpots(.test),peaceful(.test),peacefulNear,usePeacefulContext,wardrobe(.test),fishingReel}.ts`, `web/components/game/peaceful/**`, `web/components/game/{Critters,FishingOverlay,FishReveal}.tsx`.

6. **`[build] study: Pomodoro tables, settlement, companion shell`**
   `web/lib/study/**`, `web/components/study/**`, `web/app/api/study/**`, `web/app/student/companion/**`, `web/public/assets/acnh/furniture/{study-chair,study-desk,bookshelf,reading-table}.glb`, `web/supabase/migrations/032_study.sql`, `specs/study*.md`, `specs/companion*.md`.

7. **`[build] economy: wallet, shop, selling, merch`**
   `web/lib/wallet/**`, `web/components/economy/**`, `web/app/api/economy/**`, `web/app/api/{coins,gear,sell}/route.ts`, `web/app/student/dashboard/{economy,admin/merch}/**`, `web/app/dev/economy/**`, `web/components/portal/ShopEditor.tsx`, `web/scripts/gen-economy-seed.mjs`, `web/public/assets/acnh/furniture/fitting-room.glb`, `web/supabase/migrations/024_game_coins.sql`, `specs/economy*.md`.

8. **`[build] oracle/identity: MBTI reading, family, display names, settings`**
   `web/lib/{oracle,identity,moderation}/**`, `web/components/oracle/**`, `web/components/game/oracle/**`, `web/components/portal/NameReportsPanel.tsx`, `web/app/api/oracle/{answer,finish,me,start}/**` + deletions of `web/app/api/oracle/{quiz,result}/route.ts`, `web/app/api/identity/**`, `web/app/student/dashboard/oracle/page.tsx`, `web/app/dev/oracle/**`, `web/supabase/migrations/034_identity.sql`, `specs/oracle-identity.md`, `specs/oracle-questions.md`.

9. **`[build] character art + combat foundation (in progress — may not fully pass gates yet)`**
   `art/**`, `web/lib/combat/**`, `web/lib/game/combat/**`, `web/lib/game/ruins(.test).ts`, `web/scripts/character-inspect.mjs`, `web/public/assets/acnh/furniture/{enemy-construct,enemy-scorpion,enemy-tarantula,enemy-wasp,boss-statue,ruins-arch,ruins-arch-broken,ruins-moai,ruins-pillar,ruins-stonehenge,ruins-torch,weapon-bow,weapon-staff,weapon-sword,clubhouse-pendant}.glb`, `specs/references/characters/**`, `specs/combat*.md`, `specs/character-set*.md`, `web/components/game/PlayerAvatar.tsx`, `web/components/game/interiorShared.tsx`, `web/components/game/HQInterior.tsx`. **Flag:** roadmap says combat/hair is "in progress now" — if `035_smoke.sql`'s corresponding migration or hair GLBs are half-written when this commit is cut, split further rather than committing a broken intermediate state; verify `tsc`/`vitest` pass before committing regardless of what the roadmap says is "done."

10. **`[build] specs/docs/evidence`**
    Remaining non-feature-specific specs (`specs/development-roadmap.md`, `specs/game-world-development-plan.md`, `specs/admin-pass*.md`, `specs/crafting*.md`), plus `specs/evidence/**` converted to WebP per §5 (with the 4 evidence `.md` files' `.png` references updated).

11. **`[build] migrations: rename to timestamped names`** (after merging `main` in, per roadmap step 2 → 3 ordering — not before)
    `git mv` the 8 files per §3's table, plus `web/supabase/tests/**` (the smoke-test SQL, updated to match the new filenames if it references them by name).

---

## 7. Execution checklist

```
# 0. Confirm no one else is mid-edit in this worktree; check with the other agents before starting.
cd /Users/DavidLiu/Documents/GitHub/uwotsi/.claude/worktrees/restart-art-cohesion
git status --short   # should match the ~226-file baseline this plan analyzed; if not, re-diff before proceeding

# 1. Commit in the 11 slices from §6, in order. After EACH commit:
npx tsc --noEmit -p web/tsconfig.json    # or: cd web && npx tsc --noEmit
cd web && npm run test -- <touched-area>  # focused vitest run for that slice; full `npm run test` at the end of §6
cd web && npm run lint                     # focused: lint only files in the commit's globs; compare error/warning count against the specs/qa.md baseline (68 errors/52 warnings) — no NEW errors, not zero errors
# commit:
git add <globs for this slice>
git commit -m "[build] <slice name>: <one-line summary>"

# 2. Merge main in.
git fetch origin main
git merge main
# Resolve the 33 conflicts per §1's table. Do the 20 High-confidence ones first (mechanical).
# Stop before the 10 Low-confidence rows and get David's ruling on the applicant-world
# coupling pattern (keep threading avatarMode/collectionScope through every merge, vs.
# forking dedicated applicant-only copies of these components going forward).
# After resolving:
git add -A
git commit -m "[build] merge main: resolve island/applicant shared-component conflicts"
cd web && npx tsc --noEmit && npm run lint && npm run test   # full gate, not focused — this is the highest-risk commit
npm install --legacy-peer-deps   # regenerate package-lock.json properly (§2)
git add web/package-lock.json
git commit -m "[build] package-lock: regenerate after merge" --only web/package-lock.json  # or fold into the merge commit if npm install ran before committing

# 3. Reconcile migration naming (§3). Do this AFTER the merge, once main's actual
#    latest timestamp is confirmed still 20260918230000 (re-check: it may have moved
#    if main shipped anything during this work).
git log -1 --format=%H -- web/supabase/migrations/ main
for pair in "024_game_coins.sql:20260926090000_game_coins.sql" \
            "025_seasonal_seed.sql:20260926090100_seasonal_seed.sql" \
            "029_progression.sql:20260926090200_progression.sql" \
            "030_homes.sql:20260926090300_homes.sql" \
            "031_collections.sql:20260926090400_collections.sql" \
            "032_study.sql:20260926090500_study.sql" \
            "033_economy.sql:20260926090600_economy.sql" \
            "034_identity.sql:20260926090700_identity.sql"; do
  old="${pair%%:*}"; new="${pair##*:}"
  git mv "web/supabase/migrations/$old" "web/supabase/migrations/$new"
done
# Do NOT rename/create 035 yet — no file exists (see §3).
git commit -m "[build] migrations: rename 024/025/029-034 to timestamped names after main's 20260918230000"

# 4. Full gate one more time on the final state.
cd web && npx tsc --noEmit && npm run lint && npm run test && npm run build

# 5. Push (branch already exists on origin; this is a fast-forward-safe push of new commits).
git push origin feat/game-default-island

# 6. Open a draft PR against main. No merge, no deploy.
gh pr create --draft --title "[build] Phase 0: commit game-default-island, merge main, reconcile migrations" \
  --body "Draft only — do not merge. See specs/phase0-plan.md for the conflict/migration/commit rationale."

# Rollback note: wip/game-snapshot-2026-09-26 (662dd76, pushed to origin) is the
# pre-Phase-0 snapshot of every uncommitted file except specs/evidence/. If any
# step above goes wrong, the worktree can be restored from that ref without
# touching main or losing the two weeks of work it captures. specs/evidence/
# itself was never snapshotted — if it's lost before commit 10 lands, it is gone.
```

**Verification gates, restated:** `tsc --noEmit` after every slice commit (cheap, catches the cross-file breaks §1 warns about early); focused `npm run lint` per slice, full `npm run lint` after the merge commit, compared against the known baseline (68 errors/52 warnings) rather than demanding zero; `npm run test` scoped to the slice's own `*.test.ts` files per commit, full suite (~650 tests) after the merge and again before push; `npm run build` only once, at the very end, immediately before push — it sets an 8 GB heap (`NODE_OPTIONS=--max-old-space-size=8192`) and this Mac has already had memory-pressure crashes during `uwotsi` three.js dev sessions, so do not run it while the other 3 agents are still active in this worktree.

## Coordinator rulings (2026-09-26)

1. **Applicant-mode plumbing: one shared implementation, no forks.** The member island adopted the applicant look (ledger 104), so the code converges instead of splitting. In each of the 10 high-risk files, take the branch version as the base and restore exactly the API surface `web/components/recruit/ApplicantWorld.tsx` and `ApplicantIsland.tsx` use (`avatarMode`, `recruitment`/`collectionScope`, `FishingBobber`'s `towardWater`, `startIntroSweep`'s call shape). Where the branch only renamed a module (`applicantLighting` → `islandLighting`, the HQ half of `applicantVillage` → `clubhouse`), update the recruitment call sites to the new names instead of keeping duplicate modules. `collect()` takes one options object `{ scope?, sizeCm? }`; update every caller on both sides.
2. **Recruitment must keep working.** Gate for the merge commit: tsc clean, the recruitment tests on `main` still pass, and a screenshot of `/student/apply/portal?preview=1` (applicant island) plus `/lab/island` (member island), both read and compared with the applicant screenshots in `specs/references/lighting-2026-09-16/`.
3. **Evidence:** convert every PNG under `specs/evidence/` to WebP with `cwebp -q 82`, update references in `specs/**/*.md`, commit the WebP files. Keep David's reference images and the character renders under `art/` as they are.
4. **Migrations:** rename 024, 025, 029–034 to timestamps after `20260918230000` in numeric order; leave 035 until its file exists. Do not delete the stray `…project_rows 2.sql` in the main checkout from this branch's commits; delete it on the branch side only after the merge brings it in (it is a byte-identical Finder duplicate).
5. **Un-ignore** every JSON the plan lists, including `art/characters/hair/hair_catalog.json`, `art/characters/character_catalog.json` (being created) and the sky `manifest.json`.
