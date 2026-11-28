# Applicant terrain and HQ lounge

2026-09-17 · local `feat/director-developer-recruitment` · no deployment

## Requested outcome

A lightweight, cohesive grass/path/beach/water treatment and a cozy furnished HQ without the acorn. Completion checks: inspect existing assets/advanced implementation first, verify the material changes in Dia, preserve terrain/fishing geometry and the board walkway, check embedded furniture textures, run focused tests and type/lint checks.

## Reused assets and implementation

Inspected current and `.claude/worktrees/restart-art-cohesion` terrain materials, existing grass texture, terrain/road PNGs, water shader, furniture assets and original source collection. The current material system already contains the strongest relevant implementation, so this extends it. No new terrain renderer, fishing system, generated bitmap or substitute furniture model.

### Ground

- Grass: corrected the inherited legacy repeat of 10 on world-continuous grid UVs. Applicant repeat is now .85; the established triangle texture gets a quieter contrast treatment and the original blade normal uses repeat .8/strength .38. Sage tint `#91b47f`. This prevents microscopic detail from disappearing while keeping the motif subtle.
- Paths: original `mRoadSoil_Alb.png` with repeat .4, crossed second sample to interrupt recognizable pale patches, and fine grain sampled from the already-used original sand image. Warm earth tint `#e6c69b`. Normal strength stays gentle at .18.
- Beach: original 256×256 sand albedo, repeat .65, luminance-based palette treatment to retain grain while removing its strong baked orange cast. Cream tint `#f5e6c7`.
- Linear magnification/mipmapped minification and 4× anisotropy on applicant maps. Ground maps/normal transforms are cloned and disposed with the applicant material so the member defaults are not retuned. Existing blended edges/meshes remain intact.

### Water

Existing grid river/ocean shader remains shared. Added an optional small-wave normal hook using the existing `mSeaWater_Nrm.png`, 128×128 and 44,095 bytes. Its RG channels drive two slow crossing ripple samples; zero-strength/default water retains the old normal behavior. The shader program key includes optional shader hooks to keep variants distinct.

Applicant water: turquoise day ramp, slower .16-speed/.96-darkening patches, smaller 1.35 blob scale, reduced ring strength .035, softer narrow shore foam and .12 normal detail. Existing evening/night palettes and fishing shoreline geometry remain authoritative. No new terrain draw calls or screen-space reflection pass. The soil grain and wave detail each add texture sampling work; no formal GPU benchmark claimed.

### HQ lounge

Removed the applicant acorn rug and replaced the acorn wall image with the existing rose image. Original sofa/low-table/tea/book sources were imported using the existing `scripts/prepare-hq-lamp.py` workflow:

| Asset | Source | Size | Triangles |
| --- | --- | ---: | ---: |
| `lounge-sofa.glb` | `FtrSofaL`, cream body variant 4 | 181,588 B | 1,824 |
| `lounge-table.glb` | `FtrLowtableJapan`, body 0 | 233,000 B | 1,190 |
| `lounge-tea.glb` | `FtrTeaset`, body/fabric 0 | 77,940 B | 1,200 |
| `lounge-book.glb` | `FtrBookOpened`, body 0 | 54,020 B | 592 |

Total new model payload: 546,548 bytes, about 534 KiB. Textures embedded; source UVs and geometry retained. Original collection: `/Users/DavidLiu/Downloads/Assets/Model/`.

Sofa `(1.5,0,1.8)` faces the wooden table `(1.5,0,-.4)`. Tea and an open book sit at the measured table height .676; a second book sits on the reading table at .922. Reused floor lamp `(3.65,0,2.25)` lights the seating area without adding another shadow pass. Collision footprints protect sofa, table and lamp; the entry-to-board route stays open. Member HQ keeps its existing rug/layout.

Reproduce each import with `python3 scripts/prepare-hq-lamp.py /Users/DavidLiu/Downloads/Assets/Model MODEL OUTPUT`, using the source/output names in the table.

## Verification

- TypeScript and focused ESLint pass.
- 84 tests pass: applicant movement/fishing/furniture, grid geometry and surface blending. Added lounge blocking and board-route checks.
- GLB audit: all four imports have UVs, valid embedded PNGs and upright source bounds.
- Dia: daytime grass/path/beach/ocean inspected, HQ entry/exit works, lounge orientation and textured upholstery/wood/tea/books checked in pixel and smooth modes. Final green reading-table cloth and chair direction from the prior task are also visually confirmed.
- Screenshots: [HQ pixel](references/lighting-2026-09-16/hq-lounge-2026-09-17.jpg), [HQ smooth](references/lighting-2026-09-16/hq-lounge-smooth-2026-09-17.jpg), [island smooth](references/lighting-2026-09-16/island-surfaces-smooth-2026-09-17.jpg).
- Lighter graphics also rendered correctly in Dia. Original preferences restored: pixel finish on, lighter graphics off.
- No full production build, hardware performance benchmark, or mobile test. Changes are local; no push, deploy or production writes.
