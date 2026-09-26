# Study in the world spec (cafe seats, outdoor tables, overhead timers)

Owner: one world agent in its own worktree. Backend exists: `web/lib/study/*`, `/api/study/*`, `useStudySession()`, tables with `anchor` keys like `study:cafe-four-1`. Decisions: rows S1, 72–80, 164–171. Load `ponytail` first.

## Fixed decisions
| Topic | Decision | Row |
|---|---|---|
| Seats | Cafe interior plus outdoor tables; mixed window tables, 2-seat, 4-seat and a couch area; final layout from David's interior design later | 164, 167 |
| Access | Cafe opens when the chapter 2 club goal completes; outdoor tables available from day one | 177 |
| Sit flow | Walk to a seat, prompt "Sit" then "Start studying"; sitting alone does not start a reward timer | S1 proposal |
| Overhead | Countdown above each studying avatar; break countdown during breaks | 78 |
| Break | Character stretches at the seat (placeholder bob until the Blender clip exists); chat unmutes | 166 |
| Leaving | Walking away ends the session and pays completed minutes | 80 |
| Board | Opt-in top-studiers board on the cafe wall | 171 |

## Deliverables
1. Seat anchors as data (position, facing, table id) in one layout file so David's interior design can be dropped in without code changes; map each backend table `anchor` to seats.
2. Cafe interior: cozy placeholder from existing dump furniture in the HQ clubhouse family (warm wood, plants, bookshelves, window light); 2-seat, 4-seat, window and couch groups; closed state until the chapter 2 goal completes (reuse the café boards logic).
3. Two or three outdoor tables in the village core (plaza, beach, pond) using existing benches/tables.
4. Sit/stand, start sheet (focus, break, cycles, presets 25/5×4 and 50/10×2), overhead timers for self and seat-mates, break stretch, walk-away ends session, private-table lock toggle for the host, table chat panel (exists on the companion page; reuse it).
5. Cafe wall board from `/api/study/board`.
6. Evidence prefix Y- under `evidence/study-world/`; tsc, focused lint, vitest (anchor mapping, walk-away detection radius).
Out of scope: final cafe interior art, phone 3D view.
