# HQ clubhouse: layout research and local refinement

Date: 2026-09-17. Scope: applicant village/HQ and reuse of the shared notification system. Local review only.

## Outcome and acceptance checks

David approved sage walls, warm wood, cream seating; subtle satisfying feedback; autonomous local rearrangement/removal and testing. The hiring board must be centered, furniture must face the activity it serves, and the entry, board, clock and bookshelf must remain reachable. Existing implementations/assets must be searched before creating anything. No deployment or new game/economy systems.

## Research findings

Pinterest is visual inspiration here, not evidence of Nintendo's implementation or a professional building standard. Some pin pages blocked automated page access; the linked pin images were retrieved and visually inspected. These may be rendered/staged interiors. Real-world measurements below inform proportions, not a claim that one game unit equals a metre.

| Principle | Source evidence | Application to this room |
|---|---|---|
| Give the room one focal point | [IKEA small-room planning](https://www.ikea.co.id/en/inspirations/7-ways-to-create-an-aesthetic-small-living-room) organizes furniture around a focal point and clear movement | Hiring board at the center of the back wall; pictures moved above the lounge |
| Plan movement before decorations | Same IKEA guidance keeps doorways and routes clear; [IKEA sofa sizing](https://www.ikea.com/es/en/rooms/living-room/how-to/how-to-choose-the-size-of-your-sofa-pub3e842ce0/) accounts for room, hall and access dimensions | Clear central route from entrance to board; separate side routes to clock and shelf |
| Group seats around an activity | [Room & Board sectional layouts](https://www.roomandboard.com/design/inspiration/living-room/sectional-ideas) shows conversational zones and circulation around tables | Sofa, angled chair, table, tea and book form one lounge, away from the main aisle |
| Tables should be within reach | IKEA sofa guide recommends approximately 45 cm between seat and table and a tabletop close to seat height | Low table; about 0.68 world units between sofa's front and table's back, allowing for avatar clearance |
| Put task lamps beside the task | [Lutron layered lighting](https://www.lutron.com/us/en/articles/layered-lighting-tips), April 15, 2023, and [IKEA living-room lighting](https://www.ikea.com/be/en/rooms/living-room/how-to/how-to-choose-the-right-lighting-for-your-living-room-pub8ab12450/) describe task/ambient/accent layers | Floor lamp at sofa arm, existing desk light at worktop, a small pendant above the board and another over the lounge table |
| Vary brightness to create depth | Lutron describes differentiated ambient, task and accent layers instead of equal illumination everywhere | Neutral/cool bounced fill with localized warm lights; readable day/evening/night profiles retained |
| Use large pieces to anchor wall groups | [Animal Crossing Pinterest room](https://ca.pinterest.com/pin/animal-crossing--5136987066245742/) has a strong centered focal wall with tall storage at its sides | Board remains primary; clock/display and lounge balance the sides, shelf backs onto side wall |
| Repeat a small material palette | [Sage/cream Pinterest reference](https://www.pinterest.com/pin/beige-couch-with-sage-green-walls-in-2024--784963410085308261/) and [wood/cream salon reference](https://www.pinterest.com/pin/444941638201242568/) repeat pale seating, wood, simple tables and restrained decoration | Sage wall/panel tones, original cream upholstery and rug, original wood surfaces; two botanical frames |
| A rug groups the seating | Observed in the sage Pinterest image: rug under table and seating front; floor remains visible around it | Original plain cream rug beneath lounge, replacing neither the entry mat nor the removed acorn rug |

## Implemented arrangement

Coordinates are game world X/Z; the fixed camera sees +X on screen left. Room walls are X ±8, Z ±6. Shared `HQ_LAYOUT` in `web/lib/game/applicantVillage.ts` supplies rendered anchors and solid footprints; `HQ_BOARD_APPROACH` also drives guidance and proximity.

| Item | X / Z | Placement reason |
|---|---|---|
| Hiring board | 0 / 5.78 | Centered; enlarged to 3.11 units wide; four postings scaled and aligned with board |
| Sofa | 4.85 / 4.8 | Back toward back wall, faces lounge/entry |
| Coffee table | 4.85 / 2.85 | In front of sofa, tea/book on measured 0.624 tabletop |
| Lounge chair | 6.55 / 1.15 | Angled toward sofa/table |
| Reading lamp | 6.8 / 4.8 | Beside outside sofa arm; reduced from 2.42 to 1.74 units tall |
| Bookshelf | 7.7 / -1.3 | Back within 0.06 of side wall, shelves face inward |
| Reception | -5.2 / -2.4 | Separate entry-side work zone, desk lamp retained |
| Trophy cabinet | -4.5 / 5.2 | Back wall on opposite side of board from lounge |
| Clock | -7 / 5.55 | Against back wall; original proximity countdown retained |
| Plants | -7.2 / 3.2 and 7.25 / -4 | Side/corner accents outside main aisle |
| Pendants | 0 / 5.65 and 4.85 / 2.85 | Y4 ceiling anchors; one lights the board, one the lounge table; light just below original shade opening |

Removed the redundant reading table/two-seat cluster and two scattered floor lamps. The nonfunctional applicant admin door is hidden; member HQ retains its existing door. Upper applicant walls are pale sage `#d3dbca`, panels `#a1ae91`. Member furniture arrangement remains unchanged.

## Assets and reuse

- Existing imported sofa/table/tea/book, restored original bookshelf, clock, desk, chair, trophies, plants and floor lamp reused.
- `clubhouse-pendant.glb`: original `FtrLightSimpleCeiling.Nin_NX_NVN`, white `FtrLightSimpleCeilingReBody1`, 67,040 bytes.
- `lounge-rug.glb`: original `RugSquareSimpleM00.Nin_NX_NVN`, 287,992 bytes.
- Both imported with `scripts/prepare-hq-lamp.py`, original meshes/UVs and embedded source albedo; no generated replacement geometry. Source root `/Users/DavidLiu/Downloads/Assets/Model/`.
- Two added files total 355,032 bytes (347 KiB). Four local point lights replace six; no additional shadow maps/postprocessing passes. Existing cached directional shadows remain.
- Reused the improved `ToastHub`, CSS, `toastQueue` and six tests from `.claude/worktrees/restart-art-cohesion/web/` (read-only source). Applicant flower effects were already firing `tsi:toast` but lacked a mounted listener. Now pickup feedback reaches the existing accessible, bounded queue. UI uses existing light/dark variables.
- Existing fishing, flower burst/chime, seagulls, backpack, character animations and firefly systems retained.

## Interaction polish

Ground arrow is 58% of its former size, nearer the avatar and maximum opacity 0.30; it fades near the destination and stops guiding once the relevant first-visit task is done. Destination pointers are smaller; the floating board label disappears after the first read. Board papers gain a small hover lift/brightening with the actual system cursor; reduced motion disables scaling. Existing keyboard board access remains. Notification stack clears the interaction prompt and respects reduced motion; no new reward/economy mechanism.

## Validation

- TypeScript and focused ESLint: pass after final layout and fixture changes.
- Focused tests: 90 passing (12 applicant movement/shoreline, 68 grid, 4 surface blending, 6 reused notification queue).
- Movement coverage includes a two-unit-wide central route to board, clock approach, shelf approach, and sofa/table collisions.
- Dia evening visual pass caught overly stark black pendants; switched to original white remake and added original cream rug to anchor seating. Final screenshots/check results below.

### Final check evidence

- Final `npx tsc --noEmit` and focused ESLint pass. After the final pendant/label adjustment, the 18 directly affected movement/notification tests passed again; the 72 terrain tests passed in the earlier 90-test run.
- GLB audit: pendant 774 triangles, rug 294 triangles; both have original UV attributes and embedded PNG images.
- Dia: entered HQ, walked the clear center route, pressed E to open all four role postings, closed board. Evening lighting and night/dark appearance inspected. No current error-level browser logs.
- [Night clubhouse screenshot](references/lighting-2026-09-16/clubhouse-night-2026-09-17.jpg).
- Full production build, sustained FPS profiling, mobile gameplay and OS-level live theme switching were not tested in this pass. Existing deadline dates remain unset and unchanged.
- Clock side route verified in Dia: walking alongside the plant triggers the small above-clock overlay. With the current unset dates it correctly reads “Application dates coming soon.” [Clock screenshot](references/lighting-2026-09-16/clubhouse-clock-2026-09-17.jpg).
- Pickup notification queue is unit-tested and connected to the existing flower event; a fresh live flower pickup was not exercised in this pass.
