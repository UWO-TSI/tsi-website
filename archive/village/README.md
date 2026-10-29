# archive/village/

The retired islands (ledger row 321). Nothing in the game, the labs or the tests loads these files.

**Why:** David, 2026-10-28: "why are we using the old island for some of these artifcats, it should not be used or archived". The new world (`web/data/world`) has been the member island since production set `NEXT_PUBLIC_GAME_WORLD` on 2026-10-26. This archive removes the village as a fallback. The title screen also moved to the new world.

**Last code that ran them:** `de87c07f` on main (2026-10-28). Build it without `NEXT_PUBLIC_GAME_WORLD` to get the village back as the member island and the title. `/lab/map` paints all three maps there. Production last showed the village on 2026-10-26.

## The village (the member island until 2026-10-26)

- `village-map.json`: the village map that `/lab/map` painted, as the terrain grid plus its object layer. It was the member island when `NEXT_PUBLIC_GAME_WORLD` wasn't `new`, and the title screen's backdrop (row 318).
- `assets/wharf-dressing.glb`, `assets/rowboat.glb`: the village wharf's dressing: the finger pier with its posts, the lantern poles and the moored rowboats (v1 water item 7; built by `art/wharf/build_wharf.py` and `art/props/build_rowboat.py`). The new world's wharf is the jetty.

## The older drafts

- `island-map.json`: the legacy grid island, the first painted draft before the village file. `/lab/map` could still open it as a source.
- `world-map.json`: the v2 cell world, the terrain v2 draft. `scripts/convert-world.ts` converted it once into the smooth world (specs/world-editor.md v0 step 2), and David has sculpted that world since.
- `v1-barriers.json`, `v1-campfire.json`: the v1 placement proposals for the v2 cell world, shown as ghosts in `/lab/map` and the world editor until accepted. Their coordinates belong to that map.

## Specs

- `island-painter.md`: `/lab/map`, the painter for the cell maps.
- `island-core.md`: the village core's layout.
- `terrain-blending.md`: blending the cell terrain.
- `acnh-system-reference.md`: the measured ACNH grid rules behind the cell maps.
