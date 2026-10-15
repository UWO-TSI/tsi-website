# Playtest round 1 (David, 2026-10-14) — row 309

David played v1 on the Mac mini using the Tethos v1 Playtest checklist. His notes are below verbatim, followed by the decisions he made in-session and the lanes that build them.

## David's notes (verbatim)
- **Underwater:** "I dislike how it looks like a poorly made animation, I want you to either recreate with real sceneces and assets or remove"
- **Reflection creator:** "the idea is good overall, but I want to rotate the overall ship and camera angle so that the face in water reflection is vertical and properly shows the face in the right oriendtation, and that the camera angle also gets a clip of their clothes so that they can change their shirt. I want you to delete a lot of the eye assets and clothes assets and also remove eyebrows. the new set of mouths are very good and i want to remove some of the old batch. the new hair howeveer is all overthe place, doesnt fit the character model at all ,and needs more work"
- **Faces:** "just remove some of the old face assets"
- **Hairs:** "hair is super messed up, does not fit head properly, I need ytou to either change hte headshape so that it universlly fits with roblox hair or do something about the hair so that you dont need to remodel each hair one by one and makes it look good like how they look origninally"
- **Crossing:** "looks good, but the tutorial will be done in the new map soon."
- **Walk-along:** "this will be done on the new map soon, so be ready for a redo. the dock movement is good, make it scattered with crate and barrel later on in the new map verions. dont teach to fish yet, make them walk with bram to the different maps, and rn the character getrs inn bram proxsimity and instantly triggers next point, but it should be he walks there with ! on his head. you talk to him, he tells you about the building. and goes to next spot, also have a todo misison ui top right listing what needs to be done for tutorial. and then bam leads you to the beach, gives you the rod and tells you tro give it a fish, then fishing tutorial. you start off with nothing in your tab bag. then bram tells you to press b to check what youve collected and that you can sell fish at the whatf fishing market. rare things can be placed in museum, and stuff can be sold in shop."
- **Title menu:** "looks goodf but some small ui stuff like drop down menu could get some work. make gear and wrench icon in the same gear settings, less clutter for setings and ui buttons. camera is a keybind and not button, sound will be in setting, so everythign is in setting and setting. i want it so that being in game the mouse is camera, they can press esc to see like ui item,s like map quest and some things plan this with me, and they can press esc again for settings and log out button"
- **Title auth:** "looks good, mostly ui development"
- **Water:** "water loops a lot better now, make the shallow water bigger area around main island. the sparkles in the distance sometimes gets folded in and you see 2x the sparkles like since the camera angle fdor it is kinda like a sphere"
- **Emote wheel:** "looks good but dont change the face when doing animations, keep it the same"
- **Pass:** controls, grass and light, night. The campfire couldn't be tested yet.

## Decisions (David, 2026-10-14)
1. **Hair fit.** Our head takes the Roblox head's shape where hair sits (top, back, sides). Every hair attaches at the same point and scale as in Roblox, so the hairs look like David's originals with zero per-hair remodelling. The face area stays ours. Undo the per-hair fringe cuts and refits.
2. **Underwater.** Removed for v1: the opening starts on Bram's boat. It gets rebuilt later from real assets or references David supplies.
3. **In-game controls and UI:**
   - **Mouse.** The mouse is the camera (pointer lock).
   - **HUD.** The quest mini tracker and the minimap stay visible on screen. Everything else leaves the HUD.
   - **First Esc.** Opens the menu: Map, Quests and journal, Bag and collection, Friends and mail.
   - **Second Esc.** Opens Settings and Log out.
   - **Settings.** The gear and wrench merge into one Settings. Sound lives in Settings.
   - **Photo.** Photo mode is a keybind (P), not a button.

   **HUD and Esc, approved** (David, 2026-10-14, on the `game/hud-esc` plan): "world not dimmer for esc1. so in game basically has game with minimal ui, like the quest, minimap, and time sun. and maybe mini health bar later when combat drops. esc1 just shows gear, bigger mini map, level, chat line mail settings etc. and the esc is like menu for log out and settings and login"
   - **In game (mouse locked):** only the quest tracker, the minimap and the time with its sun icon, top right. A slot under them is kept for a mini health bar when combat drops (nothing drawn yet).
   - **Esc 1, the UI view:** no pause and no dimming. The world keeps running and the cursor is free; the fuller UI shows over the live game:
     - a bigger minimap;
     - coins and the level;
     - the chat log;
     - the gear (Settings);
     - a dock of the menu entries: Map (M), Quests and journal (J), Bag (I) and Collection (B), Friends and Mail (L).
     A click on the world goes back to the game.
   - **Esc 2, the system menu:** Resume, Settings, and Log out (Sign in for a guest).
   - **Esc 3:** back to the game.
   - **Rooms:** Esc opens the same layers everywhere; you leave a room with E at its door.
   - **Sheets:** a sheet opened from Esc 1 (or from the system menu) closes back to it; a sheet opened by its key closes straight back to the game.
   - **Clicking someone under the lock:** a small dot sits centred just above your head. It turns into a ring with their name over a player or resident it can click: a player's card opens (the mouse is let go), a resident talks. E still interacts, and holding right click still frees a cursor.
   - **Touch:** one menu button toggles the UI view; there's no lock.
   - **Settings:** the gear and the wrench are one sheet, in tabs: Graphics, Sound, Controls, Account (Log out), and Dev (development builds only). The native dropdowns (Quality, Time) become the kit's segmented pills, and the title screen's Settings gets the same look.
4. **Asset prune.** A picker page shows every eye, mouth, face accent, face, eyebrow and clothing item as a picture. David ticks keep or remove, and the unticked ones are deleted. Eyebrows are removed regardless.
5. **Tutorial.** It's rebuilt as written in David's walk-along note, data-driven so it can move to the new map by swapping waypoints:
   - Bram walks to each stop with a "!" over his head. You talk to him (E), he tells you about the place, then he walks on.
   - A tutorial to-do list sits top right.
   - You start with an empty tool bag. At the beach Bram gives you the rod, and then comes the fishing tutorial.
   - Then he points you at B for the collection, the wharf fish market (the wharf shack) for selling fish, the museum for rare finds and the shop for everything else.

## Lanes
| Lane | Owns |
|---|---|
| `game/look-fixes` | a bigger shallow-water area round the main island; the doubled distant sparkle under the world bend; emotes keep the face unchanged |
| `game/tutorial-v2` | remove underwater; reflection creator camera and boat rotation (upright reflection, clothes in frame, shirt category); remove eyebrows; Bram tutorial v2 and the quest tracker component |
| `game/hud-esc` | pointer-lock mouse camera; the Esc menu layers; the HUD down to the quest tracker and minimap; merged Settings; photo on P; title and dropdown polish |
| `game/head-roblox` | the Roblox-compatible head (hair zone), hair attachment at Roblox's point and scale, per-hair edits reverted |
| `game/asset-thumbs` | thumbnails and a manifest of every face part, eyebrow and clothing item for the picker page |

## Wardrobe cut (David's picks in the Wardrobe Cut page, 2026-10-14)
The source is the artifact db at https://claude.ai/artifact/WfyWSpLEjV6Ekp7DCyNUTU (collection `picks`). The manifest and thumbnails are on branch `game/asset-thumbs` (`specs/picker/`).

**Cut:**
- **eyes:** E1.1, E1.2, E1.4, E1.6, E5.4, E5.5, E5.6, E6.1, E8.1, E8.4, F2.1, F2.2
- **mouths:** G1.1–G1.7, G2.1–G2.7, G3.1, G3.2, G3.4–G3.7, G4.1–G4.7, G5.1–G5.7, G6.1–G6.7, G7.1–G7.7, G8.1–G8.7, G9.1–G9.7, M2.1, M3.2, M4.2, M4.3, M5.2, M5.3, M6.1, M6.3, cat_w, grin_curl
- **tops:** outfit_silk_sweater (stays craft-only, see below)
- **bottoms:** onepiece_jumpsuit, onepiece_raincape, onepiece_raincape_hood, onepiece_robe, outfit_koi_kimono and outfit_monarch_cape (the last two stay craft-only)
- **accessories:** acc_beanie, acc_flower_crown (craft-only), acc_pumpkin_head, acc_scarf, acc_shell_necklace (craft-only), acc_vampire_cape
- **hair:** all 28 older bangs and backs. Hair is David's 21 only. ("hair honestly just import the new set and get rid of the old ones, refine head logic so it fits roblox hair logic but still looks like our style")
- **faces:** none cut. Accents: none cut.

**Follow-ups David decided:**
- **Halloween:** the pumpkin head and vampire cape are cut. "cut them ill import halloween clothing assets later". The closet keeps the witch hat and cat ears until his assets arrive.
- **Crafted items:** acc_flower_crown, acc_shell_necklace, outfit_koi_kimono, outfit_monarch_cape and outfit_silk_sweater stay craft-only. They leave the starting creator, but crafting and wearing them still work.
- **Jayden**, the applicant guide, gets new parts from the kept set. David explicitly OK'd this one edit to the recruitment island.
- **Residents, defaults and expressions** that used cut parts are re-assigned to kept parts, preferring David's new set. That covers the expressions sleepy, happy, sad and surprised, and the emote mouths for laugh, dance and cheer.

## Hair review and fidelity (David, 2026-10-14)
- **Fidelity (art direction):** "overall a lot of the hair shouldnt be so low poly and blocky, like should look closer to the reference rather than the game lowpoly model we were talking about, same with accessories and clothes, it should be simple but not completely low poly". In practice:
  - Hair: Full LOD keeps each original mesh with smooth normals, and only the distance LODs are decimated.
  - Clothes and accessories: smoothed the same way, with rounder silhouettes and smooth shading, while staying simple. That's a lane after the wardrobe cut.
- **Per-hair notes:**
  - #04 doesn't match the photo.
  - #05 sits sideways.
  - #08's visor splits off into its own accessory, with the "M" kept on it.
  - #10, #11, #15 and #16 sit slightly lower; #20 sits lower.
  - #12, #14, #17 and #18 are blocky and need to be curvy and smooth.
  - #19 is a cap worn backwards.
- Long hair length stays.

## Head, detail tiers and hair colour (David, 2026-10-14, after trying the 21 in the creator)
- **Detail by situation, not only by distance:** "i want high def when close up like for photo mode or clicking into profile, a medium when close in in combat and a low when zoomed out."
  - Full detail is used in photo mode, the profile and player card, and the creator.
  - Medium (LOD 1) is used in normal play, combat included.
  - Low (LOD 2) is used when the camera is zoomed out.
- **The head still doesn't fit the Roblox hair:** "hair dips weird, weird spots of scalp is showing, headshape overall a little weird, face doesnt have to be flat, a little to rectangley".
  - David keeps our own head ("Keep tuning our head") but wants it rounder and less rectangular, with a face that isn't flat.
  - No hair should dip oddly, and no scalp should show through the partings.
- **Hair colour:** "needs more choices like color wheel picker, doesnt need to reset all hair color option cuz it lags whenever changing hair color, also some hair color is glitching and being weird".
  - Add a colour wheel for custom colours next to the presets.
  - Changing the colour must not re-render every hair thumbnail, and must not lag.
  - Fix the glitchy colours: the near-black source textures turn into high-contrast streaks.
- Also seen in his screenshots: hair thumbnails load slowly as blank tiles, and the hair still looks faceted at full detail in the creator.
