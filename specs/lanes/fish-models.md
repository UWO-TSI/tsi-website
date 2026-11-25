# Lane: fish-models (the fish's models: concept views, raw Meshy, legendary heroes)

Worktree `.claude/worktrees/fish-list`, branch `game/fish-list` (shared with the fish-list lane, which is done). Agent type `uwotsi-lane`. Read first: `specs/fish-list.md` sections 3, 4 and 9 (section 9 has the "Fish style"), `art/pipeline/fish-style-prompt.md`, the design bible's Models chapter.

## Round 1 (2026-11-25): the pilot 5 and the legendary heroes

1. Fish style (stylised realistic): section 9 in `specs/fish-list.md` (edited through `specs/fish-list-src/template.md`, rebuilt) and the fixed prompt block `art/pipeline/fish-style-prompt.md`.
2. Pilot 5 (river): Common Shiner (common), Brown Trout (rare in the list; the brief said uncommon), Paddlefish (rare), Muskellunge (epic), Imugi (legendary, L1: hero only). Concept views (side, top, front; far side mirrored), then one Meshy `multi_image_to_3d` each for the 4 fish. David approves the raw Meshy model before any Blender edit.
3. Legendary heroes: one hero concept for L1 to L12, D1, D2, from section 4's text (no references). Aura only in the hero. David marks them up before any views or Meshy.
4. Two review pages (not published; the coordinator publishes): `specs/evidence/fish-models/page-pilot/index.html`, `page-legendary/index.html`.

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

Round 2 done (2026-11-25; above); round 1 below. Head SHA: `git log -1` on `game/fish-list`.

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

- 2026-11-25, pilot page marks (via the coordinator): the 4 raw Meshy fish approved, "looks good, now time to model and convert into triangles". Imugi hero redo: "make it more fearsome looking with fangs, look scarier like a seaserpant."
- 2026-11-25 (via the coordinator): every model goes concept views (ElevenLabs image) -> Meshy multi_image_to_3d -> David approves the RAW Meshy model -> Blender hand edit (replaces section 9's "no Meshy, Blender only"). Fish style: stylised realistic (real anatomy, clean painted scales and fins, readable silhouettes; not cartoon-cute, not bevelled hard-surface). Pilot 5 as above, the remodel fish as house scale. Legendaries: text concepts first, never web references; gold aura for legendaries, holo shimmer for Divine, electric arcs for Megabyte, in the hero concept only. Bosses are rigged and animated in Roblox Studio later (not this lane).

## Next

1. The coordinator publishes `page-pilot-2` (and the refreshed round 1 pages); wait for David's marks on the game models, the new Imugi and the legendary page.
2. Game model fixes from his notes: edit `FISH` in `art/fish/build_meshy_fish.py` (fin windows, angles, nudge, tris, length) and rerun (`FISH_CONCEPTS=<dir with meshy/<short>-side.png>` for the nudge; the registered views were in the round's scratchpad: if gone, download the views again from the ElevenLabs flow's nodes labelled `<short>-side`, `-top`, `-front` (free) and rerun `register_views.py`), then pack and re-render the icons.
3. Redone raw fish: fix the views first (an edit of the side view), then one new Meshy run only with the coordinator's OK.
4. Legendaries: from David's marks, views per creature (fish blocks, no aura), then Meshy. Charybdis is a scene (funnel plus turbine), not one mesh: plan it with him.
5. Open: section 9's route A ("reshaped from an existing fish") predates Meshy; ask whether route A fish also go through Meshy.

## Tools and gotchas

- ElevenLabs flow `61UkixbxuaVOR8CKR7vG` (gpt-image-2.6-sunburst). Make a node with `creative_generate_image` (or `creative_edit_image` with `connect_from` the side node) and `estimate_only` true (free), set `aspect_ratio` 1:1 with `creative_update_node`, then `creative_run_flow_nodes` with `generations_count` 1 (the tool default is 4). Never rerun a generation call to retry. The status call echoes every prompt in full: poll a batch once, after about a minute, not every 10 s.
- Download with `curl` from `content_url`; in zsh never name a loop variable `path` (it is tied to `PATH`).
- `art/fish/register_views.py <dir> <fish>`: cuts the grey, registers the views, mirrors the far side, writes `<dir>/meshy/` and the review strip.
- `art/fish/render_views.py`: headless Blender render of a GLB in side, top and three-quarter (`house` for the remodel fish, `auto rotz=180` for Meshy raw, nose left). Run under `LANE=fish-models withlock.sh blender`.
- Pages: `python3 ~/Developer/claudebrain-tools/review-page/mkpage.py <spec.json>` (specs were in the session scratchpad; the page embeds the images, so delete the `.webp` copies and `files.json` it leaves next to `index.html`). Render check: `~/.claude/skills/gstack/browse/dist/browse goto file://...` then `screenshot`, under `withlock.sh devserver`.
- The top views are not fed to Meshy (the image model draws median fins as side pairs from above).
