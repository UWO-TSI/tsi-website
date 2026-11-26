# Lane: fish-models (the fish's models: concept views, raw Meshy, legendary heroes)

Worktree `.claude/worktrees/fish-list`, branch `game/fish-list` (shared with the fish-list lane, which is done). Agent type `uwotsi-lane`. Read first: `specs/fish-list.md` sections 3, 4 and 9 (section 9 has the "Fish style"), `art/pipeline/fish-style-prompt.md`, the design bible's Models chapter.

## Round 1 (2026-11-25): the pilot 5 and the legendary heroes

1. Fish style (stylised realistic): section 9 in `specs/fish-list.md` (edited through `specs/fish-list-src/template.md`, rebuilt) and the fixed prompt block `art/pipeline/fish-style-prompt.md`.
2. Pilot 5 (river): Common Shiner (common), Brown Trout (rare in the list; the brief said uncommon), Paddlefish (rare), Muskellunge (epic), Imugi (legendary, L1: hero only). Concept views (side, top, front; far side mirrored), then one Meshy `multi_image_to_3d` each for the 4 fish. David approves the raw Meshy model before any Blender edit.
3. Legendary heroes: one hero concept for L1 to L12, D1, D2, from section 4's text (no references). Aura only in the hero. David marks them up before any views or Meshy.
4. Two review pages (not published; the coordinator publishes): `specs/evidence/fish-models/page-pilot/index.html`, `page-legendary/index.html`.

## Round 5 (2026-11-26): Brown Trout to uncommon, merge-ready

David's marks on Fish pilot 4 (https://claude.ai/artifact/FxSFtwMF8iRgawDg1xuZHC): every card approved, the epic held-size rule kept for all epics and rares; r4-trout-option approved with the note "uncommon".

Done:
- Brown Trout uncommon: `specs/fish-list.md` (data.mjs, rebuilt: river now 13 common, 13 uncommon, 10 rare; its drop Fin, not Fin x2), `roster.ts` (rarity), `fishCatalog.ts` (the uncommon move profile); it keeps the rich model and 45 to 80 cm, and is held at the uncommon size (as before round 4).
- The seed folded into `web/supabase/migrations/20261126073423_catalogue_seed.sql` (regenerated with gen-seeds against `20261125191541` and renamed back; not applied anywhere): the trout's and the muskie's rows. `catalogue_seed_smoke.sql` checks the trout uncommon and the muskie to 180 cm.
- `origin/main` merged (already up to date at c9c419cab). Gates: tsc clean; eslint clean on touched files; vitest lib/game, lib/collections, seedMigrations, lib/icons, components/game/peaceful, components/lab: 246 files passed; SQL smoke: chain ok, "031 ok", "catalogue seed ok" (the world-chat "the rest" error is other lanes').
- Production migrations, in order: `20261125191541_catalogue_seed.sql`, then `20261126073423_catalogue_seed.sql`.
- Not pushed (lanes never push): the coordinator pushes and merges.

## Round 4 (2026-11-26): upside-down fix, huge Muskellunge, rare Brown Trout, Imugi rig note

David's marks on Fish pilot 3 (https://claude.ai/artifact/8r52wzRXSnBzvEbSSqmy5G): approved fp3-list, fp3-paddle, fp3-shiner, fp3-imugi. Notes: fp3-shiner "wh yare all the fish upside down"; fp3-imugi "looks good, when rigging you need to have its movements like snake"; redo fp3-muskie "its gotta be huge to justify it being a epic"; redo fp3-trout "this look more like a uncommon to me, nothing baout this is rare".

Done:
- **Upside down, root cause:** the fishing bench's preview (`web/components/lab/FishPreview.tsx`) turned fish with its own rotations from the village's frames; every fish since the remodel is head +y, back -z, and those turns showed it belly up. The GLBs, the held catch (FishingRig HOLD), the tanks and the icons (levelFish) were right. Fix: the preview lays fish with `levelFish` (exported `previewFish`), turned like the icons. `components/game/peaceful/fishFrame.test.ts` holds levelFish and the preview to back up. `buildFishStage` stays only for the old `/lab/icon` stage.
- **Held size:** `heldCatchLength(cm, rarity, body = 1.36)` in `web/lib/game/fishing.ts` (tests `lib/game/heldCatch.test.ts`) replaces FishingRig's `catchLength`: common and uncommon as before (0.5 to 1.1 m), rare x1.15 to 1.25 m, epic x1.45 to 1.9 m, scaled by body height (pass 2 when the 2 m body of ledger row 346 lands; it is a dev switch on game/character-run, not in main's code). FishingRig finds the rarity by model URL. All epics are held bigger: on the page as a call for David.
- **Sizes:** Muskellunge 110-180 cm (was 70-140), Brown Trout 45-80 (was 30-60); migration `20261126073423_catalogue_seed.sql` (gen-seeds), added to the smoke chain.
- **Brown Trout rare look:** `rare_look` pass in `art/fish/build_meshy_fish.py` (gold flank, vivid red spots with pale halos, bolder black spots), rebuilt, packed, icon re-rendered. The move-to-uncommon option is its own card, not done.
- **Imugi rig note:** in `specs/fish-list.md` section 9 (via the template) and here.
- **Evidence** `specs/evidence/fish-models/r4/`; page `page-pilot-4/index.html` published at https://claude.ai/artifact/FxSFtwMF8iRgawDg1xuZHC with db + comments.
- **Gates:** tsc clean; vitest lib/game, lib/collections, seedMigrations, lib/icons, components/game/peaceful, components/lab: 246 files passed; eslint clean on touched files; SQL smoke passes (its "the rest" world-chat error and the missing tasting-book and genesis migrations are other lanes').

## Round 3 (2026-11-25): the 4 fish in the game, the Imugi raw model

David's marks on "Fish pilot 2" (via the coordinator): all four game models approved, the fierce Imugi hero approved; the legendary page still unmarked (the other 13 untouched). 1024 textures kept (approved as shown).

Done:
- **Wiring:** `FISH_LIST_FISH` in `web/lib/collections/roster.ts` (after the buried finds, so no earlier position moves; in `ROSTER`, the roster seed and the icon manifest): river; Common Shiner common, all year, 06-18; Brown Trout rare, spring and autumn, 18-06; Paddlefish rare, spring, any hour; Muskellunge epic, spring, autumn and winter, 06-18. Sizes are the species' real ranges (the list sets none): 8-15, 30-60, 90-180, 70-140 cm. Sell prices are the rarity defaults the list keeps (8, 60, 60, 180). Reel rows in `web/lib/game/fishCatalog.ts` pointing at `/assets/game/remodel/fish/<slug>.glb`, not raw. The Collection Book and the HQ tank read `FISH`, so they list them with no change. The fish list's let-it-go materials and reel tasks aren't in the code yet, so nothing to wire there.
- **Migration** `web/supabase/migrations/20261125191541_catalogue_seed.sql` (gen-seeds.mjs: the roster block plus an upsert of the 4 rows), added to `specs/evidence/launch-fixes/sql-smoke.sh`'s chain. Smokes updated: `029-031_smoke.sql` (78 -> 82), `catalogue_seed_smoke.sql` (81 -> 85, the 4 rows); tests `collections.test.ts` (81 -> 85, aquarium 93 -> 97), `world/active.test.ts` (81 -> 85 remodelled fish).
- **Imugi model:** views from the approved hero (side as an edit of the hero, top and front as edits of the side; far side mirrored), pose laid out level in three vertical sea-serpent humps, head raised, jaws on the pearl: left-right symmetric (so the mirror and a straight top view hold) and a clean rig pose. All four views went to Meshy (the top view is right here: no paired fins to invent). One run, meshy-7.1 + meshy-7, Ultra geometry: 35 credits, task `01a2142e-02d1-72bb-940a-ae8256a8502b`, 1,390,306 triangles, 48.5 MB at `art/fish/meshy/imugi-raw.glb` (not in git). No Blender yet. ElevenLabs nodes `imugi-side` `8yaVyx0cv2wOcCp8Ril6`, `imugi-top` `Ev40hRnS34ENUL1T1Elv`, `imugi-front` `zpTLvzqTNFGYGVzSjclk`: 3 generations.
- **Evidence:** `pilot/<fish>-ingame.png` (the running game's fishing bench: list, 3D preview, member catch card), `pilot/reel-list.png`, `pilot/imugi-views.png`, `pilot/imugi-raw.png`; page `specs/evidence/fish-models/page-pilot-3/index.html` (render-checked, not published).
- **Gates:** tsc clean; vitest `lib/game lib/collections lib/seedMigrations.test.ts lib/icons` 241 files passed, 1 skipped; eslint clean on the touched files; the SQL smoke chain passes the new counts (its only error, world chat's "the rest", fails the same without this migration). The chain also flags tasting-book and genesis migrations missing from its GAME list: other lanes', not touched.

## Round 2 (2026-11-25): game models for the approved 4, the fiercer Imugi

David's marks on the pilot page (verbatim, via the coordinator): Common Shiner, Brown Trout, Paddlefish, Muskellunge approve, "looks good, now time to model and convert into triangles". Imugi hero redo: "make it more fearsome looking with fangs, look scarier like a seaserpant." Legendary page not marked yet (the other 13 untouched).

Done:
- `art/fish/build_meshy_fish.py` (headless Blender, reuses `art/remodel/build_fish.py`'s finish): raw Meshy -> game frame (head +y, back -z, centred) at the house size class -> fins that stuck out flat swung back 58 and down 18 degrees about a hinge on the body (muskie's pelvics too) -> paddlefish jaw slimmed -> mirror-symmetric collapse decimate (60k, then the target) -> smart UV -> Cycles diffuse-colour bake from the raw at 1024 px -> house blur and grade -> colour nudged toward the concept after the grade (Brown Trout 0.85, Paddlefish 0.6) -> smooth shading with normals split past 70 degrees (thin fins went dark otherwise) -> COLOR_0 counter-shade -> export -> `pack-glbs.mjs`.
- `web/public/assets/game/remodel/fish/{common-shiner,brown-trout,paddlefish,muskellunge}.glb`: 900 / 1,200 / 1,600 / 1,400 triangles, 0.62 / 0.95 / 2.3 / 1.7 units long, 721 / 647 / 484 / 630 KB packed (1024 px lossless WebP; the house fish are 25 to 185 KB at 128 to 512 px: a 512 px texture would bring these near 200 KB if wanted).
- Icons `web/public/assets/icons/fish_{common_shiner,brown_trout,paddlefish,muskellunge}.webp`, rendered by `/lab/icons` (render-icons.mjs) with a temporary, reverted manifest line (the species have no rows yet); they come out nose left, back up like the house icons, which also checks the frame.
- Imugi redo 1: new node `x6xiRLKdZVZv7D9HJ02q` on the flow, 1 generation (338 credits); replaces `legendary/L1-imugi.png` on both round 1 pages.
- Evidence `pilot/<fish>-game.png` (raw vs game, side, top, three-quarter, the icon, the house fish); page `specs/evidence/fish-models/page-pilot-2/index.html` (render-checked, not published).
- Gates: `tsc --noEmit` clean; `vitest run lib/game` 234 files passed, 1 skipped (2,086 tests), including `perf/budget.test.ts` and `world/active.test.ts`.

**Wiring still missing (not done: no species rows on this branch):** roster rows in `web/lib/collections/roster.ts` (keys `fish_common_shiner`, `fish_brown_trout`, `fish_paddlefish`, `fish_muskellunge`: river, rarity, size, hours, months from `specs/fish-list.md` section 3); a `FishRow` each in `web/lib/game/fishing.ts` or `fishCatalog.ts` with `model: "/assets/game/remodel/fish/<slug>.glb"` and no `raw` (there is no dump file under `/assets/acnh/fish/`, so the usual acnh path plus `worldModel` swap would 404 in the old frame); the `collection_species` seed (a new migration) and the Collection Book. The icons resolve by key through `iconFor` once the rows exist.

## Status

Round 5 done (2026-11-26; above), merge-ready; rounds 4 to 1 below. Head SHA: `git log -1` on `game/fish-list`.

- **ElevenLabs:** 26 generations (budget about 30): 12 pilot views (side 338 credits each, top and front edits 412 each) and 14 heroes (338 each). About 9,800 ElevenLabs credits.
- **Meshy:** 4 runs, 120 credits (balance was 725, now 605), meshy-7.1 + meshy-7, standard, 2K, image_enhancement false:
  - Common Shiner `01a21193-2d01-716e-939e-257368ea2294` (407,880 tris, 15.3 MB)
  - Brown Trout `01a21193-4642-76a2-a44a-896962206fe6` (245,674 tris, 9.7 MB)
  - Paddlefish `01a21193-5170-7464-9292-685bf5d3e774` (192,756 tris, 7.7 MB)
  - Muskellunge `01a21193-5c80-7386-a55a-b98b4e30a204` (232,534 tris, 9.6 MB)
- **Raw GLBs** (not in git, all over 5 MB; `art/fish/meshy/.gitignore` ignores the folder): `art/fish/meshy/<fish>-raw.glb` and `<fish>-raw_base_color.png` in this worktree. Meshy's download links expire 2026-11-28; after that, re-download with `meshy_download_model` and the task id (free).
- **Evidence:** `specs/evidence/fish-models/pilot/<fish>-views.png` (side, top, front, far) and `<fish>-raw.png` (top row the registered views; bottom row the raw model side, top, three-quarter and the house fish at right), `legendary/<id>-<name>.png` (768 px).
- **Finding:** `web/public/assets/game/remodel/fish/rainbow-trout.glb` does not look like a trout (big-eyed, tall fins); the Golden Trout was used as the Brown Trout's house reference instead. Not fixed here.

## David's decisions

- 2026-11-26, Fish pilot 4 marks: every card approved (keep the rarity-based held size for all epics and rares; keep the trout's rich look and size); r4-trout-option "uncommon": the Brown Trout moves to uncommon.
- 2026-11-25, Fish pilot 3 marks: list, paddle, shiner and the Imugi raw model approved; "wh yare all the fish upside down"; Imugi "when rigging you need to have its movements like snake"; Muskellunge redo "its gotta be huge to justify it being a epic"; Brown Trout redo "this look more like a uncommon to me, nothing baout this is rare".
- 2026-11-25, "Fish pilot 2" marks (via the coordinator): the four game models approved, the fierce Imugi hero approved; keep the 1024 textures.
- 2026-11-25, pilot page marks (via the coordinator): the 4 raw Meshy fish approved, "looks good, now time to model and convert into triangles". Imugi hero redo: "make it more fearsome looking with fangs, look scarier like a seaserpant."
- 2026-11-25 (via the coordinator): every model goes concept views (ElevenLabs image) -> Meshy multi_image_to_3d -> David approves the RAW Meshy model -> Blender hand edit (replaces section 9's "no Meshy, Blender only"). Fish style: stylised realistic (real anatomy, clean painted scales and fins, readable silhouettes; not cartoon-cute, not bevelled hard-surface). Pilot 5 as above, the remodel fish as house scale. Legendaries: text concepts first, never web references; gold aura for legendaries, holo shimmer for Divine, electric arcs for Megabyte, in the hero concept only. Bosses are rigged and animated in Roblox Studio later (not this lane).

## Next

1. The coordinator pushes `game/fish-list`, merges it to main and applies `20261125191541_catalogue_seed.sql` then `20261126073423_catalogue_seed.sql` to production.
2. The Imugi boss edit in Blender when David asks; the rig (a serpentine S-wave down a spine chain) in Roblox Studio later.
3. The legendary page's marks (13 creatures), then views and Meshy per creature; the next fish through the pipeline.

## Tools and gotchas

- ElevenLabs flow `61UkixbxuaVOR8CKR7vG` (gpt-image-2.6-sunburst). Make a node with `creative_generate_image` (or `creative_edit_image` with `connect_from` the side node) and `estimate_only` true (free), set `aspect_ratio` 1:1 with `creative_update_node`, then `creative_run_flow_nodes` with `generations_count` 1 (the tool default is 4). Never rerun a generation call to retry. The status call echoes every prompt in full: poll a batch once, after about a minute, not every 10 s.
- Download with `curl` from `content_url`; in zsh never name a loop variable `path` (it is tied to `PATH`).
- `art/fish/register_views.py <dir> <fish>`: cuts the grey, registers the views, mirrors the far side, writes `<dir>/meshy/` and the review strip.
- `art/fish/render_views.py`: headless Blender render of a GLB in side, top and three-quarter (`house` for the remodel fish, `auto rotz=180` for Meshy raw, nose left). Run under `LANE=fish-models withlock.sh blender`.
- Pages: `python3 ~/Developer/claudebrain-tools/review-page/mkpage.py <spec.json>` (specs were in the session scratchpad; the page embeds the images, so delete the `.webp` copies and `files.json` it leaves next to `index.html`). Render check: `~/.claude/skills/gstack/browse/dist/browse goto file://...` then `screenshot`, under `withlock.sh devserver`.
- The top views are not fed to Meshy for fish (the image model draws median fins as side pairs from above); for a finless serpent the top view is fine.
- In-game shots: gstack browse runs SwiftShader and can't make the WebGL context the 3D preview needs; use Playwright from `/opt/homebrew/lib/node_modules` with `--use-angle=metal` (as `scripts/render-icons.mjs`), headless, dev server on port 3192 under the devserver lock. The member catch card is up about 1.6 s after "Preview the catch card".
- Held-catch shots without playing the reel: `hold.mjs` (round 4, session scratchpad; built from reel-cam's `specs/evidence/fish-tiers/ui-world/shoot.mjs`) loads `/lab/island` signed out and fires the avatar's own beats (`tsi:fish-start`, `-cast`, `-bite`, `-hooked`, `-caught` with `{model, sizeCm}`), then shoots ~3 s after the landing; camera via `tsi.camera.v1` (zoom 0.42, pitch 0.32). Real casts from that script no longer start (the click and E both did nothing on the pier).
- `node scripts/gen-seeds.mjs` writes the seed migration; add it to `specs/evidence/launch-fixes/sql-smoke.sh` and fix the smokes' species counts.
