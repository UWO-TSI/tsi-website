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
