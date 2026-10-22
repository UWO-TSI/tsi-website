# Lane: wardrobe follow-up

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/wardrobe-b2`
- **Branch:** `game/wardrobe-followup`, cut from main at `f66bafe6`, with main merged at `46fe6089` (task 1 merged there). Wardrobe batch 2 has merged; its seed `20261017172740` is applied to prod.
- **Lock helper:** `/Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh`, with `LANE=game/wardrobe-followup`. It waits 20 minutes, longer than a foreground call, so use a copy that waits at most 8.

## Status (2026-10-22)

- **Task 1, the #04 crew visor's logo:** **approved by David (2026-10-22)** and merged to main (`46fe6089`). Commit `80a40e30`.
  - Sheet: `specs/evidence/wardrobe-b2/19-visor-logo.webp`. It shows the round-5 M before, the visor over #03, #10 and #27 at front, 3/4 and high, the logo close up, and LOD 1.
  - Gates:
    - full tsc;
    - eslint on `look.test.ts`;
    - full vitest: 347 files, 3,330 tests;
    - `sql-smoke.sh`, with gen-seeds reporting the seeds up to date;
    - fit_check PASS, with only #20's standing flag.
  - No perf:check: the visor's triangles, materials and draw are unchanged; only the atlas's texels and the band's UVs change.
  - **Residual (tell David; not fixed):** on #03 long scruffy, one thin strand still crosses the logo at every angle. It was there in round 5, and the hat cut stays as approved.
- **Task 2, the merch catalogue rows:** done. The commit is the one that adds this line. Not applied to prod; the coordinator applies it.
  - `lib/wallet/catalogue.ts`: the TSI keycap keychain (800 gems), the TSI lanyard (800) and the GENESIS sticker (200) are `CATALOGUE` rows.
    - They're club merch: Gems only, stock unset (unlimited), redeemed and picked up at HQ on campus.
    - They're last (positions 40 to 42), so no earlier row moves.
    - The sticker's picture stays its foil sprite.
  - `PENDING_MERCH` is gone, from every reader too: the shop display, the item models, `/lab/icons`, the dev economy and the tests.
  - Migration `web/supabase/migrations/20261022185120_catalogue_seed.sql`, written by gen-seeds:
    - the economy block, plus an upsert of the three new rows;
    - the shop-icons block.
    - It sorts after every migration on main.
  - SQL smoke:
    - `web/supabase/tests/club_merch_smoke.sql` checks the rows, the prices and that they're on sale and unlimited;
    - it redeems each one with Gems and replays a redeem;
    - the desk fulfils one and cancels one, which refunds it and leaves it unlimited;
    - it applies the migration again to show it's idempotent.
    - It's in `sql-smoke.sh`, and it fails first with the migration cut off ("three merch rows").
    - Output: `specs/evidence/wardrobe-b2/sql-smoke-merch.txt`.
  - `economy.test.ts`: the three rows at their prices, on the shop's merch tab with Redeem on (`can_buy`), each reserved with Gems, stock still unlimited.
  - Gates:
    - full tsc and eslint on the changed files;
    - full vitest: 347 files, 3,331 tests;
    - sql-smoke exit 0, with gen-seeds reporting the seeds up to date;
    - fit_check PASS, with only #20's standing flag.
    - No perf:check (data only).
  - Not seen in a browser: the overlay's Redeem follows `can_buy`, which the test covers.

### What task 1 did

- **Why the M was broken:** the source's M was half an arch, mirrored across the band's UVs. The decimation took the vertex on the mirror line at the band's top, so the two halves no longer met. Painting through those UVs can't work, since one texel is sampled at several places on the band.
- **The fix** (`art/characters/accessories/arches_logo.py`, called by `import_roblox.py` for an entry with `logo`):
  - The band's front faces (10 of them, within 30 degrees of the face) get new UVs: a projection from the front into their own atlas tile, `acc_crew_visor_logo` (256 px at (1536, 768)). It's appended last in `colour_atlas.TILES`, so no other tile moves.
  - The tile is the band as it was, sampled through the old UVs. The old logo is cleared by blending the band's black across its box, row by row.
  - The W is drawn over it, antialiased:
    - the golden-arches style M (two parabolic arches whose inner feet merge), turned upside down;
    - in the visor's own trim yellow (241, 185, 17);
    - 70% of the band's height, 1.2 times as wide as it is tall (8.8 x 7.4 cm), centred on the face.
- **What stayed exactly the same** (checked against the committed GLBs):
  - the visor's triangles at Full (734) and LOD 1 (293): positions and winding;
  - its normals, skin weights and colours;
  - every atlas texel outside the new tile.
  - Only the band's UVs changed. The vertex count rose by the new UV seam (586 to 595, and 324 to 329).
  - So the hairs' hat cut (`_HATCUT`) is untouched, and no hair was rebuilt.
- **Icon:** `web/public/assets/icons/acc_crew_visor.webp` rebaked (`render-icons.mjs acc_crew_visor`). Nothing else bakes the visor's texture.
- **Test:** `look.test.ts` checks that the visor's Full and LOD 1 draw from the logo tile.

## David's decisions (newest first)

**2026-10-22: the visor logo is approved** (via the coordinator). It merged to main at `46fe6089`.

**Round 5, the #04 crew visor**, verbatim: "the M symbol is messed up make it the mcdonald m but flip it so its w".

What it means:
- The logo on the visor's front band is the golden-arches style M (two rounded arches, yellow-gold on the black band), flipped vertically so it reads as a W. That makes it a parody, not the real mark.
- Drawn by us as clean art. The real logo is never fetched.
- The visor's placement and hat cut stay exactly as approved.

**Merch prices** (David, 2026-10-18): the TSI keycap keychain 800 gems, the TSI lanyard 800 gems, the GENESIS sticker 200 gems. Stock unset (unlimited).

## Next

1. The coordinator applies `20261022185120_catalogue_seed.sql` to prod and merges. Then the three items show on sale, with Redeem on.
2. Stock limits, if David sets any: a `stock` on the row in `CATALOGUE`, then gen-seeds writes a new migration. Never edit `20261022185120` once it's applied.

## Tools and gotchas

- The previous lane's rebuild order, diagnostics and engine shots are in `specs/lanes/wardrobe-b2.md`.
- **Rebuilding the visor** (each step a foreground call under the Blender lock):
  1. `Blender -b -P art/characters/accessories/import_roblox.py -- --only acc_crew_visor` (it paints the logo tile too);
  2. `Blender -b -P art/characters/build_lod.py -- acc_crew_visor`;
  3. `Blender -b -P art/characters/hidden_cut.py -- hidden acc_crew_visor`. The import alone leaves 30 hidden triangles (764); `hidden` takes them out (734), as before.
  4. `node web/scripts/sync-character-assets.mjs`, then check out the byte-only changes to `decal_tsi_mark.png` and `hair_colour_world.png`.
  - The import is deterministic: the triangles came out identical to the committed ones.
- **Preview without Blender:** `arches_logo.inside_w(s, t)` is plain numpy, so the W can be drawn with PIL to try a shape.
- **Merch rows:** after a `CATALOGUE` change, run `node scripts/gen-seeds.mjs` from `web/`. Add the migration to `GAME` in `sql-smoke.sh` and its smoke to `SMOKES`; the script fails otherwise.
- **Engine shots:** `HOST=http://localhost:3184 node specs/evidence/wardrobe-b2/shoot.mjs <dir> visorlogo`, then `python3 specs/evidence/wardrobe-b2/sheet_visor_logo.py <dir>`.
  - The bench's camera turns round the head's axis, so a 3/4 view at zoom 4 misses the logo. The close-up is front only.
  - `&charlod=1` draws LOD 1.
