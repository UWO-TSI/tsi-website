# study-world: open questions for David

## 2026-09-26 (study-world agent, branch `game/study-world`)

Each item says what I assumed so the work kept moving. Evidence: `specs/evidence/study-world/Y-*.webp`.

1. **When walking away ends a session.** Pressing WASD stands you up. Inside 1.6 units of the seat the session keeps running and the prompt offers "Sit back down". Past 1.6 units it ends and pays the whole focus minutes. Changing scene after sitting (for example "Return to clearing") also counts as walking away. *Assumed:* this is lenient enough that an accidental keypress doesn't lose a block, and still matches row 80.
2. **Sessions started on another device.** The 3D world only ends a session that this client seated. A session running on the phone companion shows its timer card on the laptop and never ends because the avatar is somewhere else. If you walk to that seat, the prompt says "Sit back down". If a live session's seat is in the scene you load into, the avatar is put in it automatically. *Assumed.*
3. **Seat-mates are stand-ins.** There's no multiplayer yet, so other studiers show as resident sprites at their seats, with first name and countdown overhead. They bob during breaks as a placeholder stretch. The player's own sprite isn't animated: `studyPose()` in `lib/study/worldStore.ts` gives the character runtime `sit | study | stretch` and the seat's facing for the rigged Sit/Study clips.
4. **Two outdoor tables, not three.** The backend seeds exactly two (`plaza-picnic`, `pier-bench`), and a third would need a migration change. The plaza table sits on the east wing of the plaza. The pier table is on the beach west of the wharf, next to a beach chair and parasol. Want a pond table as well?
5. **Café layout is a placeholder.** It's an 18 × 12 room with warm wood, two windows over the window tables, bookshelves by the "Bookshelf table", a couch corner, plants and a floor lamp. I also added a counter with a barista (the HQ keeper figure) so the room isn't empty. Your interior design only needs new coordinates in `lib/study/seats.ts` (tables, facing, furniture kind) and the room shell in `components/game/study/CafeInterior.tsx`.
6. **Four-seat tables with sprites.** Under the steep interior camera, the back row sits partly behind the front row's sprites (`Y-cafe-four-seat-focus`). The rigged low-poly characters should fix this. If they don't, the four-seat tables could turn 90°.
7. **The grey box by the shop was the fitting room.** It's the wardrobe's "Try on outfits" station, and it shipped with its grey variant-0 remake textures. I swapped in the dump's light-wood body (ReBody1) and red curtain (ReFabric5) and turned the curtain toward the camera. Other variants: ReBody 2–4 are darker woods, 5–7 are blue, pink and teal; ReFabric 1–7 are purple, charcoal, butter, pink, red, mint and sky.
8. **Prompt priority.** The plaza table is within fishing reach of the river, so near a seat (or while seated) the Sit prompt replaces "Cast your line". *Assumed:* the seat wins because fishing/foraging is already the lowest-priority prompt.
9. **Private table.** Only the seated host sees the toggle, on the timer card. Outsiders see "Private table" above the table and get no Sit prompt, per row 168 (private shows occupied).
10. **HUD placement.** The start sheet opens beside the seated avatar. The timer card and table chat sit in the left column under the Journal button. On short laptop screens (under about 760 px tall) the column overlaps the minimap. OK for now?

## Coordinator rulings (2026-09-26, David delegated routine calls)
1. Walk-away at 1.6 units with "Sit back down": accepted.
2. Cross-device sessions as described: accepted.
3. Seat-mate stand-ins and `studyPose()` for the rig: accepted; the character agent wires the Sit/Study clips.
4. Two outdoor tables are enough for v1; add a pond table only if members ask.
5. Placeholder cafe accepted until David's interior design arrives.
6. Four-seat crowding: revisit after the rigged characters land; rotate tables only if still crowded.
7. Fitting room textures: accepted.
8. Seat prompt outranks fishing: accepted.
9. Private table behaviour: accepted.
10. Short screens: the timer card and chat must not cover the minimap; collapse the timer card to a single line under 760 px height (small follow-up, next agent touching the HUD).

## 2026-09-26 (study × character integration, branch `game/study-character`)

Evidence: `specs/evidence/study-character/S-*.webp` and `sql-smoke.md`. Each item gives the assumption I built on.

1. **Stretch is a stand-in clip.** No Blender stretch exists yet. Stretch uses Sit's hips and legs with Cheer's arms, neck and head, slowed to Sit's 2 s loop. It plays as arms up behind the head and back down, once per loop (`S-four-seat-break`, Jordan). *Assumed* good enough until a real clip lands: add "Stretch" to the catalogue and delete the `DERIVED_CLIPS` entry in `lib/game/character/clips.ts`.
2. **Seat heights are measured from the GLBs.** Study chair 0.52, sofa cushion 0.78, bench-wood slats 0.5, bed comforter 0.58. Seats pass the height through `tsi:sit`, and the engine subtracts the clip's own seat height. The `seatY` per furniture lives in `lib/study/seats.ts`, so David's interior only needs a new number if the furniture changes.
3. **`tsi:sit` with a clip at your own seat now re-poses instead of standing you up.** That's how Study, Stretch and Sit swap as the phase changes. Without a clip it still toggles, so E on the same bench stands you up. The interior walker (the bed) still toggles: E in bed wakes you.
4. **Seat-mates' looks.** The study service reads `profiles.avatar_config.look` for anyone seated and sends it with the table view. Members without a saved look (and the signed-out demo) get a fixed random look seeded from their member id. A look is visible in the world anyway, so sending it to table-mates exposes nothing new.
5. **Four-seat crowding (ruling 6): not rotated.** With rigged characters the back row is no longer hidden behind the front row. What still covered the back-row faces was your own timer at 2.4 units, so it now sits just above your nameplate (2.05). Labels no longer overlap. The front row is seen from behind, which a 90° turn would only trade for profile views. Say if you still want the tables turned.
6. **Benches.** Both village bench-wood props are sittable. You sit in the middle, facing the side you came from; one person per bench. To stand up you walk off the bench footprint, because movement only refuses steps that lose clearance.
7. **Dig.** Nothing in the codebase dug before. Dig now follows the roster's `tool: "shovel"`: rocks ("Strike the rock") and the asari clam play Dig and face the spot. The clam shows as a dark dig spot on the sand ("Dig it up") and goes through the existing collect path. No new node type. *Assumed* that a shovel strike on rocks should play Dig too.
8. **Bed.** Every home bed is an E station ("Sleep in your bed") that works from either end of the bed. The prompt text stays the same while you're asleep.
9. **Migration.** I used 004's definition (`jsonb not null default '{}'`) rather than a nullable column, so production matches the files. The grant is re-run in the same migration.
10. **Short screens (ruling 10).** Under 760 px tall the timer card is one line: phase, clock, Break/Skip and Stand up. Hidden on short screens: banked minutes and coins, the walk-away note, the chat toggle and the host's private-table toggle. With the minimap open, the column stops above it (chat scrolls in what's left). In the café there's no minimap, so chat gets the full column. *Assumed* hiding the two toggles on short screens is OK; an expand chevron would bring them back.

## Coordinator rulings on the integration assumptions (2026-09-26)
All ten accepted. A real Blender `Stretch` clip joins the art backlog (next character-art pass).
