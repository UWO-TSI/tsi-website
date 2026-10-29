# Island core spec (milestone 1: look transfer + village core)

Owner: island agent. Decisions come from `game-world-development-plan.md` rows 84–107 and 145–163 (David, 2026-09-23). Where this worktree's `CLAUDE.md`, `specs/asset-stack.md` or older specs conflict with those rows, the ledger wins (notably: characters are 3D now, the world runs on real time, ghosts are out, the curved smooth world stays).

## What milestone 1 is

Make the member game island (this worktree, `feat/game-default-island`) look like the applicant island that shipped to production on 2026-09-17, then lay out the village core on real campus time with the season/weather scaffolding. Residents stay placeholders. No quests, economy, homes, combat, study tables or creator in this milestone.

## Fixed decisions

| Topic | Decision | Row |
|---|---|---|
| Look baseline | Adopt the applicant island's shipped lighting profiles, surface materials, water, clubhouse HQ interior, fireflies, lamp pools | 104, 151, 162, 163 |
| World geometry | Keep the smooth ACNH-style curved world and ACNH dump props/trees; faceted characters on top | 148, 149, 150 |
| Time | Real-life campus time (Toronto), no accelerated day; night content only at real night | 84, 88 |
| Lighting profiles | Keep day/evening/night from the applicant island, add dawn; sky panoramas are placeholders until generated art lands (`specs/sky-art-prompts.md`) | 157 |
| Seasons | Full seasonal dressing on the real Ontario calendar, blended gradually over ~2 weeks per transition | 99, 161 |
| Weather | Open-Meteo hourly forecast for London, Ontario; states clear/rain/snow/fog/wind; seeded fallback | 152, 153, 160 |
| Quality | Auto-detect tier from first-frame timings with manual override: Light (blob shadows, no wind, fewer critters) / High (shadow maps, wind sway, full ambient life, FXAA) | 145, 147 |
| Camera | Elevated follow, slight lead, two-step zoom, no free rotate (as shipped) | 154 |
| Core layout | HQ clubhouse, plaza, catch board, notice board; shop, cafe (locked), Oracle temple; beach with wharf stub, small pond, bushes and trees; museum shell and ruins gate visible but closed | 155 |
| Size | Core ~1.5×1.5 screens of a ~3×3 island; later biomes are closed pockets | 156, 86 |
| Ambient life | Resident routines (placeholders), critters, weather. No ghost replays | 103, 85 |
| Wayfinding | Minimap in the HUD with landmark markers | 158 |
| UI | Soft rounded panels in the Tethos palette, recruitment UI kit | 124 |
| Performance | Integrated-graphics laptops: 30 FPS minimum, 60 where practical | 39 |

## Deliverables, in order

1. **Look transfer.** Bring the applicant island's rendering into this worktree's island: lighting profiles (`TOD` keys, fill ratios, fog/haze), grass/path/sand materials, the water shader with the sea-normal texture and shore rings, blob shadows, lamp pools, fireflies, the clubhouse HQ interior. Source of truth is the production checkout at `/Users/DavidLiu/Documents/GitHub/uwotsi` (branch `main`): `web/components/recruit/ApplicantIsland.tsx`, `ApplicantWorld.tsx`, `web/components/game/HQInterior.tsx`, `web/lib/game/applicantVillage.ts`, materials and lighting under `web/lib/game/` and `web/components/game/`, plus `specs/applicant-lighting-2026-09-16.md`, `specs/applicant-surfaces-and-lounge-2026-09-17.md`, `specs/cozy-lighting-and-adaptive-ui-2026-09-17.md`, `specs/clubhouse-refinement-2026-09-17.md`, `specs/hq-interior-polish-2026-09-17.md`. Read those before touching anything. Reuse and port; do not rewrite systems that exist in either checkout (David's standing rule). Evidence: side-by-side screenshots (applicant island on main vs this island) at morning, evening and night, same camera.
2. **Real time + dawn.** The island clock is the real Toronto time; add a dawn profile between night and day; verify with a forced-time query param that all four profiles and the night lamps/fireflies work.
3. **Season + weather scaffolding.** A `season.ts` that returns the blended season factor for a date; a `weather.ts` server route that fetches Open-Meteo for London, Ontario hourly (cache, seeded fallback) and maps to clear/rain/snow/fog/wind; wire the existing rain effect to it; snow/fog/wind can be stubs that only change the lighting profile for now. Tests for the date→season and code→weather mappings.
3b. **Quality tiers.** Extend the existing graphics settings: auto-detect from a first-frame timing probe, manual override persisted; Light vs High as defined above.
4. **Village core layout.** Place the row-155 landmarks on the existing default island using existing buildings/props (ACNH dump, current GLBs). Closed landmarks get a readable closed state (boarded door, sign). Catch board and notice board are props with proximity prompts that open a placeholder sheet. Add the minimap (existing island layout data) to the HUD.
5. **Report.** Screenshots per deliverable, FPS on this Mac at both tiers, test counts, and the open questions file.

Each deliverable ends with: TypeScript passes, focused lint passes, the existing test suite passes, and a screenshot reviewed by you (Read the PNG). Do not push, deploy, commit or touch production. Do not edit the main checkout.

## Out of scope

Quests, homes, economy, study tables, combat, creator, residents' final art, sky art generation, the applicant portal itself.

## Questions

Append to `specs/island-core-questions.md` (date, question, assumption) and keep going.
