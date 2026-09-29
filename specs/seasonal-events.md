# Seasonal events spec (four repeating club goals)

Owner: one agent in its own worktree. Backend: club goals in `web/lib/progression` (story vs seasonal, windows, weights). Decisions: rows 184, 204, 212, 96, 99. Load `ponytail` first.

## Fixed decisions
| Event | When | Content |
|---|---|---|
| Fall fishing tourney | September | Timed catch-size contest window, plaza trophy with the week's winners, limited-time catches |
| Winter lights festival | December | Lantern strings and snow decorations in the plaza, cocoa at the cafe, festive furniture |
| GENESIS week | March | The real showcase mirrored in-game: banners, a plaza stage, project posters |
| Spring blossom picnic | April | Cherry petals, picnic furniture, flower crowns |
Each is a seasonal club goal that repeats yearly; completing it unlocks that year's cosmetic reward and decorations stay for the window.

## Deliverables
1. Seed the four seasonal goal templates with windows, targets and rewards through the existing goal model (no new goal system).
2. An event layer in the world: decoration sets per event toggled by the active window (reuse the seasonal swap mechanism), with `?event=` override.
3. Fishing tourney: entries from catches during the window, leaderboard of biggest catch per species category (top half public / bottom half private per principle 6), plaza trophy display.
4. Limited-time catches and event furniture added to the collections roster and catalogue.
5. Evidence prefix V- under `evidence/events/`; tsc, focused lint, vitest (window activation across year boundaries in Toronto time, tourney ranking privacy).
